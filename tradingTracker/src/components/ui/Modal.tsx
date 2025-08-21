import React from 'react'

type Props = {
  open: boolean
  title?: React.ReactNode
  children: React.ReactNode
  onClose?: () => void
  dismissible?: boolean
  footer?: React.ReactNode
}

export default function Modal({ open, title, children, onClose, dismissible = true, footer }: Props) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={() => { if (dismissible) onClose?.() }} />
      <div className="relative w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl shadow-xl overflow-hidden">
        {(title || dismissible) && (
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <div className="font-semibold text-white">{title}</div>
            {dismissible && (
              <button aria-label="Close" className="text-gray-400 hover:text-gray-200" onClick={onClose}>✕</button>
            )}
          </div>
        )}
        <div className="px-4 py-4">
          {children}
        </div>
        {footer && (
          <div className="px-4 py-3 border-t border-gray-800 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}


