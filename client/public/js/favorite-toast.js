const favoriteToastTimers = new Map();

export function hideFavoriteToast(inDialog = false) {
    const toast = document.getElementById(inDialog ? "dialog-favorite-toast" : "favorite-toast");
    toast.classList.remove("is-visible");
    window.clearTimeout(favoriteToastTimers.get(toast));
    favoriteToastTimers.delete(toast);
}

function showToast(message, inDialog = false, state = "") {
    const toast = document.getElementById(inDialog ? "dialog-favorite-toast" : "favorite-toast");
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

export function showDialogSuccessToast(message) {
    showToast(message, true, "saved");
}
