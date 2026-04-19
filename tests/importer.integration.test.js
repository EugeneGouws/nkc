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
  it('returns summaries for the current txt/docx fixture set', async () => {
    const summaries = await importRecipeSummaries();

    expect(summaries.map((recipe) => recipe.source)).toEqual([
      'Chicken and Leek Casserole.docx',
      'Chicken soup.txt',
      'Crazy Easy Cupcakes.docx',
      'Homemade Oreos.docx',
      'ONION SOUP.docx',
      'Ottolenghi’s Ricotta and Oregano.docx',
      'Slow Braised Red Wine Oxtail.docx',
      'Soft and chewy cookies.txt',
      'Traditional South African Pickled Fish.docx',
    ]);

    const bySource = Object.fromEntries(summaries.map((recipe) => [recipe.source, recipe]));

    expect(bySource['Chicken and Leek Casserole.docx']).toMatchObject({
      title: 'Chicken and Leek Casserole',
      servings: 4,
    });
    expect(bySource['Chicken and Leek Casserole.docx'].ingredients).toHaveLength(7);
    expect(bySource['Chicken and Leek Casserole.docx'].ingredients[0]).toMatchObject({
      name: 'chicken thighs',
      matchedIngredient: 'chicken-stock',
      confident: false,
    });

    expect(bySource['Chicken soup.txt']).toMatchObject({
      title: 'water to cover',
      servings: 10,
    });
    expect(bySource['Chicken soup.txt'].ingredients).toHaveLength(5);

    expect(bySource['Crazy Easy Cupcakes.docx']).toMatchObject({
      title: 'Crazy Easy Cupcakes',
      servings: 0,
    });
    expect(bySource['Crazy Easy Cupcakes.docx'].ingredients).toHaveLength(8);
    expect(bySource['Crazy Easy Cupcakes.docx'].ingredients[0]).toMatchObject({
      name: 'sugar',
      matchedIngredient: 'white-sugar',
      confident: true,
      convertedAmount: 200,
      convertedUnit: 'g',
    });

    expect(bySource['Homemade Oreos.docx']).toMatchObject({
      title: 'Homemade Oreos',
      servings: 0,
    });
    expect(bySource['Homemade Oreos.docx'].ingredients).toHaveLength(10);
    expect(bySource['Homemade Oreos.docx'].ingredients[0]).toMatchObject({
      name: 'baking soda',
      matchedIngredient: 'bicarbonate-of-soda',
      confident: true,
      convertedAmount: 5,
      convertedUnit: 'ml',
    });

    expect(bySource['ONION SOUP.docx']).toMatchObject({
      title: 'ONION SOUP',
      servings: 0,
    });
    expect(bySource['ONION SOUP.docx'].ingredients).toHaveLength(7);
    expect(bySource['ONION SOUP.docx'].ingredients[0]).toMatchObject({
      name: '/ 3.5oz unsalted butter',
      matchedIngredient: 'butter',
      confident: false,
    });

    expect(bySource['Ottolenghi’s Ricotta and Oregano.docx']).toMatchObject({
      title: 'Top of Form',
      servings: 0,
    });
    expect(bySource['Ottolenghi’s Ricotta and Oregano.docx'].ingredients).toHaveLength(12);

    expect(bySource['Slow Braised Red Wine Oxtail.docx']).toMatchObject({
      title: 'Slow Braised Red Wine Oxtail',
      servings: 6,
    });
    expect(bySource['Slow Braised Red Wine Oxtail.docx'].ingredients).toHaveLength(1);
    expect(bySource['Slow Braised Red Wine Oxtail.docx'].ingredients[0]).toMatchObject({
      name: 'olive oil1.8 kg oxtail',
      matchedIngredient: 'olive-oil',
    });

    expect(bySource['Soft and chewy cookies.txt']).toMatchObject({
      title: 'Soetkoekies',
      servings: 0,
    });
    expect(bySource['Soft and chewy cookies.txt'].ingredients).toHaveLength(8);

    expect(bySource['Traditional South African Pickled Fish.docx']).toMatchObject({
      title: 'Traditional South African Pickled Fish',
      servings: 6,
    });
    expect(bySource['Traditional South African Pickled Fish.docx'].ingredients).toHaveLength(13);
    expect(bySource['Traditional South African Pickled Fish.docx'].ingredients.at(-1)).toMatchObject({
      name: 'white wine vinegar',
      matchedIngredient: 'white-vinegar',
      confident: true,
      convertedAmount: 375,
      convertedUnit: 'ml',
    });
  });
});
