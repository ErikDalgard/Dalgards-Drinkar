const STORAGE_KEY = "dalgardsdrinkar:favorites:v1";
const listeners = new Set();
const ANALYTICS_API_BASE = typeof window === "undefined"
    ? ""
    : window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
        ? "http://localhost:8787"
        : "https://dalgardsdrinkar-api.dalgard-erik.workers.dev";

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

export function toggleFavorite(id, drinkName = "") {
    const key = String(id);
    const removing = favoriteIds.has(key);
    if (removing) favoriteIds.delete(key);
    else favoriteIds.add(key);
    persist();
    notify();
    if (drinkName) {
        fetch(`${ANALYTICS_API_BASE}/analytics/event`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                event: "drink_favorite_changed",
                action: removing ? "removed" : "added",
                drinkId: key,
                drinkName,
            }),
            keepalive: true,
        }).catch(() => {});
    }
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
