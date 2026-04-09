// src/lib/aiMatcher.js
// AI-assisted ingredient matching — second pass for !confident ingredients only.
// Called after importRecipe(). Promotes unconfident ingredients to confident where possible.

import { resolveIngredientLine } from './importer.js';

// ─── AI PROMPT ────────────────────────────────────────────────────────────────
const PROMPT = (rawLine) =>
  `You are a recipe parsing assistant. Rewrite the following ingredient line \
using standard English names and common baking units (g, ml, cup, tsp, tbsp, kg, l). \
Return ONLY the reformatted ingredient line — no explanation, no punctuation.

Ingredient: ${rawLine}`;
// ──────────────────────────────────────────────────────────────────────────────

const OLLAMA_URL    = 'http://localhost:11434/api/generate';
const OLLAMA_MODEL  = 'qwen2.5:1.5b';
const AI_TIMEOUT_MS = 8000;

/**
 * Detects which AI backend is available.
 * Checks Gemini Nano (Chrome) first, then local Ollama.
 * @returns {Promise<'gemini-nano'|'ollama'|null>}
 */
export async function detectAIBackend() {
  // Gemini Nano — Chrome only
  if (typeof window !== 'undefined' && window.ai?.languageModel) {
    try {
      const cap = await window.ai.languageModel.capabilities();
      if (cap.available === 'readily') return 'gemini-nano';
    } catch {
      // not available
    }
  }

  // Ollama local server
  try {
    const signal = AbortSignal.timeout(1000);
    const res = await fetch('http://localhost:11434/api/tags', { signal });
    if (res.ok) return 'ollama';
  } catch {
    // not running
  }

  return null;
}

/**
 * Sends a raw ingredient line to the active AI backend for normalisation.
 * Returns the original line unchanged if AI is unavailable or fails.
 * @param {string} rawLine
 * @param {'gemini-nano'|'ollama'} backend
 * @returns {Promise<string>}
 */
async function promptIngredient(rawLine, backend) {
  const promptText = PROMPT(rawLine);

  try {
    if (backend === 'gemini-nano') {
      const session = await window.ai.languageModel.create();
      const result = await Promise.race([
        session.prompt(promptText),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), AI_TIMEOUT_MS)),
      ]);
      session.destroy();
      return result.trim();
    }

    if (backend === 'ollama') {
      const signal = AbortSignal.timeout(AI_TIMEOUT_MS);
      const res = await fetch(OLLAMA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: OLLAMA_MODEL, prompt: promptText, stream: false }),
        signal,
      });
      const json = await res.json();
      return json.response.trim();
    }
  } catch {
    // fall through to safe return
  }

  return rawLine;
}

/**
 * AI second pass — upgrades unconfident ingredients using AI normalisation.
 * Only ingredients with confident === false are sent to AI.
 * Fires all prompts concurrently (Promise.all).
 *
 * Outcomes per ingredient:
 *   aiResolved: true  — AI produced a confident match; ingredient updated
 *   needsManual: true — AI tried and failed; UI must ask the user to correct it
 *
 * @param {Object} recipe — output of importRecipe()
 * @param {Array}  pantry — PantryItem[]
 * @returns {Promise<Object>} recipe with ingredients updated in-place by index
 */
export async function AIMatchIngredient(recipe, pantry) {
  // Track unconfident ingredients with their original array indices
  const unconfidentWithIdx = recipe.ingredients
    .map((ing, i) => ({ ing, i }))
    .filter(({ ing }) => !ing.confident);

  if (unconfidentWithIdx.length === 0) return recipe;

  const backend = await detectAIBackend();
  if (!backend) return recipe;

  const resolved = await Promise.all(
    unconfidentWithIdx.map(async ({ ing, i }) => {
      const aiText = await promptIngredient(ing.raw, backend);
      const result = resolveIngredientLine(aiText, pantry);

      if (!result || !result.confident) {
        // AI could not produce a confident match — flag for manual correction
        return { i, updated: { ...ing, needsManual: true } };
      }

      const pantryIdx = pantry.findIndex(e => e.id === result.matchedIngredient);
      return {
        i,
        updated: {
          ...ing,                              // preserve raw and original name/amount/unit
          id: pantryIdx,
          matchedIngredient: result.matchedIngredient,
          confident: true,
          candidates: [],
          convertedUnit: result.convertedUnit,
          convertedAmount: result.convertedAmount,
          aiResolved: true,
        },
      };
    })
  );

  // Merge back by original array index — safe even when multiple unmatched ingredients share the same name
  const mergedIngredients = [...recipe.ingredients];
  resolved.forEach(({ i, updated }) => { mergedIngredients[i] = updated; });

  return { ...recipe, ingredients: mergedIngredients };
}
