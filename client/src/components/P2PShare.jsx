import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import {
    FiUploadCloud,
    FiCheckCircle,
    FiCopy,
    FiCheck,
    FiFileText,
    FiFile,
    FiImage,
    FiFilm,
    FiMusic,
    FiArchive,
    FiTrash2,
    FiPlus,
    FiMonitor,
    FiArrowRight,
    FiSmartphone,
    FiLock,
    FiUnlock,
    FiWifi,
    FiShield
} from 'react-icons/fi';
import { API_URL } from '../config';

export default function P2PShare() {
    const [roomId, setRoomId] = useState('');
    const [files, setFiles] = useState([]);
    const [status, setStatus] = useState('waiting'); // waiting, connected, locked, sending, done
    const [progress, setProgress] = useState(0);
    const [currentSendingIndex, setCurrentSendingIndex] = useState(0);
    const [currentSendingName, setCurrentSendingName] = useState('');
    const [copiedUrl, setCopiedUrl] = useState(false);
    const [copiedCode, setCopiedCode] = useState(false);
    const [dragActive, setDragActive] = useState(false);

    // Security PIN
    const [pin, setPin] = useState('');

    const socketRef = useRef(null);
    const peerRef = useRef(null);
    const channelRef = useRef(null);
    const filesRef = useRef(files);
    const pinRef = useRef(pin);
    const fileInputRef = useRef(null);
    const iceCandidateQueueRef = useRef([]);

    // Keep filesRef and pinRef in sync with state
    useEffect(() => {
        filesRef.current = files;
        // If data channel is already open and sender adds files, immediately send updated manifest!
        if (channelRef.current && channelRef.current.readyState === 'open' && files.length > 0) {
            sendManifest(files);
        }
    }, [files]);

    useEffect(() => {
        pinRef.current = pin;
    }, [pin]);

    useEffect(() => {
        // Generate a random 5-digit room ID
        const id = Math.floor(10000 + Math.random() * 90000).toString();
        setRoomId(id);

        const socket = io(API_URL, {
            withCredentials: true,
            transports: ['polling', 'websocket']
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            socket.emit('join-room', id);
        });

        socket.on('receiver-joined', async () => {
            setStatus('connected');
            createPeerConnection(id);
            try {
                const offer = await peerRef.current.createOffer();
                await peerRef.current.setLocalDescription(offer);
                socket.emit('offer', { roomId: id, sdp: peerRef.current.localDescription });
            } catch (err) {
                console.error('Error creating offer:', err);
            }
        });

        socket.on('answer', async (data) => {
            try {
                if (peerRef.current && peerRef.current.signalingState !== 'stable') {
                    await peerRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));

                    // Process any ICE candidates that arrived before the answer
                    while (iceCandidateQueueRef.current.length > 0) {
                        const candidate = iceCandidateQueueRef.current.shift();
                        try {
                            await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
                        } catch (candErr) {
                            console.warn('Sender queued ICE candidate error:', candErr);
                        }
                    }
                }
            } catch (err) {
                console.error('Error setting answer:', err);
            }
        });

        socket.on('ice-candidate', async (data) => {
            try {
                if (!data.candidate) return;
                if (peerRef.current && peerRef.current.remoteDescription && peerRef.current.remoteDescription.type) {
                    await peerRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
                } else {
                    iceCandidateQueueRef.current.push(data.candidate);
                }
            } catch (err) {
                console.error('Error adding ICE candidate:', err);
            }
        });

        socket.on('transfer-complete', () => {
            setStatus('done');

            // Increment global stats
            fetch(`${API_URL}/api/share/increment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ count: filesRef.current.length })
            }).catch(err => console.error('Failed to increment stats:', err));

            if (peerRef.current) peerRef.current.close();
            if (socketRef.current) socketRef.current.disconnect();
        });

        return () => {
            if (peerRef.current) peerRef.current.close();
            socket.disconnect();
        };
    }, []);

    const createPeerConnection = (currentRoomId) => {
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun.cloudflare.com:3478' },
                { urls: 'stun:global.stun.twilio.com:3478' }
            ]
        });
        peerRef.current = pc;

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socketRef.current?.emit('ice-candidate', { roomId: currentRoomId, candidate: event.candidate });
            }
        };

        const channel = pc.createDataChannel('fileTransfer');
        channel.binaryType = 'arraybuffer';
        channel.bufferedAmountLowThreshold = 524288;
        channelRef.current = channel;

        channel.onopen = () => {
            console.log('Data channel open on sender');
            setStatus('connected');
            if (filesRef.current.length > 0) {
                if (pinRef.current) {
                    setStatus('locked');
                    channel.send(JSON.stringify({ type: 'require-pin' }));
                } else {
                    sendManifest(filesRef.current);
                }
            }
        };

        channel.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'request-file') {
                    sendFile(data.index);
                } else if (data.type === 'verify-pin') {
                    if (data.pin === pinRef.current) {
                        channel.send(JSON.stringify({ type: 'pin-correct' }));
                        sendManifest(filesRef.current);
                    } else {
                        channel.send(JSON.stringify({ type: 'pin-incorrect' }));
                    }
                }
            } catch (e) {
                // Non-JSON ignored
            }
        };

        channel.onclose = () => {
            setStatus('done');
        };
    };

    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            setFiles(prev => {
                const combined = [...prev, ...newFiles];
                if (channelRef.current && channelRef.current.readyState === 'open') {
                    sendManifest(combined);
                }
                return combined;
            });
            // Reset input value so same files can be re-selected if removed
            e.target.value = '';
        }
    };

    const removeFile = (index) => {
        setFiles(prev => {
            const updated = prev.filter((_, i) => i !== index);
            if (channelRef.current && channelRef.current.readyState === 'open' && updated.length > 0) {
                sendManifest(updated);
            }
            return updated;
        });
    };

    const resetFiles = () => {
        setFiles([]);
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        const items = e.dataTransfer.items;
        if (!items) {
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const newFiles = Array.from(e.dataTransfer.files);
                setFiles(prev => {
                    const combined = [...prev, ...newFiles];
                    if (channelRef.current && channelRef.current.readyState === 'open') {
                        sendManifest(combined);
                    }
                    return combined;
                });
            }
            return;
        }

        const readDirEntries = async (dirReader) => {
            return new Promise((resolve) => {
                dirReader.readEntries((entries) => resolve(entries));
            });
        };

        const scanFiles = async (item) => {
            if (item.isFile) {
                return new Promise((resolve) => {
                    item.file((file) => resolve([file]));
                });
            } else if (item.isDirectory) {
                const dirReader = item.createReader();
                let allEntries = [];
                let entries = await readDirEntries(dirReader);
                while (entries.length > 0) {
                    allEntries = allEntries.concat(entries);
                    entries = await readDirEntries(dirReader);
                }
                let innerFiles = [];
                for (let entry of allEntries) {
                    const result = await scanFiles(entry);
                    innerFiles = innerFiles.concat(result);
                }
                return innerFiles;
            }
            return [];
        };

        let entries = [];
        for (let i = 0; i < items.length; i++) {
            if (items[i].kind === 'file') {
                const entry = items[i].webkitGetAsEntry ? items[i].webkitGetAsEntry() : (items[i].getAsEntry ? items[i].getAsEntry() : null);
                if (entry) {
                    entries.push({ type: 'entry', data: entry });
                } else {
                    entries.push({ type: 'file', data: items[i].getAsFile() });
                }
            }
        }

        let allFiles = [];
        for (let item of entries) {
            if (item.type === 'entry') {
                const scanned = await scanFiles(item.data);
                allFiles = allFiles.concat(scanned);
            } else if (item.type === 'file' && item.data) {
                allFiles.push(item.data);
            }
        }

        if (allFiles.length > 0) {
            setFiles(prev => {
                const combined = [...prev, ...allFiles];
                if (channelRef.current && channelRef.current.readyState === 'open') {
                    sendManifest(combined);
                }
                return combined;
            });
        }
    };

    const togglePin = () => {
        if (pin) {
            setPin('');
        } else {
            setPin(Math.floor(1000 + Math.random() * 9000).toString());
        }
    };

    const sendManifest = (selectedFiles) => {
        setStatus('sending');
        const channel = channelRef.current;
        if (!channel || channel.readyState !== 'open') return;

        const manifest = {
            type: 'batch-offer',
            files: selectedFiles.map((f, i) => ({
                name: f.name,
                size: f.size,
                type: f.type,
                index: i
            }))
        };

        channel.send(JSON.stringify(manifest));
    };

    const sendFile = async (index) => {
        const file = filesRef.current[index];
        if (!file) return;

        setCurrentSendingIndex(index);
        setCurrentSendingName(file.name);
        setProgress(0);

        const channel = channelRef.current;
        if (!channel || channel.readyState !== 'open') return;

        try {
            channel.send(JSON.stringify({
                type: 'file-start',
                index: index,
                name: file.name,
                size: file.size,
                fileType: file.type
            }));

            // 16 KB is the universal cross-browser WebRTC data channel chunk limit
            const chunkSize = 16384;
            let offset = 0;
            let bytesSent = 0;

            const readChunk = (file, offset, size) => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.onerror = reject;
                    reader.readAsArrayBuffer(file.slice(offset, offset + size));
                });
            };

            while (offset < file.size) {
                // Backpressure: If buffer exceeds 512 KB, wait for it to flush
                if (channel.bufferedAmount > 524288) {
                    await new Promise(resolve => {
                        const checkBuffer = () => {
                            if (!channel || channel.readyState !== 'open' || channel.bufferedAmount <= 262144) {
                                resolve();
                            } else {
                                setTimeout(checkBuffer, 25);
                            }
                        };
                        checkBuffer();
                    });
                }

                if (!channel || channel.readyState !== 'open') break;

                const chunk = await readChunk(file, offset, chunkSize);
                channel.send(chunk);
                offset += chunk.byteLength;
                bytesSent += chunk.byteLength;
                setProgress(Math.round((bytesSent / file.size) * 100));
            }

            if (channel && channel.readyState === 'open') {
                channel.send(JSON.stringify({ type: 'file-end', index: index }));
            }
        } catch (err) {
            console.error('Error during sendFile:', err);
        }
    };

    const shareUrl = `${window.location.origin}/p2p/${roomId}`;

    const copyUrl = () => {
        navigator.clipboard.writeText(shareUrl);
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2000);
    };

    const copyRoomCode = () => {
        navigator.clipboard.writeText(roomId);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
    };

    const cancelSending = () => {
        if (peerRef.current) peerRef.current.close();
        if (socketRef.current) socketRef.current.disconnect();
        if (channelRef.current) channelRef.current.close();
        window.location.reload();
    };

    // Helper: format bytes into human readable format
    const formatBytes = (bytes) => {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    // Helper: get file icon based on mime type or extension
    const getFileIcon = (file) => {
        const type = file.type || '';
        const name = file.name || '';
        if (type.startsWith('image/')) return <FiImage />;
        if (type.startsWith('video/')) return <FiFilm />;
        if (type.startsWith('audio/')) return <FiMusic />;
        if (type.includes('pdf') || type.includes('document') || name.endsWith('.txt')) return <FiFileText />;
        if (type.includes('zip') || type.includes('tar') || type.includes('compressed') || name.endsWith('.zip')) return <FiArchive />;
        return <FiFile />;
    };

    // Calculate total size of selected files
    const totalBytes = files.reduce((acc, f) => acc + (f.size || 0), 0);
    const roomDigits = roomId.split('');

    return (
        <div className="p2p-hub-card">
            <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                style={{ display: 'none' }}
            />

            {/* WAITING STATE */}
            {status === 'waiting' && (
                <div>
                    {files.length === 0 ? (
                        /* Initial Empty Dropzone */
                        <div
                            className={`p2p-dropzone ${dragActive ? 'drag-active' : ''}`}
                            onClick={() => fileInputRef.current?.click()}
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                        >
                            <div className="p2p-dropzone-icon">
                                <FiUploadCloud />
                            </div>
                            <h3 className="p2p-dropzone-title">Drop your files here or click to browse</h3>
                            <p className="p2p-dropzone-sub">
                                Any file type • No file size limits • Browser-to-browser direct stream
                            </p>
                            <div className="p2p-browse-pill">
                                <FiPlus /> Choose Files
                            </div>
                        </div>
                    ) : (
                        /* Two-Column Transfer Layout */
                        <div className="p2p-transfer-layout">
                            {/* Left: Selected Files Manager */}
                            <div className="p2p-files-panel">
                                <div className="p2p-files-header">
                                    <div className="p2p-files-count">
                                        Files to Stream
                                        <span className="p2p-files-size-badge">
                                            {files.length} {files.length === 1 ? 'file' : 'files'} • {formatBytes(totalBytes)}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        className="p2p-clear-all-btn"
                                        onClick={resetFiles}
                                        title="Clear all selected files"
                                    >
                                        Clear All
                                    </button>
                                </div>

                                <div className="p2p-files-list">
                                    {files.map((file, idx) => (
                                        <div key={idx} className="p2p-file-item">
                                            <div className="p2p-file-left">
                                                <div className="p2p-file-icon-box">
                                                    {getFileIcon(file)}
                                                </div>
                                                <div className="p2p-file-meta">
                                                    <p className="p2p-file-name" title={file.name}>
                                                        {file.name}
                                                    </p>
                                                    <p className="p2p-file-size">
                                                        {formatBytes(file.size)}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                className="p2p-file-del-btn"
                                                onClick={() => removeFile(idx)}
                                                title="Remove file"
                                            >
                                                <FiTrash2 />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <div className="p2p-files-actions">
                                    <button
                                        type="button"
                                        className="p2p-add-more-btn"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <FiPlus /> Add More Files
                                    </button>
                                    <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                                        Ready to stream
                                    </span>
                                </div>
                            </div>

                            {/* Right: Sharing Hub */}
                            <div className="p2p-share-hub">
                                <div className="p2p-hub-header">
                                    <h4 className="p2p-hub-title">
                                        <FiSmartphone /> Connect Receiver
                                    </h4>
                                    <button
                                        type="button"
                                        onClick={togglePin}
                                        className={`p2p-pin-toggle ${pin ? 'is-locked' : 'is-unlocked'}`}
                                        title="Add a 4-digit PIN for extra security"
                                    >
                                        {pin ? (
                                            <><FiLock /> PIN: <strong>{pin}</strong></>
                                        ) : (
                                            <><FiUnlock /> Secure with PIN</>
                                        )}
                                    </button>
                                </div>

                                {/* Prominent 5-Digit Room Code */}
                                <div className="p2p-code-section">
                                    <p className="p2p-code-label">Room Code</p>
                                    <div className="p2p-digits-row">
                                        {roomDigits.map((digit, idx) => (
                                            <div key={idx} className="p2p-digit-box">
                                                {digit}
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        className="p2p-copy-code-btn"
                                        onClick={copyRoomCode}
                                    >
                                        {copiedCode ? <><FiCheck /> Code Copied</> : <><FiCopy /> Copy Room Code</>}
                                    </button>
                                </div>

                                {/* QR Code Display */}
                                <div className="p2p-qr-wrapper">
                                    <div className="p2p-qr-box">
                                        <QRCodeSVG value={shareUrl} size={130} />
                                    </div>
                                    <p className="p2p-qr-hint">
                                        Scan with phone camera to connect instantly
                                    </p>
                                </div>

                                {/* Direct Link Row */}
                                <div className="p2p-link-box">
                                    <span className="p2p-link-text" title={shareUrl}>
                                        {shareUrl}
                                    </span>
                                    <button
                                        type="button"
                                        className="p2p-copy-link-btn"
                                        onClick={copyUrl}
                                    >
                                        {copiedUrl ? <><FiCheck /> Copied</> : <><FiCopy /> Copy Link</>}
                                    </button>
                                </div>

                                {/* Live Radar Status */}
                                <div className="p2p-radar-status">
                                    <span className="p2p-radar-dot" />
                                    <span>Waiting for receiver to join...</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* CONNECTED STATE */}
            {status === 'connected' && (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <div style={{
                        width: '76px',
                        height: '76px',
                        borderRadius: '50%',
                        background: 'rgba(16, 185, 129, 0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 20px',
                        color: 'var(--success)',
                        fontSize: '2rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FiMonitor />
                            <FiArrowRight style={{ fontSize: '1.2rem' }} />
                            <FiSmartphone />
                        </div>
                    </div>
                    <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
                        Receiver Connected!
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', margin: 0 }}>
                        Handshake established. Initiating direct file stream...
                    </p>
                </div>
            )}

            {/* LOCKED PIN STATE */}
            {status === 'locked' && (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <div style={{
                        width: '72px',
                        height: '72px',
                        borderRadius: '50%',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 20px',
                        color: 'var(--danger)',
                        fontSize: '2rem'
                    }}>
                        <FiLock />
                    </div>
                    <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>
                        Awaiting PIN Verification
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginBottom: '20px' }}>
                        Share this 4-digit PIN with the receiver to start the transfer:
                    </p>
                    <div style={{
                        display: 'inline-flex',
                        gap: '10px',
                        padding: '12px 24px',
                        background: 'var(--bg-input)',
                        border: '2px dashed var(--accent)',
                        borderRadius: 'var(--radius-lg)'
                    }}>
                        {pin.split('').map((d, i) => (
                            <span key={i} style={{
                                width: '40px',
                                height: '48px',
                                background: 'var(--bg-card)',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.8rem',
                                fontWeight: '800',
                                color: 'var(--text-primary)'
                            }}>
                                {d}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* ACTIVE SENDING STATE */}
            {status === 'sending' && (
                <div className="p2p-transfer-dashboard">
                    <div className="p2p-transfer-icon-pulse">
                        <FiUploadCloud />
                    </div>
                    <h3 className="p2p-transfer-heading">Streaming Files Directly...</h3>
                    <p className="p2p-transfer-file-active">
                        File {currentSendingIndex + 1} of {files.length}: <strong>{currentSendingName || files[currentSendingIndex]?.name}</strong>
                    </p>

                    <div className="p2p-prog-bar-wrap">
                        <div className="p2p-prog-bar-fill" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="p2p-prog-percentage">{progress}%</p>

                    <div>
                        <div className="p2p-safe-banner">
                            <FiWifi /> Keep this browser tab open until all files finish streaming.
                        </div>
                    </div>

                    <button
                        type="button"
                        className="p2p-cancel-btn"
                        onClick={cancelSending}
                    >
                        Cancel Transfer
                    </button>
                </div>
            )}

            {/* COMPLETED STATE */}
            {status === 'done' && (
                <div className="p2p-success-state">
                    <div className="p2p-success-icon-wrap">
                        <FiCheckCircle />
                    </div>
                    <h3 className="p2p-success-heading">Transfer Complete!</h3>
                    <p className="p2p-success-sub">
                        All files were directly streamed to the receiver with zero cloud storage.
                    </p>
                    <button
                        type="button"
                        className="p2p-send-more-btn"
                        onClick={() => window.location.reload()}
                    >
                        Send More Files
                    </button>
                </div>
            )}
        </div>
    );
}
