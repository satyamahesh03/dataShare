import { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up the worker for react-pdf to fetch from CDN
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PdfViewer({ fileUrl, burstShare }) {
    const [numPages, setNumPages] = useState(null);
    const [error, setError] = useState(null);
    const [width, setWidth] = useState(800);

    // Responsive width adjustment
    useEffect(() => {
        const handleResize = () => {
            const containerWidth = Math.min(window.innerWidth - 64, 800);
            setWidth(containerWidth);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    function onDocumentLoadSuccess({ numPages }) {
        setNumPages(numPages);
    }

    function onDocumentLoadError(err) {
        console.error('Error loading PDF:', err);
        setError('Failed to load PDF preview.');
    }

    return (
        <div 
            className="pdf-viewer-container" 
            style={{ 
                width: '100%', 
                maxHeight: '600px', 
                overflowY: 'auto', 
                backgroundColor: 'var(--surface-color, #1e1e24)', 
                border: '1px solid var(--border-color)', 
                borderRadius: '8px', 
                marginBottom: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
                userSelect: burstShare ? 'none' : 'auto'
            }}
            // Disable right click on ALL PDFs
            onContextMenu={(e) => e.preventDefault()}
        >
            {error ? (
                <div style={{ color: 'var(--error-color, #ff4d4d)', padding: '20px' }}>{error}</div>
            ) : (
                <Document
                    file={fileUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    loading={<div style={{ padding: '20px', color: 'var(--text-secondary)' }}>Loading PDF...</div>}
                >
                    {Array.from(new Array(numPages), (el, index) => (
                        <div key={`page_${index + 1}`} style={{ marginBottom: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                            <Page 
                                pageNumber={index + 1} 
                                // Disable text layer for burst shares to prevent selection
                                renderTextLayer={!burstShare} 
                                renderAnnotationLayer={!burstShare} 
                                width={width} 
                            />
                        </div>
                    ))}
                </Document>
            )}
        </div>
    );
}
