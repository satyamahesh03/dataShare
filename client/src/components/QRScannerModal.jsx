import React, { useEffect, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { FiX, FiAlertCircle } from 'react-icons/fi';

export default function QRScannerModal({ isOpen, onClose }) {
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        let html5QrCode;

        if (isOpen) {
            setErrorMsg(''); // clear errors on open
            html5QrCode = new Html5Qrcode("qr-reader");

            const startScanner = async () => {
                try {
                    await html5QrCode.start(
                        { facingMode: "environment" },
                        {
                            fps: 10,
                            aspectRatio: 1.0,
                            qrbox: (viewfinderWidth, viewfinderHeight) => {
                                const minEdgePercentage = 0.7; // 70% of the smallest edge
                                const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
                                const qrboxSize = Math.floor(minEdgeSize * minEdgePercentage);
                                return {
                                    width: qrboxSize,
                                    height: qrboxSize
                                };
                            },
                        },
                        (decodedText) => {
                            html5QrCode.stop().then(() => {
                                html5QrCode.clear();
                                onClose();
                                window.location.href = decodedText;
                            }).catch(err => console.error("Error stopping scanner", err));
                        },
                        (errorMessage) => {
                            // ignore routine scan failures since they are thrown on every frame a code isn't found
                        }
                    );
                } catch (err) {
                    console.error("Camera access error:", err);
                    setErrorMsg("Please grant camera permissions. Also, ensure you are accessing the site via HTTPS if on a mobile device.");
                }
            };

            // Small delay to ensure the DOM element is rendered
            setTimeout(startScanner, 100);
        }

        return () => {
            if (html5QrCode && html5QrCode.isScanning) {
                html5QrCode.stop().then(() => html5QrCode.clear()).catch(error => {
                    console.error("Failed to stop scanner on cleanup.", error);
                });
            }
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
            <style>
                {`
                    #qr-reader video {
                        width: 100% !important;
                        height: auto !important;
                        object-fit: cover !important;
                        border-radius: 12px;
                    }
                    #qr-reader {
                        border: none !important;
                    }
                `}
            </style>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '90%', margin: '80px 0 80px 20px' }}>
                <div className="modal-header" style={{ position: 'relative' }}>
                    <h3 className="modal-title">Scan QR Code</h3>
                    <button className="icon-btn" onClick={onClose} style={{ position: 'absolute', top: '-10px', right: '-20px', width: '56px', height: '56px', fontSize: '2rem' }}>
                        <FiX />
                    </button>
                </div>
                <div className="modal-body">
                    {errorMsg ? (
                        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--danger)' }}>
                            <FiAlertCircle style={{ fontSize: '32px', marginBottom: '12px' }} />
                            <p>{errorMsg}</p>
                        </div>
                    ) : (
                        <div id="qr-reader" style={{ width: '100%', borderRadius: '12px', overflow: 'hidden', background: '#000' }}></div>
                    )}
                    <p style={{ textAlign: 'center', marginTop: '16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        Point your camera at a DataShare QR code to receive files or text.
                    </p>
                </div>
            </div>
        </div>
    );
}
