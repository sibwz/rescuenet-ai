'use client'

import { X } from 'lucide-react'
import { useEffect } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  maxWidth?: string
}

export default function Modal({ open, onClose, title, children, maxWidth = 'max-w-xl' }: ModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 backdrop-blur-sm"
        style={{ background: 'rgba(9,14,24,0.75)' }}
        onClick={onClose}
      />
      <div
        className={`relative w-full ${maxWidth} rounded-2xl`}
        style={{
          background: '#1A2332',
          border: '1px solid #2A3647',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset',
        }}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid #2A3647' }}
        >
          <h2 className="font-semibold text-base" style={{ color: '#E5E7EB' }}>{title}</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: 'rgba(42,54,71,0.5)', color: '#94A3B8' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#E5E7EB' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#94A3B8' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
