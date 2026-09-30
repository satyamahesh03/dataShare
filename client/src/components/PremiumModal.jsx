import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiX, FiCheck, FiUploadCloud, FiZap, FiClock, FiShield, FiLink, FiEye } from 'react-icons/fi';
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
    const { user, isPremium, showPremium, setShowPremium, setShowLogin, setUser, triggerProWelcome } = useAuth();
    const { addToast } = useToast();
    const [paying, setPaying] = useState(false);
    const [previewMode, setPreviewMode] = useState('pro'); // 'pro' | 'free'
    const location = useLocation();
    const navigate = useNavigate();

    const isPremiumRoute = location.pathname === '/premium' || location.pathname.startsWith('/payment/checkout');
    const isOpen = isPremiumRoute;

    const isUserPremium = !!(isPremium || user?.isPremium);

    // When showPremium is triggered programmatically, reflect it in the URL
    useEffect(() => {
        if (showPremium) {
            if (!isPremiumRoute) {
                navigate('/premium', { state: { from: location.pathname } });
            }
            setShowPremium(false);
        }
    }, [showPremium, isPremiumRoute, location.pathname, navigate, setShowPremium]);

    // Prevent background page from moving while modal is open
    useEffect(() => {
        if (isOpen) {
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = originalOverflow;
            };
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleClose = () => {
        if (paying) return;
        const target = (location.state?.from && !location.state.from.startsWith('/premium') && !location.state.from.startsWith('/payment'))
            ? location.state.from
            : '/';
        navigate(target, { replace: true });
    };

    const handlePay = async () => {
        if (!user) {
            handleClose();
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

            navigate(`/payment/checkout/${order.orderId}`, { replace: true, state: { from: location.state?.from || '/' } });

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
                theme: { color: '#DFB941' },
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
                        if (triggerProWelcome) triggerProWelcome();

                        navigate(`/payment/success?payment_id=${response.razorpay_payment_id}&order_id=${response.razorpay_order_id}`, { replace: true });
                    } catch (err) {
                        addToast(err.message || 'Payment verification failed', 'error');
                        navigate('/premium', { replace: true });
                    } finally {
                        setPaying(false);
                    }
                },
                modal: {
                    ondismiss: () => {
                        setPaying(false);
                        navigate('/premium', { replace: true });
                    },
                },
            });
            checkout.open();
        } catch (err) {
            addToast(err.message || 'Payment failed', 'error');
            setPaying(false);
            navigate('/premium', { replace: true });
        }
    };

    return (
        <div className="publish-modal-overlay" style={{ zIndex: 9999 }} onClick={handleClose}>
            <div className="auth-modal pro-luxury-modal" onClick={(e) => e.stopPropagation()}>
                <button className="publish-modal-close pro-close-btn" onClick={handleClose} aria-label="Close">
                    <FiX />
                </button>

                <div className="pro-modal-scroll-area">
                    {/* TOP HIGHLIGHTED REMAINING DAYS BANNER FOR PRO MEMBERS */}
                    {isUserPremium && user?.premiumUntil ? (
                        (() => {
                            const daysLeft = Math.ceil((new Date(user.premiumUntil) - new Date()) / (1000 * 60 * 60 * 24));
                            const count = daysLeft > 0 ? daysLeft : 0;
                            return (
                                <div className="pro-top-highlight-banner">
                                    <div className="pro-top-highlight-left">
                                        <div className="pro-top-highlight-crown">
                                            <FaCrown />
                                        </div>
                                        <div className="pro-top-highlight-info">
                                            <span className="pro-top-highlight-title">Active Pro Membership</span>
                                            <span className="pro-top-highlight-days">
                                                <strong>{count}</strong> {count === 1 ? 'day' : 'days'} remaining
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()
                    ) : null}

                    {/* 1. HERO HEADER */}
                    <div className="pro-luxury-header">
                        <div className="pro-luxury-badge">
                            <FaCrown className="pro-badge-crown" /> ALL-ACCESS PASS
                        </div>
                        <h2 className="pro-luxury-title">DataShare <span className="pro-gold-text">Pro</span></h2>
                        <p className="pro-luxury-subtitle">
                            Unlock maximum upload power, self-destruct privacy, and executive identity.
                        </p>

                        <div className="pro-price-card">
                            <div className="pro-price-left">
                                <span className="pro-price-currency">₹</span>
                                <span className="pro-price-val">10</span>
                                <span className="pro-price-period">/ 30 Days</span>
                            </div>
                            <div className="pro-price-tag">
                                Instant Access • No Auto-Debit
                            </div>
                        </div>
                    </div>

                    {/* 2. INTERACTIVE "SEE YOUR ACCOUNT TRANSFORM" SHOWCASE */}
                    <div className="pro-interactive-showcase">
                        <div className="pro-showcase-bar">
                            <span className="pro-showcase-title">
                                <FiEye /> Preview: Experience Pro
                            </span>
                            <div className="pro-toggle-pill">
                                <button
                                    type="button"
                                    className={`pro-toggle-btn ${previewMode === 'free' ? 'active' : ''}`}
                                    onClick={() => setPreviewMode('free')}
                                >
                                    Free
                                </button>
                                <button
                                    type="button"
                                    className={`pro-toggle-btn pro-toggle-active ${previewMode === 'pro' ? 'active' : ''}`}
                                    onClick={() => setPreviewMode('pro')}
                                >
                                    <FaCrown /> Pro
                                </button>
                            </div>
                        </div>

                        <div className={`pro-showcase-stage ${previewMode === 'pro' ? 'is-pro' : 'is-free'}`}>
                            <div className="pro-stage-header">
                                <div className="pro-stage-avatar-wrap">
                                    <span className={`user-avatar-wrap ${previewMode === 'pro' ? 'is-premium' : ''}`}>
                                        {previewMode === 'pro' && (
                                            <span className="premium-avatar-ring" aria-hidden="true" />
                                        )}
                                        {user?.picture ? (
                                            <img src={user.picture} alt="" className="user-avatar" referrerPolicy="no-referrer" />
                                        ) : (
                                            <span className="user-avatar-fallback">{(user?.name || 'U')[0]}</span>
                                        )}
                                        {previewMode === 'pro' && (
                                            <span className="premium-crown" title="Premium Active">
                                                <FaCrown />
                                            </span>
                                        )}
                                    </span>
                                </div>

                                <div className="pro-stage-identity">
                                    <strong className="pro-stage-username">{user?.name || 'Your Account'}</strong>
                                    {previewMode === 'pro' ? (
                                        <span className="pro-vip-badge"><FaCrown /> PRO MEMBER</span>
                                    ) : (
                                        <span className="free-vip-badge">FREE TIER</span>
                                    )}
                                </div>
                            </div>

                            {/* 1 Row of perks under the profile picture */}
                            <div className="pro-perks-pills-row">
                                <span className={`perk-chip ${previewMode === 'pro' ? 'gold' : ''}`}>
                                    <FiUploadCloud /> {previewMode === 'pro' ? '1GB Uploads' : '50MB Limit'}
                                </span>
                                <span className={`perk-chip ${previewMode === 'pro' ? 'gold' : ''}`}>
                                    <ViewOnceIcon size={14} /> {previewMode === 'pro' ? '1 Burst Share' : 'Locked'}
                                </span>
                                <span className={`perk-chip ${previewMode === 'pro' ? 'gold' : ''}`}>
                                    <FiClock /> {previewMode === 'pro' ? '30-Day Expiry' : '24 Hours'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 3. CORE PRO ADVANTAGES (CONCISE & IMPACTFUL) */}
                    <div className={`pro-modal-perks-grid ${previewMode === 'pro' ? 'is-pro' : 'is-free'}`}>
                        <div className="pro-modal-perk-item">
                            <div className="pro-modal-perk-icon"><FiUploadCloud /></div>
                            <div className="pro-modal-perk-text">
                                <strong>1GB Massive Uploads</strong>
                                <span>20x larger capacity for 4K video, zip archives & datasets.</span>
                            </div>
                        </div>

                        <div className="pro-modal-perk-item">
                            <div className="pro-modal-perk-icon"><ViewOnceIcon size={18} /></div>
                            <div className="pro-modal-perk-text">
                                <strong>Burst Share (Self-Destruct)</strong>
                                <span>Files permanently delete themselves instantly upon opening.</span>
                            </div>
                        </div>

                        <div className="pro-modal-perk-item">
                            <div className="pro-modal-perk-icon"><FiClock /></div>
                            <div className="pro-modal-perk-text">
                                <strong>Custom 30-Day Expiry</strong>
                                <span>Keep project files alive from 5 minutes to a full 30 days.</span>
                            </div>
                        </div>

                        <div className="pro-modal-perk-item">
                            <div className="pro-modal-perk-icon"><FaCrown /></div>
                            <div className="pro-modal-perk-text">
                                <strong>Executive Gold Halo</strong>
                                <span>Animated rotating gold halo & verified crown badge.</span>
                            </div>
                        </div>
                    </div>


                </div>

                {/* 4. PINNED STICKY UPGRADE ACTION (NO VERTICAL SCROLLBAR) */}
                <div className="pro-luxury-actions">
                    <button className="pro-unlock-btn" onClick={handlePay} disabled={paying}>
                        {paying ? (
                            'Opening Secure Checkout…'
                        ) : isUserPremium ? (
                            <>Extend Premium (+30 Days) — ₹10</>
                        ) : (
                            <>
                                <FaCrown /> Unlock DataShare Pro — ₹10
                            </>
                        )}
                    </button>
                    <div className="pro-security-strip">
                        <FiShield /> Secured by Razorpay
                    </div>
                </div>
            </div>
        </div>
    );
}
