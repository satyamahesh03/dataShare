const express = require('express');
const crypto = require('crypto');
const { ObjectId } = require('mongodb');
const { requireAuth, publicUser, PREMIUM_DAYS } = require('../utils/auth');

const router = express.Router();
const PREMIUM_AMOUNT_PAISE = 1000; // ₹10

const Razorpay = require('razorpay');

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
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            return res.status(500).json({ error: 'Payments are not configured' });
        }

        if (PREMIUM_AMOUNT_PAISE < 100) {
            return res.status(500).json({ error: 'Invalid amount: minimum 100 paise required' });
        }

        const instance = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        const options = {
            amount: PREMIUM_AMOUNT_PAISE,
            currency: 'INR',
            receipt: `prem_${req.user._id.toString().slice(-8)}_${Date.now()}`,
            notes: {
                userId: req.user._id.toString(),
                email: req.user.email,
                plan: 'premium_monthly',
            },
        };

        const order = await instance.orders.create(options);

        res.json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: process.env.RAZORPAY_KEY_ID,
        });
    } catch (err) {
        console.error('Razorpay order error:', err);
        if (err.statusCode === 401) {
            return res.status(401).json({ error: 'Razorpay authentication failed' });
        }
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

        // If the webhook already recorded this payment, just return success
        // without crediting extra days
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

        // Atomically insert the payment record first — if the webhook beat us
        // to it (race condition), MongoDB will throw a duplicate key error on
        // the unique paymentId index and we skip crediting.
        try {
            await req.db.collection('payments').insertOne({
                userId: req.user._id,
                email: req.user.email,
                orderId: razorpay_order_id,
                paymentId: razorpay_payment_id,
                amount: PREMIUM_AMOUNT_PAISE,
                currency: 'INR',
                source: 'client_verify',
                createdAt: now,
                premiumUntil,
            });
        } catch (insertErr) {
            // Duplicate key error (code 11000) means webhook already processed it
            if (insertErr.code === 11000) {
                console.log(`ℹ️ Payment ${razorpay_payment_id} already recorded by webhook, skipping credit`);
                const user = await req.db.collection('users').findOne({ _id: req.user._id });
                return res.json({ success: true, user: publicUser(user) });
            }
            throw insertErr;
        }

        // Only credit the user if our insert succeeded (we won the race)
        await req.db.collection('users').updateOne(
            { _id: req.user._id },
            {
                $set: {
                    premiumUntil,
                    updatedAt: now,
                },
            }
        );

        const user = await req.db.collection('users').findOne({ _id: req.user._id });
        res.json({ success: true, user: publicUser(user) });
    } catch (err) {
        console.error('Payment verify error:', err);
        res.status(500).json({ error: 'Failed to verify payment' });
    }
});

// GET /api/payment/receipt/:paymentId — securely fetch verified receipt for the authenticated user
router.get('/receipt/:paymentId', requireAuth, async (req, res) => {
    try {
        const { paymentId } = req.params;
        const payment = await req.db.collection('payments').findOne({
            paymentId,
            userId: req.user._id,
        });

        if (!payment) {
            return res.status(404).json({ error: 'Receipt not found or does not belong to your account' });
        }

        res.json({
            paymentId: payment.paymentId,
            orderId: payment.orderId,
            amount: payment.amount,
            currency: payment.currency,
            createdAt: payment.createdAt,
            premiumUntil: payment.premiumUntil,
            email: req.user.email,
        });
    } catch (err) {
        console.error('Receipt fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch receipt' });
    }
});

// GET /api/payment/latest-receipt — get the latest verified payment for the authenticated user
router.get('/latest-receipt', requireAuth, async (req, res) => {
    try {
        const payment = await req.db.collection('payments')
            .find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .limit(1)
            .toArray();

        if (!payment || payment.length === 0) {
            return res.status(404).json({ error: 'No verified payments found for your account' });
        }

        const p = payment[0];
        res.json({
            paymentId: p.paymentId,
            orderId: p.orderId,
            amount: p.amount,
            currency: p.currency,
            createdAt: p.createdAt,
            premiumUntil: p.premiumUntil,
            email: req.user.email,
        });
    } catch (err) {
        console.error('Latest receipt fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch latest receipt' });
    }
});

// POST /api/payment/webhook — Razorpay Webhook listener
router.post('/webhook', async (req, res) => {
    try {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!webhookSecret) {
            console.error('Razorpay webhook error: RAZORPAY_WEBHOOK_SECRET is not configured');
            return res.status(500).json({ error: 'Webhook secret is not configured' });
        }

        const signature = req.headers['x-razorpay-signature'];
        if (!signature) {
            return res.status(400).json({ error: 'Missing x-razorpay-signature header' });
        }

        // Validate webhook signature using raw body buffer or string
        const rawBody = req.rawBody ? req.rawBody.toString() : JSON.stringify(req.body);
        const isValid = Razorpay.validateWebhookSignature(rawBody, signature, webhookSecret);

        if (!isValid) {
            console.warn('⚠️ Invalid Razorpay webhook signature');
            return res.status(400).json({ error: 'Invalid webhook signature' });
        }

        const event = req.body?.event;
        console.log(`🔔 Razorpay webhook received: ${event}`);

        // Handle payment captured / order paid events
        if (event === 'payment.captured' || event === 'order.paid') {
            const paymentEntity = req.body?.payload?.payment?.entity;
            const orderEntity = req.body?.payload?.order?.entity;

            const paymentId = paymentEntity?.id;
            const orderId = paymentEntity?.order_id || orderEntity?.id;
            const notes = paymentEntity?.notes || orderEntity?.notes || {};
            const userIdStr = notes.userId;
            const email = notes.email || paymentEntity?.email;

            if (paymentId && userIdStr && ObjectId.isValid(userIdStr)) {
                const userId = new ObjectId(userIdStr);
                const db = req.db;

                // Check if payment was already recorded
                const existingPayment = await db.collection('payments').findOne({ paymentId });
                if (!existingPayment) {
                    const user = await db.collection('users').findOne({ _id: userId });
                    if (user) {
                        const now = new Date();
                        const currentUntil = user.premiumUntil && new Date(user.premiumUntil) > now
                            ? new Date(user.premiumUntil)
                            : now;
                        const premiumUntil = new Date(currentUntil.getTime() + PREMIUM_DAYS * 24 * 60 * 60 * 1000);

                        await db.collection('users').updateOne(
                            { _id: userId },
                            {
                                $set: {
                                    premiumUntil,
                                    updatedAt: now,
                                },
                            }
                        );

                        await db.collection('payments').insertOne({
                            userId: user._id,
                            email: user.email || email,
                            orderId,
                            paymentId,
                            amount: paymentEntity?.amount || PREMIUM_AMOUNT_PAISE,
                            currency: paymentEntity?.currency || 'INR',
                            source: 'webhook',
                            createdAt: now,
                            premiumUntil,
                        });

                        console.log(`✅ Webhook: Upgraded user ${userIdStr} to premium until ${premiumUntil.toISOString()}`);
                    }
                }
            }
        } else if (event === 'payment.failed') {
            const paymentEntity = req.body?.payload?.payment?.entity;
            console.warn(`❌ Razorpay payment failed for paymentId: ${paymentEntity?.id}, error: ${paymentEntity?.error_description}`);
        }

        res.status(200).json({ status: 'ok' });
    } catch (err) {
        console.error('Razorpay webhook processing error:', err);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

module.exports = router;
