import { useEffect, useState } from 'react';
import { useSearchParams, Link, Navigate } from 'react-router-dom';
import { FiCopy, FiCheck, FiArrowRight, FiFilePlus, FiZap, FiShield, FiClock, FiPrinter, FiHome } from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { API_URL, authHeaders } from '../config';

export default function PaymentSuccess() {
    const [searchParams] = useSearchParams();
    const paymentId = searchParams.get('payment_id') || '';
    const orderId = searchParams.get('order_id') || '';
    const { user, loading, refreshUser, triggerProWelcome } = useAuth();
    const [copiedKey, setCopiedKey] = useState(null);

    // Lock payment date/time so it never changes on refresh or printing
    const [paymentDate, setPaymentDate] = useState(() => {
        const cacheKey = paymentId ? `ps_date_${paymentId}` : 'ps_date_last';
        try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) return cached;
            const now = new Intl.DateTimeFormat('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            }).format(new Date());
            localStorage.setItem(cacheKey, now);
            return now;
        } catch {
            return new Intl.DateTimeFormat('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            }).format(new Date());
        }
    });

    useEffect(() => {
        if (refreshUser) refreshUser();
        if (triggerProWelcome) triggerProWelcome();

        // Fetch official immutable transaction date from DB
        const fetchReceiptDate = async () => {
            try {
                const endpoint = paymentId
                    ? `${API_URL}/api/payment/receipt/${encodeURIComponent(paymentId)}`
                    : `${API_URL}/api/payment/latest-receipt`;
                const res = await fetch(endpoint, { headers: authHeaders() });
                if (res.ok) {
                    const data = await res.json();
                    if (data.createdAt) {
                        const d = new Date(data.createdAt);
                        const formatted = new Intl.DateTimeFormat('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                        }).format(d);
                        setPaymentDate(formatted);
                        const cacheKey = paymentId ? `ps_date_${paymentId}` : 'ps_date_last';
                        try {
                            localStorage.setItem(cacheKey, formatted);
                        } catch {}
                    }
                }
            } catch (err) {
                // Keep existing locked date
            }
        };

        fetchReceiptDate();
    }, [paymentId]);

    const copyToClipboard = (text, key) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    const handlePrint = () => {
        if (document.fonts?.ready) {
            document.fonts.ready.then(() => {
                window.print();
            });
        } else {
            window.print();
        }
    };

    if (loading) {
        return (
            <div className="ps-container">
                <div className="ps-box ps-loading-box">
                    <div className="ps-spinner" />
                    <h3 style={{ marginTop: '14px', fontSize: '1.1rem', color: 'var(--text-primary)' }}>Verifying Payment...</h3>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/" replace />;
    }

    return (
        <div className="ps-container">
            <div className="ps-box ps-box-ordered">
                {/* 1. TOP: Green Tick & Header */}
                <div className="ps-top-section">
                    <div className="ps-tick-circle">
                        <svg
                            className="ps-tick-svg"
                            viewBox="0 0 52 52"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <circle
                                className="ps-tick-circle-bg"
                                cx="26"
                                cy="26"
                                r="25"
                                fill="#10B981"
                            />
                            <path
                                className="ps-tick-check"
                                d="M14.1 27.2l7.1 7.2 16.7-16.8"
                                fill="none"
                                stroke="#FFFFFF"
                                strokeWidth="4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </div>

                    <div className="ps-top-text">
                        <h1 className="ps-title">Payment Successful!</h1>
                        <div className="ps-amount">₹10.00 <span className="ps-amount-sub">/ 30 Days</span></div>
                    </div>
                </div>

                {/* 2. OFFICIAL RECEIPT (KEPT ABOVE) */}
                <div className="ps-receipt">
                    <div className="ps-receipt-header">
                        <span className="ps-receipt-tag">Official Receipt</span>
                        <span className="ps-receipt-status-badge">PAID</span>
                    </div>

                    <div className="ps-receipt-rows">
                        <div className="ps-receipt-item">
                            <span className="ps-label">Plan</span>
                            <span className="ps-value ps-plan-badge">
                                <FaCrown className="ps-crown" /> DataShare Pro
                            </span>
                        </div>

                        <div className="ps-receipt-item">
                            <span className="ps-label">Amount Paid</span>
                            <span className="ps-value ps-amount-paid">
                                ₹10.00 INR
                            </span>
                        </div>

                        <div className="ps-receipt-item ps-account-row">
                            <span className="ps-label">Billed Account</span>
                            <span className="ps-value ps-email-full">
                                {user.email}
                            </span>
                        </div>

                        <div className="ps-receipt-item">
                            <span className="ps-label">Date & Time</span>
                            <span className="ps-value">{paymentDate}</span>
                        </div>

                        {paymentId && (
                            <div className="ps-receipt-item">
                                <span className="ps-label">Payment ID</span>
                                <div className="ps-code-wrap">
                                    <code>{paymentId}</code>
                                    <button
                                        className="ps-copy-btn no-print"
                                        onClick={() => copyToClipboard(paymentId, 'pay')}
                                        title="Copy Payment ID"
                                        type="button"
                                    >
                                        {copiedKey === 'pay' ? <FiCheck style={{ color: '#10B981' }} /> : <FiCopy />}
                                    </button>
                                </div>
                            </div>
                        )}

                        {orderId && (
                            <div className="ps-receipt-item">
                                <span className="ps-label">Order ID</span>
                                <div className="ps-code-wrap">
                                    <code>{orderId}</code>
                                    <button
                                        className="ps-copy-btn no-print"
                                        onClick={() => copyToClipboard(orderId, 'order')}
                                        title="Copy Order ID"
                                        type="button"
                                    >
                                        {copiedKey === 'order' ? <FiCheck style={{ color: '#10B981' }} /> : <FiCopy />}
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="ps-receipt-item">
                            <span className="ps-label">Gateway</span>
                            <span className="ps-value">Razorpay (256-bit SSL)</span>
                        </div>
                    </div>

                    <div className="ps-receipt-note">
                        <p>30 days access granted. Includes unlimited fast transfers.</p>
                    </div>

                    {/* Digital Signature & Verification Link */}
                    <div className="ps-print-footer">
                        <div className="ps-signature-block">
                            <div className="ps-signature-sign">DataShare</div>
                            <span className="ps-signature-label">Authorized Signatory</span>
                        </div>
                        <div className="ps-footer-link-block">
                            <span className="ps-footer-link-text">Digitally Verified Receipt</span>
                            <a
                                href="https://datashare.satyapage.in"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ps-footer-url"
                            >
                                https://datashare.satyapage.in
                            </a>
                        </div>
                    </div>
                </div>

                {/* 3. UNLOCKED FEATURES (KEPT BELOW RECEIPT, SIDE BY SIDE 2 ROWS & COLUMNS) */}
                <div className="ps-features-section">
                    <div className="ps-features">
                        <div className="ps-feature-item">
                            <div className="ps-feat-icon"><FiFilePlus /></div>
                            <div className="ps-feat-text">
                                <strong>1GB File Uploads</strong>
                                <span>20x higher file limit</span>
                            </div>
                        </div>

                        <div className="ps-feature-item">
                            <div className="ps-feat-icon"><FiZap /></div>
                            <div className="ps-feat-text">
                                <strong>Burst Share</strong>
                                <span>Self-destructing texts</span>
                            </div>
                        </div>

                        <div className="ps-feature-item">
                            <div className="ps-feat-icon"><FiClock /></div>
                            <div className="ps-feat-text">
                                <strong>Custom Expiration</strong>
                                <span>Precise timer duration</span>
                            </div>
                        </div>

                        <div className="ps-feature-item">
                            <div className="ps-feat-icon"><FiShield /></div>
                            <div className="ps-feat-text">
                                <strong>SafeVault Pro</strong>
                                <span>AES-256 cloud encryption</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. ACTIONS: [Start Uploading (1GB)] [Print Receipt] [Return to Home] KEPT AT MIDDLE */}
                <div className="ps-actions-middle">
                    <Link to="/file" className="ps-btn-primary">
                        <FiFilePlus className="ps-btn-icon" />
                        <span className="ps-btn-text">Start Uploading (1GB)</span>
                        <FiArrowRight className="ps-btn-icon" />
                    </Link>
                    <div className="ps-btn-row">
                        <button onClick={handlePrint} className="ps-btn-secondary no-print" type="button">
                            <FiPrinter /> Print Receipt
                        </button>
                        <Link to="/" className="ps-btn-secondary no-print">
                            <FiHome /> Return to Home
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
