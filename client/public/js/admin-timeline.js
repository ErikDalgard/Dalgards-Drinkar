import { buildThemeColorMap, themeHue } from "./themes.js";

function compareDatesDescending(a, b) {
  return String(b.date || "").localeCompare(String(a.date || ""));
}

export function renderAdminTimeline(container, drinks) {
  container.replaceChildren();

  const knownThemes = [...new Set(drinks.map((drink) => drink.theme).filter(Boolean))].sort();
  const themeCount = new Set(
    drinks
      .map((drink) => typeof drink.theme === "string" ? drink.theme.trim() : "")
      .filter(Boolean),
  ).size;
  document.getElementById("admin-timeline-intro").textContent =
    `Ni har under åren gjort ${drinks.length} drinkar med ${themeCount} olika teman! ` +
    "Här kan ni kika igenom tidslinjen för Dalgards drinkar.";

  if (!drinks.length) {
    const empty = document.createElement("p");
    empty.className = "admin-timeline-empty";
    empty.textContent = "Det finns inga drinkar att visa i tidslinjen ännu.";
    container.appendChild(empty);
    return;
  }

  buildThemeColorMap(knownThemes);

  const years = new Map();
  for (const drink of drinks) {
    const date = typeof drink.date === "string" ? drink.date : "";
    const year = date.match(/^\d{4}/)?.[0] || "Okänt år";
    const theme = typeof drink.theme === "string" && drink.theme.trim()
      ? drink.theme.trim()
      : "Övrigt";
    if (!years.has(year)) years.set(year, new Map());
    const themes = years.get(year);
    if (!themes.has(theme)) themes.set(theme, []);
    themes.get(theme).push(drink);
  }

  const sortedYears = [...years.entries()].sort(([yearA], [yearB]) => {
    if (yearA === "Okänt år") return 1;
    if (yearB === "Okänt år") return -1;
    return yearB.localeCompare(yearA);
  });

  const timeline = document.createElement("div");
  timeline.className = "admin-timeline-years";

  for (const [year, themes] of sortedYears) {
    const yearSection = document.createElement("details");
    yearSection.className = "admin-timeline-year";

    const yearTitle = document.createElement("summary");
    yearTitle.className = "admin-timeline-year-title";
    const yearLabel = document.createElement("span");
    yearLabel.className = "admin-timeline-year-label";
    yearLabel.textContent = year;
    yearTitle.appendChild(yearLabel);

    const yearDrinkCount = [...themes.values()].reduce((count, items) => count + items.length, 0);
    const yearCount = document.createElement("span");
    yearCount.className = "admin-timeline-year-count";
    yearCount.textContent = `${yearDrinkCount} ${yearDrinkCount === 1 ? "drink" : "drinkar"}`;
    yearTitle.appendChild(yearCount);
    yearSection.appendChild(yearTitle);

    const sortedThemes = [...themes.entries()].map(([theme, items]) => [
      theme,
      items.sort(compareDatesDescending),
    ]).sort(([themeA, itemsA], [themeB, itemsB]) => {
      const dateOrder = compareDatesDescending(itemsA[0], itemsB[0]);
      return dateOrder || themeA.localeCompare(themeB, "sv");
    });

    for (const [theme, items] of sortedThemes) {
      const group = document.createElement("details");
      group.className = "admin-timeline-group";
      group.style.setProperty("--theme-hue", String(themeHue(theme)));

      const themeTitle = document.createElement("summary");
      themeTitle.className = "admin-timeline-theme";
      const themeLabel = document.createElement("span");
      themeLabel.className = "admin-timeline-theme-label";
      themeLabel.textContent = theme;
      themeTitle.appendChild(themeLabel);

      const count = document.createElement("span");
      count.className = "admin-timeline-count";
      count.textContent = `${items.length} ${items.length === 1 ? "drink" : "drinkar"}`;
      themeTitle.appendChild(count);
      group.appendChild(themeTitle);

      const drinkList = document.createElement("ol");
      drinkList.className = "admin-timeline-drinks";
      if (items.length > 1) drinkList.classList.add("has-multiple-drinks");
      for (const drink of items) {
        const item = document.createElement("li");
        item.className = "admin-timeline-drink";

        const link = document.createElement("a");
        link.className = "admin-timeline-drink-link";
        if (drink.id !== undefined && drink.id !== null) {
          const drinkUrl = new URL("index.html", window.location.href);
          drinkUrl.searchParams.set("drink", String(drink.id));
          link.href = drinkUrl.href;
          link.setAttribute("aria-label", `Visa ${drink.drink || "drink"} i Urkällan`);
        } else {
          link.removeAttribute("href");
        }

        const text = document.createElement("span");
        text.className = "admin-timeline-drink-text";
        if (drink.date) {
          const date = document.createElement("time");
          date.dateTime = drink.date;
          date.textContent = drink.date;
          text.appendChild(date);
        }

        const name = document.createElement("p");
        name.className = "admin-timeline-drink-name";
        name.textContent = drink.drink || "Namnlös drink";
        text.appendChild(name);
        link.appendChild(text);

        if (drink.photo) {
          const image = document.createElement("img");
          image.className = "admin-timeline-drink-image";
          image.src = `${R2_BASE_URL}${drink.photo}`;
          image.alt = "";
          image.loading = "lazy";
          image.decoding = "async";
          link.appendChild(image);
          link.classList.add("has-photo");
        }

        item.appendChild(link);
        drinkList.appendChild(item);
      }

      group.appendChild(drinkList);
      yearSection.appendChild(group);
    }

    timeline.appendChild(yearSection);
  }

  container.appendChild(timeline);
}
