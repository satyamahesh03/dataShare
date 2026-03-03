// Utility to manage published post codes in localStorage

const STORAGE_KEY = 'datashare_published_posts';

/**
 * Get all stored posts, automatically removing expired ones
 */
export function getPublishedPosts() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];

        const posts = JSON.parse(raw);
        const now = Date.now();

        // Filter out expired posts
        const activePosts = posts.filter(post => new Date(post.expiresAt).getTime() > now);

        // If any were removed, update storage
        if (activePosts.length !== posts.length) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(activePosts));
        }

        return activePosts;
    } catch {
        return [];
    }
}

/**
 * Save a new published post code
 */
export function savePublishedPost({ code, expiresAt, type }) {
    try {
        const posts = getPublishedPosts(); // also cleans expired

        // Avoid duplicates
        if (posts.some(p => p.code === code)) return;

        posts.unshift({ code, expiresAt, type, createdAt: new Date().toISOString() });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
    } catch {
        // localStorage might be full or unavailable
    }
}

/**
 * Remove a specific post by code
 */
export function removePublishedPost(code) {
    try {
        const posts = getPublishedPosts();
        const filtered = posts.filter(p => p.code !== code);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch {
        // ignore
    }
}

/**
 * Get count of active (non-expired) posts
 */
export function getActivePostCount() {
    return getPublishedPosts().length;
}
