import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function BottomNav() {
  const loc = useLocation()
  const { t } = useTranslation()
  const isActive = (p: string) => (p === '/' ? loc.pathname === '/' : loc.pathname.startsWith(p))
  const item = (to: string, label: string) => (
    <Link to={to} className={`flex-1 text-center py-2 ${isActive(to) ? 'text-white' : 'text-gray-400'}`}>{label}</Link>
  )
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-900/90 backdrop-blur border-t border-gray-800 sm:hidden">
      <div className="max-w-6xl mx-auto flex">
        {item('/', t('nav.trades'))}
        {item('/stats', t('nav.stats'))}
        {item('/sage', t('nav.sage'))}
      </div>
    </nav>
  )
}