import { useState, useMemo } from 'react'
import './modal-base.css'
import './UpdatePriceModal.css'

export default function UpdatePriceModal({ isOpen, selectedIds, pantry, onSave, onClose }) {
  const [cursor, setCursor] = useState(0)

  const pantryMap = useMemo(() => {
    const m = new Map()
    if (pantry) pantry.forEach(p => m.set(p.id, p))
    return m
  }, [pantry])

  if (!isOpen) return null

  const ids = selectedIds ?? []
  const done = cursor >= ids.length

  const currentId   = ids[cursor]
  const currentItem = pantryMap.get(currentId)

  // Session 5B will replace this with: fetchPriceOptions(currentItem)
  const results = []

  function handleSkip() {
    if (cursor + 1 >= ids.length) onClose()
    else setCursor(c => c + 1)
  }

  function handleSelect(result) {
    const today = new Date().toISOString().split('T')[0]
    onSave?.(currentId, {
      costPerUnit:    result.costPerUnit,
      packageValue:   result.packageValue,
      packageUnit:    result.packageUnit,
      packagePrice:   result.product.price,
      matchedProduct: result.product.name ?? result.product.title ?? '',
      dateLastUpdated: today,
    })
    if (cursor + 1 >= ids.length) onClose()
    else setCursor(c => c + 1)
  }

  if (done) {
    return (
      <div className="update-price-modal">
        <div className="panel-header">
          <div className="panel-heading-row">
            <p className="panel-heading">Searching Checkers 60sixty</p>
            <button className="ctrl-btn modal-close-x" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>
        <div className="price-done">
          <p className="price-done-msg">All done — prices updated</p>
          <button className="ctrl-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    )
  }

  return (
    <div className="update-price-modal">
      <div className="panel-header">
        <div className="panel-heading-row">
          <p className="panel-heading">Searching Checkers 60sixty</p>
          <button className="ctrl-btn modal-close-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="panel-controls">
          <span className="status-dot dot-thinking" />
          <span className="price-current-name">
            {currentItem?.canonicalName ?? currentId}
          </span>
          <button className="ctrl-btn price-skip-btn" onClick={handleSkip}>
            Skip →
          </button>
        </div>
      </div>

      <div className="panel-list">
        {results.length === 0 ? (
          <p className="price-stub-placeholder">
            Price results will show here (Apify — Session 5B)
          </p>
        ) : (
          results.map((result, i) => {
            const name = result.product.name ?? result.product.title ?? '—'
            const pkg  = result.packageValue != null
              ? `${result.packageValue}${result.packageUnit} @ R${result.product.price?.toFixed(2) ?? '?'}`
              : '—'
            return (
              <div key={i} className="price-result-row">
                <span className="price-result-name">{name}</span>
                <span className="price-result-pkg">{pkg}</span>
                <button
                  className="ctrl-btn price-result-select"
                  onClick={() => handleSelect(result)}
                >
                  Select
                </button>
              </div>
            )
          })
        )}
      </div>

      {ids.length > 1 && (
        <div className="price-progress">
          {cursor + 1} of {ids.length}
        </div>
      )}
    </div>
  )
}
