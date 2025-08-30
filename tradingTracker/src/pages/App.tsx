import React from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../supabase/SupabaseProvider'
import Button from '../components/ui/Button'
import BottomNav from '../components/ui/BottomNav'
import { useTranslation } from 'react-i18next'
import { setLanguage } from '../i18n'
import NicknameModal from '../components/NicknameModal'

export default function App() {
  const { user, signInWithGoogle, signOut, nickname, setNickname } = useAuth()
  const location = useLocation()
  const { t, i18n } = useTranslation()

  React.useEffect(() => {
    const lng = i18n.language.startsWith('he') ? 'he' : 'en'
    const dir = lng === 'he' ? 'rtl' : 'ltr'
    document.documentElement.lang = lng
    document.documentElement.dir = dir
  }, [i18n.language])

  // Nickname is fetched in SupabaseProvider; modal below will handle setting it

  const linkCls = (path: string) => `px-3 py-2 rounded-md ${location.pathname === path || (path !== '/' && location.pathname.startsWith(path)) ? 'bg-gray-800' : 'hover:bg-gray-800'}`

  // Public routes: allow viewing cross page and trade details without authentication
  if (location.pathname.startsWith('/cross') || location.pathname.startsWith('/trades/')) {
    return (
      <div className="min-h-screen flex flex-col pb-12 sm:pb-0">
        <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <nav className="flex items-center gap-2">
              <Link to="/" className={linkCls('/')}>{t('nav.trades')}</Link>
              <Link to="/stats" className={linkCls('/stats')}>{t('nav.stats')}</Link>
              {/* <Link to="/sage" className={linkCls('/sage')}>{t('nav.sage')}</Link> */}
              <Link to="/cross" className={linkCls('/cross')}>{t('nav.cross')}</Link>
              <Link to="/bot" className={linkCls('/bot')}>{t('nav.bot')}</Link>
            </nav>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <select
                  className="bg-gray-800 text-sm rounded px-2 py-1"
                  value={i18n.language.startsWith('he') ? 'he' : 'en'}
                  onChange={(e) => setLanguage(e.target.value as 'he' | 'en')}
                  aria-label={t('nav.lang') as string}
                >
                  <option value="he">{t('nav.lang.he')}</option>
                  <option value="en">{t('nav.lang.en')}</option>
                </select>
                {user ? (
                  <Button variant="secondary" size="sm" onClick={signOut}>{t('nav.signOut')}</Button>
                ) : (
                  <Button size="sm" onClick={signInWithGoogle}>{t('auth.continueWithGoogle')}</Button>
                )}
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
          <Outlet />
        </main>
        <BottomNav />
        {user && !nickname && (
          <NicknameModal open userId={user.id} onSaved={(n) => setNickname(n)} />
        )}
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-gray-800 rounded-2xl p-8 shadow-xl">
          <h1 className="text-2xl font-bold mb-2">{t('app.title')}</h1>
          <p className="text-gray-300 mb-6">{t('app.signInPrompt')}</p>
          <Button className="w-full" onClick={signInWithGoogle}>{t('auth.continueWithGoogle')}</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col pb-12 sm:pb-0">
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <nav className="flex items-center gap-2">
            <Link to="/" className={linkCls('/')}>{t('nav.trades')}</Link>
            <Link to="/stats" className={linkCls('/stats')}>{t('nav.stats')}</Link>
            <Link to="/cross" className={linkCls('/cross')}>{t('nav.cross')}</Link>
            <Link to="/bot" className={linkCls('/bot')}>{t('nav.bot')}</Link>
          </nav>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-sm text-gray-400">{t('nav.user', { email: user.email })}</span>
            </div>
            <div className="flex items-center gap-2">
              <select
                className="bg-gray-800 text-sm rounded px-2 py-1"
                value={i18n.language.startsWith('he') ? 'he' : 'en'}
                onChange={(e) => setLanguage(e.target.value as 'he' | 'en')}
                aria-label={t('nav.lang') as string}
              >
                <option value="he">{t('nav.lang.he')}</option>
                <option value="en">{t('nav.lang.en')}</option>
              </select>
              <Button variant="secondary" size="sm" onClick={signOut}>{t('nav.signOut')}</Button>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>
      <BottomNav />
      {user && !nickname && (
        <NicknameModal open userId={user.id} onSaved={(n) => setNickname(n)} />
      )}
    </div>
  )
}