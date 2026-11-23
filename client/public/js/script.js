import { compareDrinks } from "./utils.js";
import { buildThemeColorMap } from "./themes.js";
import { createFilterLinks } from "./filter-links.js";
import { createFilters } from "./filters.js";
import { makeCard } from "./cards.js";
import { createDrinkPage } from "./dialogs.js";
import { createDrinkNavigation } from "./drink-links.js";
import { createSearchSuggestions } from "./search-suggestions.js";
import { loadSpirits } from "./spirits.js";
let allVideos = [];
let visibleBatches = 1;
let animateCardsFrom = null;
const PAGE_SIZE = 24;
let filters;
let filterLinks;
let drinkPage;
let drinkNavigation;
let searchSuggestions;
let analyticsTimer = null;
function reportPageView() {
    fetch(`${API_BASE}/analytics/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            event: "page_view",
            page: "archive",
        }),
        keepalive: true,
    }).catch(() => {});
}
function reportArchiveFilters(state) {
    clearTimeout(analyticsTimer);
    analyticsTimer = setTimeout(() => {
        fetch(`${API_BASE}/analytics/event`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                event: "archive_filters",
                theme: state.theme,
                favoritesOnly: state.favoritesOnly,
                spirits: state.spirits,
                tastes: state.tastes,
                search: state.search,
                resultCount: state.resultCount,
            }),
            keepalive: true,
        }).catch(() => {});
    }, 500);
}
async function init() {
    reportPageView();
    try {
        const [res] = await Promise.all([fetch(`${API_BASE}/drinks`), loadSpirits(API_BASE)]);
        if (!res.ok)
            throw new Error(`HTTP ${res.status}`);
        allVideos = await res.json();
    }
    catch (err) {
        console.error(err);
        document.documentElement.classList.remove("drink-page-loading");
        document.body.classList.add("archive-unavailable");
        document.getElementById("load-error").hidden = false;
        document.getElementById("load-error-title").focus({ preventScroll: true });
        return;
    }
    const themes = [...new Set(allVideos.map((v) => v.theme))].filter(Boolean).sort();
    buildThemeColorMap(themes);
    filters = createFilters(themes, () => {
        visibleBatches = 1;
        animateCardsFrom = null;
        filterLinks?.update();
        render();
    }, allVideos, reportArchiveFilters);
    drinkPage = createDrinkPage(
        (theme) => drinkNavigation.whenClosed(() => filters.filterByTheme(theme)),
        () => drinkNavigation.close(),
        (spirit) => drinkNavigation.whenClosed(() => filters.filterBySpirit(spirit)),
    );
    drinkNavigation = createDrinkNavigation(allVideos, drinkPage);
    searchSuggestions = createSearchSuggestions(drinkNavigation.open);
    filterLinks = createFilterLinks(filters);
    filterLinks.restore();
    drinkNavigation.restore();
    document.documentElement.classList.remove("drink-page-loading");
}
function render() {
    const filtered = filters.apply(allVideos);
    searchSuggestions?.update(filtered);
    const totalBatches = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    visibleBatches = Math.max(1, Math.min(visibleBatches, totalBatches));
    const end = visibleBatches * PAGE_SIZE;
    const sortSelect = document.getElementById("sort-order");
    sortSelect.title = `Sortering: ${sortSelect.selectedOptions[0].textContent}`;
    filtered.sort((a, b) => compareDrinks(a, b, sortSelect.value));
    const pageItems = filtered.slice(0, end);
    const grid = document.getElementById("grid");
    grid.innerHTML = "";
    grid.setAttribute("aria-busy", "false");
    grid.removeAttribute("aria-label");
    const animationStart = animateCardsFrom;
    animateCardsFrom = null;
    pageItems.forEach((v, index) => {
        const card = makeCard(v, {
            onOpen: drinkNavigation.open,
            onThemeSelect: filters.filterByTheme,
        });
        if (animationStart !== null && index >= animationStart) {
            card.classList.add("card-entering");
            card.style.setProperty("--card-entry-delay", `${Math.min(index - animationStart, 7) * 35}ms`);
        }
        grid.appendChild(card);
    });
    document.getElementById("count").textContent =
        `Visar ${filtered.length} av ${allVideos.length} drinkar`;
    const empty = document.getElementById("empty");
    empty.style.display = filtered.length ? "none" : "block";
    if (!filtered.length && filters.getState().favoritesOnly) {
        const hasFavorites = filters.getFavoriteCount() > 0;
        document.getElementById("empty-title").textContent = hasFavorites
            ? "Inga favoriter matchar dina övriga filter."
            : "Du har inte sparat några favoriter än.";
        document.getElementById("empty-reset").textContent = hasFavorites
            ? "Rensa sökning och filter" : "Visa alla drinkar";
    } else {
        document.getElementById("empty-title").textContent = "Inget resultat hittades i Urkällan!";
        document.getElementById("empty-reset").textContent = "Rensa sökning och filter";
    }
    renderLoadMore(totalBatches);
}
function renderLoadMore(totalBatches) {
    const el = document.getElementById("pagination");
    el.innerHTML = "";
    if (visibleBatches >= totalBatches)
        return;
    const loadMore = document.createElement("button");
    loadMore.className = "load-more";
    loadMore.textContent = `Visa fler drinkar`;
    loadMore.addEventListener("click", () => {
        const previousCount = document.querySelectorAll("#grid .card").length;
        animateCardsFrom = previousCount;
        visibleBatches += 1;
        render();
    });
    el.appendChild(loadMore);
}
document.getElementById("load-retry").addEventListener("click", () => {
    window.location.reload();
});
init();
