/**
 * migration.js — one-time data migration from old bakerspro_ localStorage keys.
 *
 * bakerspro_db        → price data applied to local_pantry
 * bakerspro_recipes   → recipes merged into local_recipes
 * bakerspro_favourites→ favorite flags applied to merged recipes
 * bakerspro_collections, bakerspro_consent_* → removed (not used in nkc)
 *
 * Each migration branch is guarded by the presence of its old key.
 * On completion the old key is removed, so this is a no-op on subsequent runs.
 */

import { readPantry, savePantryItem } from './pantryStore.js';
import { readRecipes, saveRecipes } from './recipeStore.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse old pkg string: "1000g · R265" → { packageValue, packageUnit, packagePrice }
 * Returns {} if the format is unrecognised.
 */
function parsePkg(pkg) {
  if (!pkg) return {};
  const m = pkg.match(/^([\d.]+)\s*([a-zA-Z]+)\s*[·•]\s*R\s*([\d.]+)/);
  if (!m) return {};
  return {
    packageValue: parseFloat(m[1]),
    packageUnit:  m[2].toLowerCase(),
    packagePrice: parseFloat(m[3]),
  };
}

/**
 * Find a pantry item that matches the old ingredient name or any of its aliases.
 * Returns the first match or null.
 */
function findPantryMatch(oldName, oldAliases, pantry) {
  const candidates = [oldName, ...(oldAliases ?? [])].map(s => s.toLowerCase());
  return pantry.find(item =>
    item.aliases.some(a => candidates.includes(a.toLowerCase())) ||
    candidates.includes(item.canonicalName.toLowerCase())
  ) ?? null;
}

// ─── Migration steps ─────────────────────────────────────────────────────────

function migratePantryPrices() {
  const raw = localStorage.getItem('bakerspro_db');
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    const oldItems = Array.isArray(parsed) ? parsed : (parsed.items ?? []);
    const pantry   = readPantry();

    oldItems.forEach(oldItem => {
      const match = findPantryMatch(oldItem.name, oldItem.aliases, pantry);
      if (!match) return;

      const { packageValue, packageUnit, packagePrice } = parsePkg(oldItem.pkg);

      savePantryItem({
        id:              match.id,
        costPerUnit:     oldItem.costPerUnit     ?? match.costPerUnit,
        packageValue:    packageValue            ?? match.packageValue,
        packageUnit:     packageUnit             ?? match.packageUnit,
        packagePrice:    packagePrice            ?? match.packagePrice,
        matchedProduct:  match.matchedProduct,
        dateLastUpdated: oldItem.dateLastUpdated ?? null,
      });
    });
  } catch (err) {
    console.error('bakerspro_db migration failed:', err);
  }
  localStorage.removeItem('bakerspro_db');
}

function migrateRecipes() {
  const raw = localStorage.getItem('bakerspro_recipes');
  if (!raw) return;
  try {
    const parsed     = JSON.parse(raw);
    const oldRecipes = Array.isArray(parsed) ? parsed : (parsed.items ?? []);
    const current    = readRecipes();
    const existingIds = new Set(current.map(r => r.id));

    const incoming = oldRecipes
      .filter(r => r.id && !existingIds.has(r.id))
      .map(r => ({
        favorite:  false,
        rawText:   '',
        dateAdded: r.importedAt?.split('T')[0] ?? r.dateAdded ?? '',
        ...r,
        // Normalise tags[] → collection (single string, first element)
        collection: Array.isArray(r.tags) ? (r.tags[0] ?? '') : (r.collection ?? r.tag ?? ''),
      }));

    if (incoming.length > 0) {
      saveRecipes([...current, ...incoming]);
    }
  } catch (err) {
    console.error('bakerspro_recipes migration failed:', err);
  }
  localStorage.removeItem('bakerspro_recipes');
}

function migrateFavourites() {
  const raw = localStorage.getItem('bakerspro_favourites');
  if (!raw) return;
  try {
    const favIds = new Set(JSON.parse(raw));
    if (favIds.size > 0) {
      const recipes = readRecipes();
      saveRecipes(recipes.map(r => ({
        ...r,
        favorite: r.favorite || favIds.has(r.id),
      })));
    }
  } catch (err) {
    console.error('bakerspro_favourites migration failed:', err);
  }
  localStorage.removeItem('bakerspro_favourites');
}

function cleanupOldKeys() {
  ['bakerspro_collections', 'bakerspro_consent_storage', 'bakerspro_consent_ai'].forEach(k =>
    localStorage.removeItem(k)
  );
}

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Run all bakerspro_ migrations in order.
 * Each step is a no-op if the corresponding old key does not exist.
 * Safe to call on every app startup — idempotent once old keys are gone.
 */
export function migrateFromBakersPro() {
  migratePantryPrices();  // must run before migrateRecipes (recipes may share pantry items)
  migrateRecipes();
  migrateFavourites();    // must run after migrateRecipes (favs reference recipe IDs)
  cleanupOldKeys();
}
