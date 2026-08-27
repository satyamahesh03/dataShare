import { useState } from 'react';
import { FiX, FiCheck } from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { API_URL, authHeaders } from '../config';
import ViewOnceIcon from './ViewOnceIcon';

function loadRazorpay() {
    return new Promise((resolve) => {
        if (window.Razorpay) return resolve(true);
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
}

export default function PremiumModal() {
    const { user, showPremium, setShowPremium, setShowLogin, setUser } = useAuth();
    const { addToast } = useToast();
    const [paying, setPaying] = useState(false);

    if (!showPremium) return null;

    const handlePay = async () => {
        if (!user) {
            setShowPremium(false);
            setShowLogin(true);
            return;
        }
        setPaying(true);
        try {
            const ready = await loadRazorpay();
            if (!ready) throw new Error('Could not load Razorpay');

            const orderRes = await fetch(`${API_URL}/api/payment/create-order`, {
                method: 'POST',
                headers: authHeaders({ 'Content-Type': 'application/json' }),
            });
            const order = await orderRes.json();
            if (!orderRes.ok) throw new Error(order.error || 'Could not start payment');

            const checkout = new window.Razorpay({
                key: order.keyId,
                amount: order.amount,
                currency: order.currency,
                name: 'DataShare Premium',
                description: 'Monthly Premium — ₹10',
                order_id: order.orderId,
                prefill: {
                    name: user.name,
                    email: user.email,
                },
                theme: { color: '#C9A227' },
                handler: async (response) => {
                    try {
                        const verifyRes = await fetch(`${API_URL}/api/payment/verify`, {
                            method: 'POST',
                            headers: authHeaders({ 'Content-Type': 'application/json' }),
                            body: JSON.stringify(response),
                        });
                        const data = await verifyRes.json();
                        if (!verifyRes.ok) throw new Error(data.error || 'Verification failed');
                        setUser(data.user);
                        setShowPremium(false);
                        addToast('Premium is now active. Enjoy Burst Share and 1GB uploads!', 'success');
                    } catch (err) {
                        addToast(err.message || 'Payment verification failed', 'error');
                    } finally {
                        setPaying(false);
                    }
                },
                modal: {
                    ondismiss: () => setPaying(false),
                },
            });
            checkout.open();
        } catch (err) {
            addToast(err.message || 'Payment failed', 'error');
            setPaying(false);
        }
    };

    return (
        <div className="publish-modal-overlay" onClick={() => !paying && setShowPremium(false)}>
            <div className="auth-modal premium-modal" onClick={(e) => e.stopPropagation()}>
                <button className="publish-modal-close" onClick={() => setShowPremium(false)}>
                    <FiX />
                </button>
                <div className="auth-modal-crown">
                    <FaCrown />
                </div>
                <h2 className="publish-modal-title">Go Premium</h2>
                <p className="publish-modal-desc">
                    Unlock Burst Share and larger uploads for ₹10 / month.
                </p>
                <div className="premium-price">
                    <span className="premium-price-amount">₹10</span>
                    <span className="premium-price-period">/ month</span>
                </div>
                <ul className="premium-features">
                    <li><FiCheck /> Upload files up to <strong>1GB</strong></li>
                    <li>
                        <FiCheck />
                        <span className="premium-feature-burst">
                            <ViewOnceIcon size={16} /> Burst Share — opens once, then gone
                        </span>
                    </li>
                    <li><FiCheck /> Posts synced wherever you sign in</li>
                    <li><FiCheck /> Gold crown on your profile</li>
                </ul>
                {user?.isPremium && user.premiumUntil ? (
                    (() => {
                        const daysLeft = Math.ceil((new Date(user.premiumUntil) - new Date()) / (1000 * 60 * 60 * 24));
                        return (
                            <div style={{ textAlign: 'center', marginBottom: '16px', color: 'var(--accent)', fontWeight: '600' }}>
                                You have {daysLeft > 0 ? daysLeft : 0} premium {daysLeft === 1 ? 'day' : 'days'} left!
                            </div>
                        );
                    })()
                ) : null}
                <button className="premium-pay-btn" onClick={handlePay} disabled={paying}>
                    {paying ? 'Opening checkout…' : user?.isPremium ? 'Extend Premium (+30 days) — ₹10' : 'Pay ₹10 with Razorpay'}
                </button>
            </div>
        </div>
    );
}
