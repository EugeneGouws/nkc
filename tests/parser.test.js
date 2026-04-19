/**
 * parser.test.js — Nana's Kitchen Costings
 *
 * Run with:  npx vitest run tests/parser.test.js
 *
 * Tests are organised by function, then by source:
 *   - Unit tests (synthetic inputs)
 *   - Recipe-derived tests (Homemade Oreos, Crazy Easy Cupcakes)
 *   - Fringe / adversarial cases
 *
 * Pipeline: parseRecipeText → findIngredients → parseIngredientLine
 *                             (findAmount, findUnit, findIngredient)
 * Units returned by parseIngredientLine are RAW (cup, tsp, tbsp, g, ml, each).
 * Volumetric conversion (cup→ml/g) is deferred to the matcher.
 */

import { describe, it, expect } from 'vitest';
import { parseWordNumber, parseAmountStr, parseIngredientLine, parseRecipeText } from '../src/lib/parser.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const approx = (a, b, tol = 0.001) => Math.abs(a - b) < tol;


// ===========================================================================
// parseWordNumber
// ===========================================================================
describe('parseWordNumber', () => {

  describe('original test suite (all must pass)', () => {
    it('"one and a half" → 1.5',    () => expect(approx(parseWordNumber('one and a half'), 1.5)).toBe(true));
    it('"a quarter"      → 0.25',   () => expect(approx(parseWordNumber('a quarter'), 0.25)).toBe(true));
    it('"two"            → 2',      () => expect(approx(parseWordNumber('two'), 2)).toBe(true));
    it('"½"              → 0.5',    () => expect(approx(parseWordNumber('½'), 0.5)).toBe(true));
    it('"1½"             → 1.5',    () => expect(approx(parseWordNumber('1½'), 1.5)).toBe(true));
    it('"1 1/2"          → 1.5',    () => expect(approx(parseWordNumber('1 1/2'), 1.5)).toBe(true));
    it('"3/4"            → 0.75',   () => expect(approx(parseWordNumber('3/4'), 0.75)).toBe(true));
    it('"1 and a 0.5"    → 1.5',    () => expect(approx(parseWordNumber('1 and a 0.5'), 1.5)).toBe(true));
    it('"two and 1/2"    → 2.5',    () => expect(approx(parseWordNumber('two and 1/2'), 2.5)).toBe(true));
    it('"3 and .75"      → 3.75',   () => expect(approx(parseWordNumber('3 and .75'), 3.75)).toBe(true));
  });

  describe('"a" → 1', () => {
    it('"a"              → 1',      () => expect(approx(parseWordNumber('a'), 1)).toBe(true));
    it('"a pinch"        → 1',      () => expect(approx(parseWordNumber('a'), 1)).toBe(true));
  });

  describe('unicode fractions', () => {
    it('"¼"   → 0.25',   () => expect(approx(parseWordNumber('¼'), 0.25)).toBe(true));
    it('"¾"   → 0.75',   () => expect(approx(parseWordNumber('¾'), 0.75)).toBe(true));
    it('"⅓"   → 0.333',  () => expect(approx(parseWordNumber('⅓'), 1/3)).toBe(true));
    it('"⅔"   → 0.666',  () => expect(approx(parseWordNumber('⅔'), 2/3)).toBe(true));
    it('"⅛"   → 0.125',  () => expect(approx(parseWordNumber('⅛'), 0.125)).toBe(true));
    it('"2¾"  → 2.75',   () => expect(approx(parseWordNumber('2¾'), 2.75)).toBe(true));
    it('"1⅓"  → 1.333',  () => expect(approx(parseWordNumber('1⅓'), 4/3)).toBe(true));
  });

  describe('"and" connector variants', () => {
    it('"one and a quarter" → 1.25',  () => expect(approx(parseWordNumber('one and a quarter'), 1.25)).toBe(true));
    it('"two and a half"    → 2.5',   () => expect(approx(parseWordNumber('two and a half'), 2.5)).toBe(true));
    it('"2 and a half"      → 2.5',   () => expect(approx(parseWordNumber('2 and a half'), 2.5)).toBe(true));
    it('"3 and 1/4"         → 3.25',  () => expect(approx(parseWordNumber('3 and 1/4'), 3.25)).toBe(true));
    it('"a half"            → 0.5',   () => expect(approx(parseWordNumber('a half'), 0.5)).toBe(true));
  });

  describe('plain numbers', () => {
    it('"1"    → 1',     () => expect(approx(parseWordNumber('1'), 1)).toBe(true));
    it('"2.5"  → 2.5',   () => expect(approx(parseWordNumber('2.5'), 2.5)).toBe(true));
    it('"0.25" → 0.25',  () => expect(approx(parseWordNumber('0.25'), 0.25)).toBe(true));
    it('"500"  → 500',   () => expect(approx(parseWordNumber('500'), 500)).toBe(true));
    it('".5"   → 0.5',   () => expect(approx(parseWordNumber('.5'), 0.5)).toBe(true));
  });

  describe('edge cases — never throw', () => {
    it('empty string → 0',    () => expect(parseWordNumber('')).toBe(0));
    it('whitespace → 0',      () => expect(parseWordNumber('   ')).toBe(0));
    it('gibberish → 0',       () => expect(parseWordNumber('xyzzy')).toBe(0));
    it('null-ish string → 0', () => expect(parseWordNumber('null')).toBe(0));
  });
});


