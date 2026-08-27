import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch } from 'react-icons/fi';
import { API_URL } from '../config';

export default function SearchPage() {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSearch = async (e) => {
        e.preventDefault();
        const trimmed = code.trim();
        if (trimmed.length !== 5) {
            setError('Please enter a valid 5-digit share code');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // First check if it's a normal share
            const res = await fetch(`${API_URL}/api/share/lookup/${trimmed}`);
            if (res.ok) {
                navigate(`/share/${trimmed}`);
                return;
            }

            // If not found in DB, check if it's an active P2P room
            const p2pRes = await fetch(`${API_URL}/api/p2p/check/${trimmed}`);
            if (p2pRes.ok) {
                const p2pData = await p2pRes.json();
                if (p2pData.active) {
                    navigate(`/p2p/${trimmed}`);
                    return;
                }
            }

            // Both failed
            setError('Share not found or has expired');
        } catch {
            setError('Failed to connect to server');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="search-page">
            <div className="search-card">
                <div className="search-icon-big">
                    <FiSearch />
                </div>
                <h2 className="search-title">Find a Share</h2>
                <p className="search-desc">
                    Enter the 5-digit code to access shared content
                </p>
                <form onSubmit={handleSearch} className="search-input-wrapper">
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Enter code"
                        value={code}
                        onChange={(e) => {
                            // Only allow numbers
                            setCode(e.target.value.replace(/[^0-9]/g, ''));
                            setError('');
                        }}
                        maxLength={5}
                        autoFocus
                    />
                    <button
                        type="submit"
                        className="search-go-btn"
                        disabled={loading || code.trim().length !== 5}
                    >
                        {loading ? '...' : 'Go'}
                    </button>
                </form>
                {error && <p className="search-error">{error}</p>}
            </div>
        </div>
    );
}
