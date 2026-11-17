import { themeHue } from "./themes.js";
import { formatDrinkDate, hashHue } from "./utils.js";
import { SPIRITS, ingredientsContainSpirit } from "./spirits.js";
import { TASTE_FILTERS, parseTasteProfile, matchesTasteFilters } from "./taste.js";
export function createFilters(themes, onChange, videos = []) {
    let selectedTheme = "";
    const selectedSpirits = new Set();
    const selectedTastes = new Set();
    const pickerSlot = document.getElementById("filter-picker-slot");
    const filterPanel = document.getElementById("filter-panel");
    function isMobileFilterSheet() {
        return window.matchMedia("(max-width: 650px)").matches;
    }
    function openPicker(panel, toggle, beforeId) {
        closeThemePicker();
        closeSpiritPicker();
        closeTastePicker();
        if (isMobileFilterSheet()) {
            filterPanel.insertBefore(pickerSlot, document.getElementById(beforeId));
            pickerSlot.hidden = false;
            pickerSlot.classList.remove("is-open");
            pickerSlot.append(panel);
        } else {
            pickerSlot.classList.remove("is-open");
            pickerSlot.hidden = true;
            toggle.parentElement.append(panel);
        }
        panel.hidden = false;
        panel.classList.add("open");
        toggle.setAttribute("aria-expanded", "true");
        if (isMobileFilterSheet()) {
            requestAnimationFrame(() => pickerSlot.classList.add("is-open"));
        }
    }
    function syncFilterToggle() {
        const open = document.getElementById("filter-panel").classList.contains("open");
        const toggle = document.getElementById("filter-toggle");
        toggle.setAttribute("aria-expanded", String(open));
        toggle.classList.toggle("active", open);
        const mobileSheetOpen = open && isMobileFilterSheet();
        document.getElementById("filter-toggle-text").textContent = open
            ? (mobileSheetOpen ? "Stäng filter" : "Dölj filter")
            : "Visa filter";
        document.getElementById("filter-backdrop").hidden = !mobileSheetOpen;
        document.body.classList.toggle("filter-sheet-open", mobileSheetOpen);
        const panel = document.getElementById("filter-panel");
        if (mobileSheetOpen) {
            panel.setAttribute("role", "dialog");
            panel.setAttribute("aria-modal", "true");
        } else {
            panel.removeAttribute("role");
            panel.removeAttribute("aria-modal");
        }
    }
    function notifyChange() {
        syncFilterToggle();
        updateTasteControls();
        updateSpiritLabel();
        updateSpiritChipStyles();
        document.getElementById("theme-picker-label").textContent = selectedTheme || "Alla teman";
        document.querySelectorAll("#theme-chip-list .theme-chip").forEach((chip) => {
            const active = chip.dataset.theme === (selectedTheme || "__all__");
            chip.classList.toggle("active", active);
            chip.setAttribute("aria-pressed", String(active));
        });
        renderActiveFilters();
        onChange();
    }
    function resetFilters() {
        selectedTheme = "";
        selectedSpirits.clear();
        selectedTastes.clear();
        closeThemePicker();
        closeTastePicker();
        ["date-from", "date-to"].forEach((id) => {
            document.getElementById(id).value = "";
        });
        document.getElementById("filter-panel").classList.remove("open");
        document.getElementById("filter-toggle-text").textContent = "Visa filter";
        document.getElementById("filter-toggle").classList.remove("active");
        closeSpiritPicker();
        notifyChange();
    }
    function renderActiveFilters() {
        const container = document.getElementById("active-filters");
        const list = document.getElementById("active-filter-list");
        list.replaceChildren();
        const selections = [];
        const search = document.getElementById("search");
        if (selectedTheme) {
            selections.push({ label: selectedTheme, theme: true, remove: () => { selectedTheme = ""; } });
        }
        selectedSpirits.forEach((spirit) => {
            selections.push({ label: spirit, spirit: true, remove: () => selectedSpirits.delete(spirit) });
        });
        selectedTastes.forEach((id) => {
            const filter = TASTE_FILTERS.find((item) => item.id === id);
            selections.push({ label: filter.label, remove: () => selectedTastes.delete(id) });
        });
        [["date-from", "Från"], ["date-to", "Till"]].forEach(([id, label]) => {
            const input = document.getElementById(id);
            if (input.value) {
                selections.push({ label: `${label} ${formatDrinkDate(input.value)}`, remove: () => { input.value = ""; } });
            }
        });
        selections.forEach((selection, index) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "active-filter-chip";
            button.setAttribute("aria-label", `Ta bort filter: ${selection.label}`);
            const label = document.createElement("span");
            label.textContent = selection.label;
            const cross = document.createElement("span");
            cross.textContent = "×";
            cross.setAttribute("aria-hidden", "true");
            button.append(label, cross);
            if (selection.theme) {
                button.classList.add("active-filter-theme");
                button.style.setProperty("--theme-hue", themeHue(selectedTheme));
            }
            if (selection.spirit) {
                button.classList.add("active-filter-spirit");
                button.style.setProperty("--spirit-hue", hashHue(selection.label));
            }
            button.addEventListener("click", () => {
                selection.remove();
                notifyChange();
                const next = list.children[Math.min(index, list.children.length - 1)];
                (next || search).focus({ preventScroll: true });
            });
            list.appendChild(button);
        });
        container.hidden = selections.length === 0;
    }
    function buildThemeChips(themes) {
        const list = document.getElementById("theme-chip-list");
        list.innerHTML = "";
        const allChip = document.createElement("button");
        allChip.type = "button";
        allChip.className = "theme-chip";
        allChip.dataset.theme = "__all__";
        allChip.textContent = "Alla teman";
        allChip.addEventListener("click", () => {
            selectTheme("");
        });
        list.appendChild(allChip);
        themes.forEach((theme) => {
            const hue = themeHue(theme || "ovrigt");
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "theme-chip";
            if (!theme.trim()) {
                chip.classList.add("icon-only");
            }
            chip.dataset.theme = theme;
            chip.style.background = `hsl(${hue},65%,35%)`;
            chip.style.color = `hsl(${hue},20%,95%)`;
            if (theme.trim()) {
                const span = document.createElement("span");
                span.textContent = theme;
                chip.appendChild(span);
            }
            chip.addEventListener("click", () => {
                selectTheme(theme);
            });
            list.appendChild(chip);
        });
    }
    // ============================================
    // Spirit Chips
    // ============================================
    function buildSpiritChips() {
        const list = document.getElementById("spirit-chip-list");
        list.innerHTML = "";
        const allChip = document.createElement("button");
        allChip.type = "button";
        allChip.className = "taste-filter-option spirit-filter-option";
        allChip.textContent = "All sprit";
        allChip.dataset.spirit = "";
        allChip.addEventListener("click", () => {
            selectSpirit("");
        });
        list.appendChild(allChip);
        SPIRITS.forEach((spirit) => {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "taste-filter-option spirit-filter-option";
            chip.dataset.spirit = spirit;
            chip.textContent = spirit;
            chip.addEventListener("click", () => {
                selectSpirit(spirit);
            });
            list.appendChild(chip);
        });
    }
    function selectSpirit(spirit) {
        if (spirit === "") {
            selectedSpirits.clear();
        }
        else if (selectedSpirits.has(spirit)) {
            selectedSpirits.delete(spirit);
        }
        else {
            selectedSpirits.add(spirit);
        }
        updateSpiritLabel();
        updateSpiritChipStyles();
        notifyChange();
    }
    function updateSpiritLabel() {
        const label = document.getElementById("spirit-picker-label");
        if (selectedSpirits.size === 0) {
            label.textContent = "All sprit";
        }
        else if (selectedSpirits.size === 1) {
            label.textContent = [...selectedSpirits][0];
        }
        else {
            label.textContent =
                `${selectedSpirits.size} sorter valda`;
        }
    }
    function updateSpiritChipStyles() {
        document
            .querySelectorAll("#spirit-chip-list .spirit-filter-option")
            .forEach((chip) => {
            const spirit = chip.dataset.spirit;
            const isActive = spirit === ""
                ? selectedSpirits.size === 0
                : selectedSpirits.has(spirit);
            chip.classList.toggle("active", isActive);
            chip.setAttribute("aria-pressed", String(isActive));
        });
    }
    // ============================================
    // Theme Selection & Picker
    // ============================================
    const themePanel = document.getElementById("theme-picker-panel");
    const themeToggle = document.getElementById("theme-picker-toggle");
    function closePickerPanel(panel, toggle) {
        const wasOpen = !panel.hidden;
        panel.hidden = true;
        panel.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        if (wasOpen && pickerSlot.contains(panel)) {
            pickerSlot.classList.remove("is-open");
            pickerSlot.hidden = true;
        }
    }
    function closeThemePicker() {
        closePickerPanel(themePanel, themeToggle);
    }
    function openThemePicker() {
        closeTastePicker();
        closeSpiritPicker();
        openPicker(themePanel, themeToggle, "spirit-filter-group");
    }
    function selectTheme(theme) {
        selectedTheme = theme;
        document.getElementById("theme-picker-label").textContent =
            theme || "Alla teman";
        closeThemePicker();
        notifyChange();
    }
    function filterByTheme(theme) {
        selectTheme(theme);
        window.scrollTo({
            top: 0,
            behavior: "smooth",
        });
    }
    function filterBySpirit(spirit) {
        if (!SPIRITS.includes(spirit)) return;
        selectedTheme = "";
        selectedTastes.clear();
        selectedSpirits.clear();
        selectedSpirits.add(spirit);
        ["search", "date-from", "date-to"].forEach((id) => {
            document.getElementById(id).value = "";
        });
        notifyChange();
        document.querySelector("#active-filter-list button")?.focus({ preventScroll: true });
        window.scrollTo({ top: 0, behavior: "smooth" });
    }
    // Taste picker uses only complete, valid profiles; missing data is not zero.
    const tastePanel = document.getElementById("taste-picker-panel");
    const tasteToggle = document.getElementById("taste-picker-toggle");
    const profileCount = videos.filter((video) => parseTasteProfile(video.taste) !== null).length;
    document.getElementById("taste-filter-info").textContent =
        `Smakprofil finns för ${profileCount} av ${videos.length} drinkar.`;
    function updateTasteControls() {
        const chosen = TASTE_FILTERS.filter((item) => selectedTastes.has(item.id));
        document.getElementById("taste-picker-label").textContent = chosen.length === 0
            ? "Alla smaker" : chosen.length === 1 ? chosen[0].label : `${chosen.length} smaker valda`;
        document.querySelectorAll("#taste-filter-options button").forEach((button) => {
            const active = button.dataset.taste === "" ? selectedTastes.size === 0 : selectedTastes.has(button.dataset.taste);
            button.classList.toggle("active", active);
            button.setAttribute("aria-pressed", String(active));
        });
    }
    function closeTastePicker() {
        closePickerPanel(tastePanel, tasteToggle);
    }
    const tasteOptions = document.getElementById("taste-filter-options");
    [{ id: "", label: "Alla smaker" }, ...TASTE_FILTERS].forEach((filter) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "taste-filter-option";
        button.dataset.taste = filter.id;
        const label = document.createElement("span");
        label.textContent = filter.label;
        const description = document.createElement("small");
        description.textContent = filter.description;
        button.append(label, description);
        button.addEventListener("click", () => {
            if (!filter.id) selectedTastes.clear();
            else if (selectedTastes.has(filter.id)) selectedTastes.delete(filter.id);
            else selectedTastes.add(filter.id);
            notifyChange();
        });
        tasteOptions.appendChild(button);
    });
    tasteToggle.addEventListener("click", () => {
        const open = tastePanel.hidden;
        if (open) {
            openPicker(tastePanel, tasteToggle, "date-range-filter");
        } else {
            closeTastePicker();
        }
    });
    document.addEventListener("click", (event) => {
        if (!tastePanel.contains(event.target) && !tasteToggle.contains(event.target)) closeTastePicker();
    });
    tastePanel.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            event.stopPropagation();
            closeTastePicker();
            tasteToggle.focus();
        }
    });
    // Spirit picker
    const spiritPanel = document.getElementById("spirit-picker-panel");
    const spiritToggle = document.getElementById("spirit-picker-toggle");
    function closeSpiritPicker() {
        closePickerPanel(spiritPanel, spiritToggle);
    }
    document
        .getElementById("spirit-picker-toggle")
        .addEventListener("click", (e) => {
        e.stopPropagation();
        const open = spiritPanel.hidden;
        if (open) {
            openPicker(spiritPanel, spiritToggle, "date-range-filter");
        } else {
            closeSpiritPicker();
        }
    });
    document.addEventListener("click", (e) => {
        if (!spiritPanel.contains(e.target) && !spiritToggle.contains(e.target)) {
            closeSpiritPicker();
        }
    });
    spiritPanel.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            event.stopPropagation();
            closeSpiritPicker();
            spiritToggle.focus();
        }
    });
    // Theme picker
    themeToggle.addEventListener("click", () => {
        const open = themePanel.hidden;
        if (open) openThemePicker();
        else closeThemePicker();
    });
    themePanel.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            event.stopPropagation();
            closeThemePicker();
            themeToggle.focus();
        }
    });
    document.addEventListener("click", (event) => {
        if (!themePanel.contains(event.target) && !themeToggle.contains(event.target)) {
            closeThemePicker();
        }
    });
    // Search, sorting & modal
    document
        .getElementById("search")
        .addEventListener("input", () => {
        notifyChange();
    });
    document
        .getElementById("sort-order")
        .addEventListener("change", () => {
        notifyChange();
    });
    // Filter panel
    document
        .getElementById("filter-toggle")
        .addEventListener("click", () => {
        const filterPanel = document.getElementById("filter-panel");
        if (!filterPanel)
            return;
        const opening = !filterPanel.classList.contains("open");
        if (!opening) {
            closeThemePicker();
            closeSpiritPicker();
            closeTastePicker();
        }
        filterPanel.classList.toggle("open", opening);
        syncFilterToggle();
        if (opening && isMobileFilterSheet()) {
            document.getElementById("filter-sheet-close").focus();
        }
    });
    function closeFilterSheet(restoreFocus = true) {
        document.getElementById("filter-panel").classList.remove("open");
        closeThemePicker();
        closeSpiritPicker();
        closeTastePicker();
        syncFilterToggle();
        if (restoreFocus && isMobileFilterSheet()) {
            document.getElementById("filter-toggle").focus({ preventScroll: true });
        }
    }
    document.getElementById("filter-sheet-close").addEventListener("click", () => closeFilterSheet());
    document.getElementById("filter-sheet-apply").addEventListener("click", () => closeFilterSheet());
    document.getElementById("filter-sheet-clear").addEventListener("click", () => resetFilters());
    document.getElementById("filter-backdrop").addEventListener("click", () => closeFilterSheet());
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && isMobileFilterSheet() &&
            document.getElementById("filter-panel").classList.contains("open")) {
            closeFilterSheet();
            return;
        }
        if (event.key === "Tab" && isMobileFilterSheet() &&
            document.getElementById("filter-panel").classList.contains("open")) {
            const panel = document.getElementById("filter-panel");
            const focusable = [...panel.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')]
                .filter((element) => element.offsetParent !== null);
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
            }
        }
    });
    document
        .getElementById("date-from")
        .addEventListener("change", () => {
        notifyChange();
    });
    document
        .getElementById("date-to")
        .addEventListener("change", () => {
        notifyChange();
    });
    document.getElementById("empty-reset").addEventListener("click", () => {
        document.getElementById("search").value = "";
        resetFilters();
        document.getElementById("search").focus({ preventScroll: true });
    });
    document.getElementById("active-filter-clear").addEventListener("click", () => {
        resetFilters();
        document.getElementById("search").focus({ preventScroll: true });
    });
    // Home
    document
        .getElementById("home-link")
        .addEventListener("click", () => {
        document.getElementById("sort-order").value = "desc";
        document.getElementById("search").value = "";
        resetFilters();
        document.getElementById("filter-toggle-text").textContent = "Visa filter";
        document
            .getElementById("filter-panel")
            .classList.remove("open");
        document
            .getElementById("filter-toggle")
            .classList.remove("active");
        notifyChange();
        window.scrollTo({
            top: 0,
            behavior: "smooth",
        });
    });

    function getState() {
        return {
            theme: selectedTheme,
            spirits: [...selectedSpirits],
            tastes: [...selectedTastes],
            search: document.getElementById("search").value,
            dateFrom: document.getElementById("date-from").value,
            dateTo: document.getElementById("date-to").value,
            sort: document.getElementById("sort-order").value,
        };
    }
    function setState(state) {
        selectedTheme = themes.includes(state.theme) ? state.theme : "";
        selectedSpirits.clear();
        (state.spirits || []).filter((spirit) => SPIRITS.includes(spirit)).forEach((spirit) => selectedSpirits.add(spirit));
        selectedTastes.clear();
        (state.tastes || []).filter((id) => TASTE_FILTERS.some((filter) => filter.id === id)).forEach((id) => selectedTastes.add(id));
        document.getElementById("search").value = state.search || "";
        document.getElementById("date-from").value = state.dateFrom || "";
        document.getElementById("date-to").value = state.dateTo || "";
        document.getElementById("sort-order").value = state.sort || "desc";
        notifyChange();
    }
    function apply(videos) {
        const q = document.getElementById("search").value.toLowerCase();
        const theme = selectedTheme;
        const dateFrom = document.getElementById("date-from").value;
        const dateTo = document.getElementById("date-to").value;
        return videos.filter((v) => (!theme || v.theme === theme) &&
            (selectedSpirits.size === 0 ||
                [...selectedSpirits].every((s) => ingredientsContainSpirit(v.ingredients, s))) &&
            matchesTasteFilters(v.taste, selectedTastes) &&
            (!dateFrom || v.date >= dateFrom) &&
            (!dateTo || v.date <= dateTo) &&
            (!q ||
                `${v.drink} ${v.note} ${v.theme} ${v.date} ${v.ingredients} ${v.steps}`
                    .toLowerCase()
                    .includes(q.toLowerCase())));
    }
    updateTasteControls();
    buildThemeChips(themes);
    buildSpiritChips();
    updateSpiritChipStyles();
    renderActiveFilters();
    return { apply, filterByTheme, filterBySpirit, getState, setState };
}
