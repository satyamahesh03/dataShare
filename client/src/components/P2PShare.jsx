import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import { FiUploadCloud, FiCheckCircle, FiCopy, FiFileText, FiMonitor, FiArrowRight, FiSmartphone, FiLock, FiUnlock } from 'react-icons/fi';
import { API_URL } from '../config';

export default function P2PShare() {
    const [roomId, setRoomId] = useState('');
    const [files, setFiles] = useState([]);
    const [status, setStatus] = useState('waiting'); // waiting, connected, sending, done
    const [progress, setProgress] = useState(0);
    const [copied, setCopied] = useState(false);

    // Security PIN
    const [pin, setPin] = useState('');

    const socketRef = useRef(null);
    const peerRef = useRef(null);
    const channelRef = useRef(null);
    const filesRef = useRef(files);
    const pinRef = useRef(pin);
    const ackResolverRef = useRef(null);

    // Keep filesRef and pinRef in sync with state
    useEffect(() => {
        filesRef.current = files;
    }, [files]);

    useEffect(() => {
        pinRef.current = pin;
    }, [pin]);

    useEffect(() => {
        // Generate a random 6-character room ID
        const id = Math.random().toString(36).substring(2, 8).toUpperCase();
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
            // When receiver joins, we create an offer
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
                }
            } catch (err) {
                console.error('Error setting answer:', err);
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

        socket.on('transfer-complete', () => {
            console.log('Transfer complete received from receiver.');
            setStatus('done');

            // Increment global stats
            fetch(`${API_URL}/api/share/increment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ count: filesRef.current.length })
            }).catch(err => console.error('Failed to increment stats:', err));

            // Close connections to prevent re-use of this session
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
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        });
        peerRef.current = pc;

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socketRef.current.emit('ice-candidate', { roomId: currentRoomId, candidate: event.candidate });
            }
        };

        const channel = pc.createDataChannel('fileTransfer');
        // Set low threshold to 1MB to prevent pipe from emptying
        channel.bufferedAmountLowThreshold = 1048576;
        channelRef.current = channel;

        channel.onopen = () => {
            console.log('Data channel opened!');
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
                    // Receiver requested a file
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
                // Ignore binary data or non-json
            }
        };
        channel.onclose = () => {
            console.log('Data channel closed');
            setStatus('done');
        };
    };

    const handleFileSelect = (e) => {
        if (e.target.files.length > 0) {
            setFiles(prev => [...prev, ...Array.from(e.target.files)]);
        }
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.backgroundColor = 'var(--bg-input)';

        const items = e.dataTransfer.items;
        if (!items) {
            if (e.dataTransfer.files.length > 0) {
                setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
            }
            return;
        }

        const readDirEntries = async (dirReader) => {
            return new Promise((resolve) => {
                dirReader.readEntries(async (entries) => {
                    resolve(entries);
                });
            });
        };

        const scanFiles = async (item) => {
            if (item.isFile) {
                return new Promise((resolve) => {
                    item.file((file) => {
                        // Some systems require path to identify duplicates or folders, 
                        // setting a custom property on the file object
                        resolve([file]);
                    });
                });
            } else if (item.isDirectory) {
                const dirReader = item.createReader();
                let allEntries = [];
                let entries = await readDirEntries(dirReader);

                // readEntries may not return all files at once, must loop until empty
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

        // Extract entries synchronously because e.dataTransfer becomes invalid after first await
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
            setFiles(prev => [...prev, ...allFiles]);
        }
    };

    const togglePin = () => {
        if (pin) {
            setPin('');
        } else {
            // Generate 4-digit PIN
            setPin(Math.floor(1000 + Math.random() * 9000).toString());
        }
    };

    const sendManifest = (selectedFiles) => {
        setStatus('sending');
        const channel = channelRef.current;

        // Send list of all files
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

        const channel = channelRef.current;

        // Send file start
        channel.send(JSON.stringify({
            type: 'file-start',
            index: index,
            name: file.name,
            size: file.size,
            fileType: file.type
        }));

        // 64KB chunks are optimal for WebRTC over WAN
        const chunkSize = 65536;
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
            // Buffer up to 4MB before pausing loop
            if (channel.bufferedAmount > 4194304) {
                await new Promise(resolve => {
                    channel.onbufferedamountlow = () => {
                        channel.onbufferedamountlow = null;
                        resolve();
                    };
                });
            }
            const chunk = await readChunk(file, offset, chunkSize);
            channel.send(chunk);
            offset += chunk.byteLength;
            bytesSent += chunk.byteLength;

            // Only update global progress if sending one file at a time sequentially
            // For random access, this progress bar might jump around, but that's okay for now.
            // Or we can just show "Sending: Filename"
            setProgress(Math.round((bytesSent / file.size) * 100));
        }

        // Mark end of this file
        channel.send(JSON.stringify({ type: 'file-end', index: index }));
    };

    const shareUrl = `${window.location.origin}/p2p/${roomId}`;

    const copyUrl = () => {
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const resetFiles = () => {
        setFiles([]);
        if (socketRef.current) {
            // Re-join logic or just keep socket?
            // If we clear files, we probably just want to go back to initial state.
            // But if we already have a room, we might want to keep it?
            // For simplicity, let's keep the room but clear the files manifest if we haven't sent it yet.
            // Actually, if we are in 'waiting' state, we haven't sent manifest yet.
            // Just clearing files state is enough to hide the QR code section.
        }
    };

    const cancelSending = () => {
        // Close connections
        if (peerRef.current) peerRef.current.close();
        if (socketRef.current) socketRef.current.disconnect();
        if (channelRef.current) channelRef.current.close();

        // Refresh page to reset completely or reset state
        window.location.reload();
    };

    return (
        <div
            className="p2p-section"
            style={{
                background: 'linear-gradient(145deg, var(--bg-card), var(--bg-secondary))',
                boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
                border: '1px solid var(--border-light)',
                transition: 'transform 0.3s ease, box-shadow 0.3s ease',
            }}
        >
            <h3 className="p2p-section-title">
                <span className="p2p-section-title-icon" style={{ background: 'transparent', width: 'auto' }}>
                    <FiMonitor className="p2p-device-icon primary" />
                    <FiArrowRight className="p2p-transfer-arrow" />
                    <FiSmartphone className="p2p-device-icon secondary" />
                </span>
                Direct Peer-to-Peer Transfer
            </h3>

            {status === 'waiting' && (
                <>
                    <p className="p2p-section-subtitle">
                        Send files directly to another device without uploading to any server.<br />
                        <span style={{ color: 'var(--accent)', fontWeight: '500' }}>Fast, private, and unlimited.</span>
                    </p>
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        alignItems: 'center',
                        marginBottom: '32px',
                        width: '100%'
                    }}>
                        <div style={{
                            background: 'rgba(239, 68, 68, 0.08)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            borderRadius: 'var(--radius-md)',
                            padding: '12px 16px',
                            color: 'var(--danger)',
                            fontSize: '0.9rem',
                            display: 'flex',
                            alignItems: 'flex-start',
                            textAlign: 'left',
                            maxWidth: '500px',
                            width: '100%',
                            boxSizing: 'border-box'
                        }}>
                            <span style={{ marginRight: '8px', fontWeight: 'bold', flexShrink: 0 }}>Important:</span>
                            <span>Please do not switch tabs or close this window during the transfer.</span>
                        </div>
                        <div style={{
                            background: 'rgba(16, 185, 129, 0.08)',
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            borderRadius: 'var(--radius-md)',
                            padding: '12px 16px',
                            color: 'var(--success)',
                            fontSize: '0.9rem',
                            display: 'flex',
                            alignItems: 'flex-start',
                            textAlign: 'left',
                            maxWidth: '500px',
                            width: '100%',
                            boxSizing: 'border-box'
                        }}>
                            <span style={{ marginRight: '8px', fontWeight: 'bold', flexShrink: 0 }}>Pro Tip:</span>
                            <span>For ultra-fast, zero-data transfers, connect both devices to the same WiFi network.</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'stretch', justifyContent: 'center' }}>
                        {files.length === 0 && (
                            <div style={{ flex: '1 1 300px', maxWidth: '1100px', width: '100%' }}>
                                <label className="file-input-label" style={{
                                    height: '100%',
                                    minHeight: '320px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    border: '2px dashed var(--border)',
                                    borderRadius: 'var(--radius-xl)',
                                    padding: '32px',
                                    backgroundColor: 'var(--bg-input)',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}
                                    onDrop={handleDrop}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        e.currentTarget.style.borderColor = 'var(--accent)';
                                        e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                                    }}
                                    onDragLeave={(e) => {
                                        e.preventDefault();
                                        e.currentTarget.style.borderColor = 'var(--border)';
                                        e.currentTarget.style.backgroundColor = 'var(--bg-input)';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = 'var(--accent)';
                                        e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = 'var(--border)';
                                        e.currentTarget.style.backgroundColor = 'var(--bg-input)';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                >
                                    <input
                                        type="file"
                                        multiple
                                        className="hidden-file-input"
                                        onChange={handleFileSelect}
                                        style={{ display: 'none' }}
                                    />
                                    <div className="p2p-upload-icon-wrap">
                                        <FiUploadCloud style={{ fontSize: '40px', color: 'var(--accent)' }} />
                                    </div>
                                    <span className="p2p-upload-title">Choose files or drag & drop</span>
                                    <span className="p2p-upload-subtitle">
                                        {files.length > 0 ? `${files.length} file(s) selected` : 'Select multiple files'}
                                    </span>
                                </label>
                            </div>
                        )}

                        {files.length > 0 && (
                            <div style={{
                                flex: '1 1 300px',
                                maxWidth: '500px',
                                width: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                backgroundColor: 'var(--bg-input)',
                                borderRadius: 'var(--radius-xl)',
                                padding: '32px',
                                border: '1px solid var(--border)',
                                minHeight: '320px',
                                overflow: 'hidden',
                                animation: 'fadeIn 0.5s ease'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '16px', width: '100%' }}>
                                    <button
                                        onClick={togglePin}
                                        style={{
                                            background: pin ? 'var(--danger)' : 'transparent',
                                            border: pin ? 'none' : '1px solid var(--border)',
                                            color: pin ? 'var(--text-inverse)' : 'var(--text-secondary)',
                                            padding: '8px 20px',
                                            borderRadius: 'var(--radius-full)',
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            fontWeight: '600',
                                            transition: 'all 0.2s',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}
                                    >
                                        {pin ? <><FiLock /> PIN: {pin}</> : <><FiUnlock /> Secure with PIN (Optional)</>}
                                    </button>
                                </div>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                                    <div style={{
                                        background: '#fff',
                                        padding: '20px',
                                        borderRadius: '16px',
                                        boxShadow: 'var(--shadow-md)',
                                        marginBottom: '24px'
                                    }}>
                                        <QRCodeSVG value={shareUrl} size={140} />
                                    </div>
                                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: '500', marginBottom: '4px' }}>
                                        Scan to Receive
                                    </p>
                                    <p style={{ fontSize: '0.95rem', color: 'var(--accent)', fontWeight: '600' }}>
                                        {files.length} file{files.length !== 1 && 's'} ready to send
                                    </p>
                                </div>

                                <div style={{ width: '100%', marginTop: 'auto' }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '12px',
                                        background: 'var(--bg-card)',
                                        padding: '6px 6px 6px 20px',
                                        borderRadius: 'var(--radius-full)',
                                        width: '100%',
                                        border: '1px solid var(--border)',
                                        transition: 'border-color 0.2s, box-shadow 0.2s',
                                        marginBottom: '16px',
                                        overflow: 'hidden'
                                    }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.borderColor = 'var(--accent)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.borderColor = 'var(--border)';
                                        }}
                                    >
                                        <span style={{
                                            color: 'var(--text-primary)',
                                            fontSize: '0.95rem',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            flex: 1,
                                            userSelect: 'all',
                                            minWidth: '0'
                                        }}>
                                            {shareUrl}
                                        </span>
                                        <button
                                            onClick={copyUrl}
                                            style={{
                                                background: copied ? 'var(--success)' : 'var(--accent)',
                                                border: 'none',
                                                color: 'var(--text-inverse)',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px',
                                                padding: '10px 20px',
                                                borderRadius: 'var(--radius-full)',
                                                height: '44px',
                                                flexShrink: 0,
                                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                fontWeight: '600',
                                                fontSize: '0.9rem'
                                            }}
                                            title="Copy Link"
                                        >
                                            {copied ? <><FiCheckCircle /> Copied</> : <><FiCopy /> Copy</>}
                                        </button>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                                        <button
                                            onClick={resetFiles}
                                            style={{
                                                background: 'transparent',
                                                border: '1px solid var(--border)',
                                                color: 'var(--text-secondary)',
                                                padding: '10px 24px',
                                                borderRadius: 'var(--radius-full)',
                                                cursor: 'pointer',
                                                fontSize: '0.9rem',
                                                fontWeight: '500',
                                                transition: 'all 0.2s',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.borderColor = 'var(--danger)';
                                                e.currentTarget.style.color = 'var(--danger)';
                                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.borderColor = 'var(--border)';
                                                e.currentTarget.style.color = 'var(--text-secondary)';
                                                e.currentTarget.style.background = 'transparent';
                                            }}
                                        >
                                            Clear / Reset
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {status === 'connected' && (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
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
                        <div style={{ display: 'flex', alignItems: 'center', color: 'var(--accent)', animation: 'pulse 2s infinite' }}>
                            <FiMonitor style={{ fontSize: '32px' }} />
                            <FiArrowRight className="p2p-transfer-arrow" style={{ fontSize: '24px' }} />
                            <FiSmartphone style={{ fontSize: '32px' }} />
                        </div>
                    </div>
                    <h4 style={{ color: 'var(--text-primary)', marginBottom: '8px', fontSize: '1.2rem' }}>Receiver Connected!</h4>
                    <p style={{ color: 'var(--text-secondary)' }}>Preparing to send {files.length} file(s)...</p>
                </div>
            )}

            {status === 'locked' && (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        background: 'rgba(239, 68, 68, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 24px',
                        border: '1px solid rgba(239, 68, 68, 0.2)'
                    }}>
                        <FiLock style={{ fontSize: '32px', color: 'var(--danger)' }} />
                    </div>
                    <h4 style={{ color: 'var(--text-primary)', marginBottom: '12px', fontSize: '1.2rem' }}>Awaiting PIN Verification</h4>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Share this exact PIN with the receiver:</p>
                    <div style={{
                        display: 'inline-block',
                        background: 'var(--bg-input)',
                        padding: '16px 32px',
                        borderRadius: 'var(--radius-lg)',
                        border: '2px dashed var(--border)',
                        color: 'var(--text-primary)',
                        fontSize: '3rem',
                        fontWeight: '700',
                        letterSpacing: '12px'
                    }}>
                        {pin}
                    </div>
                </div>
            )}

            {status === 'sending' && (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
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
                        <FiUploadCloud style={{ fontSize: '40px', color: 'var(--accent)' }} />
                    </div>
                    <h4 style={{ color: 'var(--text-primary)', marginBottom: '16px', fontSize: '1.2rem' }}>Sending Files...</h4>
                    <div style={{
                        width: '100%',
                        maxWidth: '320px',
                        margin: '0 auto',
                        height: '6px',
                        background: 'var(--bg-input)',
                        borderRadius: '4px',
                        overflow: 'hidden'
                    }}>
                        <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.3s ease-out' }}></div>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '12px', fontWeight: '500' }}>{progress}%</p>

                    <button
                        onClick={cancelSending}
                        style={{
                            marginTop: '24px',
                            background: 'transparent',
                            border: '1px solid var(--danger)',
                            color: 'var(--danger)',
                            padding: '8px 24px',
                            borderRadius: 'var(--radius-full)',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '0.9rem',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--danger)';
                            e.currentTarget.style.color = 'var(--text-inverse)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--danger)';
                        }}
                    >
                        Cancel Transfer
                    </button>
                </div>
            )}

            {status === 'done' && (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
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
                    <h4 style={{ color: 'var(--text-primary)', marginBottom: '8px', fontSize: '1.2rem' }}>Transfer Complete!</h4>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>All files have been successfully sent.</p>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            background: 'var(--accent)',
                            color: 'var(--text-inverse)',
                            border: 'none',
                            padding: '12px 32px',
                            borderRadius: 'var(--radius-full)',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '0.95rem',
                            transition: 'transform 0.2s',
                            boxShadow: 'var(--shadow-md)'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        Send More Files
                    </button>
                </div>
            )}
        </div>
    );
}
