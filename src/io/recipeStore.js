/**
 * Recipe persistence layer — localStorage-backed storage for confirmed recipes.
 *
 * StoredRecipe shape: { id, title, servings, rawText, ingredients[], favorite, collection, dateAdded }
 *
 * On first read, seeds data/recipes.json into localStorage under local_recipes.
 * Write gateway: importFinished() in src/lib/importer.js calls addRecipe() here.
 */

import seedRecipesFile from '../data/recipes.json';

const STORAGE_KEY = 'local_recipes';

// Normalise a raw recipe object (seed or bakerspro-migrated) to the current StoredRecipe shape.
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

/**
 * Overwrites a stored recipe in-place by ID.
 * Called by the Edit Recipe flow in the UI.
 * @param {string} id
 * @param {Object} updatedRecipe — Partial or full StoredRecipe fields to merge
 */
export function updateRecipe(id, updatedRecipe) {
  writeRecipes(readRecipes().map(r => r.id === id ? { ...r, ...updatedRecipe } : r));
}

