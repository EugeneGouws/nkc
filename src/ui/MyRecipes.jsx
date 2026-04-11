import { useState, useMemo } from 'react'
import './MyRecipes.css'

function recipeStatus(recipe, pantryMap) {
  const matched = (recipe.ingredients ?? [])
    .filter(i => i.matchedIngredient)
    .map(i => pantryMap.get(i.matchedIngredient))
    .filter(Boolean)

  if (matched.length === 0) return { status: 'red', total: null }
  if (matched.some(p => p.costPerUnit === 0)) return { status: 'red', total: null }

  const total = (recipe.ingredients ?? []).reduce((sum, i) => {
    const p = pantryMap.get(i.matchedIngredient)
    if (!p || !i.convertedAmount) return sum
    return sum + i.convertedAmount * p.costPerUnit
  }, 0)

  if (matched.some(p => p.needsCosting)) return { status: 'amber', total }
  return { status: 'green', total }
}

export default function MyRecipes({
  recipes,
  collections,
  pantry,
  onToggleFavourite,
  onOpenCosting,
  onDeleteRecipe,
  onFavFilterChange,
  onCollectionChange,
}) {
  const [favActive,           setFavActive]           = useState(false)
  const [selectedCollection,  setSelectedCollection]  = useState('')
  const [expandedId,          setExpandedId]          = useState(null)

  const pantryMap = useMemo(() => {
    const m = new Map()
    if (pantry) pantry.forEach(p => m.set(p.id, p))
    return m
  }, [pantry])

  function handleFavClick() {
    const next = !favActive
    setFavActive(next)
    onFavFilterChange(next)
  }

  function handleCollectionChange(e) {
    const val = e.target.value
    setSelectedCollection(val)
    onCollectionChange(val)
  }

  function handleRowClick(id) {
    setExpandedId(prev => prev === id ? null : id)
  }

  function handleDelete(e, id) {
    e.stopPropagation()
    if (window.confirm('Delete recipe. Are you sure?')) {
      onDeleteRecipe(id)
      if (expandedId === id) setExpandedId(null)
    }
  }

  return (
    <div className="nkc-panel nkc-card">
      <div className="panel-header">
        <p className="panel-heading">My Recipes</p>
        <div className="panel-controls">
          <button
            className={`ctrl-btn${favActive ? ' active' : ''}`}
            onClick={handleFavClick}
          >
            ★ Favourites
          </button>
          <select
            className="ctrl-select"
            value={selectedCollection}
            onChange={handleCollectionChange}
            style={{ fontSize: '10px' }}
          >
            <option value="">All collections</option>
            {collections.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="panel-list">
        {recipes.map(recipe => {
          const isExpanded = expandedId === recipe.id
          const { status, total } = recipeStatus(recipe, pantryMap)
          return (
            <div key={recipe.id} className="recipe-item">
              <div
                className={`recipe-row${isExpanded ? ' expanded' : ''}`}
                onClick={() => handleRowClick(recipe.id)}
              >
                <button
                  className="recipe-star"
                  onClick={e => { e.stopPropagation(); onToggleFavourite(recipe.id) }}
                  style={{ color: recipe.favorite ? 'var(--star-active)' : 'var(--tx-muted)' }}
                >
                  ★
                </button>
                <span className="recipe-title">{recipe.title}</span>
                {recipe.tag && <span className="coll-pill">{recipe.tag}</span>}
              </div>

              {isExpanded && (
                <div className="recipe-preview">
                  <div className="recipe-preview-cost">
                    <span className={`status-dot ${status}`} />
                    {total !== null && (
                      <span className="recipe-preview-total">R{total.toFixed(2)}</span>
                    )}
                    <button
                      className="ctrl-btn"
                      onClick={e => { e.stopPropagation(); onOpenCosting(recipe) }}
                    >
                      View costing breakdown
                    </button>
                  </div>
                  <div className="recipe-preview-actions">
                    <button className="ctrl-btn" onClick={e => e.stopPropagation()}>
                      Edit recipe
                    </button>
                    <button
                      className="ctrl-btn recipe-delete-btn"
                      onClick={e => handleDelete(e, recipe.id)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
