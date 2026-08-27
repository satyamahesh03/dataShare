import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { FiFile, FiImage, FiFileText, FiDownload, FiLock, FiClock, FiArrowLeft, FiAlertTriangle, FiEye, FiEyeOff } from 'react-icons/fi';
import { API_URL } from '../config';
import ViewOnceIcon from '../components/ViewOnceIcon';
import PdfViewer from '../components/PdfViewer';

export default function ViewShare() {
    const { code } = useParams();
    const [status, setStatus] = useState('loading'); // loading, password, content, error
    const [shareData, setShareData] = useState(null);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [downloading, setDownloading] = useState(false);
    const [showPw, setShowPw] = useState(false);
    const [isBurst, setIsBurst] = useState(false);
    const [blackout, setBlackout] = useState(false);

    useEffect(() => {
        if (!shareData?.burstShare) return;

        const handleKeyDown = (e) => {
            if (
                e.key === 'PrintScreen' || 
                (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key))
            ) {
                setBlackout(true);
            }
        };

        const handleKeyUp = (e) => {
            if (
                e.key === 'PrintScreen' || 
                e.key === 'Meta' || e.key === 'Shift'
            ) {
                setBlackout(false);
            }
        };

        const handleVisibilityChange = () => {
            if (document.hidden) {
                setBlackout(true);
            } else {
                setBlackout(false);
            }
        };

        const handleBlur = () => setBlackout(true);
        const handleFocus = () => setBlackout(false);

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', handleBlur);
        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleBlur);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [shareData?.burstShare]);

    useEffect(() => {
        lookupShare();
    }, [code]);

    const lookupShare = async () => {
        try {
            const res = await fetch(`${API_URL}/api/share/lookup/${code}`);
            const data = await res.json();

            if (!res.ok) {
                setStatus('error');
                setError(data.error || (res.status === 410 ? 'This one-time share has already been opened' : 'Share not found'));
                return;
            }

            setIsBurst(!!data.burstShare);
            if (data.hasPassword) {
                setStatus('password');
            } else if (data.burstShare) {
                setStatus('burst');
            } else {
                await accessShare();
            }
        } catch {
            setStatus('error');
            setError('Failed to connect to server');
        }
    };

    const accessShare = async (pw = '') => {
        try {
            const res = await fetch(`${API_URL}/api/share/access/${code}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: pw || undefined }),
            });

            const data = await res.json();

            if (!res.ok) {
                if (res.status === 401) {
                    setPasswordError(data.error || 'Incorrect password');
                    return;
                }
                setStatus('error');
                setError(data.error || 'Failed to access share');
                return;
            }

            setShareData(data);
            setStatus('content');
        } catch {
            setStatus('error');
            setError('Failed to connect to server');
        }
    };

    const handlePasswordSubmit = (e) => {
        e.preventDefault();
        setPasswordError('');
        accessShare(password);
    };

    const formatSize = (bytes) => {
        if (!bytes) return '';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const getFileIcon = (type) => {
        if (type?.startsWith('image/')) return <FiImage />;
        if (type?.startsWith('text/')) return <FiFileText />;
        return <FiFile />;
    };

    const handleDownload = async (fileUrl, fileName, filePublicId) => {
        if (!fileUrl) return;
        setDownloading(true);
        try {
            // Check if it's an S3 url or old Cloudinary url
            if (filePublicId && fileUrl.includes('amazonaws.com')) {
                // Generate a fresh presigned URL to force download
                const res = await fetch(`${API_URL}/api/share/download-url?key=${encodeURIComponent(filePublicId)}&name=${encodeURIComponent(fileName || 'download')}`);
                const data = await res.json();
                if (data.url) {
                    window.location.href = data.url;
                    return;
                }
            }

            // Fallback for Cloudinary files or if S3 presigning fails
            const response = await fetch(fileUrl, {
                mode: 'cors',
                cache: 'no-cache', // Bypass browser cache in case it cached a non-CORS response previously
            });

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName || 'download';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Download fetch failed:', err);
            // Fallback: simply open the URL in a new tab if fetch is still blocked
            window.open(fileUrl, '_blank');
        } finally {
            setDownloading(false);
        }
    };

    const isImage = (type) => type?.startsWith('image/');
    const isVideo = (type) => type?.startsWith('video/');
    const isAudio = (type) => type?.startsWith('audio/');
    const isPdf = (type) => type === 'application/pdf';

    const renderFormattedContent = (text) => {
        if (!text) return null;
        const lines = text.split('\n');

        return lines.map((line, i) => {
            // Heading 3 (check longest prefix first)
            if (line.startsWith('### ')) {
                return <h3 key={i} className="view-block view-h3">{line.slice(4)}</h3>;
            }
            // Heading 2
            if (line.startsWith('## ')) {
                return <h2 key={i} className="view-block view-h2">{line.slice(3)}</h2>;
            }
            // Heading 1
            if (line.startsWith('# ')) {
                return <h1 key={i} className="view-block view-h1">{line.slice(2)}</h1>;
            }
            // Bullet list
            if (line.startsWith('• ')) {
                return (
                    <div key={i} className="view-block view-bullet">
                        <span className="view-bullet-dot">•</span>
                        <span>{line.slice(2)}</span>
                    </div>
                );
            }
            // Numbered list
            if (/^\d+\.\s/.test(line)) {
                const match = line.match(/^(\d+\.)\s(.*)/);
                return (
                    <div key={i} className="view-block view-numbered">
                        <span className="view-numbered-num">{match[1]}</span>
                        <span>{match[2]}</span>
                    </div>
                );
            }
            // Todo (checked)
            if (line.startsWith('☑ ')) {
                return (
                    <div key={i} className="view-block view-todo checked">
                        <span className="view-todo-check">☑</span>
                        <span className="view-todo-text checked">{line.slice(2)}</span>
                    </div>
                );
            }
            // Todo (unchecked)
            if (line.startsWith('☐ ')) {
                return (
                    <div key={i} className="view-block view-todo">
                        <span className="view-todo-check">☐</span>
                        <span className="view-todo-text">{line.slice(2)}</span>
                    </div>
                );
            }
            // Empty line
            if (!line.trim()) {
                return <div key={i} className="view-block view-empty">&nbsp;</div>;
            }
            // Regular text
            return <p key={i} className="view-block view-text">{line}</p>;
        });
    };

    // Loading State
    if (status === 'loading') {
        return (
            <div className="page-loading">
                <div className="loading-spinner" />
            </div>
        );
    }

    // Error State
    if (status === 'error') {
        return (
            <div className="error-page">
                <div className="error-icon"><FiAlertTriangle /></div>
                <h2 className="error-title">{error?.toLowerCase().includes('opened') ? 'Already Opened' : 'Share Not Found'}</h2>
                <p className="error-desc">
                    {error || 'This share does not exist or has expired.'}
                </p>
                <Link to="/" className="home-link">
                    <FiArrowLeft /> Go Home
                </Link>
            </div>
        );
    }

    // Burst / view-once gate
    if (status === 'burst') {
        return (
            <div className="password-gate">
                <div className="password-gate-card">
                    <div className="password-gate-icon burst-gate-icon">
                        <ViewOnceIcon size={32} />
                    </div>
                    <h2 className="password-gate-title">View once</h2>
                    <p className="password-gate-desc">
                        This Burst Share can be opened only one time. After you view it, the link will no longer work.
                    </p>
                    <button
                        type="button"
                        className="publish-btn"
                        style={{ width: '100%', justifyContent: 'center' }}
                        onClick={() => accessShare()}
                    >
                        Open once
                    </button>
                </div>
            </div>
        );
    }

    // Password Gate
    if (status === 'password') {
        return (
            <div className="password-gate">
                <div className="password-gate-card">
                    <div className="password-gate-icon">
                        <FiLock />
                    </div>
                    <h2 className="password-gate-title">Password Protected</h2>
                    <p className="password-gate-desc">
                        {isBurst
                            ? 'This Burst Share is password protected and can be opened only once.'
                            : 'This share is password protected. Enter the password to view the content.'}
                    </p>
                    <form onSubmit={handlePasswordSubmit}>
                        <div className="pw-input-wrap pw-gate-wrap">
                            <input
                                type={showPw ? 'text' : 'password'}
                                className="password-gate-input"
                                placeholder="Enter password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoFocus
                            />
                            <button type="button" className="pw-toggle" onClick={() => setShowPw(!showPw)}>
                                {showPw ? <FiEyeOff /> : <FiEye />}
                            </button>
                        </div>
                        {passwordError && (
                            <p className="password-gate-error">{passwordError}</p>
                        )}
                        <button type="submit" className="publish-btn" style={{ width: '100%', justifyContent: 'center' }}>
                            Unlock
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // Content View
    return (
        <div className="view-page">
            {blackout && shareData?.burstShare && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'black', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexDirection: 'column' }}>
                    <FiLock size={48} style={{ marginBottom: '16px' }} />
                    <h2>Screenshots Disabled</h2>
                    <p>This is a secure Burst Share.</p>
                </div>
            )}
            <div className="view-card">
                <div className="view-card-header">
                    <div className="view-card-title">
                        {shareData.type === 'text' ? <FiFileText /> : <FiFile />}
                        {shareData.type === 'text' ? 'Shared Text' : shareData.fileName}
                    </div>
                    <div className="view-card-meta">
                        <span>
                            <FiClock style={{ marginRight: 4, verticalAlign: 'middle' }} />
                            {shareData.burstShare ? 'Disappears after this view' : `Expires ${formatDistanceToNow(new Date(shareData.expiresAt), { addSuffix: true })}`}
                        </span>
                        {shareData.burstShare && (
                            <span className="burst-view-badge">
                                <ViewOnceIcon size={14} /> View once
                            </span>
                        )}
                        {shareData.type === 'file' && (
                            <span>
                                {(shareData.files || []).length} file{(shareData.files || []).length !== 1 ? 's' : ''}
                                {shareData.fileSize > 0 && ` · ${formatSize(shareData.files ? shareData.files.reduce((s, f) => s + (f.fileSize || 0), 0) : shareData.fileSize)}`}
                            </span>
                        )}
                    </div>
                </div>

                <div 
                    className="view-card-body"
                    onContextMenu={(e) => e.preventDefault()}
                    style={{ userSelect: shareData?.burstShare ? 'none' : 'auto' }}
                >
                    {shareData.type === 'text' ? (
                        <div className="view-text-content">
                            {renderFormattedContent(shareData.textContent)}
                        </div>
                    ) : (
                        <div className="view-files-list">
                            {(shareData.files || [{ fileUrl: shareData.fileUrl, fileName: shareData.fileName, fileType: shareData.fileType, fileSize: shareData.fileSize }]).map((file, i) => (
                                <div key={i} className="view-file-item">
                                    {isImage(file.fileType) ? (
                                        <img
                                            src={file.fileUrl}
                                            alt={file.fileName}
                                            className="view-image-preview"
                                        />
                                    ) : isVideo(file.fileType) ? (
                                        <video
                                            src={file.fileUrl}
                                            controls
                                            controlsList="nodownload"
                                            className="view-video-preview"
                                            style={{ width: '100%', maxHeight: '400px', borderRadius: '8px', backgroundColor: '#000', marginBottom: '12px' }}
                                        />
                                    ) : isAudio(file.fileType) ? (
                                        <div className="view-audio-container" style={{ padding: '16px', background: 'var(--bg-color)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '12px' }}>
                                            <div style={{ marginBottom: '12px', fontWeight: 500, fontSize: '14px', color: 'var(--text-secondary)' }}>{file.fileName}</div>
                                            <audio
                                                src={file.fileUrl}
                                                controls
                                                controlsList="nodownload"
                                                className="view-audio-preview"
                                                style={{ width: '100%' }}
                                            />
                                        </div>
                                    ) : isPdf(file.fileType) ? (
                                        <PdfViewer fileUrl={file.fileUrl} burstShare={shareData.burstShare} />
                                    ) : (
                                        <div className="view-file-row">
                                            <div className="view-file-icon-sm">
                                                {getFileIcon(file.fileType)}
                                            </div>
                                            <div className="view-file-info">
                                                <span className="view-file-name">{file.fileName}</span>
                                                {file.fileSize > 0 && <span className="view-file-size">{formatSize(file.fileSize)}</span>}
                                            </div>
                                        </div>
                                    )}
                                    {!shareData.burstShare && (
                                        <button
                                            className="download-btn"
                                            onClick={() => handleDownload(file.fileUrl, file.fileName, file.filePublicId)}
                                            disabled={downloading}
                                        >
                                            <FiDownload /> {downloading ? 'Downloading...' : `Download${(shareData.files || []).length > 1 ? '' : ' File'}`}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
