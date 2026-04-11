import { useState, useRef, useEffect } from 'react'
import { importRecipe, importFromFile } from '../lib/index.js'
import './ImportBar.css'

export default function ImportBar({ pantry, onImport }) {
  const [dragOver,  setDragOver]  = useState(false)
  const [hidePaste, setHidePaste] = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)

  const rootRef      = useRef(null)
  const textareaRef  = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    const ro = new ResizeObserver(([entry]) => {
      setHidePaste(entry.contentRect.width < 460)
    })
    ro.observe(rootRef.current)
    return () => ro.disconnect()
  }, [])

  function handleTextareaInput(e) {
    const el = e.target
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  async function handleFile(file) {
    setError(null)
    setLoading(true)
    try {
      const recipe = await importFromFile(file, pantry)
      onImport(recipe)
    } catch (err) {
      setError(err.message ?? 'Failed to read file')
    } finally {
      setLoading(false)
    }
  }

  function handleImport() {
    const text = textareaRef.current?.value?.trim()
    if (!text) return
    setError(null)
    try {
      const recipe = importRecipe(text, pantry)
      if (textareaRef.current) {
        textareaRef.current.value = ''
        textareaRef.current.style.height = 'auto'
      }
      onImport(recipe)
    } catch (err) {
      setError(err.message ?? 'Failed to parse recipe')
    }
  }

  function handleDragOver(e) {
    e.preventDefault()
    setDragOver(true)
  }

  function handleDragLeave() {
    setDragOver(false)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleFileInput(e) {
    const file = e.target.files[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  return (
    <div className="import-bar nkc-card" ref={rootRef}>
      <div className="import-inner">
        <div
          className={`drop-zone${dragOver ? ' drag-over' : ''}${loading ? ' loading' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !loading && fileInputRef.current?.click()}
        >
          {loading ? 'Parsing…' : hidePaste ? '↑ Click to browse' : '↑ Drop file · click to browse'}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.docx,.pdf"
          style={{ display: 'none' }}
          onChange={handleFileInput}
        />

        {!hidePaste && (
          <textarea
            ref={textareaRef}
            className="paste-area"
            placeholder="Paste recipe text here…"
            onInput={handleTextareaInput}
          />
        )}

        <button
          className="import-btn"
          onClick={handleImport}
          disabled={loading}
        >
          Import Recipe
        </button>
      </div>

      {error && <p className="import-error">{error}</p>}
    </div>
  )
}
