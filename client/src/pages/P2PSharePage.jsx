import React from 'react';
import P2PShare from '../components/P2PShare';

export default function P2PSharePage() {
    return (
        <main className="p2p-page">
            <div className="p2p-page-header">
                <h1 className="p2p-page-title">P2P Transfer</h1>
                <p className="p2p-page-subtitle">Direct browser-to-browser file sharing.</p>
            </div>
            <P2PShare />
        </main>
    );
}
