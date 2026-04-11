/**
 * io/ module — public exports for recipe and pantry persistence.
 *
 * Recipe management:
 *   - readRecipes() — get all stored recipes
 *   - addRecipe(recipe) — append a recipe to storage
 *   - importFinished(importerOutput, opts) — ONLY public write path; called by UI
 *
 * Pantry management:
 *   - readPantry() — get the full pantry
 *   - getMyPantry(recipes) — get pantry reordered by recipe usage
 *
 * (writeRecipes is intentionally not exported — it is an internal implementation detail.)
 */

export { readRecipes, addRecipe, saveRecipes, toggleRecipeFavourite, deleteRecipe } from './recipeStore.js';
export { readPantry, getMyPantry, addIngredientToPantry, getPendingSubmissions, priceUpdate, refreshNeedsCosting } from './pantryStore.js';
