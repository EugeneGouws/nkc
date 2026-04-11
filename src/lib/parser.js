/**
 * Pure parsing layer, no React, no side effects
 * input text of recipe. output ingredients list in raw text for matching
 * Summary of flow:
 * parseRecipeText -> findIngredients -> parseIngredientLine -> (findAmount, findUnit, findIngredient) -> parseWordNumber -> expandUnicodeFracs.
 */



// Inline word-to-number converter — covers every number word that appears in
// real recipes. Replaces the 'words-to-numbers' npm package which is a CJS
// module incompatible with Vite's browser bundler.
const WORD_NUM_MAP = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  half: 0.5, quarter: 0.25,
}
const WORD_NUM_RE = new RegExp(`\\b(${Object.keys(WORD_NUM_MAP).join('|')})\\b`, 'gi')

function wordsToNumbers(str) {
  const replaced = String(str).replace(WORD_NUM_RE, m => WORD_NUM_MAP[m.toLowerCase()])
  const trimmed = replaced.trim()
  const n = Number(trimmed)
  return trimmed !== '' && !isNaN(n) ? n : replaced
}

//some constants

// Maps raw unit strings to their canonical form.
// cup/tsp/tbsp are returned as-is — volumetric conversion is deferred to the matcher.
//This should grow as new unit measures are discovered.
const UNIT_NORM = {
  cup: 'cup', cups: 'cup',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp', tbs: 'tbsp',
  g: 'g', gram: 'g', grams: 'g', kg: 'g',
  ml: 'ml', milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml',
  l: 'ml', liter: 'ml', liters: 'ml', litre: 'ml', litres: 'ml',
  slab: 'each', slabs: 'each',
  pack: 'each', packs: 'each', packet: 'each', packets: 'each',
  each: 'each', whole: 'each', piece: 'each', pieces: 'each',
};

//(kg→g, l→ml)
const UNIT_MULTIPLIERS = {
  kg: 1000, kilos: 1000,  l: 1000, liter: 1000, liters: 1000, litre: 1000, litres: 1000,
};

//findIngredients helpers
const SKIP_LINE_RE = /^(ingredients?:?|method|directions|instructions?|for\s+the|preparation|preheat|oven|bake|mix|combine|stir|beat|fold|pour|grease|line\s+a|serves?|makes?|yields?)/i;
const STOP_RE = /^(method|directions|instructions?|steps?|preparation)\b/i;

// List of Ingredients that are free/always-available and should never be costed
//This list should grow as more are discovered
const FREE_INGREDIENTS = new Set(['water', 'warm water', 'hot water', 'cold water', 'boiling water']);


// --- Dealing with fractions ---

const UNICODE_FRACS = {
  '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75,
  '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
};

// Unicode fraction chars as a single character class string for regex building
const FRAC_CHARS = Object.keys(UNICODE_FRACS).join('');

/**
 * Expand Unicode fraction characters in a string to their decimal equivalents.
 * "1½" → "1.5", "¾" → "0.75", "2⅓" → "2.3333..."
 */
function expandUnicodeFracs(str) {
  // Pass 1: integer glued directly to a fraction char, e.g. "1½" → "1.5"
  let result = str.replace(
    new RegExp(`(\\d+)([${FRAC_CHARS}])`, 'g'),
    (_, int, frac) => String(Number(int) + UNICODE_FRACS[frac]),
  );
  // Pass 2: lone fraction chars, e.g. "½" → "0.5"
  result = result.replace(
    new RegExp(`[${FRAC_CHARS}]`, 'g'),
    (frac) => String(UNICODE_FRACS[frac]),
  );
  return result;
}

/**
 * Resolve "and"-connector and fraction-word patterns that wordsToNumbers leaves
 * unhandled. Returns a number if a pattern matched, null otherwise.
 */
