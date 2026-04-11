import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { refreshNeedsCosting } from './io/index.js'
import App from './App.jsx'

refreshNeedsCosting()

createRoot(document.getElementById('app')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
