import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FiUploadCloud, FiFile, FiX, FiImage, FiFileText, FiPlus } from 'react-icons/fi';
import { useToast } from '../context/ToastContext';
import { savePublishedPost } from '../utils/publishedPosts';
import ShareResult from '../components/ShareResult';
import PublishModal from '../components/PublishModal';
import { API_URL } from '../config';
const MAX_TOTAL_SIZE = 30 * 1024 * 1024;
const MAX_FILES = 5;

export default function FileShare() {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [shareResult, setShareResult] = useState(null);
    const [showPublishModal, setShowPublishModal] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const fileInputRef = useRef(null);
    const { addToast } = useToast();

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
                addToast(`Adding "${f.name}" would exceed 30MB limit`, 'error');
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
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const getFileIcon = (type) => {
        if (type?.startsWith('image/')) return <FiImage />;
        if (type?.startsWith('text/')) return <FiFileText />;
        return <FiFile />;
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
                setUploadProgress(Math.round(((i + 1) / files.length) * 40));
            }

            setUploadProgress(45);

            const res = await fetch(`${API_URL}/api/share/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'file',
                    files: filesData,
                    expiryMinutes,
                    password,
                }),
            });

            setUploadProgress(90);
            const data = await res.json();
            if (data.success) {
                savePublishedPost({ code: data.code, expiresAt: data.expiresAt, type: 'file' });
                setShareResult(data);
                setShowPublishModal(false);
                setUploadProgress(100);
                addToast(`${files.length} file(s) shared successfully!`, 'success');
            } else {
                addToast(data.error || 'Failed to upload files', 'error');
            }
        } catch (err) {
            addToast('Upload failed. Please try again.', 'error');
        } finally {
            setLoading(false);
            setUploadProgress(0);
        }
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
                    <Link to="/">Tools</Link>
                    <span className="separator">/</span>
                    <span className="current">File Sharing</span>
                </div>
                <button
                    className="publish-btn"
                    onClick={handlePublishClick}
                    disabled={files.length === 0}
                >
                    {loading ? `Uploading${uploadProgress > 0 ? ` ${uploadProgress}%` : '...'}` : 'Publish'}
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
                        <p className="upload-limit">Up to 5 files · Maximum total size: 30MB</p>
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
                                {files.length} file{files.length !== 1 ? 's' : ''} · {formatSize(totalSize)} / 30 MB
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
                onClose={() => setShowPublishModal(false)}
                onPublish={handlePublish}
                loading={loading}
            />

            {shareResult && (
                <ShareResult
                    shareData={shareResult}
                    onClose={handleCloseResult}
                />
            )}
        </main>
    );
}