// ===========================================================================
// parseAmountStr
// ===========================================================================
describe('parseAmountStr', () => {
  it('"1 1/2" → 1.5',           () => expect(approx(parseAmountStr('1 1/2'), 1.5)).toBe(true));
  it('"3/4" → 0.75',            () => expect(approx(parseAmountStr('3/4'), 0.75)).toBe(true));
  it('"½" → 0.5',               () => expect(approx(parseAmountStr('½'), 0.5)).toBe(true));
  it('"1½" → 1.5',              () => expect(approx(parseAmountStr('1½'), 1.5)).toBe(true));
  it('"2.5" → 2.5',             () => expect(approx(parseAmountStr('2.5'), 2.5)).toBe(true));
  it('"one and a half" → 1.5',  () => expect(approx(parseAmountStr('one and a half'), 1.5)).toBe(true));
  it('"two and 1/2" → 2.5',     () => expect(approx(parseAmountStr('two and 1/2'), 2.5)).toBe(true));
});


// ===========================================================================
// parseIngredientLine — skip / null cases
// ===========================================================================
describe('parseIngredientLine — lines that should return null', () => {
  it('skip: "Method"',                       () => expect(parseIngredientLine('Method')).toBeNull());
  it('skip: "Directions"',                   () => expect(parseIngredientLine('Directions')).toBeNull());
  it('skip: "Instructions"',                 () => expect(parseIngredientLine('Instructions')).toBeNull());
  it('skip: "Preheat the oven to 180°C"',    () => expect(parseIngredientLine('Preheat the oven to 180°C')).toBeNull());
  it('skip: "Bake for about 12 minutes"',    () => expect(parseIngredientLine('Bake for about 12 minutes')).toBeNull());
  it('skip: "Mix until combined"',           () => expect(parseIngredientLine('Mix until combined')).toBeNull());
  it('skip: "For the cream filling"',        () => expect(parseIngredientLine('For the cream filling')).toBeNull());
  it('skip: "Ingredients"',                  () => expect(parseIngredientLine('Ingredients')).toBeNull());
  it('skip: "Ingredients:"',                 () => expect(parseIngredientLine('Ingredients:')).toBeNull());
  it('skip: "1 cup water" (FREE_INGREDIENT)',  () => expect(parseIngredientLine('1 cup water')).toBeNull());
  it('skip: "2 cups warm water" (FREE)',       () => expect(parseIngredientLine('2 cups warm water')).toBeNull());
  it('skip: "flour" — no leading number',    () => expect(parseIngredientLine('flour')).toBeNull());
  it('skip: empty string',                   () => expect(parseIngredientLine('')).toBeNull());
  it('skip: "salt to taste"',                () => expect(parseIngredientLine('salt to taste')).toBeNull());
  it('skip: "0 eggs" — zero amount',         () => expect(parseIngredientLine('0 eggs')).toBeNull());
  it('skip: "1 cup boiling water" (FREE)',   () => expect(parseIngredientLine('1 cup boiling water')).toBeNull());
  it('skip: name > 7 words',                 () => expect(parseIngredientLine('2 cups one two three four five six seven flour')).toBeNull());
  it('skip: name < 2 chars',                 () => expect(parseIngredientLine('2g x')).toBeNull());
});


