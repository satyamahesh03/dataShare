import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { API_URL, TOKEN_KEY, authHeaders } from '../config';
import { useToast } from './ToastContext';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const { addToast } = useToast();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showLogin, setShowLogin] = useState(false);
    const [showPremium, setShowPremium] = useState(false);

    const triggerProWelcome = () => {
        document.documentElement.classList.add('premium-transforming');
        setTimeout(() => {
            document.documentElement.classList.remove('premium-transforming');
        }, 3500);
    };

    const refreshUser = async () => {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) {
            setUser(null);
            setLoading(false);
            return;
        }
        try {
            const res = await fetch(`${API_URL}/api/auth/me`, {
                headers: authHeaders(),
            });
            if (!res.ok) throw new Error('Session expired');
            const data = await res.json();
            setUser(data.user);
        } catch {
            localStorage.removeItem(TOKEN_KEY);
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshUser();
    }, []);

    useEffect(() => {
        if (user?.isPremium) {
            document.documentElement.setAttribute('data-premium', 'true');
        } else {
            document.documentElement.removeAttribute('data-premium');
        }
    }, [user]);

    const loginWithGoogle = async (credential) => {
        const res = await fetch(`${API_URL}/api/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Google sign-in failed');
        localStorage.setItem(TOKEN_KEY, data.token);
        setUser(data.user);
        setShowLogin(false);
        if (data.user?.isPremium) {
            triggerProWelcome();
        } else {
            addToast(`Welcome${data.user?.name ? `, ${data.user.name.split(' ')[0]}` : ''}!`, 'success');
        }
        return data.user;
    };

    const logout = () => {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
        addToast('Signed out', 'info');
    };

    const requirePremium = () => {
        if (!user) {
            setShowLogin(true);
            addToast('Sign in to unlock Premium', 'info');
            return false;
        }
        if (!user.isPremium) {
            setShowPremium(true);
            return false;
        }
        return true;
    };

    const value = useMemo(() => ({
        user,
        loading,
        isPremium: !!user?.isPremium,
        showLogin,
        setShowLogin,
        showPremium,
        setShowPremium,
        triggerProWelcome,
        loginWithGoogle,
        logout,
        refreshUser,
        requirePremium,
        setUser,
    }), [user, loading, showLogin, showPremium]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
