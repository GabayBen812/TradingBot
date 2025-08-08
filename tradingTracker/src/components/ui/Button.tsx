import React from 'react'
import clsx from 'clsx'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}

export default function Button({ className, variant = 'primary', size = 'md', ...props }: Props) {
  const base = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-60 disabled:pointer-events-none'
  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-500 text-white focus:ring-blue-400',
    secondary: 'bg-gray-700 hover:bg-gray-600 text-white focus:ring-gray-400',
    ghost: 'bg-transparent hover:bg-gray-800 text-gray-200 focus:ring-gray-500',
    danger: 'bg-red-600 hover:bg-red-500 text-white focus:ring-red-400',
  } as const
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
  } as const
  return (
    <button className={clsx(base, variants[variant], sizes[size], className)} {...props} />
  )
}