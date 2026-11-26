import { themeHue } from "./themes.js";
import { escapeHtml } from "./utils.js";
import { isFavorite, toggleFavorite } from "./favorites.js";
import { showFavoriteToast } from "./favorite-toast.js";

export function makeCard(v, { onOpen, onThemeSelect }) {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
    <div class="card-media">
    </div>
    <div class="card-body">
      <h2 class="card-drink"><button type="button" class="card-open">${escapeHtml(v.drink)}</button></h2>
      <div class="card-meta">
        ${v.theme?.trim() ? `<button type="button" class="card-theme" title="${escapeHtml(v.theme)}">${escapeHtml(v.theme)}</button>` : ""}
      </div>
    </div>`;
    if (v.photo) {
        const image = document.createElement("img");
        image.src = `${R2_BASE_URL}${v.photo}`;
        image.alt = "";
        image.loading = "lazy";
        image.decoding = "async";
        card.querySelector(".card-media").prepend(image);
    }
    const favoriteButton = document.createElement("button");
    favoriteButton.type = "button";
    favoriteButton.className = "card-favorite";
    favoriteButton.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/></svg>';
    const syncFavoriteButton = () => {
        const active = isFavorite(v.id);
        favoriteButton.classList.toggle("is-favorite", active);
        favoriteButton.setAttribute("aria-pressed", String(active));
        favoriteButton.setAttribute("aria-label", active
            ? `Ta bort ${v.drink} från favoriter`
            : `Spara ${v.drink} som favorit`);
        favoriteButton.title = active ? "Ta bort från favoriter" : "Spara som favorit";
    };
    syncFavoriteButton();
    favoriteButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const saved = toggleFavorite(v.id, v.drink);
        showFavoriteToast(saved);
    });
    card.querySelector(".card-media").append(favoriteButton);
    card.querySelector(".card-open").addEventListener("click", () => onOpen(v));
    const themeButton = card.querySelector(".card-theme");
    if (themeButton) {
        const hue = themeHue(v.theme);
        card.style.setProperty("--theme-hue", hue);
        themeButton.addEventListener("click", () => onThemeSelect(v.theme));
    }
    return card;
}