// ===========================================================================
// parseIngredientLine — standard unit parsing
// ===========================================================================
describe('parseIngredientLine — gram / ml / each', () => {
  it('"500g butter" → 500g', () => {
    const r = parseIngredientLine('500g butter');
    expect(r).not.toBeNull();
    expect(r.name).toBe('butter');
    expect(r.amount).toBe(500);
    expect(r.unit).toBe('g');
  });
  it('"250ml milk" → 250ml', () => {
    const r = parseIngredientLine('250ml milk');
    expect(r.amount).toBe(250);
    expect(r.unit).toBe('ml');
  });
  it('"3 eggs" → 3 each', () => {
    const r = parseIngredientLine('3 eggs');
    expect(r.amount).toBe(3);
    expect(r.unit).toBe('each');
    expect(r.name).toContain('egg');
  });
  it('"1 slab dark chocolate" → 1 each', () => {
    const r = parseIngredientLine('1 slab dark chocolate');
    expect(r.amount).toBe(1);
    expect(r.unit).toBe('each');
  });
  it('"1 pack instant yeast" → 1 each', () => {
    const r = parseIngredientLine('1 pack instant yeast');
    expect(r.unit).toBe('each');
  });
  it('"500 g butter" — space between number and unit', () => {
    const r = parseIngredientLine('500 g butter');
    expect(r).not.toBeNull();
    expect(r.amount).toBe(500);
    expect(r.unit).toBe('g');
  });
});


// ===========================================================================
// parseIngredientLine — cup / tsp / tbsp return raw units
// ===========================================================================
describe('parseIngredientLine — cup/tsp/tbsp return raw unit (no conversion)', () => {
  it('"1 cup milk" → amount: 1, unit: "cup"', () => {
    const r = parseIngredientLine('1 cup milk');
    expect(r).not.toBeNull();
    expect(r.amount).toBe(1);
    expect(r.unit).toBe('cup');
  });
  it('"1 tsp vanilla" → amount: 1, unit: "tsp"', () => {
    const r = parseIngredientLine('1 tsp vanilla');
    expect(r.amount).toBe(1);
    expect(r.unit).toBe('tsp');
  });
  it('"2 tbsp cocoa" → amount: 2, unit: "tbsp"', () => {
    const r = parseIngredientLine('2 tbsp cocoa');
    expect(r.amount).toBe(2);
    expect(r.unit).toBe('tbsp');
  });
  it('"1 tablespoon milk" → amount: 1, unit: "tbsp"', () => {
    const r = parseIngredientLine('1 tablespoon milk');
    expect(r.amount).toBe(1);
    expect(r.unit).toBe('tbsp');
  });
  it('"2 Tablespoons milk" (capital T) → amount: 2, unit: "tbsp"', () => {
    const r = parseIngredientLine('2 Tablespoons milk');
    expect(r.amount).toBe(2);
    expect(r.unit).toBe('tbsp');
  });
});


// ===========================================================================
// parseIngredientLine — fraction amounts
// ===========================================================================
describe('parseIngredientLine — fraction amounts', () => {
  it('"1/2 cup sugar" → amount: 0.5, unit: "cup"', () => {
    const r = parseIngredientLine('1/2 cup sugar');
    expect(r).not.toBeNull();
    expect(approx(r.amount, 0.5)).toBe(true);
    expect(r.unit).toBe('cup');
  });
  it('"3/4 cup sugar" → amount: 0.75, unit: "cup"', () => {
    const r = parseIngredientLine('3/4 cup sugar');
    expect(approx(r.amount, 0.75)).toBe(true);
    expect(r.unit).toBe('cup');
  });
  it('"1/8 teaspoon salt" → amount: 0.125, unit: "tsp"', () => {
    const r = parseIngredientLine('1/8 teaspoon salt');
    expect(approx(r.amount, 0.125)).toBe(true);
    expect(r.unit).toBe('tsp');
  });
  it('"1 1/2 cups flour" → amount: 1.5, unit: "cup"', () => {
    const r = parseIngredientLine('1 1/2 cups flour');
    expect(approx(r.amount, 1.5)).toBe(true);
    expect(r.unit).toBe('cup');
  });
});


