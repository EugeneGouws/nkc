// src/lib/matcher.js
// Two-phase fuzzy matcher: resolves parsed ingredient names to pantry entries.

// --- Helpers ---

function trigrams(str) {
  const s = ` ${str.toLowerCase()} `;
  const result = new Set();
  for (let i = 0; i < s.length - 2; i++) {
    result.add(s.slice(i, i + 3));
  }
  return result;
}

function jaccardSim(a, b) {
  const ta = trigrams(a);
  const tb = trigrams(b);
  let intersection = 0;
  for (const t of ta) {
    if (tb.has(t)) intersection++;
  }
  const union = ta.size + tb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function bestAliasScore(query, aliases) {
  let best = 0;
  for (const alias of aliases) {
    const s = jaccardSim(query, alias);
    if (s > best) best = s;
  }
  return best;
}

function unitFamily(unit) {
  if (['g', 'kg'].includes(unit)) return 'mass';
  if (['ml', 'l', 'cup', 'tbsp', 'tsp'].includes(unit)) return 'volume';
  if (['each', 'piece'].includes(unit)) return 'count';
  return 'other';
}

// --- Exports ---

/**
 * findCandidates(name, pantry) → [{ entry, score }]
 *
 * Phase 1: exact alias match → score 1.0
 * Phase 2: Jaccard trigram similarity for all remaining entries
 * Returns up to 5 candidates sorted by score descending.
 */
export function findCandidates(name, pantry) {
  const query = name.toLowerCase().trim();
  const exactIds = new Set();
  const results = [];

  // Phase 1 — exact alias match
  for (const entry of pantry) {
    if (entry.aliases.some(a => a.toLowerCase() === query)) {
      results.push({ entry, score: 1.0 });
      exactIds.add(entry.id);
    }
  }

  // Phase 2 — fuzzy for entries not already scored 1.0
  for (const entry of pantry) {
    if (exactIds.has(entry.id)) continue;
    const score = bestAliasScore(query, entry.aliases);
    if (score > 0) results.push({ entry, score });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 5);
}

/**
 * matchIngredient(name, unit, pantry) → { match, confident, candidates }
 *
 * match      — best PantryItem, or null if no plausible match (all scores < 0.2)
 * confident  — true = unambiguous, UI can auto-assign
 * candidates — empty when confident; top-5 list when not confident (for picker UI)
 */
export function matchIngredient(name, unit, pantry) {
  const candidates = findCandidates(name, pantry);

  if (candidates.length === 0 || candidates[0].score < 0.2) {
    return { match: null, confident: false, candidates: [] };
  }

  const top = candidates[0];
  const gap = top.score - (candidates[1]?.score ?? 0);
  let confident = top.score >= 0.85 && gap > 0.15;

  // Unit family penalty: cross-family mismatch breaks confidence
  if (confident && unitFamily(unit) !== 'other') {
    if (unitFamily(unit) !== unitFamily(top.entry.baseUnit)) {
      confident = false;
    }
  }

  if (confident) {
    return { match: top.entry, confident: true, needsConfirm: false, candidates: [] };
  }

  // Mid-confidence band: show best guess inline for user confirmation
  const needsConfirm = top.score >= 0.5;
  return { match: top.entry, confident: false, needsConfirm, candidates };
}
