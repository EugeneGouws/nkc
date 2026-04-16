/**
 * importer.test.js — Nana's Kitchen Costings
 *
 * Run with:  npx vitest run tests/importer.test.js
 *
 * Tests are organised in three sections:
 *   1. importRecipe — inline raw text (unit tests)
 *   2. importFromFile — actual files from tests/recipeFiles/
 *   3. readFileAsText — passthrough and error cases
 *
 * Note: PDF extraction requires browser DOM APIs (pdfjs-dist).
 *       The pdf test is skipped in this Node environment.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { importRecipe, importFromFile } from '../src/lib/importer.js';
import { readFileAsText } from '../src/lib/fileUploader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pantry = JSON.parse(readFileSync(join(__dirname, '../src/data/pantry.json'), 'utf8'));

// Suppress console.log output from logRecipe during tests
beforeEach(() => { vi.spyOn(console, 'log').mockImplementation(() => {}); });

// Helper: create a File object from a file in tests/recipeFiles/
function recipeFile(filename) {
  const buf = readFileSync(join(__dirname, 'recipeFiles', filename));
  return new File([buf], filename);
}

// ---------------------------------------------------------------------------
// 1. importRecipe — inline raw text
// ---------------------------------------------------------------------------

describe('importRecipe — inline raw text', () => {

  describe('Vanilla Cupcakes (standard English recipe)', () => {
    const raw = `Vanilla Cupcakes
Makes 12

2 cups cake flour
1 tsp baking powder
125g butter
200g castor sugar
2 large eggs
1 tsp vanilla essence
125ml milk`;

    it('extracts title and servings', () => {
      const recipe = importRecipe(raw, pantry);
      expect(recipe.title).toBe('Vanilla Cupcakes');
      expect(recipe.servings).toBe(12);
    });

    it('preserves rawText', () => {
      const recipe = importRecipe(raw, pantry);
      expect(recipe.rawText).toBe(raw);
    });

    it('matches butter confidently', () => {
      const recipe = importRecipe(raw, pantry);
      const butter = recipe.ingredients.find(i => i.name === 'butter');
      expect(butter.matchedIngredient).toBe('butter');
      expect(butter.confident).toBe(true);
      expect(butter.convertedAmount).toBe(125);
      expect(butter.convertedUnit).toBe('g');
    });

    it('matches castor sugar confidently', () => {
      const recipe = importRecipe(raw, pantry);
      const sugar = recipe.ingredients.find(i => i.name === 'castor sugar');
      expect(sugar.matchedIngredient).toBe('castor-sugar');
      expect(sugar.confident).toBe(true);
    });

    it('matches large eggs confidently (adjective alias)', () => {
      const recipe = importRecipe(raw, pantry);
      const eggs = recipe.ingredients.find(i => i.name === 'large eggs');
      expect(eggs.matchedIngredient).toBe('eggs');
      expect(eggs.confident).toBe(true);
    });

    it('matches vanilla essence confidently (alias)', () => {
      const recipe = importRecipe(raw, pantry);
      const vanilla = recipe.ingredients.find(i => i.name === 'vanilla essence');
      expect(vanilla.matchedIngredient).toBe('vanilla-extract');
      expect(vanilla.confident).toBe(true);
    });

    it('converts 2 cups cake flour to grams via pantry conversions', () => {
      const recipe = importRecipe(raw, pantry);
      const flour = recipe.ingredients.find(i => i.name === 'cake flour');
      expect(flour.matchedIngredient).toBe('cake-flour');
      expect(flour.convertedAmount).toBe(240);   // 2 × 120g per cup
      expect(flour.convertedUnit).toBe('g');
    });
  });

  describe('Chocolate Brownies (aliases and abbreviations)', () => {
    const raw = `Chocolate Brownies
Serves 16

200g dark choc
125g butter
300g sugar
3 eggs
1 tsp vanilla essence
120g cake flour
30g cocoa powder
2ml bicarb`;

    it('matches dark choc to dark-chocolate', () => {
      const recipe = importRecipe(raw, pantry);
      const choc = recipe.ingredients.find(i => i.name === 'dark choc');
      expect(choc.matchedIngredient).toBe('dark-chocolate');
    });

    it('matches bicarb confidently', () => {
      const recipe = importRecipe(raw, pantry);
      const bicarb = recipe.ingredients.find(i => i.name === 'bicarb');
      expect(bicarb.matchedIngredient).toBe('bicarbonate-of-soda');
      expect(bicarb.confident).toBe(true);
    });

    it('resolves servings', () => {
      const recipe = importRecipe(raw, pantry);
      expect(recipe.servings).toBe(16);
    });
  });

  describe('Soetkoekies (Afrikaans recipe — mixed match)', () => {
    const raw = `Soetkoekies
115g Botter of Rama of Stork bake
200g Wit suiker
1 Eier
30ml Melk
5ml Geursel
350g Koekmeel
10ml Bakpoeier
2ml Sout`;

    it('extracts title', () => {
      const recipe = importRecipe(raw, pantry);
      expect(recipe.title).toBe('Soetkoekies');
    });

    it('matches koekmeel (Afrikaans alias for cake flour)', () => {
      const recipe = importRecipe(raw, pantry);
      const flour = recipe.ingredients.find(i => i.name === 'koekmeel');
      expect(flour.matchedIngredient).toBe('cake-flour');
    });

    it('returns ingredients array with correct shape for unmatched items', () => {
      const recipe = importRecipe(raw, pantry);
      for (const ing of recipe.ingredients) {
        expect(ing).toHaveProperty('name');
        expect(ing).toHaveProperty('amount');
        expect(ing).toHaveProperty('unit');
        expect(ing).toHaveProperty('matchedIngredient');
        expect(ing).toHaveProperty('confident');
        expect(ing).toHaveProperty('candidates');
        expect(ing).toHaveProperty('convertedUnit');
        expect(ing).toHaveProperty('convertedAmount');
      }
    });

    it('unmatched ingredients fall back to raw amount and unit', () => {
      const recipe = importRecipe(raw, pantry);
      const unmatched = recipe.ingredients.filter(i => !i.matchedIngredient);
      for (const ing of unmatched) {
        expect(ing.convertedAmount).toBe(ing.amount);
        expect(ing.convertedUnit).toBe(ing.unit);
        expect(ing.id).toBe(-1);
      }
    });
  });

  describe('Recipe with no matches', () => {
    const raw = `Mystery Dish
Serves 4
200g xyzzy
100ml frobblezork`;

    it('returns match: null for unknown ingredients', () => {
      const recipe = importRecipe(raw, pantry);
      expect(recipe.ingredients.every(i => i.matchedIngredient === null)).toBe(true);
    });

    it('still returns a valid recipe object', () => {
      const recipe = importRecipe(raw, pantry);
      expect(recipe.title).toBe('Mystery Dish');
      expect(recipe.servings).toBe(4);
      expect(Array.isArray(recipe.ingredients)).toBe(true);
    });
  });

  describe('Importer enrichment details', () => {
    it('preserves the pantry array index for matched ingredients', () => {
      const raw = `Butter Test\nServes 1\n\n125g butter`;
      const recipe = importRecipe(raw, pantry);
      const butter = recipe.ingredients[0];

      expect(butter.matchedIngredient).toBe('butter');
      expect(butter.id).toBe(pantry.findIndex((item) => item.id === 'butter'));
    });

    it('keeps raw amount and unit when a matched ingredient has no conversion for that unit', () => {
      const raw = `Conversion Gap\nServes 1\n\n2 each butter`;
      const recipe = importRecipe(raw, pantry);
      const butter = recipe.ingredients[0];

      expect(butter.matchedIngredient).toBe('butter');
      expect(butter.convertedAmount).toBe(2);
      expect(butter.convertedUnit).toBe('each');
    });

    it('returns disambiguation candidates for non-confident matches', () => {
      const raw = `Ambiguous Sugar\nServes 1\n\n100g dark sugar`;
      const recipe = importRecipe(raw, pantry);
      const sugar = recipe.ingredients[0];

      expect(sugar.matchedIngredient).toBeTruthy();
      expect(sugar.confident).toBe(false);
      expect(sugar.candidates.length).toBeGreaterThanOrEqual(2);
      expect(sugar.candidates[0]).toHaveProperty('entry');
      expect(sugar.candidates[0]).toHaveProperty('score');
    });
  });
});

// ---------------------------------------------------------------------------
// 2. importFromFile — actual files from tests/recipeFiles/
// ---------------------------------------------------------------------------

describe('importFromFile — txt files', () => {

  it('Chicken soup.txt — returns a recipe object', async () => {
    const file = recipeFile('Chicken soup.txt');
    const recipe = await importFromFile(file, pantry);
    expect(recipe).toHaveProperty('title');
    expect(recipe).toHaveProperty('servings');
    expect(Array.isArray(recipe.ingredients)).toBe(true);
    expect(recipe.rawText.length).toBeGreaterThan(0);
  });

  it('Soft and chewy cookies.txt (Soetkoekies) — matches koekmeel', async () => {
    const file = recipeFile('Soft and chewy cookies.txt');
    const recipe = await importFromFile(file, pantry);
    const flour = recipe.ingredients.find(i => i.name === 'koekmeel');
    expect(flour).toBeDefined();
    expect(flour.matchedIngredient).toBe('cake-flour');
  });

  it('Soft and chewy cookies.txt — title is Soetkoekies', async () => {
    const file = recipeFile('Soft and chewy cookies.txt');
    const recipe = await importFromFile(file, pantry);
    expect(recipe.title).toBe('Soetkoekies');
  });
});

describe('importFromFile — docx files', () => {

  it('Homemade Oreos.docx — title contains Oreos', async () => {
    const file = recipeFile('Homemade Oreos.docx');
    const recipe = await importFromFile(file, pantry);
    expect(recipe.title.toLowerCase()).toContain('oreo');
  });

  it('Homemade Oreos.docx — matches butter and vanilla extract', async () => {
    const file = recipeFile('Homemade Oreos.docx');
    const recipe = await importFromFile(file, pantry);
    const butter = recipe.ingredients.find(i => i.matchedIngredient === 'butter');
    const vanilla = recipe.ingredients.find(i => i.matchedIngredient === 'vanilla-extract');
    expect(butter).toBeDefined();
    expect(vanilla).toBeDefined();
  });

  it('Homemade Oreos.docx — matches granulated sugar (white-sugar)', async () => {
    const file = recipeFile('Homemade Oreos.docx');
    const recipe = await importFromFile(file, pantry);
    const sugar = recipe.ingredients.find(i => i.matchedIngredient === 'white-sugar');
    expect(sugar).toBeDefined();
  });

  it('Homemade Oreos.docx — matches baking soda (bicarbonate-of-soda)', async () => {
    const file = recipeFile('Homemade Oreos.docx');
    const recipe = await importFromFile(file, pantry);
    const bicarb = recipe.ingredients.find(i => i.matchedIngredient === 'bicarbonate-of-soda');
    expect(bicarb).toBeDefined();
  });

  it('Crazy Easy Cupcakes.docx — title contains Cupcake', async () => {
    const file = recipeFile('Crazy Easy Cupcakes.docx');
    const recipe = await importFromFile(file, pantry);
    expect(recipe.title.toLowerCase()).toContain('cupcake');
  });

  it('Crazy Easy Cupcakes.docx — matches cake flour and baking powder', async () => {
    const file = recipeFile('Crazy Easy Cupcakes.docx');
    const recipe = await importFromFile(file, pantry);
    const flour = recipe.ingredients.find(i => i.matchedIngredient === 'cake-flour');
    const bp = recipe.ingredients.find(i => i.matchedIngredient === 'baking-powder');
    expect(flour).toBeDefined();
    expect(bp).toBeDefined();
  });

  it('Crazy Easy Cupcakes.docx — detects servings', async () => {
    const file = recipeFile('Crazy Easy Cupcakes.docx');
    const recipe = await importFromFile(file, pantry);
    // No explicit serves/makes line in this recipe — servings may be 0
    expect(typeof recipe.servings).toBe('number');
  });
});

describe('importFromFile — pdf (browser only)', () => {
  it.skip('soft chewy cookies.pdf — requires browser DOM (pdfjs-dist)', async () => {
    const file = recipeFile('soft chewy cookies.pdf');
    const recipe = await importFromFile(file, pantry);
    expect(Array.isArray(recipe.ingredients)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. readFileAsText — passthrough and error cases
// ---------------------------------------------------------------------------

describe('readFileAsText', () => {
  it('returns a string unchanged when given a string', async () => {
    const text = '250g butter\n2 eggs';
    expect(await readFileAsText(text)).toBe(text);
  });

  it('throws for unsupported file extension', async () => {
    const file = new File(['data'], 'recipe.odt');
    await expect(readFileAsText(file)).rejects.toThrow('Unsupported file type: .odt');
  });

  it('reads a txt file correctly', async () => {
    const file = recipeFile('Soft and chewy cookies.txt');
    const text = await readFileAsText(file);
    expect(typeof text).toBe('string');
    expect(text).toContain('Koekmeel');
  });

  it('treats file extensions case-insensitively', async () => {
    const file = new File(['Hello recipe'], 'RECIPE.TXT');
    await expect(readFileAsText(file)).resolves.toBe('Hello recipe');
  });
});
