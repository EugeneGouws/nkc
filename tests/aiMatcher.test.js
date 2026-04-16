import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { AIMatchIngredient, detectAIBackend } from '../src/lib/aiMatcher.js';
import { importRecipe } from '../src/lib/importer.js';
import { parseIngredientLine } from '../src/lib/parser.js';
import { matchIngredient } from '../src/lib/matcher.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pantry = JSON.parse(readFileSync(join(__dirname, '../src/data/pantry.json'), 'utf8'));

const originalWindow = global.window;
const originalFetch = global.fetch;

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  delete global.window;
  global.fetch = vi.fn();
});

afterEach(() => {
  if (originalWindow === undefined) {
    delete global.window;
  } else {
    global.window = originalWindow;
  }

  if (originalFetch === undefined) {
    delete global.fetch;
  } else {
    global.fetch = originalFetch;
  }
});

describe('detectAIBackend', () => {
  it('prefers gemini-nano when Chrome AI is readily available', async () => {
    global.window = {
      ai: {
        languageModel: {
          capabilities: vi.fn().mockResolvedValue({ available: 'readily' }),
        },
      },
    };

    const backend = await detectAIBackend();

    expect(backend).toBe('gemini-nano');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('falls back to ollama when Gemini is unavailable and local Ollama responds', async () => {
    global.window = {
      ai: {
        languageModel: {
          capabilities: vi.fn().mockResolvedValue({ available: 'no' }),
        },
      },
    };
    global.fetch.mockResolvedValue({ ok: true });

    const backend = await detectAIBackend();

    expect(backend).toBe('ollama');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toContain('/api/tags');
  });

  it('returns null when neither Gemini nor Ollama is available', async () => {
    global.fetch.mockRejectedValue(new Error('offline'));

    const backend = await detectAIBackend();

    expect(backend).toBeNull();
  });
});

describe('AIMatchIngredient', () => {
  it('returns the recipe unchanged when every ingredient is already confident', async () => {
    const recipe = importRecipe(`Simple Butter Cake\nServes 2\n125g butter\n2 eggs`, pantry);

    const result = await AIMatchIngredient(recipe, pantry);

    expect(result).toEqual(recipe);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('upgrades only unconfident ingredients by reparsing and rematching AI-normalized text', async () => {
    const raw = `AI Rescue Cake\nServes 4\n125g butter\n100g donker suiker\n1 egg`;
    const recipe = importRecipe(raw, pantry);
    const beforeAi = recipe.ingredients.find((ingredient) => ingredient.name === 'donker suiker');
    const stable = recipe.ingredients.find((ingredient) => ingredient.name === 'butter');
    const aiLine = '100g brown sugar';

    expect(beforeAi.matchedIngredient).toBeNull();
    expect(beforeAi.confident).toBe(false);
    expect(stable.matchedIngredient).toBe('butter');
    expect(stable.confident).toBe(true);

    const reparsed = parseIngredientLine(aiLine);
    const rematched = matchIngredient(reparsed.name, reparsed.unit, pantry);
    expect(reparsed).toMatchObject({ name: 'brown sugar', amount: 100, unit: 'g' });
    expect(rematched.match.id).toBe('brown-sugar');
    expect(rematched.confident).toBe(true);

    global.fetch.mockImplementation((url, options) => {
      if (String(url).includes('/api/tags')) {
        return Promise.resolve({ ok: true });
      }

      if (String(url).includes('/api/generate')) {
        expect(options.method).toBe('POST');
        expect(options.body).toContain('100g donker suiker');
        return Promise.resolve({
          json: async () => ({ response: aiLine }),
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await AIMatchIngredient(recipe, pantry);
    const rescued = result.ingredients.find((ingredient) => ingredient.name === 'donker suiker');
    const butter = result.ingredients.find((ingredient) => ingredient.name === 'butter');

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(rescued.matchedIngredient).toBe(rematched.match.id);
    expect(rescued.confident).toBe(true);
    expect(rescued.candidates).toEqual([]);
    expect(rescued.convertedUnit).toBe('g');
    expect(rescued.convertedAmount).toBe(100);
    expect(rescued.aiResolved).toBe(true);
    expect(rescued.name).toBe('donker suiker');
    expect(rescued.raw).toBe('100g donker suiker');
    expect(butter).toEqual(stable);
  });

  it('leaves an ingredient unchanged when AI returns text that still cannot be parsed into a confident match', async () => {
    const raw = `Second Pass Fails\nServes 3\n125g butter\n5ml geursel\n1 egg`;
    const recipe = importRecipe(raw, pantry);
    const beforeAi = recipe.ingredients.find((ingredient) => ingredient.name === 'geursel');

    expect(beforeAi.matchedIngredient).toBeNull();
    expect(beforeAi.confident).toBe(false);

    global.fetch.mockImplementation((url) => {
      if (String(url).includes('/api/tags')) {
        return Promise.resolve({ ok: true });
      }

      if (String(url).includes('/api/generate')) {
        return Promise.resolve({
          json: async () => ({ response: 'a splash of something nice' }),
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await AIMatchIngredient(recipe, pantry);
    const afterAi = result.ingredients.find((ingredient) => ingredient.name === 'geursel');

    expect(afterAi).toEqual({ ...beforeAi, needsManual: true });
  });

  it('runs the full lifecycle for multiple AI candidates and upgrades only the line whose returned text becomes confident', async () => {
    const raw = `Mixed Rescue Batch\nServes 6\n125g butter\n100g donker suiker\n30ml melk\n1 egg`;
    const recipe = importRecipe(raw, pantry);

    const beforeSugar = recipe.ingredients.find((ingredient) => ingredient.name === 'donker suiker');
    const beforeMilk = recipe.ingredients.find((ingredient) => ingredient.name === 'melk');
    expect(beforeSugar.matchedIngredient).toBeNull();
    expect(beforeMilk.confident).toBe(false);

    global.fetch.mockImplementation((url, options) => {
      if (String(url).includes('/api/tags')) {
        return Promise.resolve({ ok: true });
      }

      if (String(url).includes('/api/generate')) {
        const body = String(options.body);
        if (body.includes('100g donker suiker')) {
          return Promise.resolve({
            json: async () => ({ response: '100g brown sugar' }),
          });
        }

        if (body.includes('30ml melk')) {
          return Promise.resolve({
            json: async () => ({ response: '30ml milk' }),
          });
        }
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    const result = await AIMatchIngredient(recipe, pantry);
    const sugar = result.ingredients.find((ingredient) => ingredient.name === 'donker suiker');
    const milk = result.ingredients.find((ingredient) => ingredient.name === 'melk');
    const butter = result.ingredients.find((ingredient) => ingredient.name === 'butter');

    const reparsedSugar = parseIngredientLine('100g brown sugar');
    const reparsedMilk = parseIngredientLine('30ml milk');
    const rematchedSugar = matchIngredient(reparsedSugar.name, reparsedSugar.unit, pantry);
    const rematchedMilk = matchIngredient(reparsedMilk.name, reparsedMilk.unit, pantry);

    expect(rematchedSugar.confident).toBe(true);
    expect(rematchedMilk.confident).toBe(true);

    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(sugar.matchedIngredient).toBe('brown-sugar');
    expect(sugar.confident).toBe(true);
    expect(sugar.aiResolved).toBe(true);
    expect(milk.matchedIngredient).toBe('milk');
    expect(milk.confident).toBe(true);
    expect(milk.aiResolved).toBe(true);
    expect(butter.matchedIngredient).toBe('butter');
    expect(butter.aiResolved).toBeUndefined();
  });
});