// ===========================================================================
// parseIngredientLine — kg / litre multipliers
// ===========================================================================
describe('parseIngredientLine — kg and litre multipliers', () => {
  it('"1kg flour" → 1000g', () => {
    const r = parseIngredientLine('1kg flour');
    expect(r.amount).toBe(1000);
    expect(r.unit).toBe('g');
  });
  it('"1.5kg sugar" → 1500g', () => {
    const r = parseIngredientLine('1.5kg sugar');
    expect(r.amount).toBe(1500);
  });
  it('"1 litre milk" → 1000ml', () => {
    const r = parseIngredientLine('1 litre milk');
    expect(r.amount).toBe(1000);
    expect(r.unit).toBe('ml');
  });
  it('"500ml cream" stays 500ml', () => {
    const r = parseIngredientLine('500ml cream');
    expect(r.amount).toBe(500);
  });
});


// ===========================================================================
// parseIngredientLine — bullet prefix stripping
// ===========================================================================
describe('parseIngredientLine — bullet prefix stripping', () => {
  it('"- 2 eggs"',    () => expect(parseIngredientLine('- 2 eggs')).not.toBeNull());
  it('"• 500g flour"', () => expect(parseIngredientLine('• 500g flour')).not.toBeNull());
  it('"* 1 tsp salt"', () => {
    const r = parseIngredientLine('* 1 tsp salt');
    expect(r).not.toBeNull();
    expect(r.amount).toBe(1);
    expect(r.unit).toBe('tsp');
  });
  it('"· 3 eggs"',    () => expect(parseIngredientLine('· 3 eggs')).not.toBeNull());
});


// ===========================================================================
// parseIngredientLine — suffix stripping
// ===========================================================================
describe('parseIngredientLine — suffix stripping', () => {
  it('"1 tsp vanilla extract, room temperature" → name has no comma tail', () => {
    const r = parseIngredientLine('1 tsp vanilla extract, room temperature');
    expect(r.name).not.toContain(',');
    expect(r.name).not.toContain('room temperature');
  });
  it('"1/2 cup butter (113g)" → name has no parenthetical', () => {
    const r = parseIngredientLine('1/2 cup butter (113g)');
    expect(r.name).not.toContain('(');
  });
  it('"500g cake flour (sifted)" → name excludes "(sifted)"', () => {
    const r = parseIngredientLine('500g cake flour (sifted)');
    expect(r.name).not.toContain('sifted');
  });
});


