import { useState } from 'react'
import './MyPantry.css'

function formatPkg(item) {
  return `${item.packageValue}${item.packageUnit} @ R${item.packagePrice.toFixed(2)}`
}

function formatCostPerUnit(item) {
  if (item.baseUnit === 'each') return `R${item.costPerUnit.toFixed(2)}/each`
  if (item.baseUnit === 'ml')   return `R${(item.costPerUnit * 100).toFixed(2)}/100ml`
  return `R${(item.costPerUnit * 100).toFixed(2)}/100g`
}

export default function MyPantry({ items, onEditIngredient, onUpdatePrices }) {
  const [expandedId, setExpandedId] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())

  function toggleExpand(id) {
    setExpandedId(prev => prev === id ? null : id)
  }

  function toggleSelect(id, e) {
    e.stopPropagation()
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const hasSelection = selectedIds.size > 0

  return (
    <div className="nkc-panel nkc-card">
      <div className="panel-header">
        <p className="panel-heading">My Pantry</p>
        <div className="panel-controls">
          <button
            className="ctrl-btn"
            disabled={!hasSelection}
            style={hasSelection ? { borderColor: 'var(--green-accent)', color: 'var(--green-accent)' } : {}}
            onClick={() => onUpdatePrices([...selectedIds])}
          >
            Update selected prices
          </button>
        </div>
      </div>

      <div className="panel-list">
        {items.map(item => (
          <div key={item.id} className="pantry-item">
            <div className="pantry-row" onClick={() => toggleExpand(item.id)}>
              <input
                type="checkbox"
                checked={selectedIds.has(item.id)}
                onChange={e => toggleSelect(item.id, e)}
                onClick={e => e.stopPropagation()}
              />
              <span className="item-name">{item.canonicalName}</span>
              {item.needsCosting && <span className="stale-dot" />}
              {item.needsCosting
                ? <span className="item-pkg needs-costing">needs costing</span>
                : <span className="item-pkg">{formatPkg(item)}</span>
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
                <button className="edit-btn" onClick={() => onEditIngredient(item)}>
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