function resolveAndConnector(str) {
  let s = str.replace(/\band\s+a\s+(\d)/gi, 'and $1');

  const wtn = wordsToNumbers(s);
  if (typeof wtn === 'number') return null;
  s = String(wtn).trim();

  const halfMatch = s.match(/^(\d*\.?\d+)\s+and\s+(\d*\.?\d+)\s+half\b/i);
  if (halfMatch) return Number(halfMatch[1]) + Number(halfMatch[2]) * 0.5;

  const qtrMatch = s.match(/^(\d*\.?\d+)\s+and\s+(\d*\.?\d+)\s+quarter\b/i);
  if (qtrMatch) return Number(qtrMatch[1]) + Number(qtrMatch[2]) * 0.25;

  const loneHalf = s.match(/^(\d*\.?\d+)\s+half\b/i);
  if (loneHalf) return Number(loneHalf[1]) * 0.5;

  const loneQtr = s.match(/^(\d*\.?\d+)\s+quarter\b/i);
  if (loneQtr) return Number(loneQtr[1]) * 0.25;

  const andFrac = s.match(/^(\d+)\s+and\s+(\d+)\/(\d+)/i);
  if (andFrac) return Number(andFrac[1]) + Number(andFrac[2]) / Number(andFrac[3]);

  const andDec = s.match(/^(\d+)\s+and\s+(\d*\.?\d+)/i);
  if (andDec) return Number(andDec[1]) + Number(andDec[2]);

  return null;
}

// --- Exported functions ---

/**
 * Convert a text string that may contain word numbers or fractions to a float.
 * Returns 0 on failure, never throws.
 */
export function parseWordNumber(str) {
  try {
    let s = expandUnicodeFracs(String(str).trim());

    if (s.toLowerCase() === 'a' || s.toLowerCase() === 'an') return 1;

    const connected = resolveAndConnector(s);
    if (connected !== null) return connected;

    const wtn = wordsToNumbers(s);
    if (typeof wtn === 'number') return wtn;
    s = String(wtn).trim();

    const mixedMatch = s.match(/(\d+)\s+(\d+)\/(\d+)/);
    if (mixedMatch) {
      return Number(mixedMatch[1]) + Number(mixedMatch[2]) / Number(mixedMatch[3]);
    }

    const fracMatch = s.match(/^(\d+)\/(\d+)$/);
    if (fracMatch) {
      return Number(fracMatch[1]) / Number(fracMatch[2]);
    }

    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;

  } catch {
    return 0;
  }
}

export default parseWordNumber;

/**
 * Parse the leading amount portion of an ingredient token string.
 * Input: "1.5", "¾", "1 1/2", "two", "one and a half"
 * Output: number
 */
export function parseAmountStr(str) {
  const s = expandUnicodeFracs(String(str).trim());

  const mixedMatch = s.match(/^(\d+)\s+(\d+)\/(\d+)/);
  if (mixedMatch) {
    return Number(mixedMatch[1]) + Number(mixedMatch[2]) / Number(mixedMatch[3]);
  }

  return parseWordNumber(s);
}

// --- Private pipeline helpers ---

/**
 * Parse the amount, raw unit token, and name portion from a cleaned ingredient line.
 * Returns { amount, rawUnit, namePart } or null if no amount can be extracted.
 */
function findAmount(line) {
  // Glued unit: "250g", "500ml", "1.5kg", "1l"
  const gluedMatch = line.match(/^(\d*\.?\d+)(g|kg|ml|l)\b/i);
  if (gluedMatch) {
    return {
      amount: parseAmountStr(gluedMatch[1]),
      rawUnit: gluedMatch[2].toLowerCase(),
      namePart: line.slice(gluedMatch[0].length).trim(),
    };
  }

  // Token-split path
  const expanded = String(wordsToNumbers(expandUnicodeFracs(line)) ?? line);
  const tokens = expanded.split(/\s+/);

  let unitIdx = -1;
  for (let i = 0; i < tokens.length; i++) {
    if (UNIT_NORM[tokens[i].toLowerCase()]) { unitIdx = i; break; }
  }

  if (unitIdx === -1) {
    // No recognised unit — amount is the first numeric token, rest is name
    const firstNum = parseAmountStr(tokens[0]);
    if (firstNum === 0) return null;
    return { amount: firstNum, rawUnit: '', namePart: tokens.slice(1).join(' ') };
  }

  if (unitIdx === 0) return null; // unit is first token, no amount

  const amountStr = tokens.slice(0, unitIdx).join(' ');
  const amount = parseAmountStr(amountStr);
  if (amount === 0) return null;
  return { amount, rawUnit: tokens[unitIdx].toLowerCase(), namePart: tokens.slice(unitIdx + 1).join(' ') };
}

