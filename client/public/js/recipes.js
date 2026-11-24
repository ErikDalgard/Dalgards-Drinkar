import { getDrinkSpirits } from "./spirits.js";
import { hashHue } from "./utils.js";

import { TASTE_LABELS } from "./taste.js";

const FRACTIONS = {
    "¼": 0.25,
    "½": 0.5,
    "¾": 0.75,
    "⅓": 1 / 3,
    "⅔": 2 / 3,
    "⅛": 0.125,
    "⅜": 0.375,
    "⅝": 0.625,
    "⅞": 0.875,
};
const QUANTITY_TOKEN = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?[¼½¾⅓⅔⅛⅜⅝⅞]?|[¼½¾⅓⅔⅛⅜⅝⅞])`;
const INGREDIENT_QUANTITY_PATTERN = new RegExp(
    `^(\\s*)(${QUANTITY_TOKEN})(?:\\s*([-–])\\s*(${QUANTITY_TOKEN}))?(\\s+)(.*)$`,
    "u",
);

function parseQuantity(value) {
    const mixed = value.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
    const fraction = value.match(/^(\d+)\/(\d+)$/);
    if (fraction) return Number(fraction[1]) / Number(fraction[2]);
    const wholeAndFraction = value.match(/^(\d+(?:[.,]\d+)?)([¼½¾⅓⅔⅛⅜⅝⅞])$/);
    if (wholeAndFraction) return Number(wholeAndFraction[1].replace(",", ".")) + FRACTIONS[wholeAndFraction[2]];
    if (FRACTIONS[value] !== undefined) return FRACTIONS[value];
    return Number(value.replace(",", "."));
}

function formatQuantity(value) {
    const rounded = Math.round(value * 1000) / 1000;
    return new Intl.NumberFormat("sv-SE", {
        maximumFractionDigits: 3,
        useGrouping: false,
    }).format(rounded);
}

export function scaleIngredientQuantity(ingredient, factor) {
    if (!Number.isFinite(factor) || factor <= 0 || factor === 1) return ingredient;
    const match = ingredient.match(INGREDIENT_QUANTITY_PATTERN);
    if (!match) return ingredient;
    const first = parseQuantity(match[2]) * factor;
    const second = match[4] === undefined ? null : parseQuantity(match[4]) * factor;
    if (!Number.isFinite(first) || (second !== null && !Number.isFinite(second))) return ingredient;
    const range = match[4] === undefined
        ? ""
        : `${match[3]}${formatQuantity(second)}`;
    return `${match[1]}${formatQuantity(first)}${range}${match[5]}${match[6]}`;
}

export function renderTasteProfile(tasteStr) {
    const container = document.getElementById("taste-profile");
    const rows = document.getElementById("taste-rows");
    if (!container || !rows) return;
    rows.innerHTML = "";
    if (!tasteStr) {
        container.style.display = "none";
        return;
    }
    const values = String(tasteStr)
        .split(",")
        .map((s) => parseInt(s.trim().split("/")[0], 10));
    TASTE_LABELS.forEach((label, i) => {
        const value = values[i] || 0;
        let dots = "";
        for (let d = 1; d <= 5; d++) {
            dots += `<span class="taste-dot ${d <= value ? "filled" : ""}"></span>`;
        }
        const row = document.createElement("div");
        row.className = "taste-row";
        row.dataset.taste = label.toLowerCase();
        row.innerHTML = `
          <span class="taste-label">${label}</span>
          <div class="taste-meter" role="meter" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="5" aria-label="${label}: ${value} av 5">
            <span class="taste-dots">${dots}</span>
            <span class="taste-value" aria-hidden="true">${value}<span class="taste-max">/5</span></span>
          </div>
        `;
        rows.appendChild(row);
    });
    container.style.display = "block";
}
// ============================================
// Recipe Groups
// ============================================
export function renderRecipeGroups(ingredientsRaw, stepsRaw, drinkNameRaw, tasteRaw = "", servings = 1, targetServings = servings, portionsControls = []) {
    const container = document.getElementById("recipe-groups");
    container.innerHTML = "";
    const standaloneTaste = document.getElementById("taste-profile");
    const standaloneTasteRows = document.getElementById("taste-rows");
    if (standaloneTaste) {
        if (standaloneTasteRows) standaloneTasteRows.innerHTML = "";
    }
    const ingredientGroups = (ingredientsRaw || "")
        .split("||")
        .map((g) => g.trim());
    const stepGroups = (stepsRaw || "")
        .split("||")
        .map((g) => g.trim());
    const tasteGroups = (tasteRaw || "")
        .split("||")
        .map((g) => g.trim());
    const names = (drinkNameRaw || "")
        .split("&")
        .map((name) => name.trim());
    const groupCount = Math.max(ingredientGroups.length, stepGroups.length, tasteGroups.filter(Boolean).length, 1);
    if (groupCount === 1) {
        if (standaloneTaste) renderTasteProfile(tasteRaw);
    } else if (standaloneTaste) {
        standaloneTaste.style.display = "none";
    }
    for (let i = 0; i < groupCount; i++) {
        const group = document.createElement("div");
        group.className = "recipe-group";
        if (groupCount > 1) {
            const label = document.createElement("p");
            label.className = "recipe-group-label";
            label.textContent = names[i] || `Drink ${i + 1}`;
            group.appendChild(label);
        }
        if (groupCount > 1 && tasteGroups[i]) {
            appendTasteProfile(group, tasteGroups[i], true);
        }
        const groupServings = Array.isArray(servings) ? servings[i] ?? servings[0] ?? 1 : servings;
        const groupTargetServings = Array.isArray(targetServings)
            ? targetServings[i] ?? groupServings
            : targetServings;
        const quantityFactor = groupTargetServings / groupServings;
        const ingredients = (ingredientGroups[i] || "")
            .split(";")
            .map((s) => s.trim())
            .filter(Boolean)
            .map((ingredient) => scaleIngredientQuantity(ingredient, quantityFactor));
        const steps = (stepGroups[i] || "").split(";").map((s) => s.trim()).filter(Boolean);
        if (ingredients.length) {
            const control = portionsControls[i] || null;
            group.appendChild(makeRecipeSection("Ingredienser", ingredients, false, control));
        }
        if (steps.length) {
            group.appendChild(makeRecipeSection("Gör så här", steps, true));
        }
        container.appendChild(group);
    }
}

function appendTasteProfile(container, tasteStr, grouped = false) {
    const profileContainer = document.createElement("section");
    profileContainer.className = "taste-profile recipe-taste-profile";
    if (grouped) profileContainer.setAttribute("aria-label", "Smakprofil");
    const heading = document.createElement("p");
    heading.className = "recipe-heading";
    heading.textContent = "Smakprofil";
    profileContainer.appendChild(heading);
    const rows = document.createElement("div");
    rows.className = "taste-rows";
    const values = tasteStr
        .split(",")
        .map((s) => parseInt(s.trim().split("/")[0], 10));
    TASTE_LABELS.forEach((label, i) => {
        const value = values[i] || 0;
        let dots = "";
        for (let d = 1; d <= 5; d++) {
            dots += `<span class="taste-dot ${d <= value ? "filled" : ""}"></span>`;
        }
        const row = document.createElement("div");
        row.className = "taste-row";
        row.dataset.taste = label.toLowerCase();
        row.innerHTML = `
          <span class="taste-label">${label}</span>
          <div class="taste-meter" role="meter" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="5" aria-label="${label}: ${value} av 5">
            <span class="taste-dots">${dots}</span>
            <span class="taste-value" aria-hidden="true">${value}<span class="taste-max">/5</span></span>
          </div>
        `;
        rows.appendChild(row);
    });
    profileContainer.appendChild(rows);
    container.appendChild(profileContainer);
}

function makeRecipeSection(title, items, ordered, headingAccessory = null) {
    const section = document.createElement("section");
    section.className = `recipe-section ${ordered ? "recipe-method" : "recipe-shopping"}`;
    section.setAttribute("aria-label", title);
    const heading = document.createElement("h3");
    heading.className = "recipe-heading";
    heading.textContent = title;
    if (headingAccessory) {
        const headingRow = document.createElement("div");
        headingRow.className = "recipe-section-heading-row";
        headingRow.append(heading, headingAccessory);
        section.appendChild(headingRow);
    } else {
        section.appendChild(heading);
    }
    const groups = [];
    let current = { title: "", items: [] };
    items.forEach((text) => {
        const heading = text.match(/^#\s+(.+)$/s);
        if (heading) {
            if (current.title || current.items.length) groups.push(current);
            current = { title: heading[1], items: [] };
        } else {
            current.items.push(text);
        }
    });
    if (current.title || current.items.length) groups.push(current);
    const hasHeadings = groups.some((group) => group.title);
    groups.forEach((group) => {
        const target = hasHeadings ? document.createElement("div") : section;
        if (hasHeadings) {
            target.className = "recipe-subsection";
            section.appendChild(target);
        }
        if (group.title) {
            const subtitle = document.createElement("h4");
            subtitle.className = "recipe-subheading";
            subtitle.textContent = group.title;
            target.appendChild(subtitle);
        }
        if (!group.items.length) return;
        const list = document.createElement(ordered ? "ol" : "ul");
        list.className = ordered ? "recipe-steps" : "recipe-ingredients";
        // Preserve list semantics in Safari when removing the default markers.
        list.setAttribute("role", "list");
        group.items.forEach((text) => {
            const item = document.createElement("li");
            item.textContent = text;
            list.appendChild(item);
        });
        target.appendChild(list);
    });
    return section;
}

export function renderSpiritLinks(ingredients, onSpiritSelect) {
    const container = document.getElementById("recipe-spirit-links");
    container.replaceChildren();
    const spirits = getDrinkSpirits(ingredients);
    container.hidden = spirits.length === 0;
    if (!spirits.length) return;
    const heading = document.createElement("h3");
    heading.className = "recipe-heading";
    heading.textContent = "Fler drinkar med:";
    container.appendChild(heading);
    const buttons = document.createElement("div");
    buttons.className = "recipe-spirit-buttons";
    spirits.forEach((spirit) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "recipe-spirit-button";
        button.textContent = spirit;
        button.style.setProperty("--spirit-hue", hashHue(spirit));
        button.setAttribute("aria-label", `Visa alla drinkar med ${spirit}`);
        button.addEventListener("click", () => onSpiritSelect(spirit));
        buttons.appendChild(button);
    });
    container.appendChild(buttons);
}
