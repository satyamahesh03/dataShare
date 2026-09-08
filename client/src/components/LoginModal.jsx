import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { FiX } from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { GOOGLE_CLIENT_ID } from '../config';

export default function LoginModal() {
    const { showLogin, setShowLogin, loginWithGoogle } = useAuth();
    const { addToast } = useToast();
    const location = useLocation();
    const navigate = useNavigate();

    const isLoginRoute = location.pathname === '/login';
    const isOpen = isLoginRoute;

    // When showLogin is triggered from buttons, reflect it in the URL with a unique auth ID,
    // then immediately turn off the context's showLogin state so the URL is the single source of truth.
    useEffect(() => {
        if (showLogin) {
            if (!isLoginRoute) {
                const authId = 'auth_' + Math.random().toString(36).substring(2, 10);
                navigate(`/login?auth_id=${authId}`, { state: { from: location.pathname } });
            }
            setShowLogin(false);
        }
    }, [showLogin, isLoginRoute, location.pathname, navigate, setShowLogin]);

    if (!isOpen) return null;

    const handleClose = () => {
        const target = (location.state?.from && !location.state.from.startsWith('/login'))
            ? location.state.from
            : '/';
        navigate(target, { replace: true });
    };

    return (
        <div className="publish-modal-overlay" style={{ zIndex: 9999 }} onClick={handleClose}>
            <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
                <button className="publish-modal-close" onClick={handleClose}>
                    <FiX />
                </button>
                <div className="auth-modal-crown">
                    <FaCrown />
                </div>
                <h2 className="publish-modal-title">Sign in to DataShare</h2>
                <p className="publish-modal-desc">
                    Use Google to sync your posts across devices and upgrade to Premium.
                </p>
                <ul className="auth-benefits">
                    <li>Your uploads stay in your account</li>
                    <li>Free users can share files up to 50MB</li>
                    <li>Premium unlocks 1GB uploads and Burst Share</li>
                </ul>
                <div className="google-login-wrap">
                    {GOOGLE_CLIENT_ID ? (
                        <GoogleLogin
                            onSuccess={async (cred) => {
                                try {
                                    await loginWithGoogle(cred.credential);
                                    handleClose();
                                } catch (err) {
                                    addToast(err.message || 'Sign-in failed', 'error');
                                }
                            }}
                            onError={() => addToast('Google sign-in was cancelled', 'error')}
                            useOneTap={false}
                            theme="filled_black"
                            size="large"
                            text="continue_with"
                            shape="pill"
                        />
                    ) : (
                        <p className="password-gate-error">Google sign-in is not configured.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
