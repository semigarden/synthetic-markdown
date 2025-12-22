import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles/index.module.scss'
import App from '@/App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)

export * from '@/App.tsx'
