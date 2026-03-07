import { useState, useEffect } from 'react';
import { HiX } from 'react-icons/hi';

function InstallPWA() {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showBanner, setShowBanner] = useState(false);

    useEffect(() => {
        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShowBanner(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        window.addEventListener('appinstalled', () => {
            setShowBanner(false);
            setDeferredPrompt(null);
        });

        if (window.matchMedia('(display-mode: standalone)').matches) {
            setShowBanner(false);
        }

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setShowBanner(false);
        }
        setDeferredPrompt(null);
    };

    const handleDismiss = () => {
        setShowBanner(false);
    };

    if (!showBanner) return null;

    return (
        <div className="pwa-toast" id="pwa-install-banner">
            <button className="pwa-toast-close" onClick={handleDismiss} aria-label="Dismiss">
                <HiX />
            </button>
            <img src="/icon-192.png" alt="DataShare" className="pwa-toast-icon" />
            <p className="pwa-toast-title">Install DataShare</p>
            <p className="pwa-toast-desc">Get quick access from your home screen</p>
            <button className="pwa-toast-btn" onClick={handleInstall} id="pwa-install-button">
                Install App
            </button>
        </div>
    );
}

export default InstallPWA;
