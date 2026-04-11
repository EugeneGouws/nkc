import { useState, useEffect, useRef, useMemo } from 'react'
import { refreshNeedsCosting } from './io/index.js'
import useAppState from './hooks/useAppState.js'
import ImportBar from './ui/ImportBar.jsx'
import MyPantry from './ui/MyPantry.jsx'
import MyRecipes from './ui/MyRecipes.jsx'
import AddIngredientModal from './ui/modals/AddIngredientModal.jsx'
import UpdatePriceModal from './ui/modals/UpdatePriceModal.jsx'
import ImportRecipeModal from './ui/modals/ImportRecipeModal.jsx'
import CostingModal from './ui/modals/CostingModal.jsx'
import './styles/tokens.css'
import './styles/base.css'
import './styles/app-shell.css'
import './styles/book-layout.css'
import './styles/panel-shared.css'

export default function App() {
  const { pantry, recipes, addRecipeToState, updateItemPrice, addIngredient, toggleFavourite, deleteRecipe } = useAppState()

  const [favFilterOn, setFavFilterOn]           = useState(false)
  const [collectionFilter, setCollectionFilter] = useState('')
  const [activeTab, setActiveTab]               = useState('pantry')
  const [layoutMode, setLayoutMode]             = useState('wide')
  const [modalState, setModalState]             = useState({ open: false, type: null, context: null })
  const appRef = useRef(null)

  useEffect(() => { refreshNeedsCosting() }, [])

  useEffect(() => {
    const ro = new ResizeObserver(([entry]) => {
      setLayoutMode(entry.contentRect.width >= 660 ? 'wide' : 'narrow')
    })
    ro.observe(appRef.current)
    return () => ro.disconnect()
  }, [])

  const visibleRecipes = useMemo(() =>
    recipes.filter(r => (!favFilterOn || r.favorite) && (!collectionFilter || r.tag === collectionFilter)),
    [recipes, favFilterOn, collectionFilter]
  )

  const pantryItems = useMemo(() => {
    const ids = new Set(visibleRecipes.flatMap(r => r.ingredients.map(i => i.matchedIngredient)))
    return pantry
      .filter(p => ids.has(p.id))
      .sort((a, b) => a.canonicalName.localeCompare(b.canonicalName))
  }, [pantry, visibleRecipes])

  const collections = useMemo(() =>
    [...new Set(recipes.map(r => r.tag).filter(Boolean))].sort(),
    [recipes]
  )

  function openModal(type, context = null) {
    setModalState({ open: true, type, context })
  }

  function closeModal() {
    setModalState({ open: false, type: null, context: null })
  }

  // Renders the active modal into the appropriate wrapper div.
  // mode='wide': left/right half wrappers; mode='narrow': full-panel overlay.
  function renderModals(mode) {
    if (!modalState.open) return null

    function wrap(side, content) {
      if (mode === 'wide') return <div className={`modal-${side}-wrap`}>{content}</div>
      return <div className="modal-full-wrap">{content}</div>
    }

    if (modalState.type === 'editIngredient') return wrap('right',
      <AddIngredientModal
        isOpen
        item={modalState.context}
        onAdd={({ name, baseUnit, pkgValue, pkgUnit, pkgPrice, pkgMatch, conversions, aliases }) => {
          addIngredient({ name, pkgValue, pkgUnit, pkgPrice, pkgMatch, conversions, aliases }, baseUnit)
          closeModal()
        }}
        onClose={closeModal}
      />
    )

    if (modalState.type === 'updatePrices') return wrap('right',
      <UpdatePriceModal
        isOpen
        selectedIds={modalState.context ?? []}
        pantry={pantryItems}
        onSave={(id, data) => updateItemPrice(id, data)}
        onClose={closeModal}
      />
    )

    if (modalState.type === 'import') return wrap('right',
      <ImportRecipeModal
        isOpen
        recipe={modalState.context}
        pantry={pantry}
        onImport={recipe => { addRecipeToState(recipe, {}); closeModal() }}
        onAddIngredient={(ingredient, baseUnit) => addIngredient(ingredient, baseUnit)}
        onClose={closeModal}
      />
    )

    if (modalState.type === 'openCosting') return (
      <CostingModal
        recipe={modalState.context}
        pantry={pantryItems}
        layoutMode={mode}
        onSave={(id, data) => updateItemPrice(id, data)}
        onClose={closeModal}
      />
    )

    return null
  }

  const pantryPanel = (
    <MyPantry
      items={pantryItems}
      onEditIngredient={item => openModal('editIngredient', item)}
      onUpdatePrices={ids => openModal('updatePrices', ids)}
    />
  )

  const recipesPanel = (
    <MyRecipes
      recipes={visibleRecipes}
      collections={collections}
      pantry={pantry}
      onToggleFavourite={toggleFavourite}
      onOpenCosting={recipe => openModal('openCosting', recipe)}
      onDeleteRecipe={deleteRecipe}
      onFavFilterChange={setFavFilterOn}
      onCollectionChange={setCollectionFilter}
    />
  )

  return (
    <div className={`nkc-app${layoutMode === 'narrow' ? ' narrow' : ''}`} ref={appRef}>

      <header className="app-header nkc-card">
        <span className="app-title">Kitchen Costings</span>
        <span className="app-brand">Nana's Kitchen</span>
      </header>

      <ImportBar
        pantry={pantry}
        onImport={recipe => openModal('import', recipe)}
      />

      {layoutMode === 'wide' ? (
        <div className="book-wrap">
          <div className="nkc-panels">
            {pantryPanel}
            <div className="book-spine" aria-hidden="true" />
            {recipesPanel}
            {renderModals('wide')}
            <svg
              aria-hidden="true"
              style={{ position:'absolute', top:0, left:'50%', transform:'translateX(-50%)', pointerEvents:'none', zIndex:51 }}
              width="25" height="5" viewBox="0 0 25 5"
            >
              <path d="M0,0 C4,0 9,3.5 12.5,5 C16,3.5 21,0 25,0 Z" fill="#7B5C3A" />
            </svg>
            <svg
              aria-hidden="true"
              style={{ position:'absolute', bottom:0, left:'50%', transform:'translateX(-50%)', pointerEvents:'none', zIndex:51 }}
              width="25" height="5" viewBox="0 0 25 5"
            >
              <defs>
                <linearGradient id="spine-bottom-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(0,0,0,0.01)" />
                  <stop offset="100%" stopColor="rgba(0,0,0,0.14)" />
                </linearGradient>
              </defs>
              <path d="M0,0 C4,0 9,3.5 12.5,5 C16,3.5 21,0 25,0 Z" fill="url(#spine-bottom-grad)" />
            </svg>
          </div>
          <div className="book-page-stack" aria-hidden="true">
            <svg
              aria-hidden="true"
              style={{ position:'absolute', top:0, left:'50%', transform:'translateX(-50%)', pointerEvents:'none', zIndex:3 }}
              width="25" height="10" viewBox="0 0 25 10"
            >
              <path d="M0,0 L25,0 L25,2 C19,2 15,4 12.5,4 C10,4 6,2 0,2 Z" fill="#f8f4ed"/>
              <path d="M0,2 C6,2 10,4 12.5,4 C15,4 19,2 25,2 L25,3 C19,3 15,4.8 12.5,4.8 C10,4.8 6,3 0,3 Z" fill="#cfc8b8"/>
              <path d="M0,3 C6,3 10,4.8 12.5,4.8 C15,4.8 19,3 25,3 L25,5 C19,5 15,6.3 12.5,6.3 C10,6.3 6,5 0,5 Z" fill="#f0ebe0"/>
              <path d="M0,5 C6,5 10,6.3 12.5,6.3 C15,6.3 19,5 25,5 L25,6 C19,6 15,7 12.5,7 C10,7 6,6 0,6 Z" fill="#c8c0ae"/>
              <path d="M0,6 C6,6 10,7 12.5,7 C15,7 19,6 25,6 L25,8 C19,8 15,8.5 12.5,8.5 C10,8.5 6,8 0,8 Z" fill="#e8e2d5"/>
              <path d="M0,8 C6,8 10,8.5 12.5,8.5 C15,8.5 19,8 25,8 L25,9 C19,9 15,9.2 12.5,9.2 C10,9.2 6,9 0,9 Z" fill="#c0b8a6"/>
              <path d="M0,9 L25,9 L25,10 L0,10 Z" fill="#e0dace"/>
            </svg>
          </div>
        </div>
      ) : (
        <div className="book-wrap">
          <div className="panel-tab-bar">
            <button
              className={`tab-btn${activeTab === 'pantry' ? ' active' : ''}`}
              onClick={() => setActiveTab('pantry')}
            >
              My Pantry
            </button>
            <button
              className={`tab-btn${activeTab === 'recipes' ? ' active' : ''}`}
              onClick={() => setActiveTab('recipes')}
            >
              My Recipes
            </button>
          </div>
          <div className="narrow-panel-wrap">
            {activeTab === 'pantry' ? pantryPanel : recipesPanel}
            {renderModals('narrow')}
          </div>
        </div>
      )}

    </div>
  )
}
