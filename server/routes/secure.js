const express = require('express');
const crypto = require('crypto');

const router = express.Router();

const ALG = 'aes-256-cbc';

// ─── ENCRYPT ───────────────────────────────────────────────
// Takes: { text, password }
// Returns: { encryptedMessage }  — a single string the user copies
router.post('/encrypt', async (req, res) => {
    try {
        const { text, password, expiryHours = 24 } = req.body;
        if (!text || !password) {
            return res.status(400).json({ error: 'Text and password are required' });
        }

        // Generate a random salt and IV
        const salt = crypto.randomBytes(16);
        const iv = crypto.randomBytes(16);

        // Derive a 32-byte AES key from the password + salt
        const key = crypto.scryptSync(password, salt, 32);

        // Encrypt the text
        const cipher = crypto.createCipheriv(ALG, key, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        // Bundle everything into ONE string:  salt:iv:encryptedText  (all hex)
        const encryptedMessage = `${salt.toString('hex')}:${iv.toString('hex')}:${encrypted}`;

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

        res.json({ encryptedMessage });

    } catch (error) {
        console.error('Encrypt Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ─── DECRYPT ───────────────────────────────────────────────
// Takes: { encryptedMessage, password }
// Splits the string, re-derives the key, decrypts
router.post('/decrypt', async (req, res) => {
    try {
        const { encryptedMessage, password } = req.body;
        if (!encryptedMessage || !password) {
            return res.status(400).json({ error: 'Encrypted message and password are required' });
        }

        // Split the bundled string back into parts
        const parts = encryptedMessage.trim().split(':');
        if (parts.length !== 3) {
            return res.status(400).json({ error: 'Invalid encrypted message format' });
        }

        const [saltHex, ivHex, encryptedText] = parts;

        // Re-derive the AES key from the password + salt
        const salt = Buffer.from(saltHex, 'hex');
        const iv = Buffer.from(ivHex, 'hex');
        const key = crypto.scryptSync(password, salt, 32);

        // Decrypt
        const decipher = crypto.createDecipheriv(ALG, key, iv);
        let decryptedText;
        try {
            decryptedText = decipher.update(encryptedText, 'hex', 'utf8');
            decryptedText += decipher.final('utf8');
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
