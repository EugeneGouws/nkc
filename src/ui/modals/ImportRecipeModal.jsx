import { useState, useEffect } from 'react'
import { findCandidates, AIMatchIngredient, AISuggestRecipeMeta } from '../../lib/index.js'
import AddIngredientModal from './AddIngredientModal.jsx'
import './modal-base.css'
import './ImportRecipeModal.css'

// Compute typeahead suggestions for a search string against the pantry.
// 1-char: nothing. 2-char: startsWith on name/aliases. 3+: findCandidates (alias + Jaccard).
function computeSuggestions(value, pantryList) {
  if (value.length < 2) return []
  if (value.length < 3) {
    const q = value.toLowerCase()
    return pantryList
      .filter(p =>
        p.canonicalName.toLowerCase().startsWith(q) ||
        p.aliases.some(a => a.toLowerCase().startsWith(q))
      )
      .slice(0, 6)
      .map(p => ({ entry: p }))
  }
  return findCandidates(value, pantryList)
}

export default function ImportRecipeModal({ isOpen, mode, recipe, pantry, collections, onImport, onSave, onAddIngredient, onClose }) {
  const isEditRecipe = mode === 'edit'

  const [aiMode,        setAiMode]        = useState(false)
  const [aiProgress,    setAiProgress]    = useState('')
  const [aiError,       setAiError]       = useState(null)
  const [editRows,      setEditRows]      = useState([])
  const [editTitle,     setEditTitle]     = useState('')
  const [editServings,  setEditServings]  = useState(1)
  const [editCollection,setEditCollection]= useState('')
  const [suggestions,   setSuggestions]   = useState({})  // { rowIndex: [{entry}] }
  const [openDropdown,  setOpenDropdown]  = useState(null) // rowIndex | null
  const [addIngOpen,    setAddIngOpen]    = useState(false)
  const [addIngName,    setAddIngName]    = useState('')

  // Auto-exit AI mode when all ingredients become matched
  useEffect(() => {
    if (aiMode && editRows.length > 0 && editRows.every(r => r.matchedId)) {
      setAiMode(false)
    }
  }, [editRows])

  useEffect(() => {
    if (!isOpen) {
      setAiMode(false)
      setAiProgress('')
      setAiError(null)
      setEditRows([])
      setEditTitle('')
      setEditServings(1)
      setEditCollection('')
      setSuggestions({})
      setOpenDropdown(null)
      setAddIngOpen(false)
      setAddIngName('')
    }
    if (isOpen && recipe) {
      setEditRows(buildEditRows(recipe, pantry ?? []))
      setEditTitle(recipe.title ?? '')
      setEditServings(recipe.servings ?? 1)
      setEditCollection(recipe.collection ?? '')
    }
  }, [isOpen])

  if (!isOpen) return null

  const ingredients = recipe?.ingredients ?? []
  const pantryList  = pantry ?? []

  const pantryByName = new Map(pantryList.map(p => [p.canonicalName.toLowerCase(), p]))

  // ── Edit row helpers ───────────────────────────────────────────────────────

  function buildEditRows(src, pList) {
    return (src?.ingredients ?? []).map(ing => {
      const matched = ing.matchedIngredient
        ? pList.find(p => p.id === ing.matchedIngredient)
        : null
      return {
        nameInput: matched?.canonicalName ?? ing.name ?? ing.raw ?? '',
        matchedId: ing.matchedIngredient ?? null,
        amount:    ing.amount != null ? String(ing.amount) : '',
        unit:      ing.unit ?? '',
      }
    })
  }

  function updateRow(i, changes) {
    setEditRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...changes } : r))
  }

  function handleNameChange(i, value) {
    const exact = pantryByName.get(value.toLowerCase())
    updateRow(i, { nameInput: value, matchedId: exact?.id ?? null })
    const suggs = computeSuggestions(value, pantryList)
    setSuggestions(prev => ({ ...prev, [i]: suggs }))
    setOpenDropdown(suggs.length > 0 ? i : null)
  }

  function selectSuggestion(i, entry) {
    updateRow(i, { nameInput: entry.canonicalName, matchedId: entry.id })
    setOpenDropdown(null)
  }

  // ── Import ─────────────────────────────────────────────────────────────────

  function handleImport() {
    if (!recipe) return
    const updatedIngredients = ingredients.map((ing, i) => {
      const row = editRows[i]
      return {
        ...ing,
        name:              row.nameInput,
        matchedIngredient: row.matchedId,
        confident:         !!row.matchedId,
        needsConfirm:      false,
        amount:            parseFloat(row.amount) || 0,
        unit:              row.unit,
        convertedAmount:   parseFloat(row.amount) || 0,
        convertedUnit:     row.unit,
      }
    })
    const updated = { ...recipe, title: editTitle, servings: editServings, collection: editCollection, ingredients: updatedIngredients }
    if (isEditRecipe) {
      onSave?.(updated)
    } else {
      onImport?.(updated)
    }
  }

  // ── AI Check ────────────────────────────────────────────────────────────────

  async function handleAICheck() {
    setAiMode(true)
    setAiProgress('Starting AI check…')
    setAiError(null)

    try {
      const unmatchedCount = editRows.filter(r => !r.matchedId).length
      console.log(`[ImportRecipe] Starting AI check for ${unmatchedCount} unmatched ingredients`);

      // Build pseudo-recipe with confident flags driven by editRows' matchedId
      const pseudoRecipe = {
        ...recipe,
        ingredients: recipe.ingredients.map((ing, i) => ({
          ...ing,
          confident: !!editRows[i]?.matchedId,
          matchedIngredient: editRows[i]?.matchedId ?? null,
        }))
      }

      setAiProgress(`Processing ${unmatchedCount} ingredients…`)
      const [updated, meta] = await Promise.all([
        AIMatchIngredient(pseudoRecipe, pantryList),
        AISuggestRecipeMeta(pseudoRecipe, collections ?? []),
      ])
      const aiResolved = updated.ingredients.filter(ing => ing.aiResolved).length
      console.log(`[ImportRecipe] AI resolved ${aiResolved}/${unmatchedCount} ingredients`);
      console.log(`[ImportRecipe] AI meta suggestion:`, meta);

      // Map AI-resolved results back to editRows
      setEditRows(prev => prev.map((row, i) => {
        if (row.matchedId) return row // already matched — don't touch
        const ing = updated.ingredients[i]
        if (ing?.aiResolved && ing.matchedIngredient) {
          const matched = pantryList.find(p => p.id === ing.matchedIngredient)
          console.log(`[ImportRecipe] AI matched row ${i}: "${row.nameInput}" → "${matched?.canonicalName}"`);
          return { ...row, nameInput: matched?.canonicalName ?? row.nameInput, matchedId: ing.matchedIngredient }
        }
        return row
      }))

      // Apply meta non-destructively — only fill empty / default fields so user input is never overwritten
      if (meta.collection) setEditCollection(prev => prev.trim() ? prev : meta.collection)
      if (meta.servings)   setEditServings(prev => prev > 1 ? prev : meta.servings)

      setAiProgress('')
      setAiMode(false) // always exit aiMode when AI completes (matched or not)
    } catch (err) {
      console.error('[ImportRecipe] AI check failed:', err);
      setAiError(err.message || 'AI check failed. Please try manual matching.');
      setAiProgress('')
      setAiMode(false)
    }
  }

  // ── Derived state ──────────────────────────────────────────────────────────

  const canImport   = recipe != null && editRows.every(r => r.matchedId)
  const matchedCount = editRows.filter(r => r.matchedId).length
  const infoText     = recipe
    ? `${matchedCount} / ${ingredients.length} matched`
    : 'Awaiting import…'

  return (
    <div className="import-recipe-modal">
      <div className="panel-header">
        <div className="modal-title-row">
          <p className="panel-heading">{recipe?.title ?? 'Import Recipe'}</p>
          <button className="ctrl-btn modal-close-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="panel-controls">
          <button
            className="ctrl-btn"
            disabled={!canImport}
            onClick={handleImport}
          >
            {isEditRecipe ? 'Save Recipe' : 'Import Recipe'}
          </button>
          {aiMode && <span className="status-dot dot-thinking" />}
          <span className="modal-info-box">
            {aiError ? (
              <span style={{ color: '#c0392b' }}>Error: {aiError}</span>
            ) : aiProgress ? (
              <span style={{ color: '#f39c12' }}>{aiProgress}</span>
            ) : (
              infoText
            )}
          </span>
          {recipe && editRows.some(r => !r.matchedId) && (
            aiMode
              ? <button className="ctrl-btn" onClick={() => setAiMode(false)}>Cancel</button>
              : <button className="ctrl-btn" onClick={handleAICheck}>AI Check</button>
          )}
        </div>
      </div>

      <div className="panel-list">
        {!recipe ? (
          <p className="ing-empty">Drop or paste a recipe above to get started</p>
        ) : (
          <>
            <div className="ing-row ing-row--meta">
              <span className="ing-meta-label">Title</span>
              <input
                className="ing-edit-name"
                style={{ flex: 1 }}
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                placeholder="Recipe title"
              />
              <span className="ing-meta-label">Servings</span>
              <input
                className="ing-edit-qty"
                type="number"
                min="1"
                value={editServings}
                onChange={e => setEditServings(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
            <div className="ing-row ing-row--meta">
              <span className="ing-meta-label">Collection</span>
              <input
                className="ing-edit-name"
                style={{ flex: 1 }}
                value={editCollection}
                onChange={e => setEditCollection(e.target.value)}
                placeholder="e.g. Cakes, Breads…"
              />
            </div>
            {editRows.map((row, i) => (
            <div key={i} className="ing-row">
              <span className={`status-dot ${row.matchedId ? 'green' : 'red'}`} />
              <div className="ing-edit-name-wrap">
                <input
                  className="ing-edit-name"
                  value={row.nameInput}
                  onChange={e => !aiMode && handleNameChange(i, e.target.value)}
                  onFocus={() => {
                    if (aiMode) return
                    const suggs = computeSuggestions(row.nameInput, pantryList)
                    if (suggs.length > 0) { setSuggestions(prev => ({ ...prev, [i]: suggs })); setOpenDropdown(i) }
                  }}
                  onBlur={() => setTimeout(() => setOpenDropdown(null), 150)}
                  placeholder="Search pantry…"
                  readOnly={aiMode}
                />
                {!aiMode && openDropdown === i && (suggestions[i]?.length > 0 || row.nameInput.length >= 2) && (
                  <div className="ing-dropdown">
                    {(suggestions[i] ?? []).map(({ entry }) => (
                      <div
                        key={entry.id}
                        className="ing-dropdown-item"
                        onMouseDown={e => { e.preventDefault(); selectSuggestion(i, entry) }}
                      >
                        {entry.canonicalName}
                      </div>
                    ))}
                    <div
                      className="ing-dropdown-item ing-dropdown-add"
                      onMouseDown={e => {
                        e.preventDefault()
                        setAddIngName(row.nameInput)
                        setAddIngOpen(true)
                        setOpenDropdown(null)
                      }}
                    >
                      + Add new ingredient
                    </div>
                  </div>
                )}
              </div>
              <input
                className="ing-edit-qty"
                type="number"
                min="0"
                step="any"
                value={row.amount}
                onChange={e => updateRow(i, { amount: e.target.value })}
                placeholder="qty"
                readOnly={aiMode}
              />
              <input
                className="ing-edit-unit"
                value={row.unit}
                onChange={e => updateRow(i, { unit: e.target.value })}
                placeholder="unit"
                readOnly={aiMode}
              />
            </div>
          ))}
          </>
        )}
      </div>

      {addIngOpen && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 60 }}>
          <AddIngredientModal
            isOpen
            ingredientName={addIngName}
            onAdd={(data) => {
              onAddIngredient?.(
                { name: data.name, pkgValue: data.pkgValue, pkgUnit: data.pkgUnit,
                  pkgPrice: data.pkgPrice, pkgMatch: data.pkgMatch,
                  conversions: data.conversions, aliases: data.aliases },
                data.baseUnit
              )
              setAddIngOpen(false)
            }}
            onClose={() => setAddIngOpen(false)}
          />
        </div>
      )}
    </div>
  )
}
