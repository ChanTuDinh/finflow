import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { StoreProvider } from './lib/store.jsx'
import { PeriodProvider } from './lib/period.jsx'
import { SelectionProvider } from './lib/selection.jsx'

createRoot(document.getElementById('root')).render(
  <StoreProvider>
    <PeriodProvider>
      <SelectionProvider>
        <App />
      </SelectionProvider>
    </PeriodProvider>
  </StoreProvider>,
)
