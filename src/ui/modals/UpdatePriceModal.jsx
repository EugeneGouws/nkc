import { useState, useMemo, useEffect } from 'react'
import { fetchPriceOptions } from '../../lib/pricer.js'
import './modal-base.css'
import './UpdatePriceModal.css'

export default function UpdatePriceModal({ isOpen, selectedIds, pantry, onSave, onClose }) {
  const [cursor, setCursor] = useState(0)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)

  const pantryMap = useMemo(() => {
    const m = new Map()
    if (pantry) pantry.forEach(p => m.set(p.id, p))
    return m
  }, [pantry])

  const ids = selectedIds ?? []
  const done = cursor >= ids.length
  const currentId = ids[cursor]
  const currentItem = pantryMap.get(currentId)

  useEffect(() => {
    if (!isOpen || !currentItem) {
      setResults([])
      setLoading(false)
      setError(null)
      return
    }

    const fetchPrices = async () => {
      setLoading(true)
      setError(null)
      console.log(`[UpdatePrice] Fetching prices for: "${currentItem.canonicalName}"`)
      try {
        const options = await fetchPriceOptions(currentItem)
        console.log(`[UpdatePrice] Got ${options.length} price options`)
        setResults(options)
      } catch (err) {
        console.error('[UpdatePrice] Failed to fetch prices:', err)
        setError(err.message || 'Failed to fetch prices')
        setResults([])
      } finally {
        setLoading(false)
      }
    }

    fetchPrices()
  }, [isOpen, currentItem, retryCount])

  if (!isOpen) return null

  function advance() {
    setRetryCount(0)
    if (cursor + 1 >= ids.length) onClose()
    else setCursor(c => c + 1)
  }

  function handleSkip() {
    advance()
  }

  function handleSelect(result) {
    const today = new Date().toISOString().split('T')[0]
    const priceNum = parseFloat(String(result.product.price ?? '').replace(/[^0-9.]/g, ''))
    onSave?.(currentId, {
      costPerUnit:    result.costPerUnit,
      packageValue:   result.packageValue,
      packageUnit:    result.packageUnit,
      packagePrice:   isNaN(priceNum) ? null : priceNum,
      matchedProduct: result.product.name ?? result.product.title ?? '',
      dateLastUpdated: today,
    })
    advance()
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
          {loading && <span className="status-dot dot-thinking" />}
          <span className="price-current-name">
            {currentItem?.canonicalName ?? currentId}
          </span>
          <button className="ctrl-btn price-skip-btn" onClick={handleSkip}>
            Skip →
          </button>
        </div>
      </div>

      <div className="panel-list">
        {loading ? (
          <p className="price-loading-msg">
            <span className="status-dot dot-thinking" /> Searching…
          </p>
        ) : error ? (
          <div className="price-error">
            <p className="price-error-msg">{error}</p>
            <button className="ctrl-btn price-error-retry" onClick={() => setRetryCount(c => c + 1)}>Retry</button>
            <button className="ctrl-btn" onClick={handleSkip}>Skip →</button>
          </div>
        ) : results.length === 0 ? (
          <p className="price-no-results">No products found</p>
        ) : (
          results.map((result, i) => {
            const name = result.product.name ?? result.product.title ?? '—'
            const rawPrice = parseFloat(String(result.product.price ?? '').replace(/[^0-9.]/g, ''))
            const pkg  = result.packageValue != null
              ? `${result.packageValue}${result.packageUnit} @ R${isNaN(rawPrice) ? '?' : rawPrice.toFixed(2)}`
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
