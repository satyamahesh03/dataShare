import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useToast } from '../context/ToastContext';
import { format } from 'date-fns';
import { FiCopy, FiDownload, FiShare2, FiX, FiCheck } from 'react-icons/fi';

export default function ShareResult({ shareData, onClose }) {
    const { addToast } = useToast();
    const navigate = useNavigate();
    const [codeCopied, setCodeCopied] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);

    const shareUrl = `${window.location.origin}/share/${shareData.code}`;
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
                <div className="published-code" onClick={copyCode}>
                    {shareData.code.split('').map((char, i) => (
                        <span key={i} className="published-code-char">{char}</span>
                    ))}
                </div>

                {/* Share URL */}
                <div className="published-url" onClick={copyLink}>
                    <span className="published-url-text">{shareUrl}</span>
                    <span className="published-url-copy">
                        {linkCopied ? <FiCheck /> : <FiCopy />}
                    </span>
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
