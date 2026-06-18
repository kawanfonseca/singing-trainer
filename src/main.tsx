import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { RangePage } from './pages/RangePage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {window.location.pathname === '/range' ? <RangePage /> : <App />}
  </StrictMode>,
)