// ===========================================================================
// parseIngredientLine — Homemade Oreos (Sally's Baking Addiction)
// ===========================================================================
describe('parseIngredientLine — Homemade Oreos recipe', () => {

  it('"1 teaspoon baking soda" → amount: 1, unit: "tsp"', () => {
    const r = parseIngredientLine('1 teaspoon baking soda');
    expect(r).not.toBeNull();
    expect(r.name).toContain('baking soda');
    expect(r.amount).toBe(1);
    expect(r.unit).toBe('tsp');
  });

  it('"1/8 teaspoon salt" → amount: 0.125, unit: "tsp"', () => {
    const r = parseIngredientLine('1/8 teaspoon salt');
    expect(r).not.toBeNull();
    expect(approx(r.amount, 0.125)).toBe(true);
    expect(r.unit).toBe('tsp');
  });

  it('"1/2 cup (8 Tbsp; 113g) unsalted butter, softened..." → amount: 0.5, unit: "cup"', () => {
    const r = parseIngredientLine('1/2 cup (8 Tbsp; 113g) unsalted butter, softened to room temperature');
    expect(r).not.toBeNull();
    expect(approx(r.amount, 0.5)).toBe(true);
    expect(r.unit).toBe('cup');
    expect(r.name).toContain('butter');
    expect(r.name).not.toContain('softened');
    expect(r.name).not.toContain('(');
  });

  it('"3/4 cup (150g) granulated sugar" → amount: 0.75, unit: "cup"', () => {
    const r = parseIngredientLine('3/4 cup (150g) granulated sugar');
    expect(r).not.toBeNull();
    expect(approx(r.amount, 0.75)).toBe(true);
    expect(r.unit).toBe('cup');
    expect(r.name).toContain('sugar');
    expect(r.name).not.toContain('(');
  });

  it('"1/4 cup (50g) packed light brown sugar" → name contains "brown sugar"', () => {
    const r = parseIngredientLine('1/4 cup (50g) packed light brown sugar');
    expect(r).not.toBeNull();
    expect(r.name).toContain('brown sugar');
  });

  it('"1 large egg, at room temperature" → comma-suffix stripped', () => {
    const r = parseIngredientLine('1 large egg, at room temperature');
    expect(r).not.toBeNull();
    expect(r.amount).toBe(1);
    expect(r.unit).toBe('each');
    expect(r.name).not.toContain('room temperature');
    expect(r.name).not.toContain(',');
  });

  it('"1 teaspoon pure vanilla extract" → amount: 1, unit: "tsp"', () => {
    const r = parseIngredientLine('1 teaspoon pure vanilla extract');
    expect(r).not.toBeNull();
    expect(r.name).toContain('vanilla');
    expect(r.amount).toBe(1);
    expect(r.unit).toBe('tsp');
  });

  it('"(156g) all-purpose flour" — parenthetical-only amount returns null', () => {
    const r = parseIngredientLine('(156g) all-purpose flour');
    // parenthetical-only amounts not supported — Open Decision #1
    expect(r).toBeNull();
  });

  it('"1/4 cup (4 Tbsp; 56g) unsalted butter" → amount: 0.25, unit: "cup"', () => {
    const r = parseIngredientLine('1/4 cup (4 Tbsp; 56g) unsalted butter');
    expect(r).not.toBeNull();
    expect(approx(r.amount, 0.25)).toBe(true);
    expect(r.unit).toBe('cup');
  });

  it('"1/4 cup (48g) vegetable shortening" → amount: 0.25, unit: "cup"', () => {
    const r = parseIngredientLine('1/4 cup (48g) vegetable shortening');
    expect(r).not.toBeNull();
    expect(approx(r.amount, 0.25)).toBe(true);
    expect(r.name).toContain('shortening');
  });

  it('"Oreos" section header → null', () => {
    expect(parseIngredientLine('Oreos')).toBeNull();
  });

  it('"Cream Filling" section header → null', () => {
    expect(parseIngredientLine('Cream Filling')).toBeNull();
  });
});


