// Drink entries preserve the current filter parameters and list position.
export function createDrinkNavigation(drinks, dialog) {
    const entryToken = `${Date.now()}-${Math.random()}`;
    let currentId = null;
    let returningToList = false;
    let afterClose = null;
    const notice = document.getElementById("drink-link-notice");
    const shareButton = document.getElementById("share-drink");
    const shareStatus = document.getElementById("share-status");

    function drinkUrl(id) {
        const url = new URL(window.location.href);
        if (id === null) url.searchParams.delete("drink");
        else url.searchParams.set("drink", id);
        return url;
    }
    function resetShareStatus() {
        shareStatus.textContent = "";
    }
    function setNotFound(visible) {
        notice.hidden = !visible;
        document.body.classList.toggle("drink-not-found", visible);
        if (visible) {
            document.getElementById("drink-link-home").href = window.location.pathname;
            document.getElementById("drink-not-found-title").focus({ preventScroll: true });
        }
    }
    document.getElementById("home-link").addEventListener("click", () => {
        if (!notice.hidden) window.location.assign(window.location.pathname);
    });
    function show(drink) {
        currentId = String(drink.id);
        fetch(`${API_BASE}/drinks/${encodeURIComponent(currentId)}`).catch((error) => {
            console.error("Kunde inte hämta drink: ", error);
        });
        setNotFound(false);
        resetShareStatus();
        dialog.open(drink);
    }
    function open(drink) {
        if (returningToList) return;
        const id = String(drink.id);
        if (currentId === id) return;
        // Opening a different drink within the overlay replaces its entry.
        const method = currentId === null ? "pushState" : "replaceState";
        window.history[method]({ ...window.history.state, drinkModalEntry: entryToken }, "", drinkUrl(id));
        show(drink);
    }
    function close() {
        currentId = null;
        resetShareStatus();
        if (window.history.state?.drinkModalEntry === entryToken) {
            returningToList = true;
            window.history.back();
        } else {
            // A directly opened/shared URL must close onto this site's archive.
            window.history.replaceState(window.history.state, "", drinkUrl(null));
        }
    }
    function restore() {
        returningToList = false;
        const id = new URL(window.location.href).searchParams.get("drink");
        if (id === null) {
            currentId = null;
            resetShareStatus();
            dialog.close({ updateHistory: false });
            setNotFound(false);
            return;
        }
        const drink = drinks.find((item) => String(item.id) === id);
        if (drink) {
            if (currentId !== id) show(drink);
        } else {
            currentId = null;
            dialog.close({ updateHistory: false });
            resetShareStatus();
            setNotFound(true);
        }
    }
    window.addEventListener("popstate", restore);
    // Related theme/spirit links apply after Back has returned to the list entry.
    function whenClosed(callback) {
        if (returningToList) afterClose = callback;
        else callback();
    }
    window.addEventListener("popstate", () => {
        if (afterClose) {
            const callback = afterClose;
            afterClose = null;
            // Let filter URL restoration finish before applying the new selection.
            setTimeout(callback, 0);
        }
    });
    shareButton.addEventListener("click", async () => {
        if (currentId === null) return;
        const id = currentId;
        const link = drinkUrl(id).href;
        shareStatus.textContent = "";
        if (typeof navigator.share !== "function") {
            shareStatus.textContent = "Delning stöds inte i den här webbläsaren.";
            return;
        }
        const drink = drinks.find((item) => String(item.id) === id);
        try {
            await navigator.share({
                title: drink?.drink || "Dalgards Drinkar",
                url: link,
            });
        } catch (error) {
            if (error?.name === "AbortError") return;
            console.error("Kunde inte dela drinklänken:", error);
            if (currentId === id) {
                shareStatus.textContent = "Det gick inte att dela länken. Försök igen.";
            }
        }
    });
    return { open, close, restore, whenClosed };
}
