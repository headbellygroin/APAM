import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'
import { initializeMarketCache } from './lib/marketDataCache'

initializeMarketCache().catch((err) => {
  console.error('Market cache warmup failed:', err)
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