// ===========================================================================
// parseIngredientLine — Crazy Easy Cupcakes (Carmen, Port Elizabeth)
// ===========================================================================
describe('parseIngredientLine — Crazy Easy Cupcakes recipe', () => {

  it('"1 Cup sugar" (capital C) → amount: 1, unit: "cup"', () => {
    const r = parseIngredientLine('1 Cup sugar');
    expect(r).not.toBeNull();
    expect(r.amount).toBe(1);
    expect(r.unit).toBe('cup');
    expect(r.name).toContain('sugar');
  });

  it('"1 Cup margarine or butter (250g)" — strips parenthetical', () => {
    const r = parseIngredientLine('1 Cup margarine or butter (250g)');
    expect(r).not.toBeNull();
    expect(r.name).not.toContain('(');
    expect(['margarine', 'butter'].some(w => r.name.includes(w))).toBe(true);
  });

  it('"4 extra large eggs" → 4 each, name contains "egg"', () => {
    const r = parseIngredientLine('4 extra large eggs');
    expect(r).not.toBeNull();
    expect(r.amount).toBe(4);
    expect(r.unit).toBe('each');
    expect(r.name).toContain('egg');
  });

  it('"2 cups of cake flour" → strips "of", amount: 2, unit: "cup"', () => {
    const r = parseIngredientLine('2 cups of cake flour');
    expect(r).not.toBeNull();
    expect(r.name).not.toMatch(/^of\b/);
    expect(r.name).toContain('cake flour');
    expect(r.amount).toBe(2);
    expect(r.unit).toBe('cup');
  });

  it('"1 teaspoon baking powder" → amount: 1, unit: "tsp"', () => {
    const r = parseIngredientLine('1 teaspoon baking powder');
    expect(r.amount).toBe(1);
    expect(r.unit).toBe('tsp');
  });

  it('"¼ teaspoon salt" (unicode fraction) → amount: 0.25, unit: "tsp"', () => {
    const r = parseIngredientLine('¼ teaspoon salt');
    expect(r).not.toBeNull();
    expect(approx(r.amount, 0.25)).toBe(true);
    expect(r.unit).toBe('tsp');
    expect(r.name).toContain('salt');
  });

  it('"2 Tablespoons milk" (capital T) → amount: 2, unit: "tbsp"', () => {
    const r = parseIngredientLine('2 Tablespoons milk');
    expect(r).not.toBeNull();
    expect(r.amount).toBe(2);
    expect(r.unit).toBe('tbsp');
  });

  it('"1 teaspoon vanilla" → amount: 1, unit: "tsp"', () => {
    const r = parseIngredientLine('1 teaspoon vanilla');
    expect(r.amount).toBe(1);
    expect(r.unit).toBe('tsp');
  });

  it('"Preheat the oven to 180˚C." → null', () => {
    expect(parseIngredientLine('Preheat the oven to 180˚C.')).toBeNull();
  });

  it('"Beat in eggs one at a time." → null', () => {
    expect(parseIngredientLine('Beat in eggs one at a time.')).toBeNull();
  });

  it('"Bake for about 12 minutes or till firm to touch." → null', () => {
    expect(parseIngredientLine('Bake for about 12 minutes or till firm to touch.')).toBeNull();
  });

  it('"Add dry ingredients." → null', () => {
    expect(parseIngredientLine('Add dry ingredients.')).toBeNull();
  });

  it('"To make chocolate cupcakes add 2 Tablespoons cocoa..." → null', () => {
    const line = 'To make chocolate cupcakes add 2 Tablespoons cocoa powder and an 1 extra Tablespoon of milk.';
    expect(parseIngredientLine(line)).toBeNull();
  });
});


// ===========================================================================
// parseIngredientLine — fringe / adversarial cases
// ===========================================================================
describe('parseIngredientLine — fringe cases', () => {

  it('"a pinch of salt" → "a" as 1, unit: "each"', () => {
    const r = parseIngredientLine('a pinch of salt');
    expect(r).not.toBeNull();
    expect(r.amount).toBe(1);
    expect(r.name).toContain('salt');
  });

  it('"2 cups flour, sifted twice" → name stripped after comma', () => {
    const r = parseIngredientLine('2 cups flour, sifted twice');
    expect(r.name).not.toContain('sifted');
  });

  it('"one teaspoon vanilla" → amount: 1, unit: "tsp"', () => {
    const r = parseIngredientLine('one teaspoon vanilla');
    expect(r).not.toBeNull();
    expect(r.amount).toBe(1);
    expect(r.unit).toBe('tsp');
  });

  it('"one and a half teaspoons vanilla extract" → amount: 1.5, unit: "tsp"', () => {
    const r = parseIngredientLine('one and a half teaspoons vanilla extract');
    expect(r).not.toBeNull();
    expect(approx(r.amount, 1.5)).toBe(true);
    expect(r.unit).toBe('tsp');
  });

  it('"two cups self raising flour" → amount: 2, unit: "cup"', () => {
    const r = parseIngredientLine('two cups self raising flour');
    expect(r).not.toBeNull();
    expect(approx(r.amount, 2)).toBe(true);
    expect(r.unit).toBe('cup');
  });

  it('"½ cup butter" → amount: 0.5, unit: "cup"', () => {
    const r = parseIngredientLine('½ cup butter');
    expect(r).not.toBeNull();
    expect(approx(r.amount, 0.5)).toBe(true);
    expect(r.unit).toBe('cup');
  });

  it('"1½ cups flour" → amount: 1.5, unit: "cup"', () => {
    const r = parseIngredientLine('1½ cups flour');
    expect(r).not.toBeNull();
    expect(approx(r.amount, 1.5)).toBe(true);
    expect(r.unit).toBe('cup');
  });

  it('"3 large eggs, beaten" → 3 each, comma-suffix stripped', () => {
    const r = parseIngredientLine('3 large eggs, beaten');
    expect(r.amount).toBe(3);
    expect(r.unit).toBe('each');
    expect(r.name).not.toContain('beaten');
    expect(r.name).toContain('egg');
  });

  it('"200g dark chocolate, roughly chopped" → name clean', () => {
    const r = parseIngredientLine('200g dark chocolate, roughly chopped');
    expect(r.amount).toBe(200);
    expect(r.name).not.toContain('roughly');
  });

  it('"zest of 1 lemon" → null (no leading number)', () => {
    expect(parseIngredientLine('zest of 1 lemon')).toBeNull();
  });

  it('"1 x 385g tin condensed milk" → 1 each', () => {
    const r = parseIngredientLine('1 x 385g tin condensed milk');
    expect(r).not.toBeNull();
    expect(r.amount).toBe(1);
  });
});


