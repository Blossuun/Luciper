/**
 * src/renderer/main.tsx
 *
 * React 애플리케이션 진입점.
 * React 18 createRoot API를 사용한다.
 */

import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './index.css'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('[Luciper] #root element not found')

createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
