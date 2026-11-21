import { createTasteFields } from "./admin-taste-fields.js";

export function createDrinkVariants() {
  const container = document.getElementById("admin-variants");
  const addButton = document.getElementById("add-drink-variant");
  let nextId = 0;

  function addVariant(values = {}, focus = false) {
    const id = nextId++;
    const variant = document.createElement("fieldset");
    variant.className = "admin-variant";
    variant.dataset.variantId = String(id);
    variant.innerHTML = `
      <legend>Drink 2</legend>
      <button type="button" class="admin-recipe-remove admin-action-remove admin-variant-remove" aria-label="Ta bort denna drink">Ta bort Drink 2</button>
      <div class="filter-group full-width">
        <label for="variant-name-${id}">Drinknamn</label>
        <input type="text" id="variant-name-${id}" class="admin-variant-name" value="">
      </div>
      <fieldset class="admin-recipe-fields full-width">
        <legend class="admin-recipe-legend">
          <span>Ingredienser</span>
          <span class="recipe-portions" role="group" aria-label="Portioner för Drink 2">
            <button type="button" class="recipe-portions-button variant-servings-decrease" aria-label="Minska portioner">−</button>
            <input type="number" class="variant-servings" min="1" step="1" value="1" required aria-label="Antal portioner för Drink 2">
            <span class="recipe-portions-unit">port</span>
            <button type="button" class="recipe-portions-button variant-servings-increase" aria-label="Öka portioner">+</button>
          </span>
        </legend>
        <div id="variant-ingredients-${id}" class="admin-recipe-rows"></div>
        <div class="admin-recipe-actions">
          <button type="button" class="admin-recipe-add variant-add-ingredient">+ Lägg till ingrediens</button>
          <button type="button" class="admin-recipe-add variant-add-ingredient-heading">+ Lägg till rubrik</button>
        </div>
      </fieldset>
      <fieldset class="admin-recipe-fields full-width">
        <legend>Gör så här</legend>
        <div id="variant-steps-${id}" class="admin-recipe-rows"></div>
        <div class="admin-recipe-actions">
          <button type="button" class="admin-recipe-add variant-add-step">+ Lägg till steg</button>
          <button type="button" class="admin-recipe-add variant-add-step-heading">+ Lägg till rubrik</button>
        </div>
      </fieldset>
      <fieldset class="admin-taste-fields full-width">
        <legend>Smakprofil</legend>
        <p class="admin-taste-hint" role="status" aria-live="polite"></p>
        <div id="variant-taste-${id}" class="admin-taste-rows"></div>
        <button type="button" class="admin-recipe-remove admin-action-remove variant-taste-clear" aria-label="Rensa smakprofil">Rensa smakprofil</button>
      </fieldset>`;

    container.appendChild(variant);
    const name = variant.querySelector(".admin-variant-name");
    name.value = values.name || "";
    const servings = variant.querySelector(".variant-servings");
    servings.value = String(values.servings ?? 1);
    const servingsControl = servings.closest(".recipe-portions");
    const decreaseServings = servingsControl.querySelector(".variant-servings-decrease");
    const increaseServings = servingsControl.querySelector(".variant-servings-increase");
    const updateServingsButtons = () => {
      const value = Number(servings.value);
      decreaseServings.disabled = value <= 1;
      increaseServings.disabled = value >= Number.MAX_SAFE_INTEGER;
    };
    servings.addEventListener("input", updateServingsButtons);
    servings.addEventListener("change", updateServingsButtons);
    decreaseServings.addEventListener("click", () => {
      const value = Number(servings.value);
      if (value > 1) {
        servings.value = String(value - 1);
        servings.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    increaseServings.addEventListener("click", () => {
      const value = Number(servings.value);
      if (Number.isSafeInteger(value) && value < Number.MAX_SAFE_INTEGER) {
        servings.value = String(value + 1);
        servings.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    name.addEventListener("input", updateVariantLabels);
    updateServingsButtons();
    const ingredients = createVariantRecipeFields(
      variant,
      "ingredients",
      "Ingrediens",
      false,
      id,
      values.ingredients || "",
    );
    const steps = createVariantRecipeFields(
      variant,
      "steps",
      "Steg",
      true,
      id,
      values.steps || "",
    );
    const taste = createTasteFields({
      container: variant.querySelector(".admin-taste-rows"),
      hint: variant.querySelector(".admin-taste-hint"),
      clear: variant.querySelector(".variant-taste-clear"),
      namePrefix: `taste-variant-${id}`,
    });
    taste.setValue(values.taste || "");
    variant._variantData = { name, ingredients, steps, taste };

    variant.querySelector(".admin-variant-remove").addEventListener("click", () => {
      variant.remove();
      updateVariantLabels();
      container.dispatchEvent(new Event("change", { bubbles: true }));
    });
    if (focus) name.focus();
    updateVariantLabels();
  }

  function createVariantRecipeFields(variant, kind, label, multiline, id, value) {
    const prefix = `variant-${kind}-${id}`;
    const rowContainer = variant.querySelector(`#${prefix}`);
    const addButton = variant.querySelector(`.variant-add-${kind === "ingredients" ? "ingredient" : "step"}`);
    const headingButton = variant.querySelector(`.variant-add-${kind === "ingredients" ? "ingredient" : "step"}-heading`);
    const fields = window.createRecipeFields(kind, label, multiline, {
      container: rowContainer,
      addButton,
      headingButton,
      idPrefix: prefix,
    });
    fields.setValue(value);
    return fields;
  }

  function updateVariantLabels() {
    [...container.children].forEach((variant, index) => {
      const drinkNumber = index + 2;
      variant.querySelector("legend").textContent = `Drink ${drinkNumber}`;
      const remove = variant.querySelector(".admin-variant-remove");
      remove.textContent = `Ta bort Drink ${drinkNumber}`;
      variant.querySelector(".admin-variant-remove").setAttribute(
        "aria-label",
        `Ta bort Drink ${drinkNumber}`,
      );
      const drinkName = variant.querySelector(".admin-variant-name").value.trim() || `Drink ${drinkNumber}`;
      const servingsControl = variant.querySelector(".variant-servings").closest(".recipe-portions");
      servingsControl.setAttribute("aria-label", `Portioner för ${drinkName}`);
      variant.querySelector(".variant-servings").setAttribute("aria-label", `Antal portioner för ${drinkName}`);
    });
  }

  function setValue({ drink, ingredients, steps, taste, servings }) {
    container.replaceChildren();
    const names = String(drink || "").split("&").map((value) => value.trim());
    const ingredientGroups = String(ingredients || "").split("||").map((value) => value.trim());
    const stepGroups = String(steps || "").split("||").map((value) => value.trim());
    const tasteGroups = String(taste || "").split("||").map((value) => value.trim());
    const servingsGroups = Array.isArray(servings) ? servings : names.map(() => servings ?? 1);
    for (let index = 1; index < names.length; index++) {
      addVariant({
        name: names[index] || "",
        ingredients: ingredientGroups[index] || "",
        steps: stepGroups[index] || "",
        taste: tasteGroups[index] || "",
        servings: servingsGroups[index] ?? servingsGroups[0] ?? 1,
      });
    }
  }

  function getValue() {
    const variants = [...container.children];
    return {
      names: variants.map((variant) => variant._variantData.name.value.trim()),
      ingredients: variants.map((variant) => variant._variantData.ingredients.getValue()),
      steps: variants.map((variant) => variant._variantData.steps.getValue()),
      tastes: variants.map((variant) => variant._variantData.taste.getValue()),
      servings: variants.map((variant) => Number(variant.querySelector(".variant-servings").value)),
    };
  }

  function isComplete() {
    return [...container.children].every((variant) =>
      variant._variantData.name.value.trim() &&
      variant._variantData.taste.isComplete() &&
      Number.isSafeInteger(Number(variant.querySelector(".variant-servings").value)) &&
      Number(variant.querySelector(".variant-servings").value) > 0
    );
  }

  addButton.addEventListener("click", () => {
    addVariant({}, true);
    container.dispatchEvent(new Event("change", { bubbles: true }));
  });
  return { setValue, getValue, isComplete };
}
