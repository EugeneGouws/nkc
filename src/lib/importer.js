// src/lib/importer.js
// High-level recipe import: parse raw text → match ingredients → build recipe object.

import { parseRecipeText } from './parser.js';
import { matchIngredient } from './matcher.js';
import { readFileAsText } from './fileUploader.js';

/**
 * Convert a parsed amount+unit to the pantry item's baseUnit using its conversions map.
 * Returns the original unit/amount unchanged if no conversion is available.
 */
function convertAmount(amount, unit, pantryEntry) {
  if (!pantryEntry) return { convertedUnit: unit, convertedAmount: amount };

  const { baseUnit, conversions } = pantryEntry;

  if (unit === baseUnit) return { convertedUnit: baseUnit, convertedAmount: amount };

  if (conversions && conversions[unit] !== undefined) {
    return {
      convertedUnit: baseUnit,
      convertedAmount: amount * conversions[unit],
    };
  }

  return { convertedUnit: unit, convertedAmount: amount };
}

/**
 * importRecipe(rawText, pantry) → recipe object
 *
 * Parses rawText, matches each ingredient against pantry, and returns a structured
 * recipe with title, servings, raw text, and a list of enriched ingredients.
 *
 * Each ingredient carries:
 *   id              — pantry array index (-1 if unmatched)
 *   name            — raw parsed name (lowercase)
 *   amount          — raw parsed amount
 *   unit            — raw parsed unit
 *   raw             — original unparsed line
 *   matchedIngredient — matched pantry entry id string, or null
 *   confident       — true = auto-assigned, false = needs user disambiguation
 *   candidates      — top match options when not confident (empty when confident)
 *   convertedUnit   — baseUnit of matched pantry item (or raw unit if unmatched)
 *   convertedAmount — amount in convertedUnit (or raw amount if unmatched)
 */
export function importRecipe(rawText, pantry) {
  const { title, servings, ingredients } = parseRecipeText(rawText);

  const enriched = ingredients.map(parsed => {
    const { name, amount, unit, raw } = parsed;
    const { match, confident, candidates } = matchIngredient(name, unit, pantry);

    const pantryIndex = match ? pantry.findIndex(e => e.id === match.id) : -1;
    const { convertedUnit, convertedAmount } = convertAmount(amount, unit, match);

    return {
      id: pantryIndex,
      name,
      amount,
      unit,
      raw,
      matchedIngredient: match?.id ?? null,
      confident,
      candidates,
      convertedUnit,
      convertedAmount,
    };
  });

  const recipe = { title, servings, rawText, ingredients: enriched };
  logRecipe(recipe);
  return recipe;
}

function logRecipe(recipe) {
  console.log(`\n=== ${recipe.title || '(no title)'} — serves ${recipe.servings || '?'} ===`);
  for (const ing of recipe.ingredients) {
    if (ing.matchedIngredient) {
      const status = ing.confident ? '✓' : '?';
      console.log(`  ${status} ${ing.matchedIngredient}  ${ing.convertedAmount}${ing.convertedUnit}`);
    } else {
      console.log(`  ✗ [UNMATCHED] ${ing.name}  ${ing.amount}${ing.unit}`);
    }
  }
  console.log('');
}

/**
 * importFromFile(input, pantry) → Promise<recipe object>
 *
 * Accepts a File (docx/pdf/txt) or a raw text string, extracts the text,
 * then runs the full import pipeline.
 */
export async function importFromFile(input, pantry) {
  const rawText = await readFileAsText(input);
  return importRecipe(rawText, pantry);
}
