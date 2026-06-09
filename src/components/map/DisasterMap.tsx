'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

interface EmergencyPoint {
  _id: string
  reporterName: string
  location: string
  emergencyType: string
  urgency: string
  urgency_reason?: string
  peopleAffected: number
  description: string
  status: string
  coords: [number, number]
}

interface VolunteerPoint {
  _id: string
  name: string
  location: string
  skills: string[]
  status: string
  phone?: string
  coords: [number, number]
}

interface ResourcePoint {
  _id: string
  resourceType: string
  quantity: number
  location: string
  status: string
  coords: [number, number]
}

interface MapStats {
  totalEmergencies: number
  criticalEmergencies: number
  availableVolunteers: number
  availableResources: number
  activeMissions: number
}

interface MapData {
  emergencies: EmergencyPoint[]
  volunteers: VolunteerPoint[]
  resources: ResourcePoint[]
  missions: unknown[]
  stats: MapStats
}

interface DisasterMapProps {
  filters: {
    emergencies: boolean
    volunteers: boolean
    resources: boolean
    missions: boolean
  }
}

const URGENCY_COLORS: Record<string, string> = {
  critical: '#f87171',
  high: '#fb923c',
  medium: '#facc15',
  low: '#4ade80',
}

const URGENCY_GLOW: Record<string, string> = {
  critical: 'rgba(248,113,113,0.35)',
  high: 'rgba(251,146,60,0.3)',
  medium: 'rgba(250,204,21,0.25)',
  low: 'rgba(74,222,128,0.25)',
}

const EMERGENCY_ICONS: Record<string, string> = {
  medical: '🏥',
  food: '🍱',
  water: '💧',
  shelter: '⛺',
  evacuation: '🚨',
}

const RESOURCE_LABELS: Record<string, string> = {
  food: 'Food Supplies',
  water: 'Water',
  medicine: 'Medicine',
  shelter_kits: 'Shelter Kits',
  vehicles: 'Vehicles',
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length > 0) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const L = require('leaflet')
        const bounds = L.latLngBounds(points)
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 })
      } catch {
        // ignore
      }
    }
  }, [map, points])
  return null
}

export default function DisasterMap({ filters }: DisasterMapProps) {
  const [data, setData] = useState<MapData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/map-data')
        if (!res.ok) throw new Error('Failed to fetch map data')
        const json = await res.json() as MapData
        setData(json)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load map data')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: 'rgba(13,20,37,0.95)' }}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm" style={{ color: '#64748b' }}>Loading map data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: 'rgba(13,20,37,0.95)' }}>
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    )
  }

  const allPoints: [number, number][] = [
    ...(data?.emergencies.map((e) => e.coords) ?? []),
    ...(data?.volunteers.map((v) => v.coords) ?? []),
    ...(data?.resources.map((r) => r.coords) ?? []),
  ]

  // Default center on Pakistan if no data
  const defaultCenter: [number, number] = [30.3753, 69.3451]

  return (
    <MapContainer
      center={defaultCenter}
      zoom={5}
      style={{ height: '100%', width: '100%' }}
      className="rounded-xl"
    >
      {/* Dark-themed tile layer */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />

      {allPoints.length > 0 && <FitBounds points={allPoints} />}

      {/* Emergency markers */}
      {filters.emergencies && data?.emergencies.map((e) => {
        const color = URGENCY_COLORS[e.urgency] ?? '#94a3b8'
        const radius = Math.min(10 + e.peopleAffected / 12, 22)
        return (
          <CircleMarker
            key={e._id}
            center={e.coords}
            radius={radius}
            pathOptions={{
              color: color,
              fillColor: color,
              fillOpacity: 0.75,
              weight: e.urgency === 'critical' ? 2.5 : 1.5,
              opacity: 1,
            }}
          >
            <Popup>
              <div style={{ minWidth: 220, fontFamily: 'system-ui, sans-serif' }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: color }}>
                  {EMERGENCY_ICONS[e.emergencyType] ?? '🚨'} {e.urgency.toUpperCase()} — {e.emergencyType.toUpperCase()}
                </div>
                <p style={{ fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>{e.location}</p>
                <p style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>{e.description}</p>
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 8, fontSize: 11, color: '#475569' }}>
                  <p><strong>Reporter:</strong> {e.reporterName}</p>
                  <p><strong>People affected:</strong> {e.peopleAffected}</p>
                  <p><strong>Status:</strong> <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{e.status}</span></p>
                  {e.urgency_reason && (
                    <p style={{ marginTop: 6, color: '#3b82f6', fontStyle: 'italic', fontSize: 10 }}>{e.urgency_reason}</p>
                  )}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        )
      })}

      {/* Volunteer markers */}
      {filters.volunteers && data?.volunteers.map((v) => (
        <CircleMarker
          key={v._id}
          center={v.coords}
          radius={7}
          pathOptions={{
            color: '#60a5fa',
            fillColor: v.status === 'available' ? '#3b82f6' : '#475569',
            fillOpacity: 0.8,
            weight: 1.5,
          }}
        >
          <Popup>
            <div style={{ minWidth: 190, fontFamily: 'system-ui, sans-serif' }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#3b82f6' }}>👤 Volunteer</div>
              <p style={{ fontWeight: 600, color: '#1e293b' }}>{v.name}</p>
              <p style={{ fontSize: 11, color: '#64748b' }}>{v.location}</p>
              <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 8, paddingTop: 8, fontSize: 11, color: '#475569' }}>
                <p>
                  <strong>Status:</strong>{' '}
                  <span style={{ color: v.status === 'available' ? '#16a34a' : '#d97706', fontWeight: 600 }}>
                    {v.status}
                  </span>
                </p>
                <p><strong>Skills:</strong> {v.skills.join(', ').replace(/_/g, ' ')}</p>
                {v.phone && <p><strong>Phone:</strong> {v.phone}</p>}
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {/* Resource markers */}
      {filters.resources && data?.resources.map((r) => (
        <CircleMarker
          key={r._id}
          center={r.coords}
          radius={7}
          pathOptions={{
            color: '#a855f7',
            fillColor: r.status === 'available' ? '#9333ea' : '#475569',
            fillOpacity: 0.8,
            weight: 1.5,
          }}
        >
          <Popup>
            <div style={{ minWidth: 190, fontFamily: 'system-ui, sans-serif' }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#9333ea' }}>📦 Resource Depot</div>
              <p style={{ fontWeight: 600, color: '#1e293b' }}>{RESOURCE_LABELS[r.resourceType] ?? r.resourceType}</p>
              <p style={{ fontSize: 11, color: '#64748b' }}>{r.location}</p>
              <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 8, paddingTop: 8, fontSize: 11, color: '#475569' }}>
                <p><strong>Quantity:</strong> {r.quantity} units</p>
                <p>
                  <strong>Status:</strong>{' '}
                  <span style={{ color: r.status === 'available' ? '#16a34a' : '#d97706', fontWeight: 600 }}>
                    {r.status}
                  </span>
                </p>
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}
