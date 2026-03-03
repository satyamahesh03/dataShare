import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiX } from 'react-icons/fi';
import { API_URL } from '../config';

export default function SearchModal({ isOpen, onClose }) {
    const [chars, setChars] = useState(['', '', '', '', '', '']);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const inputRefs = useRef([]);
    const navigate = useNavigate();


    useEffect(() => {
        if (isOpen) {
            setChars(['', '', '', '', '', '']);
            setError('');
            setTimeout(() => inputRefs.current[0]?.focus(), 100);
        }
    }, [isOpen]);

    const handleChange = (index, value) => {
        const char = value.toUpperCase().slice(-1);
        const newChars = [...chars];
        newChars[index] = char;
        setChars(newChars);
        setError('');

        // Auto-focus next input
        if (char && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }

        // Auto-submit when all 6 chars are filled
        if (char && index === 5) {
            const code = newChars.join('');
            if (code.length === 6) {
                submitCode(code);
            }
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !chars[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
            const newChars = [...chars];
            newChars[index - 1] = '';
            setChars(newChars);
        }
        if (e.key === 'Enter') {
            const code = chars.join('');
            if (code.length >= 4) submitCode(code);
        }
        if (e.key === 'Escape') onClose();
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
        const newChars = ['', '', '', '', '', ''];
        for (let i = 0; i < pasted.length; i++) {
            newChars[i] = pasted[i];
        }
        setChars(newChars);
        if (pasted.length === 6) {
            submitCode(pasted);
        } else {
            inputRefs.current[Math.min(pasted.length, 5)]?.focus();
        }
    };

    const submitCode = async (code) => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_URL}/api/share/lookup/${code}`);
            if (res.ok) {
                onClose();
                navigate(`/share/${code}`);
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

    if (!isOpen) return null;

    return (
        <div className="search-modal-overlay" onClick={onClose}>
            <div className="search-modal" onClick={e => e.stopPropagation()}>
                <button className="search-modal-close" onClick={onClose}>
                    <FiX />
                </button>

                <h2 className="search-modal-title">Enter your sharing code</h2>
                <p className="search-modal-desc">
                    Use your sharing code to retrieve your content.
                </p>

                <div className="search-code-boxes">
                    {chars.map((char, i) => (
                        <span key={i}>
                            <input
                                ref={el => inputRefs.current[i] = el}
                                type="text"
                                className={`search-code-box ${char ? 'filled' : ''} ${error ? 'error' : ''}`}
                                value={char}
                                onChange={e => handleChange(i, e.target.value)}
                                onKeyDown={e => handleKeyDown(i, e)}
                                onPaste={handlePaste}
                                maxLength={1}
                                autoComplete="off"
                                disabled={loading}
                            />
                            {i === 2 && <span className="search-code-dot">·</span>}
                        </span>
                    ))}
                </div>

                {error && <p className="search-modal-error">{error}</p>}
                {loading && (
                    <div className="search-modal-loading">
                        <div className="loading-spinner" />
                    </div>
                )}
            </div>
        </div>
    );
}
