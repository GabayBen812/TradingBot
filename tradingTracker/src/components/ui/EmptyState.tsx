import React from 'react'

export default function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="text-center text-gray-300 py-10">
      <div className="text-lg font-semibold">{title}</div>
      {description && <div className="text-sm text-gray-400 mt-1">{description}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}