import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiLock, FiUnlock, FiCopy, FiCheck, FiShield, FiLink } from 'react-icons/fi';
import { API_URL } from '../config';

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
    const [pastedMessage, setPastedMessage] = useState('');
    const [decryptPassword, setDecryptPassword] = useState('');
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);

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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, password, expiryHours: expiry }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Encryption failed');

            setEncryptedOutput(data.encryptedMessage);
            setText('');
            setPassword('');
        } catch (err) {
            setError(err.message);
        } finally {
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

            setDecryptedText(data.text);
        } catch (err) {
            setError(err.message);
        } finally {
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
        navigate(target === 'encrypt' ? '/secure/encrypt' : '/secure/decrypt');
    };

    return (
        <main className="tool-page secure-page">
            <div className="tool-header">
                <div>
                    <h1 className="hero-title"><span className="highlight">Safe</span>Vault</h1>
                    <p className="hero-subtitle">Encrypt and decrypt your messages with a password.</p>
                </div>
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

            <div className="content-area secure-area">
                {error && <div className="secure-error-banner">{error}</div>}

                {mode === 'encrypt' ? (
                    <>
                        {encryptedOutput ? (
                            <div className="secure-success-box">
                                <FiShield className="secure-shield-icon" />
                                <h2>Message Encrypted!</h2>
                                <p>Copy the encrypted text below and share it along with the password. The recipient can decrypt it at the link.</p>

                                <div className="decrypted-payload-box" style={{ wordBreak: 'break-all', cursor: 'pointer' }} onClick={copyText} title="Click to copy">
                                    {encryptedOutput.length > 100 ? encryptedOutput.slice(0, 100) + '...' : encryptedOutput}
                                    {copied && <span style={{ display: 'block', marginTop: '8px', color: 'var(--success)', fontSize: '0.85rem' }}>✓ Copied!</span>}
                                </div>

                                <div className="secure-success-actions">
                                    <button className="primary-btn" onClick={copyText}>
                                        {copied ? <FiCheck /> : <FiCopy />} {copied ? 'Copied!' : 'Copy Encrypted Text'}
                                    </button>
                                    <button className="secondary-btn" onClick={copyDecryptLink}>
                                        {copiedLink ? <FiCheck /> : <FiLink />} {copiedLink ? 'Link Copied!' : 'Copy Decrypt Link'}
                                    </button>
                                    <button className="secondary-btn" onClick={() => { setEncryptedOutput(''); setText(''); setPassword(''); }}>
                                        Encrypt Another
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="text-editor">
                                    <textarea
                                        value={text}
                                        onChange={(e) => setText(e.target.value)}
                                        placeholder="Enter the message you want to encrypt..."
                                        spellCheck="false"
                                    />
                                </div>

                                <div className="secure-bottom-bar">
                                    <div className="expiry-bar">
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
                                        <input
                                            type="password"
                                            className="secure-input password-input"
                                            placeholder="Password"
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                        />
                                        <button
                                            className="primary-btn publish-btn"
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
                            <div className="decrypt-box">
                                <textarea
                                    className="secure-input"
                                    placeholder="Paste the encrypted text here..."
                                    value={pastedMessage}
                                    onChange={e => setPastedMessage(e.target.value)}
                                    spellCheck="false"
                                    style={{ minHeight: '150px', resize: 'vertical', width: '100%' }}
                                />
                                <div className="secure-row">
                                    <input
                                        type="password"
                                        className="secure-input password-input"
                                        placeholder="Password"
                                        value={decryptPassword}
                                        onChange={e => setDecryptPassword(e.target.value)}
                                    />
                                    <button
                                        className="primary-btn publish-btn"
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
        </main>
    );
}
