/**
 * pantryStore.js — unified pantry persistence layer.
 *
 * On first read, seeds pantry.json into localStorage under nkc_pantry.
 * All subsequent reads and writes (price updates, new items) go to that key.
 * The seed file (pantry.json) is never mutated.
 *
 * Community diff: items with userAdded:true were added by the user after seeding.
 * Price changes on static items are visible via the diff between nkc_pantry and pantry.json.
 */

import seedPantry from '../data/pantry.json';

const PANTRY_KEY = 'nkc_pantry';

// ─── Internal read/write ──────────────────────────────────────────────────────

function readAllPantry() {
  try {
    const stored = localStorage.getItem(PANTRY_KEY);
    if (!stored) {
      localStorage.setItem(PANTRY_KEY, JSON.stringify(seedPantry));
      return [...seedPantry];
    }
    return JSON.parse(stored);
  } catch (err) {
    console.error('Failed to read pantry from localStorage:', err);
    return [...seedPantry];
  }
}

function writePantry(items) {
  try {
    localStorage.setItem(PANTRY_KEY, JSON.stringify(items));
  } catch (err) {
    console.error('Failed to write pantry to localStorage:', err);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nameToId(name) {
  return name.toLowerCase().trim().replace(/\s+/g, '-');
}

function nameToCanonical(name) {
  return name
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// ─── Public reads ─────────────────────────────────────────────────────────────

/**
 * Returns the full pantry array from localStorage (seeds on first call).
 * @returns {Array} PantryItem[]
 */
export function readPantry() {
  return readAllPantry();
}

/**
 * Returns the full pantry, reordered by recipe usage.
 * Used items come first (by usage count desc, then name asc),
 * followed by unused items (alphabetically by canonicalName).
 *
 * @param {Array} recipes — StoredRecipe[]
 * @returns {Array} Reordered PantryItem[]
 */
export function getMyPantry(recipes) {
  const fullPantry = readAllPantry();

  const usageCount = {};
  recipes.forEach((recipe) => {
    recipe.ingredients.forEach((ingredient) => {
      if (ingredient.matchedIngredient) {
        usageCount[ingredient.matchedIngredient] =
          (usageCount[ingredient.matchedIngredient] || 0) + 1;
      }
    });
  });

  const used = [];
  const unused = [];

  fullPantry.forEach((item) => {
    if (usageCount[item.id]) {
      used.push({ item, count: usageCount[item.id] });
    } else {
      unused.push(item);
    }
  });

  used.sort((a, b) => b.count - a.count || a.item.canonicalName.localeCompare(b.item.canonicalName));
  unused.sort((a, b) => a.canonicalName.localeCompare(b.canonicalName));

  return [...used.map(({ item }) => item), ...unused];
}

// ─── Writes ───────────────────────────────────────────────────────────────────

/**
 * Appends an unmatched ingredient as a new pantry item.
 * Deduplicates by id. Called by importFinished for still-unmatched ingredients.
 *
 * @param {Object} ingredient — RecipeIngredient { name, ... }
 * @param {string} baseUnit   — 'g' | 'ml' | 'each', computed by importer
 * @returns {Array} Updated pantry
 */
export function addIngredientToPantry(ingredient, baseUnit) {
  const id = nameToId(ingredient.name);
  const items = readAllPantry();

  if (items.some(item => item.id === id)) return items;

  const userItem = {
    id,
    canonicalName: nameToCanonical(ingredient.name),
    aliases: [ingredient.name.toLowerCase()],
    baseUnit,
    conversions: {},
    costPerUnit: 0,
    packageValue: 0,
    packageUnit: '',
    packagePrice: 0,
    matchedProduct: null,
    dateLastUpdated: null,
    needsCosting: true,
    priceOptionCount: 3,
    searchHints: [],
    userAdded: true,
    submittedToSeed: false,
    dateUserAdded: new Date().toISOString().split('T')[0],
  };

  items.push(userItem);
  writePantry(items);
  return items;
}

/**
 * Updates the price fields of a pantry item in localStorage.
 * Works for both seed items and user-added items — both live in nkc_pantry.
 *
 * @param {string} itemId
 * @param {{ costPerUnit, packageValue, packageUnit, packagePrice, matchedProduct, dateLastUpdated }} data
 * @returns {Array} Updated pantry
 */
export function priceUpdate(itemId, { costPerUnit, packageValue, packageUnit, packagePrice, matchedProduct, dateLastUpdated }) {
  const items = readAllPantry();
  const idx = items.findIndex(item => item.id === itemId);
  if (idx === -1) {
    console.error(`priceUpdate: item '${itemId}' not found in pantry`);
    return items;
  }

  items[idx] = {
    ...items[idx],
    costPerUnit,
    packageValue,
    packageUnit,
    packagePrice,
    matchedProduct,
    dateLastUpdated,
    needsCosting: false,
  };

  writePantry(items);
  return items;
}

/**
 * Marks items as needsCosting:true if their price is older than 7 days.
 * Called once at app launch.
 *
 * @returns {number} Count of items marked stale
 */
export function refreshNeedsCosting() {
  const items = readAllPantry();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);

  let staleCount = 0;
  const updated = items.map(item => {
    if (!item.dateLastUpdated || item.needsCosting) return item;
    if (new Date(item.dateLastUpdated) < cutoff) {
      staleCount++;
      return { ...item, needsCosting: true };
    }
    return item;
  });

  if (staleCount > 0) writePantry(updated);
  return staleCount;
}

/**
 * Returns user-added items not yet submitted to the seed pantry.
 * @returns {Array} PantryItem[] where userAdded && !submittedToSeed
 */
export function getPendingSubmissions() {
  return readAllPantry().filter(item => item.userAdded && !item.submittedToSeed);
}
