const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config(); // Load ENV as early as possible

const { MongoClient } = require('mongodb');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const cloudinary = require('cloudinary').v2;
const cron = require('node-cron');
const shareRoutes = require('./routes/share');
const secureRoutes = require('./routes/secure');

const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const PORT = process.env.PORT || 6500;

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: '*' },
    maxHttpBufferSize: 1e8 // 100 MB max for huge signals if needed
});

io.on('connection', (socket) => {
    // Basic WebRTC Signaling
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
    });

    socket.on('receiver-joined', (roomId) => {
        socket.to(roomId).emit('receiver-joined');
    });

    socket.on('offer', (data) => {
        socket.to(data.roomId).emit('offer', data);
    });

    socket.on('answer', (data) => {
        socket.to(data.roomId).emit('answer', data);
    });

    socket.on('ice-candidate', (data) => {
        socket.to(data.roomId).emit('ice-candidate', data);
    });

    socket.on('transfer-complete', (roomId) => {
        socket.to(roomId).emit('transfer-complete');
    });

    // Verify room existence before joining
    socket.on('check-room', (roomId, callback) => {
        const room = io.sockets.adapter.rooms.get(roomId);
        // Room must exist and have at least one client (the sender)
        const exists = room && room.size > 0;
        callback({ active: exists });
    });
});

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1024mb' }));
app.use(express.urlencoded({ extended: true, limit: '1024mb' }));

// Cloudinary config
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// S3 config
const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
});
const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;

// MongoDB connection
let db;
async function connectDB() {
    try {
        const client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        db = client.db('datashare');

        // Drop the old TTL index (we handle deletion ourselves now)
        try {
            await db.collection('shares').dropIndex('expiresAt_1');
            console.log('🗑️  Removed old TTL index (cron handles cleanup now)');
        } catch (e) {
            // Index might not exist, that's fine
        }

        // Create unique index on code
        await db.collection('shares').createIndex(
            { code: 1 },
            { unique: true }
        );

        // Drop old code index if it exists (no longer needed)
        try {
            await db.collection('secure_messages').dropIndex('code_1');
        } catch (e) { /* index might not exist, ignore */ }

        // TTL index for auto-deleting expired messages
        await db.collection('secure_messages').createIndex(
            { expiresAt: 1 },
            { expireAfterSeconds: 0 }
        );

        console.log('✅ Connected to MongoDB');

        // Start cleanup cron job
        startCleanupJob();
    } catch (err) {
        console.error('❌ MongoDB connection failed:', err);
        process.exit(1);
    }
}

// Cleanup cron: runs every 30 seconds
function startCleanupJob() {
    // Run every 30 seconds for faster cleanup
    cron.schedule('*/30 * * * * *', async () => {
        try {
            const now = new Date();
            const collection = db.collection('shares');

            // Find ALL expired shares
            const expiredShares = await collection.find({
                expiresAt: { $lte: now }
            }).toArray();

            if (expiredShares.length === 0) return;

            console.log(`\n🧹 Found ${expiredShares.length} expired share(s)...`);

            // Delete Cloudinary files for file shares
            for (const share of expiredShares) {
                if (share.type === 'file') {
                    // Collect all file public IDs to delete
                    const filesToDelete = share.files
                        ? share.files.map(f => ({ publicId: f.filePublicId, resourceType: f.cloudinaryResourceType || 'image' }))
                        : share.filePublicId
                            ? [{ publicId: share.filePublicId, resourceType: share.cloudinaryResourceType || 'image' }]
                            : [];

                    for (const { publicId, resourceType } of filesToDelete) {
                        try {
                            // Detect if the file is an S3 object based on the resource type flag we set in create handler
                            if (resourceType === 's3' || share.cloudinaryResourceType === 's3') {
                                await s3Client.send(new DeleteObjectCommand({
                                    Bucket: BUCKET_NAME,
                                    Key: publicId
                                }));
                                console.log(`  ✓ S3: deleted object ${publicId} → ok`);
                            } else {
                                // Fallback to Cloudinary for strictly backward compatible objects
                                const result = await cloudinary.uploader.destroy(publicId, {
                                    resource_type: resourceType
                                });
                                console.log(`  ✓ Cloudinary: deleted ${publicId} (${resourceType}) → ${result.result}`);

                                if (result.result === 'not found') {
                                    const otherTypes = ['image', 'video', 'raw'].filter(t => t !== resourceType);
                                    for (const altType of otherTypes) {
                                        const altResult = await cloudinary.uploader.destroy(publicId, {
                                            resource_type: altType
                                        });
                                        if (altResult.result === 'ok') {
                                            console.log(`  ✓ Cloudinary: deleted with alt type ${altType}`);
                                            break;
                                        }
                                    }
                                }
                            }
                        } catch (cloudErr) {
                            console.error(`  ✕ Cloudinary error for ${publicId}:`, cloudErr.message);
                        }
                    }
                }
            }

            // Delete all expired docs from MongoDB
            const deleteResult = await collection.deleteMany({ expiresAt: { $lte: now } });
            console.log(`  ✓ MongoDB: removed ${deleteResult.deletedCount} expired share(s)`);

        } catch (err) {
            console.error('❌ Cleanup error:', err.message);
        }
    });

    console.log('🔄 Cleanup cron started (runs every 30 seconds)');
}

// Make db accessible to routes
app.use((req, res, next) => {
    req.db = db;
    next();
});

// Routes
app.use('/api/share', shareRoutes);
app.use('/api/secure', secureRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
connectDB().then(() => {
    httpServer.listen(PORT, () => {
        console.log(`🚀 DataShare server running on http://localhost:${PORT}`);
    });
});
