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
        if (trimmed.length < 4) {
            setError('Please enter a valid share code');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const res = await fetch(`${API_URL}/api/share/lookup/${trimmed}`);
            if (res.ok) {
                navigate(`/share/${trimmed}`);
            } else {
                const data = await res.json();
                setError(data.error || 'Share not found or has expired');
            }
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
                    Enter the 6-character code to access shared content
                </p>
                <form onSubmit={handleSearch} className="search-input-wrapper">
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Enter code"
                        value={code}
                        onChange={(e) => {
                            setCode(e.target.value.toUpperCase());
                            setError('');
                        }}
                        maxLength={6}
                        autoFocus
                    />
                    <button
                        type="submit"
                        className="search-go-btn"
                        disabled={loading || code.trim().length < 4}
                    >
                        {loading ? '...' : 'Go'}
                    </button>
                </form>
                {error && <p className="search-error">{error}</p>}
            </div>
        </div>
    );
}
