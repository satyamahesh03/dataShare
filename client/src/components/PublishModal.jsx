import { useState, useRef, useEffect, useCallback } from 'react';
import { FiClock, FiLock, FiX, FiEye, FiEyeOff } from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import ViewOnceIcon from './ViewOnceIcon';

const EXPIRY_OPTIONS = [
    { value: 15, label: '15 min' },
    { value: 30, label: '30 min' },
    { value: 60, label: '1 hr' },
    { value: 180, label: '3 hrs' },
    { value: 360, label: '6 hrs' },
    { value: 720, label: '12 hrs' },
    { value: 1440, label: '1 day' },
    { value: 'custom', label: 'Custom' },
];

export default function PublishModal({ isOpen, onClose, onPublish, loading, uploadProgress = 0, uploadText }) {
    const [selectedExpiry, setSelectedExpiry] = useState(2); // default 1 hr
    const [customDate, setCustomDate] = useState('');
    const [passwordEnabled, setPasswordEnabled] = useState(false);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [burstShare, setBurstShare] = useState(false);
    const { isPremium, requirePremium } = useAuth();

    // Slider logic
    const expiryBarRef = useRef(null);
    const [sliderStyle, setSliderStyle] = useState({});

    const updateSlider = useCallback(() => {
        if (!expiryBarRef.current) return;
        const bar = expiryBarRef.current;
        const activeBtn = bar.querySelector('.expiry-pill.active');
        if (activeBtn) {
            setSliderStyle({
                left: activeBtn.offsetLeft,
                top: activeBtn.offsetTop,
                width: activeBtn.offsetWidth,
                height: activeBtn.offsetHeight,
            });
        }
    }, [selectedExpiry]);

    // Re-run slider when modal opens or layout changes
    useEffect(() => {
        if (isOpen) {
            if (!isPremium) setBurstShare(false);
            setTimeout(updateSlider, 50);
        }
    }, [isOpen, selectedExpiry, updateSlider, isPremium]);

    const currentExpiry = EXPIRY_OPTIONS[selectedExpiry];

    const handlePublish = () => {
        let expiryMinutes = currentExpiry.value;
        if (expiryMinutes === 'custom') {
            if (!customDate) {
                alert('Please select a custom expiration date and time.');
                return;
            }
            const diffMs = new Date(customDate).getTime() - Date.now();
            if (diffMs <= 0) {
                alert('Custom expiration must be in the future.');
                return;
            }
            expiryMinutes = Math.ceil(diffMs / 60000); // convert ms to minutes
        }

        onPublish({
            expiryMinutes,
            password: passwordEnabled && password ? password : undefined,
            burstShare: isPremium && burstShare,
        });
    };

    if (!isOpen) return null;

    return (
        <div className="publish-modal-overlay" onClick={!loading ? onClose : undefined}>
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
                    <div className="expiry-bar" ref={expiryBarRef} style={{ marginTop: '12px' }}>
                        <div
                            className="expiry-slider"
                            style={{
                                left: sliderStyle.left,
                                top: sliderStyle.top,
                                width: sliderStyle.width,
                                height: sliderStyle.height,
                            }}
                        />
                        {EXPIRY_OPTIONS.map((opt, i) => {
                            if (opt.value === 'custom' && !isPremium) {
                                return (
                                    <button
                                        key={opt.value}
                                        className="expiry-pill"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            requirePremium();
                                        }}
                                        title="Premium Feature"
                                    >
                                        <FaCrown style={{ color: '#C9A227', marginRight: '4px' }} />
                                        Custom
                                    </button>
                                );
                            }
                            return (
                                <button
                                    key={opt.value}
                                    className={`expiry-pill${i === selectedExpiry ? ' active' : ''}`}
                                    onClick={() => setSelectedExpiry(i)}
                                >
                                    {opt.label}
                                </button>
                            );
                        })}
                    </div>
                    {currentExpiry.value === 'custom' && (
                        <div className="custom-expiry-picker" style={{ marginTop: '16px' }}>
                            <input
                                type="datetime-local"
                                className="publish-password-input"
                                value={customDate}
                                onChange={(e) => setCustomDate(e.target.value)}
                                style={{ width: '100%', boxSizing: 'border-box' }}
                            />
                        </div>
                    )}
                </div>

                {/* Burst Share */}
                <div className="publish-option-card">
                    <div className="publish-option-top" style={{ marginBottom: burstShare && isPremium ? 8 : 0 }}>
                        <span className="publish-option-label">
                            <ViewOnceIcon /> View Once
                            <span className="premium-crown-inline" title="Premium">
                                <FaCrown />
                            </span>
                        </span>
                        <button
                            className={`publish-toggle${burstShare && isPremium ? ' active' : ''}`}
                            onClick={() => {
                                if (requirePremium()) {
                                    setBurstShare(!burstShare);
                                }
                            }}
                            type="button"
                        >
                            <span className="publish-toggle-knob" />
                        </button>
                    </div>
                    {burstShare && isPremium && (
                        <p className="burst-hint">The link can be opened only once, then it disappears.</p>
                    )}
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
                    {uploadText ? uploadText : (loading ? (uploadProgress > 0 && uploadProgress < 100 ? `Publishing... ${uploadProgress}%` : 'Publishing...') : 'Publish')}
                </button>
            </div>
        </div>
    );
}