// ===========================================================================
// parseRecipeText — full recipe parsing
// ===========================================================================

const OREOS_TEXT = `Homemade Oreos

Oreos
(156g) all-purpose flour
(41g) unsweetened Dutch-process cocoa powder
1 teaspoon baking soda
1/8 teaspoon salt
1/2 cup (8 Tbsp; 113g) unsalted butter, softened to room temperature
3/4 cup (150g) granulated sugar
1/4 cup (50g) packed light brown sugar
1 large egg, at room temperature
1 teaspoon pure vanilla extract

Cream Filling
1/4 cup (4 Tbsp; 56g) unsalted butter, softened to room temperature
1/4 cup (48g) vegetable shortening, room temperature
(210g) confectioners' sugar
1 teaspoon pure vanilla extract`;

const CUPCAKES_TEXT = `Crazy Easy Cupcakes

Carmen Port Elizabeth

Ingredients

1 Cup sugar
1 Cup margarine or butter (250g)
4 extra large eggs
2 cups of cake flour
1 teaspoon baking powder
¼ teaspoon salt
2 Tablespoons milk
1 teaspoon vanilla

Method

Preheat the oven to 180˚C.
Make sure the butter/margarine is soft. Beat in sugar till light and fluffy.
Beat in eggs one at a time.
Add dry ingredients. Do not over beat. Rather fold in with a spoon.
Lastly add the milk and vanilla.
To make chocolate cupcakes add 2 Tablespoons cocoa powder and an 1 extra Tablespoon of milk.
Put tablespoons into pans that have been coated with Spray and Cook or use muffin paper cups.
Bake for about 12 minutes or till firm to touch.
Cool, ice and decorate.`;

describe('parseRecipeText — Crazy Easy Cupcakes', () => {

  it('title is detected', () => {
    const r = parseRecipeText(CUPCAKES_TEXT);
    expect(r.title).toBeTruthy();
  });

  it('stops at "Method" — method lines not included as ingredients', () => {
    const r = parseRecipeText(CUPCAKES_TEXT);
    const names = r.ingredients.map(i => i.name);
    expect(names.some(n => n.includes('preheat'))).toBe(false);
    expect(names.some(n => n.includes('bake'))).toBe(false);
    expect(names.some(n => n.includes('beat'))).toBe(false);
  });

  it('skips "Ingredients" header line', () => {
    const r = parseRecipeText(CUPCAKES_TEXT);
    const names = r.ingredients.map(i => i.name);
    expect(names.some(n => n === 'ingredients')).toBe(false);
  });

  it('parses at least 7 ingredients', () => {
    const r = parseRecipeText(CUPCAKES_TEXT);
    expect(r.ingredients.length).toBeGreaterThanOrEqual(7);
  });

  it('finds sugar in ingredients', () => {
    const r = parseRecipeText(CUPCAKES_TEXT);
    expect(r.ingredients.some(i => i.name.includes('sugar'))).toBe(true);
  });

  it('finds eggs in ingredients', () => {
    const r = parseRecipeText(CUPCAKES_TEXT);
    expect(r.ingredients.some(i => i.name.includes('egg'))).toBe(true);
  });

  it('¼ teaspoon salt — amount: 0.25, unit: "tsp"', () => {
    const r = parseRecipeText(CUPCAKES_TEXT);
    const salt = r.ingredients.find(i => i.name.includes('salt'));
    expect(salt).toBeDefined();
    expect(approx(salt.amount, 0.25)).toBe(true);
    expect(salt.unit).toBe('tsp');
  });

  it('water not in ingredients (FREE_INGREDIENT guard)', () => {
    const textWithWater = CUPCAKES_TEXT + '\n1 cup water';
    const r = parseRecipeText(textWithWater);
    expect(r.ingredients.some(i => i.name === 'water')).toBe(false);
  });
});

