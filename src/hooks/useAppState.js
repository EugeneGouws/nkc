import { useState, useEffect } from 'react'
import { readPantry, readRecipes, saveRecipes, priceUpdate, addIngredientToPantry, updateIngredientInPantry, updateRecipe as _updateRecipe, toggleRecipeFavourite, deleteRecipe as _deleteRecipe } from '../io/index.js'
import { migrateFromBakersPro } from '../io/migration.js'
import { importFinished, resolveIngredients } from '../lib/index.js'

export default function useAppState() {
  const [pantry, setPantry] = useState([])
  const [recipes, setRecipes] = useState([])

  useEffect(() => {
    migrateFromBakersPro()   // no-op once old keys are gone
    const loadedPantry   = readPantry()
    const loadedRecipes  = readRecipes()

    // bakerspro-migrated recipes arrive without matchedIngredient/convertedAmount.
    // Run matching once and persist so this fixup never reruns after.
    // Seed data (recipes.json) is pre-resolved and will not trigger this.
    const needsFixup = loadedRecipes.some(r =>
      r.ingredients?.some(i => i.convertedAmount === undefined)
    )
    if (needsFixup) {
      const fixed = loadedRecipes.map(r => ({
        ...r,
        ingredients: resolveIngredients(r.ingredients ?? [], loadedPantry),
      }))
      saveRecipes(fixed)
      setPantry(loadedPantry)
      setRecipes(fixed)
    } else {
      setPantry(loadedPantry)
      setRecipes(loadedRecipes)
    }
  }, [])

  function addRecipeToState(recipe, opts) {
    importFinished(recipe, opts)
    setRecipes(readRecipes())
    setPantry(readPantry())
  }

  function updateItemPrice(itemId, data) {
    priceUpdate(itemId, data)
    setPantry(readPantry())
  }

  function addIngredient(ingredient, baseUnit) {
    addIngredientToPantry(ingredient, baseUnit)
    setPantry(readPantry())
  }

  function updateIngredient(itemId, data) {
    updateIngredientInPantry(itemId, data)
    setPantry(readPantry())
  }

  function toggleFavourite(id) {
    toggleRecipeFavourite(id)
    setRecipes(readRecipes())
  }

  function editRecipeInState(id, updatedRecipe) {
    _updateRecipe(id, updatedRecipe)
    setRecipes(readRecipes())
  }

  function deleteRecipe(id) {
    _deleteRecipe(id)
    setRecipes(readRecipes())
  }

  return { pantry, recipes, addRecipeToState, editRecipeInState, updateItemPrice, addIngredient, updateIngredient, toggleFavourite, deleteRecipe }
}
