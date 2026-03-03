import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { savePublishedPost } from '../utils/publishedPosts';
import ShareResult from '../components/ShareResult';
import PublishModal from '../components/PublishModal';
import BlockEditor from '../components/BlockEditor';
import { API_URL } from '../config';

export default function TextShare() {
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);
    const [shareResult, setShareResult] = useState(null);
    const [showPublishModal, setShowPublishModal] = useState(false);
    const { addToast } = useToast();

    const handleContentChange = (content) => {
        setText(content);
    };

    const handlePublishClick = () => {
        if (!text.trim()) {
            addToast('Please enter some text to share', 'error');
            return;
        }
        setShowPublishModal(true);
    };

    const handlePublish = async ({ expiryMinutes, password }) => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/share/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'text',
                    textContent: text,
                    expiryMinutes,
                    password,
                }),
            });

            const data = await res.json();
            if (data.success) {
                savePublishedPost({ code: data.code, expiresAt: data.expiresAt, type: 'text' });
                setShareResult(data);
                setShowPublishModal(false);
                addToast('Text shared successfully!', 'success');
            } else {
                addToast(data.error || 'Failed to create share', 'error');
            }
        } catch (err) {
            addToast('Server error. Please try again.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCloseResult = () => {
        setShareResult(null);
        setText('');
    };

    return (
        <main className="tool-page">
            <div className="tool-header">
                <div className="breadcrumb">
                    <Link to="/">Tools</Link>
                    <span className="separator">/</span>
                    <span className="current">Text Sharing</span>
                </div>
                <button
                    className="publish-btn"
                    onClick={handlePublishClick}
                    disabled={!text.trim()}
                >
                    Publish
                </button>
            </div>

            <div className="content-area">
                <BlockEditor onContentChange={handleContentChange} />
            </div>

            <PublishModal
                isOpen={showPublishModal}
                onClose={() => setShowPublishModal(false)}
                onPublish={handlePublish}
                loading={loading}
            />

            {shareResult && (
                <ShareResult
                    shareData={shareResult}
                    onClose={handleCloseResult}
                />
            )}
        </main>
    );
}
