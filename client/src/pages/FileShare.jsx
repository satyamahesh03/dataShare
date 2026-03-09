import { useState, useRef, useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiUploadCloud, FiFile, FiX, FiImage, FiFileText, FiPlus, FiArrowLeft } from 'react-icons/fi';
import { useToast } from '../context/ToastContext';
import { savePublishedPost } from '../utils/publishedPosts';
import ShareResult from '../components/ShareResult';
import PublishModal from '../components/PublishModal';
import { API_URL } from '../config';
const MAX_TOTAL_SIZE = 1024 * 1024 * 1024;
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

    const totalSize = files.reduce((sum, f) => sum + f.size, 0);

    const addFiles = (newFiles) => {
        const fileList = Array.from(newFiles);
        const currentTotal = files.reduce((sum, f) => sum + f.size, 0);
        let addedTotal = currentTotal;
        const validFiles = [];

        for (const f of fileList) {
            if (files.length + validFiles.length >= MAX_FILES) {
                addToast(`Maximum ${MAX_FILES} files allowed`, 'error');
                break;
            }
            if (addedTotal + f.size > MAX_TOTAL_SIZE) {
                addToast(`Adding "${f.name}" would exceed 1GB limit`, 'error');
                break;
            }
            // Avoid duplicates by name+size
            if (!files.some(existing => existing.name === f.name && existing.size === f.size)) {
                validFiles.push(f);
                addedTotal += f.size;
            }
        }

        if (validFiles.length > 0) {
            setFiles(prev => [...prev, ...validFiles]);
        }
    };

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

    const startSmoothProgress = () => {
        let current = 0;
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = setInterval(() => {
            current += 5;
            if (current >= 90) {
                current = 90;
                clearInterval(progressTimerRef.current);
            }
            setUploadProgress(current);
        }, 300);
    };

    const stopSmoothProgress = () => {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
    };

    const handlePublishClick = () => {
        if (files.length === 0) {
            addToast('Please select at least one file to share', 'error');
            return;
        }
        setShowPublishModal(true);
    };

    const handlePublish = async ({ expiryMinutes, password }) => {
        setLoading(true);
        setUploadProgress(0);
        startSmoothProgress();

        try {
            // Read all files as base64
            const filesData = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const fileData = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
                filesData.push({
                    fileData,
                    fileName: file.name,
                    fileType: file.type,
                    fileSize: file.size,
                });
            }

            const data = await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhrRef.current = xhr;

                xhr.open('POST', `${API_URL}/api/share/create`);
                xhr.setRequestHeader('Content-Type', 'application/json');

                xhr.onabort = () => reject(new Error('Upload cancelled'));
                xhr.onload = () => {
                    stopSmoothProgress();
                    setUploadProgress(100);
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            resolve(JSON.parse(xhr.responseText));
                        } catch (parseError) {
                            reject(new Error('Invalid JSON response'));
                        }
                    } else {
                        try {
                            const errorData = JSON.parse(xhr.responseText);
                            reject(new Error(errorData.error || `HTTP Error: ${xhr.status}`));
                        } catch {
                            reject(new Error(`HTTP Error: ${xhr.status}`));
                        }
                    }
                };

                xhr.onerror = () => reject(new Error('Network Error'));

                xhr.send(JSON.stringify({
                    type: 'file',
                    files: filesData,
                    expiryMinutes,
                    password,
                }));
            });

            if (data.success) {
                savePublishedPost({ code: data.code, expiresAt: data.expiresAt, type: 'file' });
                setShareResult(data);
                setShowPublishModal(false);
                addToast(`${files.length} file(s) shared successfully!`, 'success');
            } else {
                addToast(data.error || 'Failed to upload files', 'error');
            }
        } catch (err) {
            if (err.message !== 'Upload cancelled') {
                addToast('Upload failed. Please try again.', 'error');
            } else {
                addToast('Upload cancelled.', 'info');
            }
        } finally {
            stopSmoothProgress();
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
        stopSmoothProgress();
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

            <div className={`content-area ${files.length > 0 ? 'active' : ''}`}>
                {files.length === 0 ? (
                    <div
                        className={`file-upload-zone ${dragging ? 'dragging' : ''}`}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <div className="upload-icon-wrapper">
                            <FiUploadCloud />
                        </div>
                        <p className="upload-title">Upload files</p>
                        <p className="upload-desc">Drag and drop your files here or click to upload</p>
                        <p className="upload-limit">Up to 5 files · Maximum total size: 1GB</p>
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
                                {files.length} file{files.length !== 1 ? 's' : ''} · {formatSize(totalSize)} / 1 GB
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
                        style={{ width: `${Math.min((totalSize / MAX_TOTAL_SIZE) * 100, 100)}%` }}
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
                        allowTransparency={true}
                    />
                </div>
            )}
        </main>
    );
}
