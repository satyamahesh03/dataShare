import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiSend, FiDownload, FiUploadCloud, FiSmartphone, FiShield, FiWifi, FiArrowRight } from 'react-icons/fi';
import P2PShare from '../components/P2PShare';

export default function P2PSharePage() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('send'); // 'send' or 'receive'
    const [receiveCode, setReceiveCode] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const handleReceiveSubmit = (e) => {
        e.preventDefault();
        const code = receiveCode.trim();
        if (!code || code.length < 4) {
            setErrorMsg('Please enter a valid 5-digit room code.');
            return;
        }
        navigate(`/p2p/${code}`);
    };

    return (
        <main className="p2p-page">
            {/* Top Navigation & Header */}
            <div className="p2p-top-nav">
                <div className="p2p-header-info">
                    <button className="back-btn" onClick={() => navigate('/')} title="Back to Home">
                        <FiArrowLeft />
                    </button>
                    <div>
                        <h1 className="p2p-page-title">
                            Peer-to-Peer Transfer
                        </h1>
                        <p className="p2p-page-subtitle">Direct browser-to-browser stream • No file limits • 0% cloud storage</p>
                    </div>
                </div>

                <div className="p2p-pill-badge">
                    <FiShield style={{ color: 'var(--success)' }} />
                    End-to-End Encrypted WebRTC
                </div>
            </div>

            {/* How It Works (3-Step Visual Guide) */}
            <div className="p2p-steps-grid">
                <div className="p2p-step-card">
                    <div className="p2p-step-badge">1</div>
                    <div className="p2p-step-content">
                        <h3 className="p2p-step-title">Select Files</h3>
                        <p className="p2p-step-desc">Pick any files or folders. Unlimited size, never uploaded to any server.</p>
                    </div>
                </div>

                <div className="p2p-step-card">
                    <div className="p2p-step-badge">2</div>
                    <div className="p2p-step-content">
                        <h3 className="p2p-step-title">Connect Devices</h3>
                        <p className="p2p-step-desc">Scan the QR code with a phone camera or share the 5-digit room code.</p>
                    </div>
                </div>

                <div className="p2p-step-card">
                    <div className="p2p-step-badge">3</div>
                    <div className="p2p-step-content">
                        <h3 className="p2p-step-title">Direct Stream</h3>
                        <p className="p2p-step-desc">Files transfer directly between browsers at maximum local network speeds.</p>
                    </div>
                </div>
            </div>

            {/* Mode Switcher Tabs */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div className="p2p-mode-nav">
                    <button
                        className={`p2p-tab-btn ${activeTab === 'send' ? 'active' : ''}`}
                        onClick={() => setActiveTab('send')}
                    >
                        <FiSend /> Send Files
                    </button>
                    <button
                        className={`p2p-tab-btn ${activeTab === 'receive' ? 'active' : ''}`}
                        onClick={() => setActiveTab('receive')}
                    >
                        <FiDownload /> Receive with Code
                    </button>
                </div>
            </div>

            {/* Content Area */}
            {activeTab === 'send' ? (
                <P2PShare />
            ) : (
                <div className="p2p-hub-card">
                    <div className="p2p-receive-panel">
                        <div className="p2p-receive-hero-icon">
                            <FiSmartphone />
                        </div>
                        <h2 className="p2p-receive-title">Join a Transfer Room</h2>
                        <p className="p2p-receive-sub">
                            Enter the 5-digit code shown on the sender's device to connect directly.
                        </p>

                        <form className="p2p-code-input-form" onSubmit={handleReceiveSubmit}>
                            <input
                                className="p2p-room-input"
                                type="text"
                                maxLength={5}
                                placeholder="00000"
                                value={receiveCode}
                                onChange={(e) => {
                                    setReceiveCode(e.target.value.replace(/\D/g, ''));
                                    if (errorMsg) setErrorMsg('');
                                }}
                                autoFocus
                            />

                            {errorMsg && (
                                <p style={{ color: 'var(--danger)', fontSize: '0.85rem', margin: 0 }}>
                                    {errorMsg}
                                </p>
                            )}

                            <button
                                type="submit"
                                className="p2p-connect-btn"
                                disabled={receiveCode.length < 4}
                            >
                                Connect & Receive <FiArrowRight />
                            </button>
                        </form>

                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            marginTop: '28px',
                            color: 'var(--text-tertiary)',
                            fontSize: '0.82rem'
                        }}>
                            <FiWifi style={{ color: 'var(--accent)' }} />
                            Tip: Both devices on the same Wi-Fi transfer at Gigabit zero-data speeds.
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
