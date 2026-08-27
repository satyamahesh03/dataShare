import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useToast } from '../context/ToastContext';
import { format } from 'date-fns';
import { FiCopy, FiDownload, FiShare2, FiX, FiCheck, FiEdit2, FiSave } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { API_URL, authHeaders } from '../config';

export default function ShareResult({ shareData, onClose }) {
    const { addToast } = useToast();
    const navigate = useNavigate();
    const { isPremium, setShowPremium, requirePremium } = useAuth();

    const [codeCopied, setCodeCopied] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);
    const [displayCode, setDisplayCode] = useState(shareData.code);
    const [isEditing, setIsEditing] = useState(false);
    const [customSlug, setCustomSlug] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const shareUrl = `${window.location.origin}/share/${displayCode}`;
    const expiresAt = new Date(shareData.expiresAt);

    const copyCode = async () => {
        try {
            await navigator.clipboard.writeText(shareData.code);
            setCodeCopied(true);
            addToast('Code copied to clipboard', 'success');
            setTimeout(() => setCodeCopied(false), 2000);
        } catch {
            addToast('Failed to copy', 'error');
        }
    };

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setLinkCopied(true);
            addToast('Link copied to clipboard', 'success');
            setTimeout(() => setLinkCopied(false), 2000);
        } catch {
            addToast('Failed to copy link', 'error');
        }
    };

    const downloadQR = () => {
        const svg = document.getElementById('share-qr-code');
        if (!svg) return;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const data = new XMLSerializer().serializeToString(svg);
        const img = new Image();
        const svgBlob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        img.onload = () => {
            canvas.width = 400;
            canvas.height = 400;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 400, 400);
            ctx.drawImage(img, 25, 25, 350, 350);
            URL.revokeObjectURL(url);

            const link = document.createElement('a');
            link.download = `datashare-${shareData.code}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            addToast('QR code downloaded', 'success');
        };

        img.src = url;
    };

    const handleHomeClick = () => {
        onClose();
        navigate('/');
    };

    const handleSaveSlug = async () => {
        if (!customSlug.trim()) {
            setIsEditing(false);
            return;
        }

        setIsSaving(true);
        try {
            const res = await fetch(`${API_URL}/api/share/${shareData.code}/custom`, {
                method: 'PUT',
                headers: authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ customSlug })
            });
            const data = await res.json();

            if (res.ok) {
                setDisplayCode(data.customSlug);
                setIsEditing(false);
                addToast('Custom link saved!', 'success');
            } else {
                addToast(data.error || 'Failed to update link', 'error');
            }
        } catch (err) {
            addToast('Network error', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleClose = () => {
        onClose();
        navigate('/');
    };

    return (
        <div className="published-overlay">
            <div className="published-page">
                {/* Close Button */}
                <button className="published-close" onClick={handleClose}>
                    <FiX />
                </button>

                {/* Success Header */}
                <div className="published-header">
                    <div className="published-success-icon">
                        <FiCheck />
                    </div>
                    <h1 className="published-title">Published</h1>
                    <p className="published-subtitle">
                        {shareData.burstShare
                            ? 'Burst Share is ready — this link can be opened only once.'
                            : 'Your content is ready to view!'}
                    </p>
                </div>

                {/* Big Code Display */}
                <div className="published-code-container">
                    <div className="published-code" onClick={copyCode} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ display: 'flex' }}>
                            {shareData.code.split('').map((char, i) => (
                                <span key={i} className="published-code-char">{char}</span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Share URL */}
                <div className="published-url" onClick={!isEditing ? copyLink : undefined} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: isEditing ? 'default' : 'pointer' }}>
                    {!isEditing ? (
                        <>
                            <span className="published-url-text">{shareUrl}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                {displayCode === shareData.code && (
                                    <button
                                        onClick={(e) => { 
                                            e.stopPropagation(); 
                                            if (isPremium) {
                                                setIsEditing(true); 
                                                setCustomSlug('');
                                            } else {
                                                setShowPremium(true);
                                            }
                                        }}
                                        style={{ background: 'none', border: 'none', color: '#fbbf24', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                        title="Create custom link"
                                    >
                                        <FiEdit2 size={16} />
                                    </button>
                                )}
                                <span className="published-url-copy">
                                    {linkCopied ? <FiCheck size={18} /> : <FiCopy size={18} />}
                                </span>
                            </div>
                        </>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '0.5rem' }}>
                            <span style={{ color: '#9ca3af', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                                .../
                            </span>
                            <input
                                type="text"
                                value={customSlug}
                                onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                                placeholder="custom-link"
                                disabled={isSaving}
                                autoFocus
                                style={{
                                    flex: 1,
                                    padding: '0.5rem',
                                    background: 'rgba(0,0,0,0.3)',
                                    border: '1px solid #fbbf24',
                                    color: 'white',
                                    borderRadius: '0.25rem',
                                    outline: 'none',
                                    fontSize: '0.9rem',
                                    minWidth: 0
                                }}
                            />
                            <button
                                onClick={handleSaveSlug}
                                disabled={isSaving}
                                style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', padding: '0.25rem' }}
                            >
                                {isSaving ? '...' : <FiCheck size={20} />}
                            </button>
                            <button
                                onClick={() => setIsEditing(false)}
                                disabled={isSaving}
                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem' }}
                            >
                                <FiX size={20} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Expiry Info */}
                <div className="published-expiry">
                    <p className="published-expiry-label">This content will expire on</p>
                    <p className="published-expiry-date">
                        {format(expiresAt, 'MMMM d \'at\' HH:mm')}
                    </p>
                </div>

                {/* QR Code */}
                <div className="published-qr">
                    <div className="published-qr-card">
                        <QRCodeSVG
                            id="share-qr-code"
                            value={shareUrl}
                            size={160}
                            level="M"
                            includeMargin={false}
                            bgColor="#ffffff"
                            fgColor="#111827"
                        />
                    </div>
                    <p className="published-qr-text">Scan the QR code to open the link.</p>
                    <button className="published-qr-download" onClick={downloadQR}>
                        <FiDownload /> Download QR
                    </button>
                </div>
            </div>
        </div>
    );
}
