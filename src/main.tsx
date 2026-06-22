import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { RangePage } from './pages/RangePage'
import { PitchPage } from './pages/PitchPage'

const currentPage = window.location.pathname === '/range'
  ? <RangePage />
  : window.location.pathname === '/pitch'
    ? <PitchPage />
    : <App />

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {currentPage}
  </StrictMode>,
)
