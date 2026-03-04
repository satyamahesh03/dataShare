const express = require('express');
const router = express.Router();
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
});
const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;

// Generate a unique 6-char code (no ambiguous chars)
function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

// POST /api/share/create — Create a new share
router.post('/create', async (req, res) => {
    try {
        const { type, textContent, files: filesArray, fileName, fileData, fileType, fileSize, expiryMinutes, password } = req.body;

        if (!type || !expiryMinutes) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Validate expiry (1 min to 1440 min = 24 hrs)
        const expiry = Math.min(Math.max(parseInt(expiryMinutes), 1), 1440);

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
        };

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

        // Handle file share — upload to Cloudinary (supports multiple files)
        if (type === 'file') {

            // Build array of files to upload (support both old single-file and new multi-file format)
            let filesToUpload = [];
            if (filesArray && Array.isArray(filesArray)) {
                filesToUpload = filesArray;
            } else if (fileData) {
                filesToUpload = [{ fileData, fileName, fileType, fileSize }];
            }

            if (filesToUpload.length === 0) {
                return res.status(400).json({ error: 'At least one file is required' });
            }

            const uploadedFiles = [];
            try {
                for (let index = 0; index < filesToUpload.length; index++) {
                    const f = filesToUpload[index];

                    // Convert base64 payload to binary Buffer for S3
                    const base64Data = f.fileData.replace(/^data:.*?;base64,/, '');
                    const buffer = Buffer.from(base64Data, 'base64');

                    // Sanitize file name for friendly S3 URL (only valid URL chars)
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
                        filePublicId: publicId, // S3 key
                        fileName: f.fileName || 'unnamed_file',
                        fileType: f.fileType || 'application/octet-stream',
                        fileSize: f.fileSize || buffer.length,
                        // keeping field name for backward compatibility below
                        cloudinaryResourceType: 's3',
                    });
                }

                shareDoc.files = uploadedFiles;

                // Keep backward-compatible single-file fields for the first file
                shareDoc.fileUrl = uploadedFiles[0].fileUrl;
                shareDoc.filePublicId = uploadedFiles[0].filePublicId;
                shareDoc.fileName = uploadedFiles[0].fileName;
                shareDoc.fileType = uploadedFiles[0].fileType;
                shareDoc.fileSize = uploadedFiles[0].fileSize;
                shareDoc.cloudinaryResourceType = uploadedFiles[0].cloudinaryResourceType;
            } catch (uploadErr) {
                console.error('S3 upload error:', uploadErr);
                return res.status(500).json({ error: 'File upload failed' });
            }
        }

        // Insert into MongoDB
        await collection.insertOne(shareDoc);

        res.status(201).json({
            success: true,
            code: shareDoc.code,
            expiresAt: shareDoc.expiresAt,
            expiryMinutes: shareDoc.expiryMinutes,
            type: shareDoc.type,
            hasPassword: shareDoc.hasPassword,
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
        const share = await db.collection('shares').findOne({ code: code.trim() });

        if (!share) {
            return res.status(404).json({ error: 'Share not found or has expired' });
        }

        // Check if expired
        if (new Date() > new Date(share.expiresAt)) {
            return res.status(404).json({ error: 'Share has expired' });
        }

        res.json({
            exists: true,
            type: share.type,
            hasPassword: share.hasPassword,
            expiresAt: share.expiresAt,
            createdAt: share.createdAt,
        });
    } catch (err) {
        console.error('Lookup error:', err);
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
        const share = await db.collection('shares').findOne({ code: code.trim() });

        if (!share) {
            return res.status(404).json({ error: 'Share not found or has expired' });
        }

        // Check if expired
        if (new Date() > new Date(share.expiresAt)) {
            return res.status(404).json({ error: 'Share has expired' });
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
        };

        if (share.type === 'text') {
            response.textContent = share.textContent;
        } else if (share.type === 'file') {
            response.fileUrl = share.fileUrl;
            response.fileName = share.fileName;
            response.fileType = share.fileType;
            response.fileSize = share.fileSize;
            response.files = share.files || [{
                fileUrl: share.fileUrl,
                fileName: share.fileName,
                fileType: share.fileType,
                fileSize: share.fileSize,
            }];
        }

        res.json(response);
    } catch (err) {
        console.error('Access error:', err);
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

module.exports = router;
