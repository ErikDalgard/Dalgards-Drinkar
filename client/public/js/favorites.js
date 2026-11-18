const STORAGE_KEY = "dalgardsdrinkar:favorites:v1";
const listeners = new Set();

function readFavorites(value = null) {
    try {
        const stored = value ?? localStorage.getItem(STORAGE_KEY);
        const ids = stored ? JSON.parse(stored) : [];
        return new Set(Array.isArray(ids) ? ids.map(String) : []);
    } catch {
        return new Set();
    }
}

let favoriteIds = readFavorites();

function notify() {
    listeners.forEach((listener) => listener());
}

function persist() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...favoriteIds]));
    } catch {
        // Keep the in-memory list usable if browser storage is unavailable.
    }
}

export function isFavorite(id) {
    return favoriteIds.has(String(id));
}

export function getFavoriteIds() {
    return [...favoriteIds];
}

export function toggleFavorite(id) {
    const key = String(id);
    if (favoriteIds.has(key)) favoriteIds.delete(key);
    else favoriteIds.add(key);
    persist();
    notify();
    return favoriteIds.has(key);
}

export function subscribeFavorites(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

if (typeof window !== "undefined") {
    window.addEventListener("storage", (event) => {
        if (event.key !== STORAGE_KEY && event.key !== null) return;
        favoriteIds = readFavorites(event.key === null ? "[]" : event.newValue);
        notify();
    });
}
