import { useState, useMemo, useRef, useEffect } from 'react'
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
  expandedId,
  onExpandRecipe,
  onToggleFavourite,
  onOpenCosting,
  onEditRecipe,
  onDeleteRecipe,
  onFavFilterChange,
  onCollectionChange,
}) {
  const [favActive,          setFavActive]          = useState(false)
  const [selectedCollections, setSelectedCollections] = useState([])
  const [collectionsOpen,    setCollectionsOpen]    = useState(false)
  const [searchQuery,        setSearchQuery]        = useState('')

  const searchRef      = useRef(null)
  const collectionsRef = useRef(null)
  const itemRefs       = useRef({})

  const pantryMap = useMemo(() => {
    const m = new Map()
    if (pantry) pantry.forEach(p => m.set(p.id, p))
    return m
  }, [pantry])

  const filteredRecipes = useMemo(() => {
    if (!searchQuery.trim()) return recipes
    const q = searchQuery.toLowerCase()
    return recipes.filter(r => r.title.toLowerCase().includes(q))
  }, [recipes, searchQuery])

  useEffect(() => {
    if (!collectionsOpen) return
    function handleOutside(e) {
      if (!collectionsRef.current?.contains(e.target)) setCollectionsOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [collectionsOpen])

  function handleFavClick() {
    const next = !favActive
    setFavActive(next)
    onFavFilterChange(next)
  }

  function toggleCollection(c) {
    const next = selectedCollections.includes(c)
      ? selectedCollections.filter(x => x !== c)
      : [...selectedCollections, c]
    setSelectedCollections(next)
    onCollectionChange(next)
  }

  function handleRowClick(id) {
    const next = expandedId === id ? null : id
    onExpandRecipe(next)
    if (next !== null) {
      setTimeout(() => itemRefs.current[next]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 0)
    }
  }

  function handleDelete(e, id) {
    e.stopPropagation()
    if (window.confirm('Delete recipe. Are you sure?')) {
      onDeleteRecipe(id)
      if (expandedId === id) onExpandRecipe(null)
    }
  }

  const collectionLabel = selectedCollections.length === 0
    ? 'All collections'
    : selectedCollections.length === 1
    ? selectedCollections[0]
    : `${selectedCollections.length} selected`

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
          {collections.length > 0 && (
            <div className="coll-dropdown" ref={collectionsRef}>
              <button
                className={`ctrl-btn${selectedCollections.length ? ' active' : ''}`}
                onClick={() => setCollectionsOpen(o => !o)}
              >
                {collectionLabel} ▾
              </button>
              {collectionsOpen && (
                <div className="coll-menu">
                  {collections.map(c => (
                    <label key={c} className="coll-option">
                      <input
                        type="checkbox"
                        checked={selectedCollections.includes(c)}
                        onChange={() => toggleCollection(c)}
                      />
                      {c}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="search-row">
          <input
            ref={searchRef}
            className="search-input"
            type="text"
            placeholder="Search recipes…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="search-clear"
              onClick={() => { setSearchQuery(''); searchRef.current?.focus() }}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="panel-list">
        {filteredRecipes.map(recipe => {
          const isExpanded = expandedId === recipe.id
          const { status, total } = recipeStatus(recipe, pantryMap)
          return (
            <div
              key={recipe.id}
              className="recipe-item"
              ref={el => { itemRefs.current[recipe.id] = el }}
            >
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
                {recipe.collection && (
                  <span className="coll-pill">
                    {recipe.collection.split(',')[0].trim()}
                  </span>
                )}
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
                    <button
                      className="ctrl-btn"
                      onClick={e => { e.stopPropagation(); onEditRecipe?.(recipe) }}
                    >
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
