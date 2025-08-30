import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './pages/App'
import Trades from './pages/Trades'
import Stats from './pages/Stats'
import Sage from './pages/Sage'
import Cross from './pages/Cross'
import Bot from './pages/Bot'
import { SupabaseProvider } from './supabase/SupabaseProvider'
import './i18n'
import TradeDetail from './pages/TradeDetail'
import Checklist from './pages/Checklist'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Trades /> },
      { path: 'stats', element: <Stats /> },
      { path: 'sage', element: <Sage /> },
      { path: 'cross', element: <Cross /> },
      { path: 'bot', element: <Bot /> },
      { path: 'checklist', element: <Checklist /> },
      { path: 'trades/:id', element: <TradeDetail /> },
    ],
  },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SupabaseProvider>
      <RouterProvider router={router} />
    </SupabaseProvider>
  </React.StrictMode>,
)