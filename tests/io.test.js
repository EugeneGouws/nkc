import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readRecipes, saveRecipe, readPantry } from '../src/io/index.js';
import { importRecipe, importFinished } from '../src/lib/index.js';
import pantry from '../src/data/pantry.json';

/**
 * Mock localStorage for testing.
 */
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

global.localStorage = localStorageMock;

beforeEach(() => {
  localStorage.clear();
  // Pre-populate with empty list to bypass seed-on-first-load for recipe tests.
  localStorage.setItem('local_recipes', '[]');
});

describe('recipeStore', () => {
  it('readRecipes seeds from recipes.json when storage is empty', () => {
    localStorage.removeItem('local_recipes');  // simulate truly empty storage
    const recipes = readRecipes();
    expect(Array.isArray(recipes)).toBe(true);
    expect(recipes.length).toBeGreaterThan(0);  // seed data loaded
  });

  it('readRecipes falls back to seed data when stored JSON is malformed', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem('local_recipes', '{not-valid-json');

    const recipes = readRecipes();
    expect(Array.isArray(recipes)).toBe(true);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('readRecipes returns empty array when storage has an explicit empty list', () => {
    // beforeEach already sets local_recipes: [] — verify it returns []
    const recipes = readRecipes();
    expect(recipes).toEqual([]);
  });

  it('importFinished wraps importer output and adds metadata', () => {
    const raw = `Vanilla Cupcakes\nServings: 12\n\n2 cups cake flour\n1 cup white sugar\n2 eggs`;
    const imported = importRecipe(raw, pantry);

    const before = readRecipes();
    const after = importFinished(imported, { collection: 'Test', favorite: true });

    expect(before).toEqual([]);
    expect(after).toHaveLength(1);

    const storedRecipe = after[0];
    expect(storedRecipe.title).toBe('Vanilla Cupcakes');
    expect(storedRecipe.favorite).toBe(true);
    expect(storedRecipe.collection).toBe('Test');
    expect(storedRecipe.id).toBeTruthy();
    expect(storedRecipe.dateAdded).toMatch(/^\d{4}-\d{2}-\d{2}$/); // YYYY-MM-DD
    expect(storedRecipe.ingredients).toBeTruthy();
    expect(storedRecipe.rawText).toBe(raw);
  });

  it('importFinished defaults to favorite=false, collection=""', () => {
    const raw = `Simple Cake\nServings: 1\n\n1 cup sugar`;
    const imported = importRecipe(raw, pantry);
    const after = importFinished(imported);

    const storedRecipe = after[0];
    expect(storedRecipe.favorite).toBe(false);
    expect(storedRecipe.collection).toBe('');
  });

  it('importFinished uses crypto.randomUUID and today for generated metadata', () => {
    const raw = `Simple Cake\nServings: 1\n\n1 cup sugar`;
    const imported = importRecipe(raw, pantry);
    const uuidSpy = vi.spyOn(global.crypto, 'randomUUID').mockReturnValue('test-uuid');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-09T12:00:00Z'));

    const after = importFinished(imported, { collection: 'Tagged' });

    expect(after[0].id).toBe('test-uuid');
    expect(after[0].dateAdded).toBe('2026-04-09');
    expect(after[0].collection).toBe('Tagged');

    uuidSpy.mockRestore();
    vi.useRealTimers();
  });

  it('saveRecipe recovers from malformed stored data and still adds the recipe', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem('local_recipes', 'not-json');

    const recipe = {
      id: 'recipe-1',
      title: 'Recovered Recipe',
      servings: 2,
      rawText: 'raw',
      ingredients: [],
      favorite: false,
      collection: '',
      dateAdded: '2026-04-09',
    };

    const result = saveRecipe(recipe);

    // Falls back to seed data + new recipe on parse error
    expect(result.some(r => r.id === 'recipe-1')).toBe(true);
    expect(readRecipes().some(r => r.id === 'recipe-1')).toBe(true);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('saveRecipe appends to storage and returns updated array', () => {
    const recipe1 = {
      id: 'recipe-1',
      title: 'Recipe 1',
      servings: 2,
      rawText: 'raw',
      ingredients: [],
      favorite: false,
      collection: '',
      dateAdded: '2026-04-09',
    };

    const result = saveRecipe(recipe1);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(recipe1);

    const recipe2 = {
      id: 'recipe-2',
      title: 'Recipe 2',
      servings: 4,
      rawText: 'raw2',
      ingredients: [],
      favorite: true,
      collection: 'Holiday',
      dateAdded: '2026-04-08',
    };

    const result2 = saveRecipe(recipe2);
    expect(result2).toHaveLength(2);
    expect(result2[0].title).toBe('Recipe 1');
    expect(result2[1].title).toBe('Recipe 2');
  });

  it('readRecipes returns previously saved recipes', () => {
    const raw = `Test Recipe\nServings: 1\n\n1 cup sugar`;
    const imported = importRecipe(raw, pantry);
    importFinished(imported);

    const savedRecipes = readRecipes();
    expect(savedRecipes).toHaveLength(1);
    expect(savedRecipes[0].title).toBe('Test Recipe');
  });

  it('persists a fully imported recipe with converted base quantities and skips non-ingredient lines', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const uuidSpy = vi.spyOn(global.crypto, 'randomUUID').mockReturnValue('recipe-e2e');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-11T10:00:00Z'));

    const raw = `Chaos Cookies
Makes 8

Ingredients:
- 1 1/2 cups plain flour
- 1 cup margarine or butter
- one and a half tsp bicarb
- 2 tbsp vanilla essence
- 3/4 cup granulated sugar
- 2 tbsp whole milk
- 1/4 tsp sea salt
- 1 cup water
- salt to taste
For the topping
Method
Preheat the oven to 180 C
Mix until combined`;

    const imported = importRecipe(raw, pantry);
    const storedRecipes = importFinished(imported, { collection: 'Import flow', favorite: true });
    const savedRecipes = readRecipes();

    expect(storedRecipes).toHaveLength(1);
    expect(savedRecipes).toEqual(storedRecipes);

    const storedRecipe = savedRecipes[0];
    expect(storedRecipe.id).toBe('recipe-e2e');
    expect(storedRecipe.title).toBe('Chaos Cookies');
    expect(storedRecipe.servings).toBe(8);
    expect(storedRecipe.favorite).toBe(true);
    expect(storedRecipe.collection).toBe('Import flow');
    expect(storedRecipe.dateAdded).toBe('2026-04-11');
    expect(storedRecipe.ingredients).toHaveLength(7);
    expect(storedRecipe.ingredients.some((ing) => ing.name === 'water')).toBe(false);
    expect(storedRecipe.ingredients.some((ing) => ing.raw === 'For the topping')).toBe(false);
    expect(storedRecipe.ingredients.some((ing) => ing.raw === 'Preheat the oven to 180 C')).toBe(false);

    expect(storedRecipe.ingredients).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'plain flour',
        matchedIngredient: 'cake-flour',
        confident: true,
        convertedAmount: 180,
        convertedUnit: 'g',
      }),
      expect.objectContaining({
        name: 'margarine or butter',
        matchedIngredient: 'butter',
        confident: false,
        convertedAmount: 227,
        convertedUnit: 'g',
      }),
      expect.objectContaining({
        name: 'bicarb',
        matchedIngredient: 'bicarbonate-of-soda',
        confident: true,
        convertedAmount: 7.5,
        convertedUnit: 'ml',
      }),
      expect.objectContaining({
        name: 'vanilla essence',
        matchedIngredient: 'vanilla-extract',
        confident: true,
        convertedAmount: 30,
        convertedUnit: 'ml',
      }),
      expect.objectContaining({
        name: 'granulated sugar',
        matchedIngredient: 'white-sugar',
        confident: true,
        convertedAmount: 150,
        convertedUnit: 'g',
      }),
      expect.objectContaining({
        name: 'whole milk',
        matchedIngredient: 'milk',
        confident: true,
        convertedAmount: 30,
        convertedUnit: 'ml',
      }),
      expect.objectContaining({
        name: 'sea salt',
        matchedIngredient: 'salt',
        confident: true,
        convertedAmount: 1.5,
        convertedUnit: 'g',
      }),
    ]));

    expect(localStorage.getItem('local_recipes')).toContain('"convertedUnit":"g"');
    expect(localStorage.getItem('local_recipes')).toContain('"convertedUnit":"ml"');

    uuidSpy.mockRestore();
    vi.useRealTimers();
  });
});

describe('pantryStore', () => {
  it('readPantry returns the full pantry array', () => {
    const full = readPantry();
    expect(Array.isArray(full)).toBe(true);
    expect(full.length).toBeGreaterThan(0);
    expect(full[0]).toHaveProperty('id');
    expect(full[0]).toHaveProperty('canonicalName');
  });

});
