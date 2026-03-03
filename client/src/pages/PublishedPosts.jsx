import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { FiFileText, FiFile, FiClock, FiLock, FiArrowLeft, FiRefreshCw } from 'react-icons/fi';
import { getPublishedPosts, removePublishedPost } from '../utils/publishedPosts';
import { API_URL } from '../config';

export default function PublishedPosts() {
    const [shares, setShares] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPosts();
    }, []);

    const fetchPosts = async () => {
        setLoading(true);

        // Get codes from localStorage (auto-cleans expired)
        const storedPosts = getPublishedPosts();

        if (storedPosts.length === 0) {
            setShares([]);
            setLoading(false);
            return;
        }

        // Fetch details for each stored code from the server
        const results = [];

        await Promise.all(
            storedPosts.map(async (post) => {
                try {
                    const res = await fetch(`${API_URL}/api/share/lookup/${post.code}`);
                    if (res.ok) {
                        const data = await res.json();
                        results.push({
                            code: post.code,
                            type: post.type,
                            createdAt: data.createdAt || post.createdAt,
                            expiresAt: data.expiresAt,
                            hasPassword: data.hasPassword,
                        });
                    } else {
                        // Share no longer exists (expired/deleted), remove from storage
                        removePublishedPost(post.code);
                    }
                } catch {
                    // Network error, keep in storage but don't show
                }
            })
        );

        // Sort by creation time, newest first
        results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setShares(results);
        setLoading(false);
    };


    return (
        <main className="tool-page">
            <div className="tool-header">
                <div className="breadcrumb">
                    <Link to="/">Home</Link>
                    <span className="separator">/</span>
                    <span className="current">My Posts</span>
                </div>
                <button className="icon-btn" onClick={fetchPosts} title="Refresh">
                    <FiRefreshCw />
                </button>
            </div>

            {loading ? (
                <div className="page-loading">
                    <div className="loading-spinner" />
                </div>
            ) : shares.length === 0 ? (
                <div className="posts-empty">
                    <div className="posts-empty-icon">📭</div>
                    <h2 className="posts-empty-title">No Active Posts</h2>
                    <p className="posts-empty-text">
                        You haven't published any posts yet, or your posts have expired.
                    </p>
                    <Link to="/" className="publish-btn">
                        <FiArrowLeft /> Go Home
                    </Link>
                </div>
            ) : (
                <div className="posts-grid">
                    {shares.map((share) => (
                        <Link
                            key={share.code}
                            to={`/share/${share.code}`}
                            className="post-card"
                        >
                            <div className="post-card-header">
                                <div className="post-card-type">
                                    {share.type === 'text' ? <FiFileText /> : <FiFile />}
                                    <span>{share.type === 'text' ? 'Text' : 'File'}</span>
                                </div>
                                <div className="post-card-badges">
                                    {share.hasPassword && (
                                        <span className="post-card-badge post-card-badge-lock">
                                            <FiLock />
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="post-card-body">
                                <p className="post-card-label">Share Code</p>
                            </div>

                            <div className="post-card-footer">
                                <span className="post-card-code">{share.code}</span>
                                <span className="post-card-expiry">
                                    <FiClock />
                                    {formatDistanceToNow(new Date(share.expiresAt), { addSuffix: true })}
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </main>
    );
}
