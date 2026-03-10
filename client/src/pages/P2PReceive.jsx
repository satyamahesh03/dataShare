import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { FiDownload, FiCheckCircle, FiArrowLeft, FiMonitor, FiArrowRight, FiSmartphone, FiWifiOff } from 'react-icons/fi';
import { API_URL } from '../config';

export default function P2PReceive() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState('connecting'); // connecting, receiving, done
    const [progress, setProgress] = useState(0);
    const [receivedFiles, setReceivedFiles] = useState([]);
    const [currentFileTitle, setCurrentFileTitle] = useState('');
    const [availableFiles, setAvailableFiles] = useState([]);
    const [downloadingFileIndex, setDownloadingFileIndex] = useState(null);
    const [downloadQueue, setDownloadQueue] = useState([]);
    const [error, setError] = useState(null);

    const socketRef = useRef(null);
    const peerRef = useRef(null);
    const channelRef = useRef(null);

    const incomingDataRef = useRef([]);
    const currentFileMetaRef = useRef(null);

    const handleDataMessageRef = useRef(null);
    // Ref to track downloading status synchronously
    const downloadingFileIndexRef = useRef(null);
    const downloadQueueRef = useRef([]);

    // Update refs whenever relevant state changes
    useEffect(() => {
        downloadingFileIndexRef.current = downloadingFileIndex;
    }, [downloadingFileIndex]);

    useEffect(() => {
        const socket = io(API_URL, {
            withCredentials: true,
            transports: ['polling', 'websocket']
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            // Check if the room exists before joining
            socket.emit('check-room', id, (response) => {
                if (response && response.active) {
                    socket.emit('join-room', id);
                    // Notify the sender that we are here to initiate the offer
                    socket.emit('receiver-joined', id);
                } else {
                    console.error('Room not found or inactive');
                    setError('This transfer link is invalid or the sender has disconnected.');
                    // navigate('/'); // Don't navigate, show error
                }
            });
        });

        socket.on('offer', async (data) => {
            if (!peerRef.current) createPeerConnection();

            try {
                await peerRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
                const answer = await peerRef.current.createAnswer();
                await peerRef.current.setLocalDescription(answer);
                socket.emit('answer', { roomId: id, sdp: peerRef.current.localDescription });
                setStatus('waiting-files'); // Waiting for data channel
            } catch (err) {
                console.error('Error handling offer:', err);
            }
        });

        socket.on('ice-candidate', async (data) => {
            try {
                if (peerRef.current) {
                    await peerRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
                }
            } catch (err) {
                console.error('Error adding ICE candidate:', err);
            }
        });

        return () => {
            if (peerRef.current) peerRef.current.close();
            socket.disconnect();
        };
    }, [id]);

    const createPeerConnection = () => {
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        });
        peerRef.current = pc;

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socketRef.current.emit('ice-candidate', { roomId: id, candidate: event.candidate });
            }
        };

        pc.ondatachannel = (event) => {
            const channel = event.channel;
            channelRef.current = channel;

            // Critical for receiving ArrayBuffer directly rather than Blob
            channel.binaryType = 'arraybuffer';

            setupDataChannel(channel);
        };
    };

    const setupDataChannel = (channel) => {
        channel.onopen = () => {
            console.log('Data channel opened');
            setStatus('connected');
        };

        channel.onmessage = (event) => {
            if (handleDataMessageRef.current) {
                handleDataMessageRef.current(event.data);
            }
        };

        channel.onclose = () => {
            console.log('Data channel closed');
            setStatus('done');
        };
    };

    const totalFilesRef = useRef(0);
    const receivedCountRef = useRef(0);

    const handleDataMessage = (data) => {
        // Checking if data is a string (JSON metadata)
        if (typeof data === 'string') {
            try {
                const message = JSON.parse(data);

                if (message.type === 'batch-offer') {
                    setAvailableFiles(message.files);
                    setStatus('connected');
                } else if (message.type === 'file-start') {
                    setCurrentFileTitle(message.name);
                    currentFileMetaRef.current = message;
                    setDownloadingFileIndex(message.index);
                    downloadingFileIndexRef.current = message.index;
                    setStatus('receiving');
                    setProgress(0);
                    incomingDataRef.current = [];
                } else if (message.type === 'file-end') {
                    // Capture current file metadata before it gets cleared
                    const completedFile = currentFileMetaRef.current;

                    if (!completedFile) {
                        console.error('File end received but no metadata found');
                        return;
                    }

                    // Create blob and trigger download
                    const fileBlob = new Blob(incomingDataRef.current, { type: completedFile.fileType });
                    const fileUrl = URL.createObjectURL(fileBlob);

                    // Trigger download immediately
                    triggerDownload(fileUrl, completedFile.name);

                    // Mark this file as downloaded in our list
                    setReceivedFiles(prev => {
                        if (prev.find(f => f.name === completedFile.name)) return prev;
                        return [...prev, {
                            name: completedFile.name,
                            size: completedFile.size,
                            url: fileUrl,
                            index: completedFile.index
                        }];
                    });

                    setStatus('connected');
                    setDownloadingFileIndex(null);
                    downloadingFileIndexRef.current = null;

                    console.log('File finished. Checking queue:', downloadQueueRef.current);

                    // Process next file in queue synchronously to avoid React state batching issues
                    if (downloadQueueRef.current.length > 0) {
                        const nextIndex = downloadQueueRef.current.shift();
                        setDownloadQueue([...downloadQueueRef.current]);

                        if (nextIndex !== undefined) {
                            console.log('Scheduling next file request:', nextIndex);
                            // Add a small delay to ensure browser and socket are ready
                            setTimeout(() => {
                                if (channelRef.current && channelRef.current.readyState === 'open') {
                                    console.log('Sending request for file:', nextIndex);
                                    channelRef.current.send(JSON.stringify({ type: 'request-file', index: nextIndex }));
                                }
                            }, 300);
                        }
                    } else {
                        console.log('Queue empty. All done.');
                    }

                    incomingDataRef.current = [];
                    currentFileMetaRef.current = null;
                }
            } catch (e) {
                console.error('Error parsing signaling message:', e, data);
            }
        } else {
            // It's a binary chunk
            incomingDataRef.current.push(data);

            if (currentFileMetaRef.current) {
                // Approximate progress for very UI only -> chunks length
                const totalBytes = incomingDataRef.current.reduce((acc, chunk) => acc + chunk.byteLength, 0);
                const percent = Math.round((totalBytes / currentFileMetaRef.current.size) * 100);
                setProgress(Math.min(percent, 100));
            }
        }
    };

    // Keep the ref updated with the latest function
    useEffect(() => {
        handleDataMessageRef.current = handleDataMessage;
    });

    // Auto-navigate to home when all files are received
    useEffect(() => {
        if (availableFiles.length > 0 && receivedFiles.length === availableFiles.length) {
            // Notify sender that transfer is complete so they can close the room
            if (socketRef.current) {
                console.log('Transfer complete. Notifying sender...');
                socketRef.current.emit('transfer-complete', id);
            }

            // Small delay to ensure message is sent before closing
            const timer = setTimeout(() => {
                // Close connections
                if (peerRef.current) {
                    peerRef.current.close();
                }
                if (socketRef.current) {
                    socketRef.current.disconnect();
                }

                // Navigate home
                navigate('/');
            }, 500); // 500ms delay to ensure sender receives the event

            return () => clearTimeout(timer);
        }
    }, [receivedFiles, availableFiles, navigate, id]);

    const requestFile = (index) => {
        // If busy, just add to queue if not already there
        // Use ref for synchronous check
        if (downloadingFileIndexRef.current !== null) {
            if (!downloadQueueRef.current.includes(index)) {
                downloadQueueRef.current.push(index);
                setDownloadQueue([...downloadQueueRef.current]);
            }
            return;
        }

        channelRef.current.send(JSON.stringify({ type: 'request-file', index }));
    };

    const downloadAll = () => {
        if (availableFiles.length === 0) return;

        // Find all files that haven't been downloaded yet
        const pendingFiles = availableFiles
            .filter(f => !receivedFiles.some(rf => rf.name === f.name && rf.size === f.size))
            .map(f => f.index);

        if (pendingFiles.length === 0) return;

        console.log('Download All triggered. Pending files:', pendingFiles);

        // Start first one
        const first = pendingFiles[0];
        requestFile(first);

        // Queue the rest
        if (pendingFiles.length > 1) {
            const remaining = pendingFiles.slice(1);

            // Reset queue ref to ensure clean state
            downloadQueueRef.current = [];
            remaining.forEach(idx => {
                downloadQueueRef.current.push(idx);
            });

            console.log('Queued remaining files:', downloadQueueRef.current);
            setDownloadQueue([...downloadQueueRef.current]);
        }
    };

    const triggerDownload = (url, filename) => {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const renderSize = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <main className="container wrapper" style={{ marginTop: '30px', padding: '0 20px' }}>
            <div style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-lg)',
                padding: '40px',
                border: '1px solid var(--border)',
                maxWidth: '1200px',
                width: '100%',
                margin: '0 auto',
                boxShadow: 'var(--shadow-lg)',
                position: 'relative'
            }}>
                <button
                    className="back-btn"
                    onClick={() => navigate('/')}
                    title="Back to Home"
                    style={{ position: 'absolute', top: '24px', left: '24px' }}
                >
                    <FiArrowLeft />
                </button>
                <h2 style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    marginBottom: '32px',
                    color: 'var(--text-primary)',
                    fontSize: '1.5rem',
                    fontWeight: '700'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', color: 'var(--accent)', gap: '4px' }}>
                        <FiMonitor className="p2p-device-icon primary" />
                        <FiArrowRight className="p2p-transfer-arrow" />
                        <FiSmartphone className="p2p-device-icon secondary" />
                    </div>
                    Receive Files
                </h2>


                {error ? (
                    <div style={{ textAlign: 'center', padding: '32px 0' }}>
                        <div style={{
                            width: '80px',
                            height: '80px',
                            borderRadius: '50%',
                            background: 'rgba(239, 68, 68, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 24px'
                        }}>
                            <FiWifiOff style={{ fontSize: '40px', color: 'var(--danger)', marginBottom: '0' }} />
                        </div>
                        <h4 style={{ color: 'var(--text-primary)', fontSize: '1.2rem', marginBottom: '8px' }}>Connection Failed</h4>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                            {error}
                        </p>
                        <button
                            onClick={() => navigate('/')}
                            style={{
                                background: 'var(--accent)',
                                color: 'var(--text-inverse)',
                                border: 'none',
                                padding: '12px 32px',
                                borderRadius: 'var(--radius-full)',
                                cursor: 'pointer',
                                fontWeight: '600',
                                transition: 'all 0.2s',
                                boxShadow: 'var(--shadow-md)'
                            }}
                        >
                            Return Home
                        </button>
                    </div>
                ) : (
                    <>
                        {['connecting', 'waiting-files'].includes(status) && (
                            <div style={{ textAlign: 'center', padding: '32px 0' }}>
                                <div className="loader" style={{
                                    margin: '0 auto 24px',
                                    border: '3px solid var(--border)',
                                    borderTopColor: 'var(--accent)',
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite'
                                }} />
                                <h4 style={{ color: 'var(--text-primary)', marginBottom: '12px', fontSize: '1.1rem' }}>Connecting to Sender...</h4>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Leave this window open to receive files directly.</p>
                            </div>
                        )}

                        {status === 'connected' && (
                            <div style={{ textAlign: 'center', padding: '32px 0' }}>
                                <div style={{
                                    width: '80px',
                                    height: '80px',
                                    borderRadius: '50%',
                                    background: 'var(--accent-light)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    margin: '0 auto 24px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', color: 'var(--accent)' }}>
                                        <FiMonitor style={{ fontSize: '32px' }} />
                                        <FiArrowRight className="p2p-transfer-arrow" style={{ fontSize: '24px' }} />
                                        <FiSmartphone style={{ fontSize: '32px' }} />
                                    </div>
                                </div>
                                <h4 style={{ color: 'var(--text-primary)', fontSize: '1.2rem', marginBottom: '8px' }}>Connected!</h4>
                                <p style={{ color: 'var(--text-secondary)' }}>
                                    {availableFiles.length > 0
                                        ? `${availableFiles.length} file(s) available.`
                                        : 'Waiting for the sender to drop files.'}
                                </p>
                            </div>
                        )}

                        {/* Show Available Files List if connected and not receiving */}
                        {status === 'connected' && availableFiles.length > 0 && (
                            <div style={{ marginTop: '32px' }}>
                                <h4 style={{ color: 'var(--text-primary)', marginBottom: '16px', fontSize: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>Available Files ({availableFiles.length})</span>
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto', marginBottom: '24px' }}>
                                    {availableFiles.map((f, i) => {
                                        const isDownloaded = receivedFiles.some(rf => rf.name === f.name && rf.size === f.size);
                                        const isDownloading = downloadingFileIndex === f.index;
                                        const isQueued = downloadQueue.includes(f.index);

                                        return (
                                            <div key={i} style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '16px',
                                                backgroundColor: 'var(--bg-input)',
                                                borderRadius: 'var(--radius-md)',
                                                border: '1px solid var(--border)'
                                            }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', marginRight: '16px' }}>
                                                    <span style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: '600', fontSize: '0.95rem' }}>
                                                        {f.name}
                                                    </span>
                                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '4px' }}>
                                                        {renderSize(f.size)}
                                                    </span>
                                                </div>
                                                {isDownloaded ? (
                                                    <span style={{ color: 'var(--success)', fontSize: '0.9rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <FiCheckCircle /> Saved
                                                    </span>
                                                ) : isDownloading ? (
                                                    <span style={{ color: 'var(--accent)', fontSize: '0.9rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <div className="spinner" style={{ width: '14px', height: '14px', border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                                                        Downloading...
                                                    </span>
                                                ) : isQueued ? (
                                                    <span style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        Queued
                                                    </span>
                                                ) : (
                                                    <span style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        Waiting...
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                <button
                                    onClick={downloadAll}
                                    disabled={downloadingFileIndex !== null || downloadQueue.length > 0}
                                    style={{
                                        width: '100%',
                                        background: (downloadingFileIndex !== null || downloadQueue.length > 0) ? 'var(--bg-hover)' : 'var(--accent)',
                                        color: (downloadingFileIndex !== null || downloadQueue.length > 0) ? 'var(--text-tertiary)' : 'var(--text-inverse)',
                                        border: 'none',
                                        padding: '14px',
                                        borderRadius: 'var(--radius-full)',
                                        cursor: (downloadingFileIndex !== null || downloadQueue.length > 0) ? 'not-allowed' : 'pointer',
                                        fontSize: '1rem',
                                        fontWeight: '600',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        boxShadow: (downloadingFileIndex !== null || downloadQueue.length > 0) ? 'none' : 'var(--shadow-md)',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <FiDownload /> Download All Files
                                </button>
                            </div>
                        )}

                        {status === 'receiving' && (
                            <div style={{ textAlign: 'center', padding: '32px 0' }}>
                                <div style={{
                                    width: '80px',
                                    height: '80px',
                                    borderRadius: '50%',
                                    background: 'var(--accent-light)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    margin: '0 auto 24px',
                                    animation: 'pulse 2s infinite'
                                }}>
                                    <FiDownload style={{ fontSize: '40px', color: 'var(--accent)' }} />
                                </div>
                                <h4 style={{ color: 'var(--text-primary)', marginBottom: '16px', wordBreak: 'break-all', fontSize: '1.1rem' }}>
                                    Receiving: {currentFileTitle}
                                </h4>
                                <div style={{
                                    width: '100%',
                                    height: '8px',
                                    background: 'var(--bg-input)',
                                    borderRadius: '4px',
                                    overflow: 'hidden',
                                    marginTop: '24px',
                                    maxWidth: '320px',
                                    margin: '24px auto 0'
                                }}>
                                    <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.2s' }}></div>
                                </div>
                                <p style={{ color: 'var(--text-secondary)', marginTop: '12px', fontWeight: '500' }}>{progress}% Transferring...</p>
                            </div>
                        )}

                        {(status === 'done' || receivedFiles.length > 0) && (
                            <div style={{ marginTop: '24px' }}>
                                {status === 'done' || (availableFiles.length > 0 && receivedFiles.length === availableFiles.length) ? (
                                    <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                                        <div style={{
                                            width: '80px',
                                            height: '80px',
                                            borderRadius: '50%',
                                            background: 'rgba(16, 185, 129, 0.1)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            margin: '0 auto 24px'
                                        }}>
                                            <FiCheckCircle style={{ fontSize: '40px', color: 'var(--success)', marginBottom: '0' }} />
                                        </div>
                                        <h4 style={{ color: 'var(--text-primary)', fontSize: '1.2rem', marginBottom: '8px' }}>All Files Received</h4>
                                        <p style={{ color: 'var(--text-secondary)' }}>Files have been saved to your device.</p>

                                        <button
                                            onClick={() => navigate('/')}
                                            style={{
                                                marginTop: '24px',
                                                background: 'var(--accent)',
                                                color: 'var(--text-inverse)',
                                                border: 'none',
                                                padding: '12px 32px',
                                                borderRadius: 'var(--radius-full)',
                                                cursor: 'pointer',
                                                fontWeight: '600',
                                                transition: 'all 0.2s',
                                                boxShadow: 'var(--shadow-md)'
                                            }}
                                        >
                                            Return Home
                                        </button>
                                    </div>
                                ) : null}

                                {receivedFiles.length > 0 && (
                                    <>
                                        <h4 style={{ color: 'var(--text-primary)', marginBottom: '16px', fontSize: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                                            Received Files ({receivedFiles.length})
                                        </h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            {receivedFiles.map((f, i) => (
                                                <div key={i} style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    padding: '16px',
                                                    backgroundColor: 'var(--bg-input)',
                                                    borderRadius: 'var(--radius-md)',
                                                    border: '1px solid var(--border)'
                                                }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', marginRight: '16px' }}>
                                                        <span style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: '600', fontSize: '0.95rem' }}>
                                                            {f.name}
                                                        </span>
                                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '4px' }}>
                                                            {renderSize(f.size)}
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={() => triggerDownload(f.url, f.name)}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '6px',
                                                            background: 'var(--accent)',
                                                            color: 'var(--text-inverse)',
                                                            border: 'none',
                                                            padding: '8px 16px',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer',
                                                            fontSize: '0.85rem',
                                                            whiteSpace: 'nowrap',
                                                            fontWeight: '500'
                                                        }}
                                                    >
                                                        <FiDownload /> Download
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
            {/* Adding basic spin keyframes if not present */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
                @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .7; transform: scale(1.05); } }
            `}} />
        </main >
    );
}
