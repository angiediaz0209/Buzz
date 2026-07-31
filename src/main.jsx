import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BASE, asset } from './utils/urls'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register the service worker in production only, so the dev server keeps
// serving fresh modules. This is what makes "Install app" available.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(asset('sw.js'), { scope: BASE })
      .catch((error) => console.error('Service worker registration failed:', error))
  })
}
