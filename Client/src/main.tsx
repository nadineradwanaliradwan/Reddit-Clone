import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App'
import '@/styles/globals.css'
import { AppProviders } from '@/providers/app-providers'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>,
)
