/**
 * Recipe persistence layer — localStorage-backed storage for confirmed recipes.
 *
 * StoredRecipe shape: { id, title, servings, rawText, ingredients[], favorite, tag, dateAdded }
 *
 * On first read, seeds data/recipes.json into localStorage under nkc_recipes.
 * Write gateway: importFinished() in src/lib/importer.js calls addRecipe() here.
 */

import seedRecipesFile from '../data/recipes.json';

const STORAGE_KEY = 'nkc_recipes';

const seedRecipes = (seedRecipesFile.items ?? seedRecipesFile).map(r => ({
  favorite:  false,
  rawText:   '',
  dateAdded: r.importedAt?.split('T')[0] ?? '',
  ...r,
  // Normalise: seed JSON uses tags[] array; app uses tag string
  tag: Array.isArray(r.tags) ? (r.tags[0] ?? '') : (r.tag ?? ''),
}))

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
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Failed to read recipes from localStorage:`, err);
    return [...seedRecipes];
  }
}

/**
 * Writes recipes array to localStorage. Internal only — not exported.
 * @param {Array} recipes — StoredRecipe[]
 */
function writeRecipes(recipes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
  } catch (err) {
    console.error(`Failed to write recipes to localStorage:`, err);
  }
}

/**
 * Replaces the entire recipe list in localStorage. Used for batch updates (e.g. fixup pass).
 * @param {Array} recipes — StoredRecipe[]
 */
export function saveRecipes(recipes) {
  writeRecipes(recipes)
}

/**
 * Appends a StoredRecipe to the stored list and persists to localStorage.
 * @param {Object} recipe — StoredRecipe object
 * @returns {Array} Updated StoredRecipe[]
 */
export function addRecipe(recipe) {
  const recipes = readRecipes();
  recipes.push(recipe);
  writeRecipes(recipes);
  return recipes;
}

/**
 * Toggles the favorite field on a stored recipe.
 * @param {string} id — StoredRecipe id
 */
export function toggleRecipeFavourite(id) {
  const recipes = readRecipes();
  writeRecipes(recipes.map(r => r.id === id ? { ...r, favorite: !r.favorite } : r));
}

export function deleteRecipe(id) {
  writeRecipes(readRecipes().filter(r => r.id !== id));
}

