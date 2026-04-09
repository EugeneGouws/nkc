/**
 * Recipe persistence layer — localStorage-backed storage for confirmed recipes.
 *
 * StoredRecipe shape: { id, title, servings, rawText, ingredients[], favorite, tag, dateAdded }
 *
 * Write gateway: importFinished() in src/lib/importer.js calls addRecipe() here.
 */

const STORAGE_KEY = 'nkc_recipes';

/**
 * Reads and parses all stored recipes from localStorage.
 * @returns {Array} StoredRecipe[] — empty array if storage is empty or missing.
 */
export function readRecipes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error(`Failed to read recipes from localStorage:`, err);
    return [];
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

