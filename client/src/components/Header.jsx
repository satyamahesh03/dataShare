import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { FiSearch, FiSun, FiMoon, FiShare2, FiLogOut } from 'react-icons/fi';
import { MdOutlineQrCodeScanner } from 'react-icons/md';
import { FaFolderOpen, FaCrown } from 'react-icons/fa';
import SearchModal from './SearchModal';
import QRScannerModal from './QRScannerModal';

export default function Header() {
    const { theme, toggleTheme } = useTheme();
    const { user, logout, setShowLogin, setShowPremium } = useAuth();
    const [searchOpen, setSearchOpen] = useState(false);
    const [qrOpen, setQrOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <>
            <header className="header">
                <div className="header-inner">
                    <Link to="/" className="logo">
                        <FiShare2 className="logo-icon" />
                        <span className="logo-text">Data<span className="logo-highlight">Share</span></span>
                    </Link>

                    <div className="header-actions">

                        <button
                            className="icon-btn"
                            onClick={() => setQrOpen(true)}
                            title="Scan QR Code"
                            aria-label="Scan QR Code"
                        >
                            <MdOutlineQrCodeScanner />
                        </button>

                        <button
                            className="icon-btn"
                            onClick={() => setSearchOpen(true)}
                            title="Search share code"
                            aria-label="Search"
                        >
                            <FiSearch />
                        </button>

                        <Link
                            to="/posts"
                            className="icon-btn"
                            title="Published Posts"
                            aria-label="Published Posts"
                        >
                            <FaFolderOpen />
                        </Link>



                        <button
                            className="icon-btn"
                            onClick={toggleTheme}
                            title="Toggle theme"
                            aria-label="Toggle theme"
                        >
                            {theme === 'light' ? <FiMoon /> : <FiSun />}
                        </button>

                        {user && !user.isPremium && (
                            <button className="premium-nav-btn" onClick={() => setShowPremium(true)}>
                                <FaCrown /> Premium
                            </button>
                        )}

                        {user ? (
                            <div className="user-menu">
                                <button
                                    className="user-chip"
                                    onClick={() => setMenuOpen((open) => !open)}
                                    title={user.name}
                                >
                                    <span className="user-avatar-wrap">
                                        {user.picture ? (
                                            <img src={user.picture} alt="" className="user-avatar" referrerPolicy="no-referrer" />
                                        ) : (
                                            <span className="user-avatar-fallback">{(user.name || 'U')[0]}</span>
                                        )}
                                        {user.isPremium && (
                                            <span className="premium-crown" title="Premium">
                                                <FaCrown />
                                            </span>
                                        )}
                                    </span>
                                </button>
                                {menuOpen && (
                                    <div className="user-dropdown" onMouseLeave={() => setMenuOpen(false)}>
                                        <div className="user-dropdown-name">{user.name}</div>
                                        <div className="user-dropdown-email">{user.email}</div>
                                        {user.isPremium ? (
                                            <button className="user-dropdown-item" onClick={() => { setShowPremium(true); setMenuOpen(false); }}>
                                                <FaCrown className="premium-crown-inline" /> Extend Premium
                                            </button>
                                        ) : (
                                            <button className="user-dropdown-item" onClick={() => { setShowPremium(true); setMenuOpen(false); }}>
                                                <FaCrown className="premium-crown-inline" /> Upgrade to Premium
                                            </button>
                                        )}
                                        <button className="user-dropdown-item" onClick={() => { logout(); setMenuOpen(false); }}>
                                            <FiLogOut /> Sign out
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <button className="signin-btn" onClick={() => setShowLogin(true)}>
                                Sign in
                            </button>
                        )}
                    </div>
                </div>
            </header>

            <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
            <QRScannerModal isOpen={qrOpen} onClose={() => setQrOpen(false)} />
        </>
    );
}
