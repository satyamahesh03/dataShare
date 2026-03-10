import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import P2PShare from '../components/P2PShare';

export default function P2PSharePage() {
    const navigate = useNavigate();

    return (
        <main className="p2p-page" style={{ maxWidth: '1200px', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                <button className="back-btn" onClick={() => navigate('/')} title="Back to Home">
                    <FiArrowLeft />
                </button>
                <div className="p2p-page-header" style={{ marginBottom: 0 }}>
                    <h1 className="p2p-page-title" style={{ marginBottom: '4px' }}>P2P Transfer</h1>
                    <p className="p2p-page-subtitle">Direct browser-to-browser file sharing.</p>
                </div>
            </div>
            <P2PShare />
        </main>
    );
}
