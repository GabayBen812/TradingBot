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
import BotSignal from './pages/BotSignal'
import BotAnalytics from './pages/BotAnalytics'
import CrossAnalytics from './pages/CrossAnalytics'
import { SupabaseProvider } from './supabase/SupabaseProvider'
import { BotMonitorProvider } from './supabase/BotMonitorProvider'
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
      { path: 'cross/analytics', element: <CrossAnalytics /> },
      { path: 'bot', element: <Bot /> },
      { path: 'bot/signal', element: <BotSignal /> },
      { path: 'bot/analytics', element: <BotAnalytics /> },
      { path: 'checklist', element: <Checklist /> },
      { path: 'trades/:id', element: <TradeDetail /> },
    ],
  },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SupabaseProvider>
      <BotMonitorProvider>
        <RouterProvider router={router} />
      </BotMonitorProvider>
    </SupabaseProvider>
  </React.StrictMode>,
)