import React from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../supabase/SupabaseProvider'
import Button from '../components/ui/Button'
import BottomNav from '../components/ui/BottomNav'

export default function App() {
  const { user, signInWithGoogle, signOut } = useAuth()
  const location = useLocation()

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-gray-800 rounded-2xl p-8 shadow-xl">
          <h1 className="text-2xl font-bold mb-2">Crypto Trading Tracker</h1>
          <p className="text-gray-300 mb-6">Sign in to manage your trades and view performance stats.</p>
          <Button className="w-full" onClick={signInWithGoogle}>Continue with Google</Button>
        </div>
      </div>
    )
  }

  const linkCls = (path: string) => `px-3 py-2 rounded-md ${location.pathname === path || (path !== '/' && location.pathname.startsWith(path)) ? 'bg-gray-800' : 'hover:bg-gray-800'}`

  return (
    <div className="min-h-screen flex flex-col pb-12 sm:pb-0">
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <nav className="flex items-center gap-2">
            <Link to="/" className={linkCls('/')}>Trades</Link>
            <Link to="/stats" className={linkCls('/stats')}>Stats</Link>
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400 hidden sm:block">{user.email}</span>
            <Button variant="secondary" size="sm" onClick={signOut}>Sign out</Button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}