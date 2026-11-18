const favoriteToastTimers = new Map();

export function hideFavoriteToast(inDialog = false) {
    const toast = document.getElementById(inDialog ? "dialog-favorite-toast" : "favorite-toast");
    toast.classList.remove("is-visible");
    window.clearTimeout(favoriteToastTimers.get(toast));
    favoriteToastTimers.delete(toast);
}

export function showFavoriteToast(saved, inDialog = false) {
    const toast = document.getElementById(inDialog ? "dialog-favorite-toast" : "favorite-toast");
    toast.textContent = saved ? "Sparad bland favoriter" : "Borttagen från favoriter";
    toast.classList.toggle("is-saved", saved);
    toast.classList.toggle("is-removed", !saved);
    toast.classList.add("is-visible");
    window.clearTimeout(favoriteToastTimers.get(toast));
    favoriteToastTimers.set(toast, window.setTimeout(() => {
        toast.classList.remove("is-visible");
        favoriteToastTimers.delete(toast);
    }, 2200));
}
