import { useState, useRef, useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiUploadCloud, FiFile, FiX, FiImage, FiFileText, FiPlus, FiArrowLeft } from 'react-icons/fi';
import { useToast } from '../context/ToastContext';
import { savePublishedPost } from '../utils/publishedPosts';
import ShareResult from '../components/ShareResult';
import PublishModal from '../components/PublishModal';
import { API_URL, authHeaders, FREE_MAX_BYTES, PREMIUM_MAX_BYTES } from '../config';
import { useAuth } from '../context/AuthContext';
import { pendingDroppedFiles, clearPendingDroppedFiles } from '../components/GlobalDragDrop';
const MAX_FILES = 5;

export default function FileShare() {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [shareResult, setShareResult] = useState(null);
    const [showPublishModal, setShowPublishModal] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const fileInputRef = useRef(null);
    const xhrRef = useRef(null);
    const progressTimerRef = useRef(null);
    const { addToast } = useToast();
    const navigate = useNavigate();
    const { isPremium, setShowPremium } = useAuth();
    const maxTotalSize = isPremium ? PREMIUM_MAX_BYTES : FREE_MAX_BYTES;
    const limitLabel = isPremium ? '1GB' : '50MB';

    const totalSize = files.reduce((sum, f) => sum + f.size, 0);

    const addFiles = useCallback((newFiles) => {
        const fileList = Array.from(newFiles);
        let currentTotal = 0;
        setFiles(prev => {
            currentTotal = prev.reduce((sum, f) => sum + f.size, 0);
            let addedTotal = currentTotal;
            const validFiles = [];

            for (const f of fileList) {
                if (prev.length + validFiles.length >= MAX_FILES) {
                    addToast(`Maximum ${MAX_FILES} files allowed`, 'error');
                    break;
                }
                if (addedTotal + f.size > maxTotalSize) {
                    addToast(`Adding "${f.name}" would exceed the ${limitLabel} limit`, 'error');
                    if (!isPremium) setShowPremium(true);
                    break;
                }
                if (!prev.some(existing => existing.name === f.name && existing.size === f.size)) {
                    validFiles.push(f);
                    addedTotal += f.size;
                }
            }

            if (validFiles.length > 0) {
                return [...prev, ...validFiles];
            }
            return prev;
        });
    }, [addToast, isPremium, limitLabel, maxTotalSize, setShowPremium]);

    // Handle globally dropped files
    useEffect(() => {
        if (pendingDroppedFiles && pendingDroppedFiles.length > 0) {
            addFiles(pendingDroppedFiles);
            // clear the module-level variable
            clearPendingDroppedFiles();
        }
    }, [addFiles]);

    const handleDrop = (e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length > 0) {
            addFiles(e.dataTransfer.files);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setDragging(true);
    };

    const handleDragLeave = () => setDragging(false);

    const removeFile = (index) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const formatSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
    };

    const getFileIcon = (type) => {
        if (type?.startsWith('image/')) return <FiImage />;
        if (type?.startsWith('text/')) return <FiFileText />;
        return <FiFile />;
    };

    const getUploadText = () => {
        if (!loading) return 'Publish';
        if (uploadProgress >= 100) return 'Saving to Cloud...';
        if (uploadProgress > 0) return `Uploading... ${uploadProgress}%`;
        return 'Publishing...';
    };

    const handlePublishClick = () => {
        if (files.length === 0) {
            addToast('Please select at least one file to share', 'error');
            return;
        }
        setShowPublishModal(true);
    };

    const handlePublish = async ({ expiryMinutes, password, burstShare }) => {
        setLoading(true);
        setUploadProgress(0);

        try {
            // 1. Get Presigned URLs
            const fileInfo = files.map(f => ({
                fileName: f.name,
                fileType: f.type,
                fileSize: f.size
            }));

            const urlRes = await fetch(`${API_URL}/api/share/upload-url`, {
                method: 'POST',
                headers: authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ files: fileInfo })
            });

            if (!urlRes.ok) {
                const errData = await urlRes.json().catch(() => ({}));
                if (errData.upgradeRequired) setShowPremium(true);
                throw new Error(errData.error || 'Failed to get upload URLs');
            }
            const { uploadUrls } = await urlRes.json();

            // 2. Upload to S3 directly
            let totalBytesUploaded = 0;
            const uploadedFilesArr = [];

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const { uploadUrl, publicId } = uploadUrls[i];

                await new Promise((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhrRef.current = xhr;

                    xhr.upload.onprogress = (e) => {
                        if (e.lengthComputable) {
                            const currentFileProgress = e.loaded;
                            const overallProgress = Math.round(((totalBytesUploaded + currentFileProgress) / totalSize) * 90);
                            setUploadProgress(overallProgress);
                        }
                    };

                    xhr.open('PUT', uploadUrl);
                    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

                    xhr.onload = () => {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            totalBytesUploaded += file.size;
                            resolve();
                        } else {
                            reject(new Error(`S3 Upload failed: ${xhr.status}`));
                        }
                    };
                    xhr.onerror = () => reject(new Error('Network Error during S3 upload'));
                    xhr.onabort = () => reject(new Error('Upload cancelled'));

                    xhr.send(file);
                });

                uploadedFilesArr.push({
                    publicId,
                    fileName: file.name,
                    fileType: file.type,
                    fileSize: file.size
                });
            }

            // 3. Create Share on Backend
            setUploadProgress(95);

            const createRes = await fetch(`${API_URL}/api/share/create`, {
                method: 'POST',
                headers: authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({
                    type: 'file',
                    files: uploadedFilesArr,
                    expiryMinutes,
                    password,
                    burstShare,
                })
            });

            const data = await createRes.json().catch(() => ({}));

            if (createRes.ok && data.success) {
                setUploadProgress(100);
                savePublishedPost({ code: data.code, expiresAt: data.expiresAt, type: 'file' });
                setShareResult(data);
                setShowPublishModal(false);
                addToast(`${files.length} file(s) shared successfully!`, 'success');
            } else {
                if (data.upgradeRequired) setShowPremium(true);
                throw new Error(data.error || 'Failed to finish creating share');
            }

        } catch (err) {
            if (err.message !== 'Upload cancelled') {
                addToast(err.message || 'Upload failed. Please try again.', 'error');
            } else {
                addToast('Upload cancelled.', 'info');
            }
        } finally {
            setLoading(false);
            setUploadProgress(0);
            xhrRef.current = null;
        }
    };

    const handleCloseModal = () => {
        if (loading && xhrRef.current) {
            xhrRef.current.abort();
            xhrRef.current = null;
        }
        setShowPublishModal(false);
        setLoading(false);
        setUploadProgress(0);
    };

    const handleCloseResult = () => {
        setShareResult(null);
        setFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <main className="tool-page">
            <div className="tool-header">
                <div className="breadcrumb">
                    <button className="back-btn" onClick={() => navigate('/')} aria-label="Go back">
                        <FiArrowLeft />
                    </button>
                    <Link to="/">Tools</Link>
                    <span className="separator">/</span>
                    <span className="current">File Sharing</span>
                </div>
                <button
                    className="publish-btn"
                    onClick={handlePublishClick}
                    disabled={files.length === 0}
                >
                    {getUploadText()}
                </button>
            </div>

            <div
                className={`content-area ${files.length > 0 ? 'active' : ''} ${dragging ? 'dragging-global' : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
            >
                {files.length === 0 ? (
                    <div
                        className={`file-upload-zone ${dragging ? 'dragging' : ''}`}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <div className="upload-icon-wrapper">
                            <FiUploadCloud />
                        </div>
                        <p className="upload-title">Upload files</p>
                        <p className="upload-desc">Drag and drop your files here or click to upload</p>
                        <p className="upload-limit">Up to 5 files · Maximum total size: {limitLabel}{!isPremium ? ' · Sign in for Premium 1GB' : ''}</p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            style={{ display: 'none' }}
                            onChange={(e) => addFiles(e.target.files)}
                        />
                    </div>
                ) : (
                    <div className="files-list-area">
                        <div className="files-list-header">
                            <span className="files-list-count">
                                {files.length} file{files.length !== 1 ? 's' : ''} · {formatSize(totalSize)} / {isPremium ? '1 GB' : '50 MB'}
                            </span>
                            {files.length < MAX_FILES && (
                                <button
                                    className="files-add-btn"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <FiPlus /> Add more
                                </button>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                style={{ display: 'none' }}
                                onChange={(e) => addFiles(e.target.files)}
                            />
                        </div>
                        <div className="files-list">
                            {files.map((file, index) => (
                                <div key={`${file.name}-${index}`} className="file-preview">
                                    <div className="file-preview-icon">
                                        {getFileIcon(file.type)}
                                    </div>
                                    <div className="file-preview-info">
                                        <div className="file-preview-name">{file.name}</div>
                                        <div className="file-preview-size">{formatSize(file.size)}</div>
                                    </div>
                                    <button className="file-remove-btn" onClick={() => removeFile(index)}>
                                        <FiX />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Size bar */}
            {files.length > 0 && (
                <div className="files-size-bar">
                    <div
                        className="files-size-fill"
                        style={{ width: `${Math.min((totalSize / maxTotalSize) * 100, 100)}%` }}
                    />
                </div>
            )}

            <PublishModal
                isOpen={showPublishModal}
                onClose={handleCloseModal}
                onPublish={handlePublish}
                loading={loading}
                uploadProgress={uploadProgress}
                uploadText={loading ? getUploadText() : null}
            />

            {shareResult && (
                <ShareResult
                    shareData={shareResult}
                    onClose={handleCloseResult}
                />
            )}

            {/* Rocket Upload Animation */}
            {loading && uploadProgress > 0 && (
                <div
                    className="upload-rocket-container"
                    style={{
                        bottom: `${uploadProgress}%`,
                        left: `${uploadProgress}%`
                    }}
                >
                    <iframe
                        className="upload-rocket-video"
                        src="/Rocket/index.html"
                        style={{ border: 'none', background: 'transparent' }}
                        title="Upload Animation"
                        allowtransparency="true"
                    />
                </div>
            )}
        </main>
    );
}
