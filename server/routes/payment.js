const express = require('express');
const crypto = require('crypto');
const { requireAuth, publicUser, PREMIUM_DAYS } = require('../utils/auth');

const router = express.Router();
const PREMIUM_AMOUNT_PAISE = 1000; // ₹10

function razorpayAuthHeader() {
    const id = process.env.RAZORPAY_KEY_ID;
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!id || !secret) return null;
    return 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64');
}

router.get('/config', (req, res) => {
    res.json({
        keyId: process.env.RAZORPAY_KEY_ID || '',
        amount: PREMIUM_AMOUNT_PAISE,
        currency: 'INR',
        days: PREMIUM_DAYS,
    });
});

router.post('/create-order', requireAuth, async (req, res) => {
    try {
        const auth = razorpayAuthHeader();
        if (!auth) {
            return res.status(500).json({ error: 'Payments are not configured' });
        }

        const rzRes = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: {
                Authorization: auth,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount: PREMIUM_AMOUNT_PAISE,
                currency: 'INR',
                receipt: `prem_${req.user._id.toString().slice(-8)}_${Date.now()}`,
                notes: {
                    userId: req.user._id.toString(),
                    email: req.user.email,
                    plan: 'premium_monthly',
                },
            }),
        });

        const order = await rzRes.json();
        if (!rzRes.ok) {
            console.error('Razorpay order error:', order);
            return res.status(500).json({ error: 'Failed to start payment' });
        }

        res.json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: process.env.RAZORPAY_KEY_ID,
        });
    } catch (err) {
        console.error('Razorpay order error:', err);
        res.status(500).json({ error: 'Failed to start payment' });
    }
});

router.post('/verify', requireAuth, async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ error: 'Missing payment details' });
        }
        if (!process.env.RAZORPAY_KEY_SECRET) {
            return res.status(500).json({ error: 'Payments are not configured' });
        }

        const expected = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (expected !== razorpay_signature) {
            return res.status(400).json({ error: 'Payment verification failed' });
        }

        const existingPayment = await req.db.collection('payments').findOne({ paymentId: razorpay_payment_id });
        if (existingPayment) {
            const user = await req.db.collection('users').findOne({ _id: req.user._id });
            return res.json({ success: true, user: publicUser(user) });
        }

        const now = new Date();
        const currentUntil = req.user.premiumUntil && new Date(req.user.premiumUntil) > now
            ? new Date(req.user.premiumUntil)
            : now;
        const premiumUntil = new Date(currentUntil.getTime() + PREMIUM_DAYS * 24 * 60 * 60 * 1000);

        await req.db.collection('users').updateOne(
            { _id: req.user._id },
            {
                $set: {
                    premiumUntil,
                    updatedAt: now,
                },
            }
        );

        await req.db.collection('payments').insertOne({
            userId: req.user._id,
            email: req.user.email,
            orderId: razorpay_order_id,
            paymentId: razorpay_payment_id,
            amount: PREMIUM_AMOUNT_PAISE,
            currency: 'INR',
            createdAt: now,
            premiumUntil,
        });

        const user = await req.db.collection('users').findOne({ _id: req.user._id });
        res.json({ success: true, user: publicUser(user) });
    } catch (err) {
        console.error('Payment verify error:', err);
        res.status(500).json({ error: 'Failed to verify payment' });
    }
});

module.exports = router;
