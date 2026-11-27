const favoriteToastTimers = new Map();

export function hideFavoriteToast() {
    const toast = document.getElementById("favorite-toast");
    if (!toast) return;
    toast.classList.remove("is-visible");
    window.clearTimeout(favoriteToastTimers.get(toast));
    favoriteToastTimers.delete(toast);
}

function showToast(message, _inDialog = false, state = "") {
    const toast = document.getElementById("favorite-toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.toggle("is-saved", state === "saved");
    toast.classList.toggle("is-removed", state === "removed");
    toast.classList.add("is-visible");
    window.clearTimeout(favoriteToastTimers.get(toast));
    favoriteToastTimers.set(toast, window.setTimeout(() => {
        toast.classList.remove("is-visible");
        favoriteToastTimers.delete(toast);
    }, 2200));
}

export function showFavoriteToast(saved, inDialog = false) {
    showToast(
        saved ? "Sparad bland favoriter" : "Borttagen från favoriter",
        inDialog,
        saved ? "saved" : "removed",
    );
}

