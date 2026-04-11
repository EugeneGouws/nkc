import { useState, useEffect } from 'react'
import { findCandidates } from '../../lib/index.js'
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

export default function ImportRecipeModal({ isOpen, recipe, pantry, onImport, onAddIngredient, onClose }) {
  const [editMode,       setEditMode]       = useState(false)
  const [editRows,       setEditRows]       = useState([])
  const [editTitle,      setEditTitle]      = useState('')
  const [editServings,   setEditServings]   = useState(1)
  const [suggestions,    setSuggestions]    = useState({})  // { rowIndex: [{entry}] }
  const [openDropdown,   setOpenDropdown]   = useState(null) // rowIndex | null
  const [confirmStates,  setConfirmStates]  = useState({})  // { rowIndex: true|false }
  const [addIngOpen,     setAddIngOpen]     = useState(false)
  const [addIngName,     setAddIngName]     = useState('')

  useEffect(() => {
    if (!isOpen) {
      setEditMode(false)
      setEditRows([])
      setEditTitle('')
      setEditServings(1)
      setSuggestions({})
      setOpenDropdown(null)
      setConfirmStates({})
      setAddIngOpen(false)
      setAddIngName('')
    }
  }, [isOpen])

  if (!isOpen) return null

  const ingredients = recipe?.ingredients ?? []
  const servings    = recipe?.servings    ?? null
  const pantryList  = pantry ?? []

  const pantryByName = new Map(pantryList.map(p => [p.canonicalName.toLowerCase(), p]))

  // ── Edit row helpers ───────────────────────────────────────────────────────

  function buildEditRows() {
    return ingredients.map(ing => {
      const matched = ing.matchedIngredient
        ? pantryList.find(p => p.id === ing.matchedIngredient)
        : null
      return {
        nameInput: matched?.canonicalName ?? ing.name ?? ing.raw ?? '',
        matchedId: ing.matchedIngredient ?? null,
        amount:    ing.amount != null ? String(ing.amount) : '',
        unit:      ing.unit ?? '',
      }
    })
  }

  function handleEnterEdit() {
    setEditRows(buildEditRows())
    setEditTitle(recipe?.title ?? '')
    setEditServings(recipe?.servings ?? 1)
    setEditMode(true)
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
    if (editMode) {
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
      onImport({ ...recipe, title: editTitle, servings: editServings, ingredients: updatedIngredients })
    } else {
      // Apply confirmStates: confirmed → confident, rejected → needsManual
      const updatedIngredients = ingredients.map((ing, i) => {
        if (!ing.needsConfirm) return ing
        if (confirmStates[i] === true)  return { ...ing, confident: true,  needsConfirm: false }
        if (confirmStates[i] === false) return { ...ing, confident: false, needsConfirm: false, needsManual: true, matchedIngredient: null }
        return ing
      })
      onImport({ ...recipe, ingredients: updatedIngredients })
    }
  }

  // ── Derived state ──────────────────────────────────────────────────────────

  const pendingConfirm = !editMode && ingredients.some(
    (ing, i) => ing.needsConfirm && confirmStates[i] === undefined
  )

  const canImport = editMode
    ? editRows.every(r => r.matchedId)
    : recipe != null && !pendingConfirm && !ingredients.some(
        (ing, i) => ing.needsConfirm && confirmStates[i] === false
      )

  const hasUnresolved = !editMode && recipe && ingredients.some(i => !i.confident && !i.needsConfirm)

  const matchedCount = recipe ? ingredients.filter(i => i.confident || confirmStates[ingredients.indexOf(i)] === true).length : 0
  const infoText     = recipe
    ? `${matchedCount} / ${ingredients.length} matched`
    : 'Awaiting import…'

  // ── Dot class (view mode) ──────────────────────────────────────────────────

  function dotClass(ing) {
    if (ing.confident)   return 'green'
    if (ing.needsManual) return 'red'
    return 'amber'
  }

  function ingName(ing) {
    return ing.confident && ing.matchedIngredient ? ing.matchedIngredient : (ing.name ?? ing.raw)
  }

  function ingQty(ing) {
    return `${ing.amount ?? ''} ${ing.unit ?? ''}`.trim()
  }

  return (
    <div className="import-recipe-modal">
      <div className="panel-header">
        <div className="modal-title-row">
          <p className="panel-heading">{recipe?.title ?? 'Import Recipe'}</p>
          {!editMode && servings != null && (
            <span className="modal-servings">{servings} servings</span>
          )}
          <button className="ctrl-btn modal-close-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="panel-controls">
          <button
            className="ctrl-btn"
            disabled={!canImport}
            onClick={handleImport}
          >
            Import Recipe
          </button>
          {hasUnresolved && <span className="status-dot dot-thinking" />}
          <span className="modal-info-box">{infoText}</span>
          {!editMode && recipe && (
            <button className="ctrl-btn" onClick={handleEnterEdit}>
              Edit Recipe
            </button>
          )}
        </div>
      </div>

      <div className="panel-list">
        {!recipe ? (
          <p className="ing-empty">Drop or paste a recipe above to get started</p>
        ) : editMode ? (
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
            {editRows.map((row, i) => (
            <div key={i} className="ing-row">
              <span className={`status-dot ${row.matchedId ? 'green' : 'red'}`} />
              <div className="ing-edit-name-wrap">
                <input
                  className="ing-edit-name"
                  value={row.nameInput}
                  onChange={e => handleNameChange(i, e.target.value)}
                  onFocus={() => {
                    const suggs = computeSuggestions(row.nameInput, pantryList)
                    if (suggs.length > 0) { setSuggestions(prev => ({ ...prev, [i]: suggs })); setOpenDropdown(i) }
                  }}
                  onBlur={() => setTimeout(() => setOpenDropdown(null), 150)}
                  placeholder="Search pantry…"
                />
                {openDropdown === i && (suggestions[i]?.length > 0 || row.nameInput.length >= 2) && (
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
              />
              <input
                className="ing-edit-unit"
                value={row.unit}
                onChange={e => updateRow(i, { unit: e.target.value })}
                placeholder="unit"
              />
            </div>
          ))}
          </>
        ) : (
          ingredients.map((ing, i) => {
            // needsConfirm: show best-guess name with Yes / No inline
            if (ing.needsConfirm && confirmStates[i] === undefined) {
              const guessName = ing.matchedIngredient
                ? (pantryList.find(p => p.id === ing.matchedIngredient)?.canonicalName ?? ing.name)
                : ing.name
              return (
                <div key={i} className="ing-row">
                  <span className="status-dot dot-thinking" />
                  <span className="ing-name ing-name--guess">Is this <strong>{guessName}</strong>?</span>
                  <span className="ing-qty">{ingQty(ing)}</span>
                  <button
                    className="ctrl-btn ing-confirm-btn"
                    onClick={() => setConfirmStates(prev => ({ ...prev, [i]: true }))}
                  >Yes</button>
                  <button
                    className="ctrl-btn ing-confirm-btn"
                    onClick={() => setConfirmStates(prev => ({ ...prev, [i]: false }))}
                  >No</button>
                </div>
              )
            }

            // Confirmed or view mode fallback
            const confirmed = ing.needsConfirm && confirmStates[i] === true
            const rejected   = ing.needsConfirm && confirmStates[i] === false
            const dc = confirmed ? 'green' : rejected ? 'red' : dotClass(ing)
            return (
              <div key={i} className="ing-row">
                <span className={`status-dot ${dc === 'amber' ? 'dot-thinking' : dc}`} />
                <span className="ing-name">{ingName(ing)}</span>
                <span className="ing-qty">{ingQty(ing)}</span>
              </div>
            )
          })
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
