import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import TravelTimeOptimizer from './TravelTimeOptimizer.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <TravelTimeOptimizer />
  </StrictMode>,
)
