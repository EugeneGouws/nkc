/**
 * pantryStore.js — unified pantry persistence layer.
 *
 * On first read, seeds pantry.json into localStorage under local_pantry.
 * All subsequent reads and writes go to that key.
 * The seed file (pantry.json) is never mutated.
 */

import seedPantry from '../data/pantry.json';

const PANTRY_KEY = 'local_pantry';

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

// "cup:250, tbsp:15" → { cup: 250, tbsp: 15 }
function parseConversionsStr(str) {
  if (!str || typeof str !== 'string' || !str.trim()) return null;
  return Object.fromEntries(
    str.split(',')
      .map(s => s.trim().split(':').map(p => p.trim()))
      .filter(([k, v]) => k && !isNaN(parseFloat(v)))
      .map(([k, v]) => [k, parseFloat(v)])
  );
}

// "flour, plain flour" → ["flour", "plain flour"]
function parseAliasesStr(str) {
  if (!str || typeof str !== 'string' || !str.trim()) return null;
  return str.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

// ─── Public reads ─────────────────────────────────────────────────────────────

/**
 * Returns the full pantry array from localStorage (seeds on first call).
 * @returns {Array} PantryItem[]
 */
export function readPantry() {
  return readAllPantry();
}

// ─── Public writes ───────────────────────────────────────────────────────────

/**
 * Upsert a pantry item.
 *
 * Looks up by data.id, then by nameToId(data.name), then by alias match.
 * - Not found → create new item with defaults, merged with provided data.
 * - Found     → merge provided data into the existing item in-place.
 *
 * Accepts both pkg* (modal) and package* (price update) field names.
 *
 * @param {Object} data
 *   id?, name?, baseUnit?,
 *   pkgValue?/packageValue?, pkgUnit?/packageUnit?, pkgPrice?/packagePrice?,
 *   pkgMatch?/matchedProduct?, costPerUnit?,
 *   conversions? (string "cup:250" or object), aliases? (string or array),
 *   dateLastUpdated?, needsCosting?
 * @returns {Array} Updated PantryItem[]
 */
export function savePantryItem(data) {
  const items = readAllPantry();

  // ── Normalize field names ─────────────────────────────────────────────────
  const pv  = parseFloat(data.pkgValue   ?? data.packageValue)  || null;
  const pu  = data.pkgUnit     ?? data.packageUnit  ?? null;
  const pp  = parseFloat(data.pkgPrice   ?? data.packagePrice)  || null;
  const pm  = data.pkgMatch    ?? data.matchedProduct ?? null;
  const cpu = data.costPerUnit != null ? parseFloat(data.costPerUnit) : null;

  const parsedConversions = data.conversions
    ? (typeof data.conversions === 'string' ? parseConversionsStr(data.conversions) : data.conversions)
    : null;

  const parsedAliases = data.aliases
    ? (typeof data.aliases === 'string' ? parseAliasesStr(data.aliases) : data.aliases)
    : null;

  // ── Lookup ────────────────────────────────────────────────────────────────
  const lookupId = data.id ?? (data.name ? nameToId(data.name) : null);
  let idx = lookupId != null ? items.findIndex(item => item.id === lookupId) : -1;

  // Alias fallback: lookupId might appear in another item's alias list
  if (idx === -1 && lookupId) {
    idx = items.findIndex(item => item.aliases?.includes(lookupId));
    if (idx !== -1 && data.id && items[idx].id !== data.id) {
      // Conflict: name resolves to a different item than the provided id
      window.alert(`This item already exists as "${items[idx].canonicalName}".`);
      return items;
    }
  }

  // ── Compute derived fields ────────────────────────────────────────────────
  const computedCostPerUnit = cpu != null
    ? cpu
    : (pv != null && pp != null && pv > 0 ? pp / pv : null);

  const priceComplete = pv != null && pp != null && pv > 0 && pp > 0;

  // ── Update existing ───────────────────────────────────────────────────────
  if (idx !== -1) {
    const existing = items[idx];
    const updated  = { ...existing };

    if (data.name)                      updated.canonicalName   = nameToCanonical(data.name);
    if (data.baseUnit)                  updated.baseUnit        = data.baseUnit;
    if (parsedAliases?.length)          updated.aliases         = parsedAliases;
    if (parsedConversions)              updated.conversions     = parsedConversions;
    if (pv != null)                     updated.packageValue    = pv;
    if (pu != null)                     updated.packageUnit     = pu;
    if (pp != null)                     updated.packagePrice    = pp;
    if (pm != null)                     updated.matchedProduct  = pm;
    if (computedCostPerUnit != null)    updated.costPerUnit     = computedCostPerUnit;
    if (data.dateLastUpdated !== undefined) updated.dateLastUpdated = data.dateLastUpdated;

    // needsCosting: explicit override wins; otherwise false when price complete
    if (data.needsCosting !== undefined) {
      updated.needsCosting = data.needsCosting;
    } else if (priceComplete) {
      updated.needsCosting = false;
    }

    items[idx] = updated;
    writePantry(items);
    return items;
  }

  // ── Create new ───────────────────────────────────────────────────────────
  if (!data.name) {
    console.error('savePantryItem: cannot create item without a name');
    return items;
  }

  const newId = nameToId(data.name);
  const newItem = {
    id:              newId,
    canonicalName:   nameToCanonical(data.name),
    aliases:         parsedAliases?.length ? parsedAliases : [data.name.toLowerCase()],
    baseUnit:        data.baseUnit ?? 'each',
    conversions:     parsedConversions ?? {},
    costPerUnit:     computedCostPerUnit ?? 0,
    packageValue:    pv,
    packageUnit:     pu ?? data.baseUnit ?? 'each',
    packagePrice:    pp,
    matchedProduct:  pm,
    dateLastUpdated: data.dateLastUpdated ?? null,
    needsCosting:    !priceComplete,
    priceOptionCount: 3,
    searchHints:     [],
    userAdded:       true,
    submittedToSeed: false,
    dateUserAdded:   new Date().toISOString().split('T')[0],
  };

  items.push(newItem);
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
