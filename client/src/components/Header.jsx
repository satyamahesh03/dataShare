import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { FiSearch, FiSun, FiMoon, FiShare2 } from 'react-icons/fi';
import { FaFolderOpen } from 'react-icons/fa';
import SearchModal from './SearchModal';

export default function Header() {
    const { theme, toggleTheme } = useTheme();
    const [searchOpen, setSearchOpen] = useState(false);

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
                    </div>
                </div>
            </header>

            <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
        </>
    );
}
