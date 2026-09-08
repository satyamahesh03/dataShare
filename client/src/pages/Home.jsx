import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiFileText, FiFolder, FiShield, FiGlobe, FiArrowRight, FiMonitor } from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';

export default function Home() {
    const { isPremium } = useAuth();
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
                <h1 className="hero-title">
                    Share anything,<br />instantly.
                </h1>
                <p className="hero-subtitle">
                    Securely share texts and files in seconds.
                </p>
                {stats !== null && (
                    <div className="global-stats-badge">
                        <FiGlobe style={{ color: 'var(--primary-color)' }} />
                        <span><strong style={{ color: 'var(--text-primary)' }}>{stats.toLocaleString()}+</strong> items shared globally</span>
                    </div>
                )}
            </section>

            <section className="features">
                <div className="p2p-card" style={{ gridColumn: '1 / -1' }}>
                    <div className="p2p-card-content">
                        <div className="p2p-icon-wrapper">
                            <FiFolder className="p2p-device-icon primary" style={{ fontSize: '1.6rem' }} />
                        </div>
                        <div className="p2p-text-content">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <h3 className="feature-title p2p-title" style={{ margin: 0 }}>File Sharing</h3>
                                {isPremium && <span className="pro-card-badge"><FaCrown /> 1GB Active</span>}
                            </div>
                            <p className="feature-desc p2p-desc">
                                Share files with ease
                            </p>
                        </div>
                    </div>
                    <Link to="/file" className="p2p-action-btn">
                        Share Files <FiArrowRight className="p2p-arrow" />
                    </Link>
                </div>

                <Link to="/text" className="feature-card">
                    <div className="feature-card-header">
                        <div className="feature-icon">
                            <FiFileText />
                        </div>
                        <h3 className="feature-title">Text Sharing</h3>
                        {isPremium && <span className="pro-card-badge" style={{ marginLeft: 'auto' }}><FaCrown /> Burst & Custom</span>}
                    </div>
                    <p className="feature-desc">
                        Share text instantly with a link.
                    </p>
                </Link>

                <Link to="/secure/encrypt" className="feature-card">
                    <div className="feature-card-header">
                        <div className="feature-icon">
                            <FiShield />
                        </div>
                        <h3 className="feature-title">SafeVault</h3>
                    </div>
                    <p className="feature-desc">
                        Encrypt & decrypt messages with a password.
                    </p>
                </Link>

                {/* <Link to="/p2p" className="feature-card" style={{ gridColumn: '1 / -1' }}>
                    <div className="feature-card-header">
                        <div className="feature-icon">
                            <FiMonitor />
                        </div>
                        <h3 className="feature-title">Peer-to-Peer Transfer</h3>
                    </div>
                    <p className="feature-desc">
                        Send files directly to another device.
                    </p>
                </Link> */}
            </section>
        </main>
    );
}
