import { themeHue } from "./themes.js";
import { formatDrinkDate } from "./utils.js";
import { renderRecipeGroups, renderTasteProfile, renderSpiritLinks } from "./recipes.js";
import { isFavorite, subscribeFavorites, toggleFavorite } from "./favorites.js";
import { hideFavoriteToast, showFavoriteToast } from "./favorite-toast.js";
export function createDrinkDialog(onThemeSelect, onClose = () => {}, onSpiritSelect = () => {}, mediaUrl = (path) => `${R2_BASE_URL}${path}`) {
    let modalTrigger = null;
    let previousBodyOverflow = "";
    let currentDrink = null;
    const favoriteButton = document.getElementById("modal-favorite");
    function syncFavoriteButton() {
        if (!currentDrink || !favoriteButton) return;
        const active = isFavorite(currentDrink.id);
        favoriteButton.classList.toggle("is-favorite", active);
        favoriteButton.setAttribute("aria-pressed", String(active));
        favoriteButton.setAttribute("aria-label", active
            ? `Ta bort ${currentDrink.drink} från favoriter`
            : `Spara ${currentDrink.drink} som favorit`);
        favoriteButton.querySelector("span").textContent = active
            ? "Sparad favorit" : "Spara som favorit";
    }
    if (favoriteButton) {
        favoriteButton.addEventListener("click", () => {
            if (currentDrink) {
                const saved = toggleFavorite(currentDrink.id);
                showFavoriteToast(saved, true);
            }
        });
        subscribeFavorites(syncFavoriteButton);
    }
    function openModal(v) {
        if (favoriteButton) hideFavoriteToast(true);
        currentDrink = v;
        syncFavoriteButton();
        const dialog = document.getElementById("modal-backdrop");
        if (!dialog.open) {
            modalTrigger = document.activeElement;
            previousBodyOverflow = document.body.style.overflow;
        }
        document.body.style.overflow = "hidden";
        document.getElementById("modal-video").src = mediaUrl(v.url);
        document.getElementById("modal-video").poster = v.photo ? mediaUrl(v.photo) : "";
        document.getElementById("modal-drink").textContent =
            v.drink;
        const modalTheme = document.getElementById("modal-theme");
        const hue = themeHue(v.theme || "");
        modalTheme.textContent = v.theme;
        modalTheme.hidden = !v.theme?.trim();
        modalTheme.style.background =
            `hsl(${hue},65%,35%)`;
        modalTheme.style.color =
            `hsl(${hue},20%,95%)`;
        document.getElementById("modal-date").textContent =
            formatDrinkDate(v.date);
        document.getElementById("modal-note").textContent =
            v.note;
        const hasRecipe = !!((v.ingredients && v.ingredients.trim()) ||
            (v.steps && v.steps.trim()) ||
            (v.taste && v.taste.trim()));
        document.getElementById("recipe-block").style.display = hasRecipe ? "block" : "none";
        renderRecipeGroups(v.ingredients, v.steps, v.drink, v.taste);
        if (v.taste) {
            document.getElementById("taste-profile").style.display = "none";
        }
        renderSpiritLinks(v.ingredients, (spirit) => {
            closeModal();
            onSpiritSelect(spirit);
        });
        document
            .getElementById("modal-backdrop")
            .classList.add("open");
        if (!dialog.open) dialog.showModal();
        document.querySelector(".modal-scroll").scrollTop = 0;
        document.getElementById("modal-close").focus();
    }
    function closeModal({ updateHistory = true } = {}) {
        if (!document.getElementById("modal-backdrop").open) return;
        const video = document.getElementById("modal-video");
        video.pause();
        video.src = "";
        currentDrink = null;
        document
            .getElementById("modal-backdrop")
            .classList.remove("open");
        document.getElementById("modal-backdrop").close();
        document.body.style.overflow = previousBodyOverflow;
        if (modalTrigger?.isConnected)
            modalTrigger.focus({ preventScroll: true });
        if (updateHistory) onClose();
    }
    document
        .getElementById("modal-close")
        .addEventListener("click", closeModal);
    document.getElementById("modal-backdrop").addEventListener("cancel", (event) => {
        event.preventDefault();
        closeModal();
    });
    document
        .getElementById("modal-backdrop")
        .addEventListener("click", (e) => {
        if (e.target.id === "modal-backdrop") {
            closeModal();
        }
    });
    document
        .getElementById("modal-theme")
        .addEventListener("click", () => {
        const theme = document.getElementById("modal-theme").textContent.trim();
        closeModal();
        onThemeSelect(theme);
    });
    return { open: openModal, close: closeModal };
}
