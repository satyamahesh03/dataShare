const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const { signToken, publicUser, requireAuth } = require('../utils/auth');

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post('/google', async (req, res) => {
    try {
        const { credential } = req.body;
        if (!credential) {
            return res.status(400).json({ error: 'Google credential is required' });
        }
        if (!process.env.GOOGLE_CLIENT_ID) {
            return res.status(500).json({ error: 'Google sign-in is not configured' });
        }

        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload?.sub || !payload.email) {
            return res.status(401).json({ error: 'Invalid Google account' });
        }

        const users = req.db.collection('users');
        const now = new Date();
        const update = {
            googleId: payload.sub,
            email: payload.email,
            name: payload.name || payload.email.split('@')[0],
            picture: payload.picture || '',
            updatedAt: now,
        };
        await users.updateOne(
            { googleId: payload.sub },
            {
                $set: update,
                $setOnInsert: { createdAt: now },
            },
            { upsert: true }
        );
        const user = await users.findOne({ googleId: payload.sub });
        if (!user) {
            return res.status(500).json({ error: 'Failed to create account' });
        }

        const token = signToken(user);
        res.json({ token, user: publicUser(user) });
    } catch (err) {
        console.error('Google auth error:', err);
        res.status(401).json({ error: 'Google sign-in failed' });
    }
});

router.get('/me', requireAuth, (req, res) => {
    res.json({ user: publicUser(req.user) });
});

module.exports = router;
