import { useState, useMemo } from 'react'
import { resolveIngredients } from '../lib/index.js'
import ImportRecipeModal from './modals/ImportRecipeModal.jsx'

function sheetToRecipe(sheet, pantry, source) {
  const flatIngredients = sheet.sections.flatMap(sec =>
    sec.ingredients.map(ing => ({
      raw:    `${ing.qtyUsed} ${ing.unit} ${ing.name}`.trim(),
      name:   ing.name,
      amount: ing.qtyUsed,
      unit:   ing.unit,
    }))
  )
  const resolved = resolveIngredients(flatIngredients, pantry)
  const rawText = sheet.sections.map(sec => {
    const header = sec.label && sec.label !== 'Main' ? `${sec.label}:\n` : ''
    const lines  = sec.ingredients.map(i => `${i.qtyUsed} ${i.unit} ${i.name}`).join('\n')
    return header + lines
  }).join('\n\n')

  return {
    title:    sheet.title,
    servings: 1,
    source,
    rawText,
    ingredients: resolved.map((ing, i) => ({ ...ing, id: i })),
  }
}

export default function XlsxImportQueue({ sheets, pantry, collections, filename, onImport, onAddIngredient, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0)

  const currentSheet = sheets[currentIndex]
  const recipe = useMemo(
    () => currentSheet ? sheetToRecipe(currentSheet, pantry, filename ?? '') : null,
    [currentSheet, pantry, filename]
  )

  function advance() {
    setCurrentIndex(i => {
      const next = i + 1
      if (next >= sheets.length) {
        setTimeout(() => onClose?.(), 0)
      }
      return next
    })
  }

  if (!recipe) return null

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{
        position: 'absolute', top: 8, left: 12, zIndex: 70,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 4, padding: '2px 8px', fontSize: 11, color: 'var(--tx-primary)',
      }}>
        Recipe {currentIndex + 1} of {sheets.length}
      </div>
      <ImportRecipeModal
        key={currentIndex}
        isOpen
        recipe={recipe}
        pantry={pantry}
        collections={collections}
        onImport={r => { onImport?.(r); advance() }}
        onAddIngredient={onAddIngredient}
        onClose={advance}
      />
    </div>
  )
}
