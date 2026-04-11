import { useState, useEffect } from 'react'
import { readPantry, readRecipes, saveRecipes, priceUpdate, addIngredientToPantry, toggleRecipeFavourite, deleteRecipe as _deleteRecipe } from '../io/index.js'
import { importFinished, resolveIngredients } from '../lib/index.js'

export default function useAppState() {
  const [pantry, setPantry] = useState([])
  const [recipes, setRecipes] = useState([])

  useEffect(() => {
    const loadedPantry   = readPantry()
    const loadedRecipes  = readRecipes()

    // Seed recipes only have name/amount/unit — no matchedIngredient or convertedAmount.
    // Run the matcher once and persist so subsequent loads skip this step.
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

  function toggleFavourite(id) {
    toggleRecipeFavourite(id)
    setRecipes(readRecipes())
  }

  function deleteRecipe(id) {
    _deleteRecipe(id)
    setRecipes(readRecipes())
  }

  return { pantry, recipes, addRecipeToState, updateItemPrice, addIngredient, toggleFavourite, deleteRecipe }
}
