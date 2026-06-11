'use client'

import { useState } from 'react'
import { MapPin, Loader2, AlertCircle } from 'lucide-react'

export interface LocationResult {
  location: string
  lat: number
  lng: number
}

interface Props {
  onLocation: (result: LocationResult) => void
  onError?: (message: string) => void
}

export default function UseLocationButton({ onLocation, onError }: Props) {
  const [status, setStatus] = useState<'idle' | 'locating' | 'geocoding' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function detect() {
    if (!navigator.geolocation) {
      const msg = 'Geolocation is not supported by your browser.'
      setStatus('error')
      setErrorMsg(msg)
      onError?.(msg)
      return
    }

    setStatus('locating')
    setErrorMsg(null)

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setStatus('geocoding')
        const { latitude, longitude } = pos.coords

        try {
          const res = await fetch('/api/reverse-geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat: latitude, lng: longitude }),
          })
          const data = await res.json() as { location?: string; lat?: number; lng?: number; error?: string }

          if (data.location && data.lat && data.lng) {
            onLocation({ location: data.location, lat: data.lat, lng: data.lng })
            setStatus('idle')
          } else {
            throw new Error(data.error ?? 'No address returned')
          }
        } catch {
          const msg = 'Could not determine address from GPS. Enter location manually.'
          setStatus('error')
          setErrorMsg(msg)
          onError?.(msg)
        }
      },
      (err) => {
        const msg =
          err.code === 1
            ? 'Location permission denied. Please enter area name manually.'
            : 'Could not detect GPS location. Enter location manually.'
        setStatus('error')
        setErrorMsg(msg)
        onError?.(msg)
      },
      { timeout: 10000, maximumAge: 30000 }
    )
  }

  const busy = status === 'locating' || status === 'geocoding'

  return (
    <div className="mt-1.5 space-y-1">
      <button
        type="button"
        onClick={detect}
        disabled={busy}
        className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all"
        style={{
          background: 'rgba(96,165,250,0.08)',
          border: '1px solid rgba(96,165,250,0.2)',
          color: busy ? '#93c5fd' : '#60a5fa',
          cursor: busy ? 'wait' : 'pointer',
          opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            {status === 'locating' ? 'Getting GPS…' : 'Finding address…'}
          </>
        ) : (
          <>
            <MapPin className="w-3 h-3" />
            Use Current Location
          </>
        )}
      </button>
      {status === 'error' && errorMsg && (
        <p className="flex items-center gap-1 text-[11px]" style={{ color: '#f87171' }}>
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          {errorMsg}
        </p>
      )}
    </div>
  )
}