/**
 * Normalise a raw unit token to its canonical form.
 * Returns 'each' for unrecognised or absent units.
 */
function findUnit(rawUnit) {
  if (!rawUnit) return 'each';
  return UNIT_NORM[rawUnit] ?? 'each';
}

/**
 * Clean the name portion of an ingredient line.
 * Strips parentheticals, comma-suffixes, and the leading "of" preposition.
 */
function findIngredient(namePart) {
  return namePart
    .replace(/\(.*?\)/g, '')
    .replace(/,.*$/, '')
    .replace(/^of\s+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Parse a single ingredient line into a structured object.
 * @param {string} raw - One line of recipe text.
 * @returns {{ name, amount, unit, raw }} or null
 */
export function parseIngredientLine(raw) {
  const line = String(raw).trim().replace(/^[-•*·]\s*/, '');
  if (SKIP_LINE_RE.test(line)) return null;

  const parsed = findAmount(line);
  if (!parsed) return null;

  let { amount, rawUnit } = parsed;
  const { namePart } = parsed;

  // Apply unambiguous large-unit multipliers (kg→g, l→ml)
  if (UNIT_MULTIPLIERS[rawUnit]) {
    amount *= UNIT_MULTIPLIERS[rawUnit];
  }

  const unit = findUnit(rawUnit);
  const name = findIngredient(namePart);

  if (FREE_INGREDIENTS.has(name)) return null;
  if (name.length < 2) return null;
  if (name.split(/\s+/).length > 7) return null;

  return { name, amount, unit, raw };
}

/**
 * Filter recipe candidate lines down to those that look like ingredient lines.
 * Stops at the first method/directions header; skips known non-ingredient patterns.
 * @param {string[]} lines
 * @returns {string[]} raw ingredient line texts
 */
function findIngredients(lines) {
  const result = [];
  for (const line of lines) {
    if (STOP_RE.test(line)) break;
    if (SKIP_LINE_RE.test(line)) continue;
    result.push(line);
  }
  return result;
}

/**
 * Split a multi-line recipe text into a structured result.
 * @param {string} text - Raw recipe text (may include title, servings, method).
 * @returns {{ title: string, servings: number, ingredients: Array }}
 */
export function parseRecipeText(text) {
  const allLines = String(text).split('\n').map((l) => l.trim()).filter(Boolean);

  let title = '';
  let servings = 0;
  let titleFound = false;
  const candidateLines = [];

  for (const line of allLines) {
    if (STOP_RE.test(line)) break;

    // Detect servings: "Serves 12", "Makes 24", "Yields 6"
    const servMatch = line.match(/(?:serves?|makes?|yields?)\s+(\d+)/i);
    if (servMatch) { servings = Number(servMatch[1]); continue; }

    // Skip bare "ingredients" heading
    if (/^ingredients?:?$/i.test(line)) continue;

    // Title candidate: first short line with no leading number that isn't a skip line
    if (!titleFound && line.length < 80 && !SKIP_LINE_RE.test(line)) {
      if (!/^\d/.test(expandUnicodeFracs(line))) {
        title = line;
        titleFound = true;
        continue;
      }
    }

    candidateLines.push(line);
  }

  const ingredientLines = findIngredients(candidateLines);
  const ingredients = ingredientLines.map(l => parseIngredientLine(l)).filter(Boolean);

  return { title: title.trim(), servings, ingredients };
}
