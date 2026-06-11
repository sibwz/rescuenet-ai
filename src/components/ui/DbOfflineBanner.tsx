'use client'

import { useEffect, useRef, useState } from 'react'
import { WifiOff, RefreshCw } from 'lucide-react'

interface DbOfflineBannerProps {
  onRetry: () => void
}

export default function DbOfflineBanner({ onRetry }: DbOfflineBannerProps) {
  const [countdown, setCountdown] = useState(2)
  // Store latest onRetry in a ref so the interval closure stays fresh
  const onRetryRef = useRef(onRetry)
  useEffect(() => { onRetryRef.current = onRetry })

  useEffect(() => {
    setCountdown(2)
    const interval = setInterval(() => {
      setCountdown((n) => {
        if (n <= 1) {
          clearInterval(interval)
          onRetryRef.current()
          return 2  // reset for next cycle if still offline
        }
        return n - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])  // only on mount/unmount — ref handles freshness

  return (
    <div
      className="rounded-xl px-4 py-3 flex items-center gap-3"
      style={{
        background: 'rgba(245,158,11,0.08)',
        border: '1px solid rgba(245,158,11,0.28)',
      }}
    >
      <WifiOff className="w-4 h-4 flex-shrink-0" style={{ color: '#F59E0B' }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: '#FDE68A' }}>
          Database reconnecting — retrying automatically…
        </p>
        <p className="text-xs mt-0.5" style={{ color: '#D97706' }}>
          Previous data still visible · retrying in {countdown}s
        </p>
      </div>
      <button
        onClick={() => { setCountdown(2); onRetry() }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0 transition-all"
        style={{
          background: 'rgba(245,158,11,0.12)',
          border: '1px solid rgba(245,158,11,0.32)',
          color: '#F59E0B',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(245,158,11,0.22)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(245,158,11,0.12)' }}
      >
        <RefreshCw className="w-3 h-3" />
        Retry Now
      </button>
    </div>
  )
}
