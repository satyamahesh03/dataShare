import { useState } from 'react';
import { FiClock, FiLock, FiX, FiEye, FiEyeOff } from 'react-icons/fi';

const EXPIRY_OPTIONS = [
    { value: 15, label: '15 min' },
    { value: 30, label: '30 min' },
    { value: 60, label: '1 hr' },
    { value: 180, label: '3 hrs' },
    { value: 360, label: '6 hrs' },
    { value: 720, label: '12 hrs' },
    { value: 1440, label: '1 day' },
];

export default function PublishModal({ isOpen, onClose, onPublish, loading, uploadProgress = 0 }) {
    const [selectedExpiry, setSelectedExpiry] = useState(2); // default 1 hr
    const [passwordEnabled, setPasswordEnabled] = useState(false);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const currentExpiry = EXPIRY_OPTIONS[selectedExpiry];

    const handlePublish = () => {
        onPublish({
            expiryMinutes: currentExpiry.value,
            password: passwordEnabled && password ? password : undefined,
        });
    };

    if (!isOpen) return null;

    return (
        <div className="publish-modal-overlay" onClick={onClose}>
            <div className="publish-modal" onClick={(e) => e.stopPropagation()}>
                <button className="publish-modal-close" onClick={onClose}>
                    <FiX />
                </button>

                <div className="publish-modal-header">
                    <div className="publish-modal-dot" />
                    <h2 className="publish-modal-title">Publish</h2>
                </div>
                <p className="publish-modal-desc">Get ready to share with the world!</p>

                {/* Expiry Pills */}
                <div className="publish-option-card">
                    <div className="publish-option-top">
                        <span className="publish-option-label">
                            <FiClock /> Expires in
                        </span>
                        <span className="expiry-value">{currentExpiry.label}</span>
                    </div>
                    <div className="expiry-pills">
                        {EXPIRY_OPTIONS.map((opt, i) => (
                            <button
                                key={opt.value}
                                className={`expiry-pill${i === selectedExpiry ? ' active' : ''}`}
                                onClick={() => setSelectedExpiry(i)}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Password */}
                <div className="publish-option-card">
                    <div className="publish-option-top">
                        <span className="publish-option-label">
                            <FiLock /> Password protection
                        </span>
                        <button
                            className={`publish-toggle${passwordEnabled ? ' active' : ''}`}
                            onClick={() => setPasswordEnabled(!passwordEnabled)}
                        >
                            <span className="publish-toggle-knob" />
                        </button>
                    </div>
                    {passwordEnabled && (
                        <div className="publish-password-wrapper">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className="publish-password-input"
                                placeholder="Enter a password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoFocus
                            />
                            <button
                                className="publish-password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                                type="button"
                            >
                                {showPassword ? <FiEyeOff /> : <FiEye />}
                            </button>
                        </div>
                    )}
                </div>

                <button
                    className="publish-confirm-btn"
                    onClick={handlePublish}
                    disabled={loading}
                >
                    {loading && <span className="spinner" />}
                    {loading ? (uploadProgress > 0 && uploadProgress < 100 ? `Publishing... ${uploadProgress}%` : 'Publishing...') : 'Publish'}
                </button>
            </div>
        </div>
    );
}

