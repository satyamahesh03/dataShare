const express = require('express');
const crypto = require('crypto');

const router = express.Router();

const ALG = 'aes-256-ctr';
const SALT_LEN = 8;

// ─── ENCRYPT ───────────────────────────────────────────────
// Takes: { text, password }
// Returns: { encryptedMessage }  — a compact base64 string
router.post('/encrypt', async (req, res) => {
    try {
        const { text, password, expiryHours = 24 } = req.body;
        if (!text || !password) {
            return res.status(400).json({ error: 'Text and password are required' });
        }

        // Generate a random salt and IV
        const salt = crypto.randomBytes(SALT_LEN);
        const iv = crypto.randomBytes(16);

        // Derive a 32-byte AES key from the password + salt
        const key = crypto.scryptSync(password, salt, 32);

        // Encrypt the text (CTR mode = no padding, output matches input length)
        const cipher = crypto.createCipheriv(ALG, key, iv);
        const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);

        // Combine salt(8) + iv(16) + ciphertext into one buffer, then base64url encode
        const combined = Buffer.concat([salt, iv, encrypted]);
        const encryptedMessage = combined.toString('base64url');

        // Also store in MongoDB (encrypted + hashed password)
        const db = req.db;
        const collection = db.collection('secure_messages');

        const hashedPassword = crypto.scryptSync(password, salt.toString('hex'), 64).toString('hex');

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + parseInt(expiryHours));

        await collection.insertOne({
            encryptedMessage,
            hashedPassword,
            expiresAt,
            createdAt: new Date()
        });

        // Increment global stats counter
        await db.collection('app_stats').updateOne(
            { _id: 'global' },
            { $inc: { totalPublished: 1 } },
            { upsert: true }
        );

        res.json({ encryptedMessage });

    } catch (error) {
        console.error('Encrypt Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ─── DECRYPT ───────────────────────────────────────────────
// Takes: { encryptedMessage, password }
// Supports both new (base64url, CTR) and old (hex:hex:hex, CBC) formats
router.post('/decrypt', async (req, res) => {
    try {
        const { encryptedMessage, password } = req.body;
        if (!encryptedMessage || !password) {
            return res.status(400).json({ error: 'Encrypted message and password are required' });
        }

        let salt, iv, encryptedData, alg;

        if (encryptedMessage.includes(':')) {
            // Old format: salt(16):iv(16):ciphertext (all hex, CBC)
            const parts = encryptedMessage.trim().split(':');
            if (parts.length !== 3) {
                return res.status(400).json({ error: 'Invalid encrypted message format' });
            }
            salt = Buffer.from(parts[0], 'hex');
            iv = Buffer.from(parts[1], 'hex');
            encryptedData = Buffer.from(parts[2], 'hex');
            alg = 'aes-256-cbc';
        } else {
            // New format: base64url(salt(8) + iv(16) + ciphertext), CTR
            const combined = Buffer.from(encryptedMessage.trim(), 'base64url');
            if (combined.length < 25) {
                return res.status(400).json({ error: 'Invalid encrypted message' });
            }
            salt = combined.subarray(0, SALT_LEN);
            iv = combined.subarray(SALT_LEN, SALT_LEN + 16);
            encryptedData = combined.subarray(SALT_LEN + 16);
            alg = ALG;
        }

        // Re-derive the AES key from the password + salt
        const key = crypto.scryptSync(password, salt, 32);

        // Decrypt
        const decipher = crypto.createDecipheriv(alg, key, iv);
        let decryptedText;
        try {
            decryptedText = Buffer.concat([decipher.update(encryptedData), decipher.final()]).toString('utf8');
        } catch (decErr) {
            return res.status(401).json({ error: 'Incorrect password or corrupted message' });
        }

        res.json({ text: decryptedText });

    } catch (error) {
        console.error('Decrypt Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
