import { useState, useRef, useEffect } from 'react';
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
    const { user, isPremium, logout, setShowLogin, setShowPremium } = useAuth();
    const [searchOpen, setSearchOpen] = useState(false);
    const [qrOpen, setQrOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const dropdownRef = useRef(null);

    const isUserPremium = !!(isPremium || user?.isPremium);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target) && !event.target.closest('.user-chip')) {
                setMenuOpen(false);
            }
        };
        if (menuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [menuOpen]);

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

                        {!isUserPremium && (
                            <button
                                className="icon-btn header-crown-btn"
                                onClick={() => setShowPremium(true)}
                                title={user ? "Upgrade to Premium" : "Go Premium"}
                                aria-label="Go Premium"
                            >
                                <span className="header-crown-wrap">
                                    <FaCrown className="header-crown-icon" />
                                    <span className="header-crown-shine" />
                                </span>
                            </button>
                        )}

                        {user ? (
                            <div className="user-menu">
                                <button
                                    className={`user-chip ${isUserPremium ? 'user-chip-premium' : ''}`}
                                    onClick={() => setMenuOpen((open) => !open)}
                                    title={user.name}
                                >
                                    <span className={`user-avatar-wrap ${isUserPremium ? 'is-premium' : ''}`}>
                                        {isUserPremium && (
                                            <span className="premium-avatar-ring" aria-hidden="true" />
                                        )}
                                        {user.picture ? (
                                            <img src={user.picture} alt="" className="user-avatar" referrerPolicy="no-referrer" />
                                        ) : (
                                            <span className="user-avatar-fallback">{(user.name || 'U')[0]}</span>
                                        )}
                                        {isUserPremium && (
                                            <span className="premium-crown" title="Premium">
                                                <FaCrown />
                                            </span>
                                        )}
                                    </span>
                                </button>
                                {menuOpen && (
                                    <div className="user-dropdown" ref={dropdownRef}>
                                        {/* User Profile Card */}
                                        <div className="user-dropdown-header">
                                            <span className={`user-avatar-wrap ${isUserPremium ? 'is-premium' : ''}`}>
                                                {isUserPremium && <span className="premium-avatar-ring" aria-hidden="true" />}
                                                {user.picture ? (
                                                    <img src={user.picture} alt="" className="user-avatar" referrerPolicy="no-referrer" />
                                                ) : (
                                                    <span className="user-avatar-fallback">{(user.name || 'U')[0]}</span>
                                                )}
                                                {isUserPremium && (
                                                    <span className="premium-crown" title="Premium">
                                                        <FaCrown />
                                                    </span>
                                                )}
                                            </span>
                                            <div className="user-dropdown-info">
                                                <div className="user-dropdown-name">{user.name}</div>
                                                <div className="user-dropdown-email">{user.email}</div>
                                            </div>
                                        </div>

                                        {/* Membership Status Badge Card */}
                                        <div className="user-dropdown-status-box">
                                            {isUserPremium ? (
                                                <div className="user-dropdown-pro-status">
                                                    <span className="pro-status-tag">
                                                        <FaCrown /> PRO MEMBER
                                                    </span>
                                                    {user.premiumUntil && (
                                                        <span className="pro-status-days">
                                                            {Math.max(0, Math.ceil((new Date(user.premiumUntil) - new Date()) / (1000 * 60 * 60 * 24)))} days left
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="user-dropdown-free-status">
                                                    <span className="free-status-tag">Free Tier</span>
                                                    <button
                                                        className="free-upgrade-link"
                                                        onClick={() => { setShowPremium(true); setMenuOpen(false); }}
                                                    >
                                                        <FaCrown /> Upgrade
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="user-dropdown-divider" />

                                        {/* Action Items */}
                                        <div className="user-dropdown-menu">
                                            <button
                                                className="user-dropdown-item pro-menu-item"
                                                onClick={() => { setShowPremium(true); setMenuOpen(false); }}
                                            >
                                                <FaCrown className="premium-crown-inline" />
                                                <span>{isUserPremium ? 'Extend Pro Membership' : 'Upgrade to Pro — ₹10'}</span>
                                            </button>
                                            <button
                                                className="user-dropdown-item signout-menu-item"
                                                onClick={() => { logout(); setMenuOpen(false); }}
                                            >
                                                <FiLogOut />
                                                <span>Sign out</span>
                                            </button>
                                        </div>
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
