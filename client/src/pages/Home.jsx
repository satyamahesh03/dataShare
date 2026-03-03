import { Link } from 'react-router-dom';
import { FiFileText, FiFolder } from 'react-icons/fi';

export default function Home() {
    return (
        <main>
            <section className="hero">
                <h1 className="hero-title">
                    Share anything,<br />instantly.
                </h1>
                <p className="hero-subtitle">
                    Text, files — shared with a code. No sign-up needed.
                </p>
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
            </section>
        </main>
    );
}
