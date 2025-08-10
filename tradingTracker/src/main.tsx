import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './pages/App'
import Trades from './pages/Trades'
import Stats from './pages/Stats'
import Sage from './pages/Sage'
import { SupabaseProvider } from './supabase/SupabaseProvider'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Trades /> },
      { path: 'stats', element: <Stats /> },
      { path: 'sage', element: <Sage /> },
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