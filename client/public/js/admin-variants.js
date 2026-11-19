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
        <legend>Ingredienser</legend>
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
    });
  }

  function setValue({ drink, ingredients, steps, taste }) {
    container.replaceChildren();
    const names = String(drink || "").split("&").map((value) => value.trim());
    const ingredientGroups = String(ingredients || "").split("||").map((value) => value.trim());
    const stepGroups = String(steps || "").split("||").map((value) => value.trim());
    const tasteGroups = String(taste || "").split("||").map((value) => value.trim());
    for (let index = 1; index < names.length; index++) {
      addVariant({
        name: names[index] || "",
        ingredients: ingredientGroups[index] || "",
        steps: stepGroups[index] || "",
        taste: tasteGroups[index] || "",
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
    };
  }

  function isComplete() {
    return [...container.children].every((variant) =>
      variant._variantData.name.value.trim() &&
      variant._variantData.taste.isComplete()
    );
  }

  addButton.addEventListener("click", () => {
    addVariant({}, true);
    container.dispatchEvent(new Event("change", { bubbles: true }));
  });
  return { setValue, getValue, isComplete };
}
