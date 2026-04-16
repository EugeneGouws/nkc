import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { dirname, join, extname } from 'path';
import { fileURLToPath } from 'url';
import { importFromFile } from '../src/lib/importer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pantry = JSON.parse(readFileSync(join(__dirname, '../src/data/pantry.json'), 'utf8'));
const recipeFilesDir = join(__dirname, 'recipeFiles');

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

function listImportableRecipeFiles() {
  return readdirSync(recipeFilesDir)
    .filter((name) => ['.txt', '.docx'].includes(extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b));
}

function recipeFile(filename) {
  const buf = readFileSync(join(recipeFilesDir, filename));
  return new File([buf], filename);
}

async function importRecipeSummaries() {
  const summaries = [];

  for (const filename of listImportableRecipeFiles()) {
    const recipe = await importFromFile(recipeFile(filename), pantry);
    summaries.push({
      source: filename,
      title: recipe.title,
      servings: recipe.servings,
      ingredients: recipe.ingredients
        .map((ingredient) => ({
          name: ingredient.name,
          amount: ingredient.amount,
          unit: ingredient.unit,
          matchedIngredient: ingredient.matchedIngredient,
          confident: ingredient.confident,
          convertedAmount: ingredient.convertedAmount,
          convertedUnit: ingredient.convertedUnit,
        })),
    });
  }

  return summaries;
}

describe('importer integration across recipeFiles txt/docx fixtures', () => {
  it('returns the recipe summaries with title, servings, confidence, and parsed/matched amounts', async () => {
    await expect(importRecipeSummaries()).resolves.toEqual([
      {
        source: 'Chicken soup.txt',
        title: 'water to cover',
        servings: 10,
        ingredients: [
          { name: 'chicken', amount: 1, unit: 'each', matchedIngredient: null, confident: false, convertedAmount: 1, convertedUnit: 'each' },
          { name: 'carrots', amount: 4, unit: 'each', matchedIngredient: 'carrots', confident: false, convertedAmount: 4, convertedUnit: 'each' },
          { name: 'stalks celery', amount: 4, unit: 'each', matchedIngredient: null, confident: false, convertedAmount: 4, convertedUnit: 'each' },
          { name: 'large onion', amount: 1, unit: 'each', matchedIngredient: 'eggs', confident: false, convertedAmount: 1, convertedUnit: 'each' },
          { name: 'chicken bouillon granules', amount: 1, unit: 'tsp', matchedIngredient: null, confident: false, convertedAmount: 1, convertedUnit: 'tsp' },
        ],
      },
      {
        source: 'Crazy Easy Cupcakes.docx',
        title: 'Crazy Easy Cupcakes',
        servings: 0,
        ingredients: [
          { name: 'sugar', amount: 1, unit: 'cup', matchedIngredient: 'white-sugar', confident: false, convertedAmount: 200, convertedUnit: 'g' },
          { name: 'margarine or butter', amount: 1, unit: 'cup', matchedIngredient: 'butter', confident: false, convertedAmount: 227, convertedUnit: 'g' },
          { name: 'extra large eggs', amount: 4, unit: 'each', matchedIngredient: 'eggs', confident: true, convertedAmount: 4, convertedUnit: 'each' },
          { name: 'cake flour', amount: 2, unit: 'cup', matchedIngredient: 'cake-flour', confident: false, convertedAmount: 240, convertedUnit: 'g' },
          { name: 'baking powder', amount: 1, unit: 'tsp', matchedIngredient: 'baking-powder', confident: true, convertedAmount: 1, convertedUnit: 'ml' },
          { name: 'salt', amount: 0.25, unit: 'tsp', matchedIngredient: 'salt', confident: false, convertedAmount: 1.5, convertedUnit: 'g' },
          { name: 'milk', amount: 2, unit: 'tbsp', matchedIngredient: 'milk', confident: true, convertedAmount: 30, convertedUnit: 'ml' },
          { name: 'vanilla', amount: 1, unit: 'tsp', matchedIngredient: 'vanilla-extract', confident: true, convertedAmount: 1, convertedUnit: 'ml' },
        ],
      },
      {
        source: 'Homemade Oreos.docx',
        title: 'Homemade Oreos',
        servings: 0,
        ingredients: [
          { name: 'baking soda', amount: 1, unit: 'tsp', matchedIngredient: 'bicarbonate-of-soda', confident: true, convertedAmount: 1, convertedUnit: 'ml' },
          { name: 'salt', amount: 0.125, unit: 'tsp', matchedIngredient: 'salt', confident: false, convertedAmount: 0.75, convertedUnit: 'g' },
          { name: 'unsalted butter', amount: 0.5, unit: 'cup', matchedIngredient: 'butter', confident: false, convertedAmount: 113.5, convertedUnit: 'g' },
          { name: 'granulated sugar', amount: 0.75, unit: 'cup', matchedIngredient: 'white-sugar', confident: false, convertedAmount: 150, convertedUnit: 'g' },
          { name: 'packed light brown sugar', amount: 0.25, unit: 'cup', matchedIngredient: 'brown-sugar', confident: false, convertedAmount: 55, convertedUnit: 'g' },
          { name: 'large egg', amount: 1, unit: 'each', matchedIngredient: 'eggs', confident: true, convertedAmount: 1, convertedUnit: 'each' },
          { name: 'pure vanilla extract', amount: 1, unit: 'tsp', matchedIngredient: 'vanilla-extract', confident: false, convertedAmount: 1, convertedUnit: 'ml' },
          { name: 'unsalted butter', amount: 0.25, unit: 'cup', matchedIngredient: 'butter', confident: false, convertedAmount: 56.75, convertedUnit: 'g' },
          { name: 'vegetable shortening', amount: 0.25, unit: 'cup', matchedIngredient: 'vegetable-shortening', confident: true, convertedAmount: 51.25, convertedUnit: 'ml' },
          { name: 'pure vanilla extract', amount: 1, unit: 'tsp', matchedIngredient: 'vanilla-extract', confident: false, convertedAmount: 1, convertedUnit: 'ml' },
        ],
      },
      {
        source: 'Soft and chewy cookies.txt',
        title: 'Soetkoekies',
        servings: 0,
        ingredients: [
          { name: 'botter of rama of stork bake', amount: 115, unit: 'g', matchedIngredient: null, confident: false, convertedAmount: 115, convertedUnit: 'g' },
          { name: 'wit suiker', amount: 200, unit: 'g', matchedIngredient: null, confident: false, convertedAmount: 200, convertedUnit: 'g' },
          { name: 'eier', amount: 1, unit: 'each', matchedIngredient: null, confident: false, convertedAmount: 1, convertedUnit: 'each' },
          { name: 'melk', amount: 30, unit: 'ml', matchedIngredient: 'condensed-milk', confident: false, convertedAmount: 30, convertedUnit: 'ml' },
          { name: 'geursel: karamel', amount: 5, unit: 'ml', matchedIngredient: 'caramel-treat', confident: false, convertedAmount: 5, convertedUnit: 'ml' },
          { name: 'koekmeel', amount: 350, unit: 'g', matchedIngredient: 'cake-flour', confident: true, convertedAmount: 350, convertedUnit: 'g' },
          { name: 'bakpoeier', amount: 10, unit: 'ml', matchedIngredient: null, confident: false, convertedAmount: 10, convertedUnit: 'ml' },
          { name: 'sout', amount: 2, unit: 'ml', matchedIngredient: null, confident: false, convertedAmount: 2, convertedUnit: 'ml' },
        ],
      },
    ]);
  });
});
