import { themeHue } from "./themes.js";
import { formatDrinkDate } from "./utils.js";
import { renderRecipeGroups, renderTasteProfile, renderSpiritLinks } from "./recipes.js";
import { isFavorite, subscribeFavorites, toggleFavorite } from "./favorites.js";
import { hideFavoriteToast, showFavoriteToast } from "./favorite-toast.js";
export function createDrinkDialog(onThemeSelect, onClose = () => {}, onSpiritSelect = () => {}, mediaUrl = (path) => `${R2_BASE_URL}${path}`) {
    return createDrinkView(onThemeSelect, onClose, onSpiritSelect, mediaUrl, false);
}
export function createDrinkPage(onThemeSelect, onClose = () => {}, onSpiritSelect = () => {}, mediaUrl = (path) => `${R2_BASE_URL}${path}`) {
    return createDrinkView(onThemeSelect, onClose, onSpiritSelect, mediaUrl, true);
}
function createDrinkView(onThemeSelect, onClose, onSpiritSelect, mediaUrl, pageMode) {
    let modalTrigger = null;
    let previousBodyOverflow = "";
    let currentDrink = null;
    const favoriteButton = document.getElementById("modal-favorite");
    const detailPage = pageMode ? document.getElementById("drink-page") : null;
    const originalDocumentTitle = document.title;
    let portionCounters = [];
    function renderCurrentRecipe() {
        if (!currentDrink) return;
        const baseServings = portionCounters.map(({ baseServings }) => baseServings);
        const targetServings = portionCounters.map(({ input, baseServings }) => {
            const value = Number(input.value);
            return Number.isSafeInteger(value) && value > 0 ? value : baseServings;
        });
        renderRecipeGroups(
            currentDrink.ingredients,
            currentDrink.steps,
            currentDrink.drink,
            currentDrink.taste,
            baseServings,
            targetServings,
            portionCounters.map(({ control }) => control),
        );
        portionCounters.forEach(({ updateButtons }) => updateButtons());
    }
    function createPortionCounter(index, drinkName, baseServings) {
        const control = document.createElement("div");
        control.className = "recipe-portions";
        control.setAttribute("role", "group");
        control.setAttribute("aria-label", `Portioner för ${drinkName}`);
        const decrease = document.createElement("button");
        decrease.type = "button";
        decrease.className = "recipe-portions-button";
        decrease.textContent = "−";
        decrease.setAttribute("aria-label", "Minska portioner");
        const input = document.createElement("input");
        input.type = "number";
        input.id = index === 0 ? "modal-servings" : `modal-servings-${index + 1}`;
        input.min = "1";
        input.step = "1";
        input.value = String(baseServings);
        input.setAttribute("aria-label", "Antal portioner");
        const unit = document.createElement("span");
        unit.className = "recipe-portions-unit";
        unit.textContent = "port";
        const increase = document.createElement("button");
        increase.type = "button";
        increase.className = "recipe-portions-button";
        increase.textContent = "+";
        increase.setAttribute("aria-label", "Öka portioner");
        control.append(decrease, input, unit, increase);

        const updateButtons = () => {
            const value = Number(input.value);
            decrease.disabled = value <= 1;
            increase.disabled = value >= Number.MAX_SAFE_INTEGER;
        };
        input.addEventListener("input", () => {
            const value = Number(input.value);
            if (Number.isSafeInteger(value) && value > 0) renderCurrentRecipe();
        });
        input.addEventListener("change", () => {
            const value = Number(input.value);
            input.value = String(Number.isSafeInteger(value) && value > 0 ? value : baseServings);
            renderCurrentRecipe();
        });
        decrease.addEventListener("click", () => {
            const value = Number(input.value);
            if (value > 1) {
                input.value = String(value - 1);
                renderCurrentRecipe();
            }
        });
        increase.addEventListener("click", () => {
            const value = Number(input.value);
            if (Number.isSafeInteger(value) && value < Number.MAX_SAFE_INTEGER) {
                input.value = String(value + 1);
                renderCurrentRecipe();
            }
        });
        return { control, input, baseServings, updateButtons };
    }

    function preparePortionCounters(drink) {
        const groupCount = Math.max(
            String(drink.ingredients || "").split("||").length,
            String(drink.steps || "").split("||").length,
            String(drink.taste || "").split("||").map((group) => group.trim()).filter(Boolean).length,
            1,
        );
        const names = String(drink.drink || "").split("&").map((name) => name.trim());
        const servings = Array.isArray(drink.servings) ? drink.servings : [];
        const legacyServings = Number.isSafeInteger(drink.servings) && drink.servings > 0
            ? drink.servings : 1;
        portionCounters = Array.from({ length: groupCount }, (_, index) => {
            const name = names[index] || `Drink ${index + 1}`;
            const baseServings = Number.isSafeInteger(servings[index]) && servings[index] > 0
                ? servings[index] : Array.isArray(drink.servings) ? 1 : legacyServings;
            return createPortionCounter(index, name, baseServings);
        });
    }
    function syncFavoriteButton() {
        if (!currentDrink || !favoriteButton) return;
        const active = isFavorite(currentDrink.id);
        favoriteButton.classList.toggle("is-favorite", active);
        favoriteButton.classList.toggle("btn-primary", active);
        favoriteButton.classList.toggle("btn-secondary", !active);
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
                const saved = toggleFavorite(currentDrink.id, currentDrink.drink);
                showFavoriteToast(saved, true);
            }
        });
        subscribeFavorites(syncFavoriteButton);
    }

    function openModal(v) {
        if (favoriteButton) hideFavoriteToast(true);
        currentDrink = v;
        syncFavoriteButton();
        const dialog = pageMode ? null : document.getElementById("modal-backdrop");
        if (pageMode) {
            if (detailPage.hidden) modalTrigger = document.activeElement;
            detailPage.hidden = false;
            document.body.classList.add("drink-page-active");
            document.title = `${v.drink} – Urkällan`;
        } else if (!dialog.open) {
            modalTrigger = document.activeElement;
            previousBodyOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";
        }
        document.getElementById("modal-video").src = mediaUrl(v.url);
        document.getElementById("modal-video").poster = v.photo ? mediaUrl(v.photo) : "";
        document.getElementById("modal-drink").textContent =
            v.drink;
        const modalTheme = document.getElementById("modal-theme");
        const hue = themeHue(v.theme || "");
        modalTheme.textContent = v.theme;
        modalTheme.hidden = !v.theme?.trim();
        modalTheme.style.background = `hsl(${hue},65%,35%)`;
        modalTheme.style.color = `hsl(${hue},20%,95%)`;
        document.getElementById("modal-date").textContent =
            formatDrinkDate(v.date);
        document.getElementById("modal-note").textContent =
            v.note;
        const hasRecipe = !!((v.ingredients && v.ingredients.trim()) ||
            (v.steps && v.steps.trim()) ||
            (v.taste && v.taste.trim()));
        document.getElementById("recipe-block").style.display = hasRecipe ? "block" : "none";
        preparePortionCounters(v);
        renderCurrentRecipe();
        renderSpiritLinks(v.ingredients, (spirit) => {
            closeModal();
            onSpiritSelect(spirit);
        });
        if (pageMode) {
            window.scrollTo(0, 0);
            document.getElementById("modal-drink").focus({ preventScroll: true });
        } else {
            document
                .getElementById("modal-backdrop")
                .classList.add("open");
            if (!dialog.open) dialog.showModal();
            document.querySelector(".modal-scroll").scrollTop = 0;
            document.getElementById("modal-close").focus();
        }
    }
    function closeModal({ updateHistory = true } = {}) {
        const dialog = pageMode ? null : document.getElementById("modal-backdrop");
        if (pageMode ? detailPage.hidden : !dialog.open) return;
        const video = document.getElementById("modal-video");
        video.pause();
        video.src = "";
        currentDrink = null;
        if (pageMode) {
            detailPage.hidden = true;
            document.body.classList.remove("drink-page-active");
            document.title = originalDocumentTitle;
        } else {
            document
                .getElementById("modal-backdrop")
                .classList.remove("open");
            dialog.close();
            document.body.style.overflow = previousBodyOverflow;
        }
        if (modalTrigger?.isConnected) modalTrigger.focus({ preventScroll: true });
        if (updateHistory) onClose();
    }
    document
        .getElementById("modal-close")
        .addEventListener("click", closeModal);
    if (!pageMode) {
        document.getElementById("modal-backdrop").addEventListener("cancel", (event) => {
            event.preventDefault();
            closeModal();
        });
        document
            .getElementById("modal-backdrop")
            .addEventListener("click", (event) => {
                if (event.target.id === "modal-backdrop") closeModal();
            });
    }
    document
        .getElementById("modal-theme")
        .addEventListener("click", () => {
        const theme = document.getElementById("modal-theme").textContent.trim();
        closeModal();
        onThemeSelect(theme);
    });
    return { open: openModal, close: closeModal };
}
