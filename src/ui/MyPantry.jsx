import { useState, useRef } from 'react'
import './MyPantry.css'

function formatPkg(item) {
  return `${item.packageValue}${item.packageUnit} @ R${item.packagePrice.toFixed(2)}`
}

function formatCostPerUnit(item) {
  if (!item.costPerUnit) return '—'
  if (item.baseUnit === 'each') return `R${item.costPerUnit.toFixed(2)}/each`
  if (item.baseUnit === 'ml')   return `R${(item.costPerUnit * 100).toFixed(2)}/100ml`
  return `R${(item.costPerUnit * 100).toFixed(2)}/100g`
}

function dotClass(item) {
  if (!item.packagePrice || !item.costPerUnit) return 'red'
  if (item.needsCosting) return 'amber'
  return 'green'
}

export default function MyPantry({ items, processingIds = new Set(), onEditIngredient, onSearchPrices }) {
  const [expandedId, setExpandedId] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const itemRefs = useRef({})

  function toggleExpand(id) {
    const next = expandedId === id ? null : id
    setExpandedId(next)
    if (next !== null) {
      setTimeout(() => itemRefs.current[next]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 0)
    }
  }

  //toggle sellect on if off and vica versa.
  function toggleSelect(id, e) {
    e.stopPropagation()
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const hasSelection = selectedIds.size > 0
  const allSelected  = items.length > 0 && items.every(item => selectedIds.has(item.id))

  function handleSelectAll() {
    setSelectedIds(allSelected ? new Set() : new Set(items.map(i => i.id)))
  }

  function handleSearch() {
    onSearchPrices([...selectedIds])
    setSelectedIds(new Set())
  }

  return (
    <div className="nkc-panel nkc-card">
      <div className="panel-header">
        <p className="panel-heading">My Pantry</p>
        <div className="panel-controls">
          {items.length > 0 && (
            <input
              type="checkbox"
              checked={allSelected}
              ref={el => { if (el) el.indeterminate = hasSelection && !allSelected }}
              onChange={handleSelectAll}
              style={{ accentColor: 'var(--green-accent)', width: 13, height: 13, cursor: 'pointer', flexShrink: 0 }}
            />
          )}
          <button
            className="ctrl-btn"
            disabled={!hasSelection}
            style={hasSelection ? { borderColor: 'var(--green-accent)', color: 'var(--green-accent)' } : {}}
            onClick={handleSearch}
          >
            Search Checkers Sixty60
          </button>
        </div>
      </div>

      <div className="panel-list">
        {items.length === 0 && (
          <p className="pantry-empty">Select a recipe to see ingredient prices</p>
        )}
        {items.map(item => (
          <div key={item.id} className="pantry-item" ref={el => { itemRefs.current[item.id] = el }}>
            <div className="pantry-row" onClick={() => toggleExpand(item.id)}>
              <input
                type="checkbox"
                checked={selectedIds.has(item.id)}
                onChange={e => toggleSelect(item.id, e)}
                onClick={e => e.stopPropagation()}
              />
              <span className="item-name">{item.canonicalName}</span>
              <span className={`status-dot ${dotClass(item)}`} />
              {dotClass(item) === 'red'
                ? <span className="item-pkg no-price">no price information</span>
                : <span className={`item-pkg${dotClass(item) === 'amber' ? ' needs-costing' : ''}`}>{formatPkg(item)}</span>
              }
              <span className="chevron">{expandedId === item.id ? '▲' : '▼'}</span>
            </div>

            {expandedId === item.id && (
              <div className="pantry-expand">
                <span className="matched-product">
                  <span className="matched-label">Matched: </span>
                  {item.matchedProduct || 'No product matched yet'}
                </span>
                <span className="cost-per-unit">{formatCostPerUnit(item)}</span>
                <button
                  className="edit-btn"
                  onClick={() => onEditIngredient(item)}
                  disabled={processingIds.has(item.id)}
                  style={processingIds.has(item.id) ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                >
                  Edit
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
