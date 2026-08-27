const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');

const JWT_SECRET = process.env.JWT_SECRET || 'datashare-dev-jwt-secret';
const FREE_MAX_BYTES = 50 * 1024 * 1024;
const PREMIUM_MAX_BYTES = 1024 * 1024 * 1024;
const PREMIUM_DAYS = 30;

function signToken(user) {
    return jwt.sign(
        { userId: user._id.toString(), email: user.email },
        JWT_SECRET,
        { expiresIn: '30d' }
    );
}

function isPremium(user) {
    return !!(user && user.premiumUntil && new Date(user.premiumUntil) > new Date());
}

function publicUser(user) {
    if (!user) return null;
    const premium = isPremium(user);
    return {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        picture: user.picture,
        isPremium: premium,
        premiumUntil: premium ? user.premiumUntil : null,
    };
}

function getMaxUploadBytes(user) {
    return isPremium(user) ? PREMIUM_MAX_BYTES : FREE_MAX_BYTES;
}

async function loadUserFromToken(db, token) {
    if (!token) return null;
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        if (!payload?.userId || !ObjectId.isValid(payload.userId)) return null;
        return await db.collection('users').findOne({ _id: new ObjectId(payload.userId) });
    } catch {
        return null;
    }
}

function extractToken(req) {
    const header = req.headers.authorization || '';
    if (header.startsWith('Bearer ')) return header.slice(7);
    return null;
}

async function optionalAuth(req, res, next) {
    try {
        const user = await loadUserFromToken(req.db, extractToken(req));
        if (user) req.user = user;
    } catch {
        // ignore invalid tokens for optional routes
    }
    next();
}

async function requireAuth(req, res, next) {
    const user = await loadUserFromToken(req.db, extractToken(req));
    if (!user) {
        return res.status(401).json({ error: 'Sign in required' });
    }
    req.user = user;
    next();
}

module.exports = {
    signToken,
    isPremium,
    publicUser,
    getMaxUploadBytes,
    optionalAuth,
    requireAuth,
    FREE_MAX_BYTES,
    PREMIUM_MAX_BYTES,
    PREMIUM_DAYS,
};
