import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiFileText, FiFolder, FiShield, FiGlobe } from 'react-icons/fi';
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
                <h1 className="hero-title">
                    Share anything,<br />instantly.
                </h1>
                <p className="hero-subtitle">
                    Securely share texts and files in seconds. No account required.
                </p>
                {stats !== null && (
                    <div className="global-stats-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', marginTop: '16px', backgroundColor: 'var(--surface-color)', borderRadius: '24px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '500' }}>
                        <FiGlobe style={{ color: 'var(--primary-color)' }} />
                        <span><strong style={{ color: 'var(--text-primary)' }}>{stats.toLocaleString()}+</strong> items shared globally</span>
                    </div>
                )}
            </section>

            <section className="features">
                <Link to="/text" className="feature-card">
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

                <Link to="/file" className="feature-card">
                    <div className="feature-card-top">
                        <div className="feature-icon">
                            <FiFolder />
                        </div>
                        <h3 className="feature-title">File Sharing</h3>
                    </div>
                    <p className="feature-desc">
                        Send files fast.
                    </p>
                </Link>

                <Link to="/secure/encrypt" className="feature-card">
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
            </section>
        </main>
    );
}
