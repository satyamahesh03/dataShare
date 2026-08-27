import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiLock, FiUnlock, FiCopy, FiCheck, FiShield, FiLink, FiArrowLeft, FiEye, FiEyeOff } from 'react-icons/fi';
import { API_URL, authHeaders } from '../config';
import { savePublishedPost } from '../utils/publishedPosts';

const EXPIRY_OPTIONS = [
    { label: '15m', value: 0.25 },
    { label: '30m', value: 0.5 },
    { label: '1h', value: 1 },
    { label: '3h', value: 3 },
    { label: '6h', value: 6 },
    { label: '12h', value: 12 },
    { label: '24h', value: 24 },
];

export default function SecureText() {
    const location = useLocation();
    const navigate = useNavigate();
    const isDecryptPage = location.pathname === '/secure/decrypt';
    const mode = isDecryptPage ? 'decrypt' : 'encrypt';

    const [text, setText] = useState('');
    const [password, setPassword] = useState('');
    const [expiry, setExpiry] = useState(24);

    const [loading, setLoading] = useState(false);
    const [encryptedOutput, setEncryptedOutput] = useState('');
    const [decryptedText, setDecryptedText] = useState('');
    const [pastedMessage, setPastedMessage] = useState(location.state?.message || '');
    const [decryptPassword, setDecryptPassword] = useState('');
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);
    const [animationType, setAnimationType] = useState(null); // 'lock' | 'unlock' | null
    const [showEncPw, setShowEncPw] = useState(false);
    const [showDecPw, setShowDecPw] = useState(false);
    const expiryBarRef = useRef(null);
    const encRef = useRef(null);
    const decRef = useRef(null);
    const [sliderStyle, setSliderStyle] = useState({});

    // Explicitly auto-focus when mode changes or user navigates between features
    useEffect(() => {
        setTimeout(() => {
            if (mode === 'encrypt' && !encryptedOutput && encRef.current) {
                encRef.current.focus();
            } else if (mode === 'decrypt' && !decryptedText && decRef.current) {
                decRef.current.focus();
            }
        }, 50);
    }, [mode, encryptedOutput, decryptedText]);

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
    }, []);

    useEffect(() => {
        updateSlider();
    }, [expiry, updateSlider]);

    // ── ENCRYPT ──
    const handleEncrypt = async () => {
        if (!text) return setError('Please enter a message to encrypt.');
        if (!password) return setError('Please provide a password.');

        setLoading(true);
        setError('');
        setEncryptedOutput('');

        try {
            const res = await fetch(`${API_URL}/api/secure/encrypt`, {
                method: 'POST',
                headers: authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ text, password, expiryHours: expiry }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Encryption failed');

            setLoading(false);
            setText('');
            setPassword('');

            // Calculate exact expiry date
            const expDate = new Date();
            expDate.setTime(expDate.getTime() + expiry * 60 * 60 * 1000);

            // Save to published posts
            savePublishedPost({
                code: data.encryptedMessage,
                expiresAt: expDate.toISOString(),
                type: 'secure',
            });

            setAnimationType('lock');
            setTimeout(() => {
                setAnimationType(null);
                setEncryptedOutput(data.encryptedMessage);
            }, 2000);
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    // ── DECRYPT ──
    const handleDecrypt = async () => {
        if (!pastedMessage) return setError('Please paste the encrypted message.');
        if (!decryptPassword) return setError('Please provide the password.');

        setLoading(true);
        setError('');
        setDecryptedText('');

        try {
            const res = await fetch(`${API_URL}/api/secure/decrypt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ encryptedMessage: pastedMessage.trim(), password: decryptPassword }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Decryption failed. Wrong password or invalid message.');

            setPastedMessage('');
            setDecryptPassword('');

            setLoading(false);
            setAnimationType('unlock');
            setTimeout(() => {
                setAnimationType(null);
                setDecryptedText(data.text);
            }, 2000);
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    const copyText = () => {
        navigator.clipboard.writeText(encryptedOutput);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const copyDecryptLink = () => {
        const link = `${window.location.origin}/secure/decrypt`;
        navigator.clipboard.writeText(link);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
    };

    const switchMode = (target) => {
        setError('');
        setEncryptedOutput('');
        setDecryptedText('');
        setText('');
        setPassword('');
        setPastedMessage('');
        setDecryptPassword('');
        navigate(target === 'encrypt' ? '/secure/encrypt' : '/secure/decrypt');
    };

    return (
        <>
            {animationType && (
                <div className="secure-overlay">
                    <div className="secure-overlay-content">
                        <div className="lock-anim-container">
                            <div className="lock-anim-ring" />
                            <div className="lock-anim-ring ring-2" />
                            <div className={`lock-anim-icon ${animationType}`}>
                                {animationType === 'lock' ? <FiLock /> : <FiUnlock />}
                            </div>
                            <div className="lock-particles">
                                {[...Array(8)].map((_, i) => (
                                    <span key={i} className="lock-particle" style={{ '--i': i }} />
                                ))}
                            </div>
                        </div>
                        <h2 className="secure-overlay-title">
                            {animationType === 'lock' ? 'Message Secured!' : 'Message Unlocked!'}
                        </h2>
                        <div className="secure-overlay-bar">
                            <div className="secure-overlay-bar-fill" />
                        </div>
                    </div>
                </div>
            )}
            <main className="tool-page secure-page">
                <div className="tool-header">
                    <div className="breadcrumb">
                        <button className="back-btn" onClick={() => navigate('/')} aria-label="Go back">
                            <FiArrowLeft />
                        </button>
                    </div>
                </div>

                <div className="secure-wrapper">
                    <div className="secure-hero">
                        <h1 className="secure-title"><span className="highlight">Safe</span>Vault</h1>
                        <p className="secure-subtitle">Encrypt and decrypt your messages with a password.</p>
                    </div>

                    <div className="secure-tabs">
                        <button
                            className={`secure-tab ${mode === 'encrypt' ? 'active' : ''}`}
                            onClick={() => switchMode('encrypt')}
                        >
                            <FiLock /> Encrypt
                        </button>
                        <button
                            className={`secure-tab ${mode === 'decrypt' ? 'active' : ''}`}
                            onClick={() => switchMode('decrypt')}
                        >
                            <FiUnlock /> Decrypt
                        </button>
                    </div>

                    <div className="secure-card">
                        {error && <div className="secure-error-banner">{error}</div>}

                        {mode === 'encrypt' ? (
                            <>
                                {encryptedOutput ? (
                                    <div className="secure-success-box">
                                        <FiShield className="secure-shield-icon" />
                                        <h2>Message Encrypted!</h2>
                                        <p>Copy the encrypted text below and share it along with the password. The recipient can decrypt it at the link.</p>

                                        <div className="encrypted-preview" onClick={copyText} title="Click to copy">
                                            <code>{encryptedOutput.slice(0, 50)}...</code>
                                            {copied && <span className="copied-tag">✓ Copied!</span>}
                                        </div>

                                        <div className="secure-success-actions">
                                            <button className="primary-btn" onClick={copyText}>
                                                {copied ? <FiCheck /> : <FiCopy />} {copied ? 'Copied!' : 'Copy Encrypted Text'}
                                            </button>
                                            <button className="secondary-btn" onClick={() => { setEncryptedOutput(''); setText(''); setPassword(''); }}>
                                                Encrypt Another
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="secure-textarea-wrap">
                                            <textarea
                                                ref={encRef}
                                                value={text}
                                                onChange={(e) => setText(e.target.value)}
                                                placeholder="Enter the message you want to encrypt..."
                                                spellCheck="false"
                                                className="secure-textarea"
                                            />
                                        </div>

                                        <div className="secure-bottom-bar">
                                            <div className="expiry-bar" ref={expiryBarRef}>
                                                <div
                                                    className="expiry-slider"
                                                    style={{
                                                        left: sliderStyle.left,
                                                        top: sliderStyle.top,
                                                        width: sliderStyle.width,
                                                        height: sliderStyle.height,
                                                    }}
                                                />
                                                {EXPIRY_OPTIONS.map(opt => (
                                                    <button
                                                        key={opt.value}
                                                        className={`expiry-pill ${expiry === opt.value ? 'active' : ''}`}
                                                        onClick={() => setExpiry(opt.value)}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="secure-row">
                                                <div className="pw-input-wrap">
                                                    <input
                                                        type={showEncPw ? 'text' : 'password'}
                                                        className="secure-input"
                                                        placeholder="Password"
                                                        value={password}
                                                        onChange={e => setPassword(e.target.value)}
                                                    />
                                                    <button type="button" className="pw-toggle" onClick={() => setShowEncPw(!showEncPw)}>
                                                        {showEncPw ? <FiEyeOff /> : <FiEye />}
                                                    </button>
                                                </div>
                                                <button
                                                    className="secure-action-btn"
                                                    onClick={handleEncrypt}
                                                    disabled={!text || !password || loading}
                                                >
                                                    {loading ? <div className="spinner" /> : <><FiLock /> Encrypt</>}
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </>
                        ) : (
                            <>
                                {decryptedText ? (
                                    <div className="secure-success-box">
                                        <FiUnlock className="decrypt-unlock-icon" />
                                        <h2>Message Decrypted!</h2>
                                        <div className="decrypted-payload-box" style={{ width: '100%', textAlign: 'left' }}>
                                            {decryptedText}
                                        </div>
                                        <div className="secure-success-actions">
                                            <button className="secondary-btn" onClick={() => { setDecryptedText(''); setPastedMessage(''); setDecryptPassword(''); }}>
                                                Decrypt Another
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="secure-decrypt-form">
                                        <textarea
                                            ref={decRef}
                                            className="secure-textarea"
                                            placeholder="Paste the encrypted text here..."
                                            value={pastedMessage}
                                            onChange={e => setPastedMessage(e.target.value)}
                                            spellCheck="false"
                                        />
                                        <div className="secure-row">
                                            <div className="pw-input-wrap">
                                                <input
                                                    type={showDecPw ? 'text' : 'password'}
                                                    className="secure-input"
                                                    placeholder="Password"
                                                    value={decryptPassword}
                                                    onChange={e => setDecryptPassword(e.target.value)}
                                                />
                                                <button type="button" className="pw-toggle" onClick={() => setShowDecPw(!showDecPw)}>
                                                    {showDecPw ? <FiEyeOff /> : <FiEye />}
                                                </button>
                                            </div>
                                            <button
                                                className="secure-action-btn"
                                                onClick={handleDecrypt}
                                                disabled={!pastedMessage || !decryptPassword || loading}
                                            >
                                                {loading ? <div className="spinner" /> : <><FiUnlock /> Decrypt</>}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </main>
        </>
    );
}