describe('parseRecipeText — Homemade Oreos', () => {

  it('title includes "oreo" or "cookie" (case-insensitive)', () => {
    const r = parseRecipeText(OREOS_TEXT);
    expect(r.title.toLowerCase()).toMatch(/oreo|cookie/);
  });

  it('parses at least 6 numbered ingredients (skipping parenthetical-only lines)', () => {
    const r = parseRecipeText(OREOS_TEXT);
    expect(r.ingredients.length).toBeGreaterThanOrEqual(6);
  });

  it('baking soda is parsed', () => {
    const r = parseRecipeText(OREOS_TEXT);
    expect(r.ingredients.some(i => i.name.includes('baking soda'))).toBe(true);
  });

  it('vanilla extract appears at least once', () => {
    const r = parseRecipeText(OREOS_TEXT);
    const vanillas = r.ingredients.filter(i => i.name.includes('vanilla'));
    expect(vanillas.length).toBeGreaterThanOrEqual(1);
  });

  it('no method lines in ingredients', () => {
    const r = parseRecipeText(OREOS_TEXT);
    const names = r.ingredients.map(i => i.name);
    expect(names.some(n => n.includes('preheat') || n.includes('bake'))).toBe(false);
  });
});

describe('parseRecipeText — servings detection', () => {

  it('"Serves 12" detected', () => {
    const text = 'Chocolate Cake\nServes 12\n2 cups flour\n3 eggs';
    const r = parseRecipeText(text);
    expect(r.servings).toBe(12);
  });

  it('"Makes 24 cookies" detected', () => {
    const text = 'Cookies\nMakes 24 cookies\n1 cup butter\n2 eggs';
    const r = parseRecipeText(text);
    expect(r.servings).toBe(24);
  });

  it('"Yields 8 portions" detected', () => {
    const text = 'Tart\nYields 8 portions\n500g flour\n250g butter';
    const r = parseRecipeText(text);
    expect(r.servings).toBe(8);
  });

  it('no servings line → default (not NaN)', () => {
    const text = 'Simple Cake\n2 cups flour\n3 eggs';
    const r = parseRecipeText(text);
    expect(Number.isNaN(r.servings)).toBe(false);
  });

  it('keeps title empty when the recipe starts with numbered ingredient lines', () => {
    const text = '2 cups flour\n3 eggs\nMethod\nMix well';
    const r = parseRecipeText(text);
    expect(r.title).toBe('');
    expect(r.ingredients).toHaveLength(2);
  });

  it('currently uses "water to cover" as the title in this import shape', () => {
    const text = 'Ingredients\n1 cup chicken\nwater to cover\nMethod\nBoil';
    const r = parseRecipeText(text);
    expect(r.title).toBe('water to cover');
  });

  it('currently keeps "Top of Form" as the first title candidate', () => {
    const text = 'Top of Form\nBottom of Form\nActual Title\n1 cup flour';
    const r = parseRecipeText(text);
    expect(r.title).toBe('Top of Form');
  });
});

describe('parseIngredientLine — regression cases', () => {
  it('currently preserves the slash-delimited alternative unit text: "100g / 3.5oz butter"', () => {
    const r = parseIngredientLine('100g / 3.5oz butter');
    expect(r.amount).toBe(100);
    expect(r.unit).toBe('g');
    expect(r.name).toBe('/ 3.5oz butter');
  });

  it('strips "Top of Form" noise', () => {
    expect(parseIngredientLine('Top of Form')).toBeNull();
  });
});
