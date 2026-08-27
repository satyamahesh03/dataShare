import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiFileText, FiFolder, FiShield, FiGlobe, FiSmartphone, FiArrowRight, FiMonitor } from 'react-icons/fi';
import { API_URL } from '../config';

export default function Home() {
    const [stats, setStats] = useState(null);

    useEffect(() => {
        fetch(`${API_URL}/api/share/stats`)
            .then(res => res.json())
            .then(data => {
                if (data.totalPublished !== undefined) {
                    setStats(data.totalPublished);
                }
            })
            .catch(err => console.error('Failed to fetch stats:', err));
    }, []);

    return (
        <main>
            <section className="hero">
                <h1 className="hero-title animate-fade-in-up">
                    Share anything,<br />instantly.
                </h1>
                <p className="hero-subtitle animate-fade-in-up delay-100">
                    Securely share texts and files in seconds.
                </p>
                {stats !== null && (
                    <div className="global-stats-badge animate-fade-in-up delay-200" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', marginTop: '16px', backgroundColor: 'var(--surface-color)', borderRadius: '24px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '500' }}>
                        <FiGlobe style={{ color: 'var(--primary-color)' }} />
                        <span><strong style={{ color: 'var(--text-primary)' }}>{stats.toLocaleString()}+</strong> items shared globally</span>
                    </div>
                )}
            </section>

            <section className="features">
                <div className="p2p-card animate-fade-in-up delay-300" style={{ gridColumn: '1 / -1' }}>
                    <div className="p2p-card-content">
                        <div className="p2p-icon-wrapper">
                            <FiFolder className="p2p-device-icon primary" style={{ fontSize: '2rem' }} />
                        </div>
                        <div className="p2p-text-content">
                            <h3 className="feature-title p2p-title">File Sharing</h3>
                            <p className="feature-desc p2p-desc">
                                Share files with ease
                            </p>
                        </div>
                    </div>
                    <Link to="/file" className="p2p-action-btn">
                        Share Files <FiArrowRight className="p2p-arrow" />
                    </Link>
                </div>

                <Link to="/text" className="feature-card animate-fade-in-up delay-400">
                    <div className="feature-card-top">
                        <div className="feature-icon">
                            <FiFileText />
                        </div>
                        <h3 className="feature-title">Text Sharing</h3>
                    </div>
                    <p className="feature-desc">
                        Share text instantly with a link.
                    </p>
                </Link>

                <Link to="/secure/encrypt" className="feature-card animate-fade-in-up delay-500">
                    <div className="feature-card-top">
                        <div className="feature-icon">
                            <FiShield />
                        </div>
                        <h3 className="feature-title">SafeVault</h3>
                    </div>
                    <p className="feature-desc">
                        Encrypt & decrypt messages with a password.
                    </p>
                </Link>

                <Link to="/p2p" className="feature-card animate-fade-in-up delay-500" style={{ gridColumn: '1 / -1' }}>
                    <div className="feature-card-top">
                        <div className="feature-icon">
                            <FiMonitor />
                        </div>
                        <h3 className="feature-title">Peer-to-Peer Transfer</h3>
                    </div>
                    <p className="feature-desc">
                        Send files directly to another device. Unlimited size, no server storage.
                    </p>
                </Link>
            </section>
        </main>
    );
}
