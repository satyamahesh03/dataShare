export const API_URL = import.meta.env.VITE_API_URL ||
    (import.meta.env.DEV ? 'http://localhost:6500' : 'https://api.datashare.satyapage.in');
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
export const TOKEN_KEY = 'datashare_token';

export const FREE_MAX_BYTES = 50 * 1024 * 1024;
export const PREMIUM_MAX_BYTES = 1024 * 1024 * 1024;

export function getAuthToken() {
    try {
        return localStorage.getItem(TOKEN_KEY) || '';
    } catch {
        return '';
    }
}

export function authHeaders(extra = {}) {
    const token = getAuthToken();
    return {
        ...extra,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}
