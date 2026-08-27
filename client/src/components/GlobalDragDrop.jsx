import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export let pendingDroppedFiles = null;
export const clearPendingDroppedFiles = () => { pendingDroppedFiles = null; };

export default function GlobalDragDrop() {
    const [isDragging, setIsDragging] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        let dragCounter = 0;

        const handleDragEnter = (e) => {
            e.preventDefault();
            if (location.pathname === '/file' || location.pathname.startsWith('/p2p')) return;
            dragCounter++;
            if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
                setIsDragging(true);
            }
        };

        const handleDragLeave = (e) => {
            e.preventDefault();
            if (location.pathname === '/file' || location.pathname.startsWith('/p2p')) return;
            dragCounter--;
            if (dragCounter === 0) {
                setIsDragging(false);
            }
        };

        const handleDragOver = (e) => {
            e.preventDefault();
            if (location.pathname === '/file' || location.pathname.startsWith('/p2p')) return;
            setIsDragging(true);
        };

        const handleDrop = (e) => {
            e.preventDefault();
            dragCounter = 0;
            setIsDragging(false);
            
            if (location.pathname === '/file' || location.pathname.startsWith('/p2p')) return;

            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                pendingDroppedFiles = e.dataTransfer.files;
                navigate('/file');
            }
        };

        window.addEventListener('dragenter', handleDragEnter);
        window.addEventListener('dragleave', handleDragLeave);
        window.addEventListener('dragover', handleDragOver);
        window.addEventListener('drop', handleDrop);

        return () => {
            window.removeEventListener('dragenter', handleDragEnter);
            window.removeEventListener('dragleave', handleDragLeave);
            window.removeEventListener('dragover', handleDragOver);
            window.removeEventListener('drop', handleDrop);
        };
    }, [location.pathname, navigate]);

    if (!isDragging) return null;

    return (
        <div 
            style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(14, 165, 233, 0.9)',
                backdropFilter: 'blur(8px)',
                zIndex: 99999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '2rem',
                fontWeight: '600',
                pointerEvents: 'none'
            }}
        >
            <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📥</div>
                Drop files to share instantly
            </div>
        </div>
    );
}
