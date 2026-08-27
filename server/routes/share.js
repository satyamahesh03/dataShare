const express = require('express');
const router = express.Router();
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');
const { optionalAuth, requireAuth, isPremium, getMaxUploadBytes } = require('../utils/auth');

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
});
const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;

// Generate a unique 5-digit code
function generateCode() {
    return Math.floor(10000 + Math.random() * 90000).toString();
}

// POST /api/share/upload-url — Generate presigned upload URLs for S3
router.post('/upload-url', optionalAuth, async (req, res) => {
    try {
        const { files } = req.body;
        if (!files || !Array.isArray(files) || files.length === 0) {
            return res.status(400).json({ error: 'Files array is required' });
        }

        const totalSize = files.reduce((sum, f) => sum + (Number(f.fileSize) || 0), 0);
        const maxBytes = getMaxUploadBytes(req.user);
        if (totalSize > maxBytes) {
            const limitLabel = isPremium(req.user) ? '1GB' : '50MB';
            return res.status(403).json({
                error: `File size exceeds the ${limitLabel} limit`,
                maxBytes,
                upgradeRequired: !isPremium(req.user),
            });
        }

        const uploadUrls = [];
        for (let i = 0; i < files.length; i++) {
            const { fileName, fileType } = files[i];
            const sanitizedName = (fileName || 'unnamed_file').replace(/[^a-zA-Z0-9.-]/g, '_');
            const publicId = `req_${Date.now()}_${i}_${sanitizedName}`;

            const command = new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: publicId,
                ContentType: fileType || 'application/octet-stream',
            });

            const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
            uploadUrls.push({
                uploadUrl,
                publicId,
                fileName,
                fileType,
            });
        }

        res.json({ uploadUrls });
    } catch (err) {
        console.error('Presigned upload URL error:', err);
        res.status(500).json({ error: 'Failed to generate upload URLs' });
    }
});

