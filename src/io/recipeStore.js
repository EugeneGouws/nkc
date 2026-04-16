/**
 * Recipe persistence layer — localStorage-backed storage for confirmed recipes.
 *
 * StoredRecipe shape: { id, title, servings, rawText, ingredients[], favorite, collection, dateAdded }
 *
 * On first read, seeds data/recipes.json into localStorage under local_recipes.
 * Write gateway: saveRecipe() — upserts by id (creates if not found).
 */

import seedRecipesFile from '../data/recipes.json';

const STORAGE_KEY = 'local_recipes';

// Normalise a raw recipe item to the current StoredRecipe shape.
function normalise(r) {
  return {
    favorite:   false,
    rawText:    '',
    dateAdded:  r.importedAt?.split('T')[0] ?? r.dateAdded ?? '',
    ...r,
    // Unify: bakerspro uses tags[] array; nkc uses collection string
    collection: Array.isArray(r.tags) ? (r.tags[0] ?? '') : (r.collection ?? ''),
  }
}

const seedRecipes = (seedRecipesFile.items ?? seedRecipesFile).map(normalise)

/**
 * Reads and parses all stored recipes from localStorage.
 * Seeds from recipes.json on first run.
 * @returns {Array} StoredRecipe[]
 */
export function readRecipes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seedRecipes));
      return [...seedRecipes];
    }
    return JSON.parse(raw).map(normalise);
  } catch (err) {
    console.error(`Failed to read recipes from localStorage:`, err);
    return [...seedRecipes];
  }
}

/**
 * Writes recipes array to localStorage. Internal only.
 */
function writeRecipes(recipes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
  } catch (err) {
    console.error(`Failed to write recipes to localStorage:`, err);
  }
}

/**
 * Replaces the entire recipe list in localStorage. Used for migration.
 * @param {Array} recipes — StoredRecipe[]
 */
export function saveRecipes(recipes) {
  writeRecipes(recipes)
}

/**
 * Upsert a recipe by id.
 *
 * - If data.id exists and is found → merge data into existing record.
 * - Otherwise → insert as a new recipe (generates id if missing).
 *
 * Unspecified fields keep their current values (or defaults for new recipes).
 *
 * @param {Object} data — Partial or full StoredRecipe fields
 * @returns {Array} Updated StoredRecipe[]
 */
export function saveRecipe(data) {
  const recipes = readRecipes();
  const idx     = data.id ? recipes.findIndex(r => r.id === data.id) : -1;

  if (idx !== -1) {
    recipes[idx] = normalise({ ...recipes[idx], ...data });
  } else {
    const newRecipe = normalise({
      favorite:  false,
      rawText:   '',
      collection: '',
      dateAdded: new Date().toISOString().split('T')[0],
      ...data,
      id: data.id ?? crypto.randomUUID(),
    });
    recipes.push(newRecipe);
  }

  writeRecipes(recipes);
  return recipes;
}

export function toggleRecipeFavourite(id) {
  const recipes = readRecipes();
  writeRecipes(recipes.map(r => r.id === id ? { ...r, favorite: !r.favorite } : r));
}

export function deleteRecipe(id) {
  writeRecipes(readRecipes().filter(r => r.id !== id));
}