// POST /api/share/create — Create a new share
router.post('/create', optionalAuth, async (req, res) => {
    try {
        const { type, textContent, files: filesArray, fileName, fileData, fileType, fileSize, expiryMinutes, password, burstShare } = req.body;

        if (!type || !expiryMinutes) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Validate expiry (1 min to 1440 min = 24 hrs, or 43200 min = 30 days for premium)
        const maxExpiry = isPremium(req.user) ? 43200 : 1440;
        const expiry = Math.min(Math.max(parseInt(expiryMinutes), 1), maxExpiry);

        // Generate unique code
        let code;
        let attempts = 0;
        const db = req.db;
        const collection = db.collection('shares');

        while (attempts < 10) {
            code = generateCode();
            const existing = await collection.findOne({ code });
            if (!existing) break;
            attempts++;
        }

        if (attempts >= 10) {
            return res.status(500).json({ error: 'Failed to generate unique code' });
        }

        // Build share document
        const now = new Date();
        const expiresAt = new Date(now.getTime() + expiry * 60 * 1000);

        const shareDoc = {
            code,
            type,
            createdAt: now,
            expiresAt,
            expiryMinutes: expiry,
            hasPassword: false,
            burstShare: false,
            opened: false,
        };

        if (req.user) {
            shareDoc.userId = req.user._id;
            shareDoc.ownerEmail = req.user.email;
        }

        if (burstShare) {
            if (!isPremium(req.user)) {
                return res.status(403).json({
                    error: 'Burst share is a Premium feature',
                    upgradeRequired: true,
                });
            }
            shareDoc.burstShare = true;
        }

        // Hash password if provided
        if (password && password.trim()) {
            shareDoc.password = await bcrypt.hash(password.trim(), 10);
            shareDoc.hasPassword = true;
        }

        // Handle text share
        if (type === 'text') {
            if (!textContent || !textContent.trim()) {
                return res.status(400).json({ error: 'Text content is required' });
            }
            shareDoc.textContent = textContent;
        }

        // Handle file share — support both direct-to-S3 and legacy base64
        if (type === 'file') {
            let filesToUpload = [];
            if (filesArray && Array.isArray(filesArray)) {
                filesToUpload = filesArray;
            } else if (fileData) {
                filesToUpload = [{ fileData, fileName, fileType, fileSize }];
            }

            if (filesToUpload.length === 0) {
                return res.status(400).json({ error: 'At least one file is required' });
            }

            const totalSize = filesToUpload.reduce((sum, f) => sum + (Number(f.fileSize) || 0), 0);
            const maxBytes = getMaxUploadBytes(req.user);
            if (totalSize > maxBytes) {
                const limitLabel = isPremium(req.user) ? '1GB' : '50MB';
                return res.status(403).json({
                    error: `File size exceeds the ${limitLabel} limit`,
                    maxBytes,
                    upgradeRequired: !isPremium(req.user),
                });
            }

            const uploadedFiles = [];
            try {
                for (let index = 0; index < filesToUpload.length; index++) {
                    const f = filesToUpload[index];

                    if (f.publicId && !f.fileData) {
                        // File was uploaded directly to S3 via presigned URL
                        const fileUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${f.publicId}`;
                        uploadedFiles.push({
                            fileUrl: fileUrl,
                            filePublicId: f.publicId,
                            fileName: f.fileName || 'unnamed_file',
                            fileType: f.fileType || 'application/octet-stream',
                            fileSize: f.fileSize || 0,
                            cloudinaryResourceType: 's3',
                        });
                    } else if (f.fileData) {
                        // Legacy handling: backend S3 upload from base64
                        const base64Data = f.fileData.replace(/^data:.*?;base64,/, '');
                        const buffer = Buffer.from(base64Data, 'base64');
                        const sanitizedName = (f.fileName || 'unnamed_file').replace(/[^a-zA-Z0-9.-]/g, '_');
                        const publicId = `${code}_${Date.now()}_${index}_${sanitizedName}`;

                        const command = new PutObjectCommand({
                            Bucket: BUCKET_NAME,
                            Key: publicId,
                            Body: buffer,
                            ContentType: f.fileType || 'application/octet-stream',
                        });

                        await s3Client.send(command);
                        const fileUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${publicId}`;

                        uploadedFiles.push({
                            fileUrl: fileUrl,
                            filePublicId: publicId,
                            fileName: f.fileName || 'unnamed_file',
                            fileType: f.fileType || 'application/octet-stream',
                            fileSize: f.fileSize || buffer.length,
                            cloudinaryResourceType: 's3',
                        });
                    }
                }

                shareDoc.files = uploadedFiles;

                // Keep backward-compatible single-file fields for the first file
                if (uploadedFiles.length > 0) {
                    shareDoc.fileUrl = uploadedFiles[0].fileUrl;
                    shareDoc.filePublicId = uploadedFiles[0].filePublicId;
                    shareDoc.fileName = uploadedFiles[0].fileName;
                    shareDoc.fileType = uploadedFiles[0].fileType;
                    shareDoc.fileSize = uploadedFiles[0].fileSize;
                    shareDoc.cloudinaryResourceType = uploadedFiles[0].cloudinaryResourceType;
                }
            } catch (uploadErr) {
                console.error('S3 upload error:', uploadErr);
                return res.status(500).json({ error: 'File upload validation failed' });
            }
        }

        // Insert into MongoDB
        await collection.insertOne(shareDoc);

        // Increment global stats counter
        await db.collection('app_stats').updateOne(
            { _id: 'global' },
            { $inc: { totalPublished: 1 } },
            { upsert: true }
        );

        res.status(201).json({
            success: true,
            code: shareDoc.code,
            expiresAt: shareDoc.expiresAt,
            expiryMinutes: shareDoc.expiryMinutes,
            type: shareDoc.type,
            hasPassword: shareDoc.hasPassword,
            burstShare: !!shareDoc.burstShare,
        });
    } catch (err) {
        console.error('Create share error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/share/lookup/:code — Check if share exists & if password is required
router.get('/lookup/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const db = req.db;
        const searchCode = code.trim();
        const share = await db.collection('shares').findOne({ 
            $or: [{ code: searchCode }, { customSlug: searchCode }] 
        });

        if (!share) {
            return res.status(404).json({ error: 'Share not found or has expired' });
        }

        // Check if expired
        if (new Date() > new Date(share.expiresAt)) {
            return res.status(404).json({ error: 'Share has expired' });
        }

        if (share.burstShare && share.opened) {
            return res.status(410).json({ error: 'This one-time share has already been opened' });
        }

        res.json({
            exists: true,
            type: share.type,
            hasPassword: share.hasPassword,
            expiresAt: share.expiresAt,
            createdAt: share.createdAt,
            burstShare: !!share.burstShare,
        });
    } catch (err) {
        console.error('Lookup error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/share/stats — Get total items published across all types
router.get('/stats', async (req, res) => {
    try {
        const db = req.db;
        const stats = await db.collection('app_stats').findOne({ _id: 'global' });
        let count = 0;

        if (stats && stats.totalPublished !== undefined) {
            count = stats.totalPublished;
        } else {
            // Seed the counter with current existing documents if it doesn't exist yet
            const totalShares = await db.collection('shares').countDocuments();
            const totalSecure = await db.collection('secure_messages').countDocuments();
            count = totalShares + totalSecure;

            await db.collection('app_stats').updateOne(
                { _id: 'global' },
                { $set: { totalPublished: count } },
                { upsert: true }
            );
        }

        res.json({ totalPublished: count });
    } catch (err) {
        console.error('Stats error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/share/download-url — Generate a time-limited AWS S3 download link that forces an attachment
router.get('/download-url', async (req, res) => {
    try {
        const { key, name } = req.query;
        if (!key) return res.status(400).json({ error: 'Missing S3 key' });

        const originalName = name || 'download';
        // Create an ASCII-safe filename by replacing non-ASCII & problematic chars
        const safeName = originalName
            .replace(/[\u2018\u2019]/g, "'")   // smart single quotes → ASCII apostrophe
            .replace(/[\u201C\u201D]/g, '"')    // smart double quotes → ASCII double quote (will be stripped next)
            .replace(/[^\x20-\x7E]/g, '_')     // replace any remaining non-ASCII with underscore
            .replace(/"/g, "'");                // replace double quotes (they break the header value)

        // Build Content-Disposition with both ASCII fallback and UTF-8 encoded original
        const utf8Name = encodeURIComponent(originalName);
        const disposition = `attachment; filename="${safeName}"; filename*=UTF-8''${utf8Name}`;

        const command = new GetObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: key,
            ResponseContentDisposition: disposition,
        });

        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        res.json({ url: signedUrl });
    } catch (err) {
        console.error('Presigner error:', err);
        res.status(500).json({ error: 'Failed to generate download URL' });
    }
});

// POST /api/share/access/:code — Access share content (with optional pw)
router.post('/access/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const { password } = req.body;
        const db = req.db;
        const searchCode = code.trim();
        const share = await db.collection('shares').findOne({ 
            $or: [{ code: searchCode }, { customSlug: searchCode }] 
        });

        if (!share) {
            return res.status(404).json({ error: 'Share not found or has expired' });
        }

        // Check if expired
        if (new Date() > new Date(share.expiresAt)) {
            return res.status(404).json({ error: 'Share has expired' });
        }

        if (share.burstShare && share.opened) {
            return res.status(410).json({ error: 'This one-time share has already been opened' });
        }

        // Check password if required
        if (share.hasPassword) {
            if (!password) {
                return res.status(401).json({ error: 'Password required', hasPassword: true });
            }
            const valid = await bcrypt.compare(password, share.password);
            if (!valid) {
                return res.status(401).json({ error: 'Incorrect password' });
            }
        }

        // Return content
        const response = {
            code: share.code,
            type: share.type,
            createdAt: share.createdAt,
            expiresAt: share.expiresAt,
            expiryMinutes: share.expiryMinutes,
            burstShare: !!share.burstShare,
        };

        if (share.type === 'text') {
            response.textContent = share.textContent;
        } else if (share.type === 'file') {
            const filesArray = share.files || [{
                fileUrl: share.fileUrl,
                filePublicId: share.filePublicId,
                fileName: share.fileName,
                fileType: share.fileType,
                fileSize: share.fileSize,
            }];

            // Generate presigned URLs for viewing to avoid AccessDenied if bucket is private
            const resolvedFiles = await Promise.all(filesArray.map(async (file) => {
                if (file.filePublicId) {
                    try {
                        const command = new GetObjectCommand({
                            Bucket: process.env.AWS_S3_BUCKET_NAME,
                            Key: file.filePublicId,
                        });
                        file.fileUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
                    } catch (e) {
                        console.error('Error generating presigned view URL:', e);
                    }
                }
                return file;
            }));

            response.fileUrl = resolvedFiles[0]?.fileUrl;
            response.fileName = share.fileName;
            response.fileType = share.fileType;
            response.fileSize = share.fileSize;
            response.files = resolvedFiles;
        }

        if (share.burstShare) {
            const claimed = await db.collection('shares').findOneAndUpdate(
                { _id: share._id, opened: { $ne: true } },
                { $set: { opened: true, openedAt: new Date() } }
            );
            if (!claimed) {
                return res.status(410).json({ error: 'This one-time share has already been opened' });
            }
        }

        res.json(response);
    } catch (err) {
        console.error('Access error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/share/mine — Logged-in user's shares (synced across devices)
router.get('/mine', requireAuth, async (req, res) => {
    try {
        const now = new Date();
        const shares = await req.db.collection('shares')
            .find(
                { userId: req.user._id, expiresAt: { $gt: now } },
                {
                    projection: {
                        password: 0,
                        fileData: 0,
                        filePublicId: 0,
                    }
                }
            )
            .sort({ createdAt: -1 })
            .toArray();

        res.json({
            shares: shares.map((share) => ({
                code: share.code,
                type: share.type,
                createdAt: share.createdAt,
                expiresAt: share.expiresAt,
                hasPassword: share.hasPassword,
                burstShare: !!share.burstShare,
                opened: !!share.opened,
                fileName: share.fileName,
                fileSize: share.fileSize,
            })),
        });
    } catch (err) {
        console.error('Mine shares error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/share/active — List all active (non-expired) shares
router.get('/active', async (req, res) => {
    try {
        const db = req.db;
        const now = new Date();
        const shares = await db.collection('shares')
            .find(
                { expiresAt: { $gt: now } },
                {
                    projection: {
                        password: 0,
                        fileData: 0,
                        filePublicId: 0,
                    }
                }
            )
            .sort({ createdAt: -1 })
            .toArray();

        res.json({ shares });
    } catch (err) {
        console.error('Active shares error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/share/increment — Increment global share count manually (for P2P)
router.post('/increment', async (req, res) => {
    try {
        const db = req.db;
        const { count } = req.body;

        // Default to increment by 1, but allow bulk increment if multiple files sent
        const incVal = (count && Number.isInteger(count) && count > 0) ? count : 1;

        await db.collection('app_stats').updateOne(
            { _id: 'global' },
            { $inc: { totalPublished: incVal } },
            { upsert: true }
        );

        res.json({ success: true });
    } catch (err) {
        console.error('Increment stats error:', err);
        // Don't fail the client request if stats fail, just log it
        res.json({ success: false, error: 'Stats update failed' });
    }
});

// PUT /api/share/:code/custom — Update custom slug for premium users
router.put('/:code/custom', requireAuth, async (req, res) => {
    try {
        if (!isPremium(req.user)) {
            return res.status(403).json({ error: 'Custom links are a Premium feature' });
        }

        const { code } = req.params;
        const { customSlug } = req.body;
        
        if (!customSlug || typeof customSlug !== 'string' || customSlug.trim() === '') {
            return res.status(400).json({ error: 'Valid custom link is required' });
        }

        const formattedSlug = customSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');

        if (formattedSlug.length < 3 || formattedSlug.length > 50) {
            return res.status(400).json({ error: 'Custom link must be between 3 and 50 characters' });
        }

        const db = req.db;
        const collection = db.collection('shares');

        // Check if the slug is already taken by a non-expired share
        const existing = await collection.findOne({
            $or: [{ code: formattedSlug }, { customSlug: formattedSlug }],
            expiresAt: { $gt: new Date() }
        });

        if (existing && existing.code !== code) {
            return res.status(409).json({ error: 'This custom link is already taken' });
        }

        const result = await collection.updateOne(
            { code: code, userId: req.user._id },
            { $set: { customSlug: formattedSlug } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Share not found or you do not have permission to edit it' });
        }

        res.json({ success: true, customSlug: formattedSlug, code: code });
    } catch (err) {
        console.error('Update custom link error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
