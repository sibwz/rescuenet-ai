'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect } from 'react'
import { Map, AlertTriangle, Users, Package, Target, RefreshCw, Activity } from 'lucide-react'

const DisasterMap = dynamic(() => import('@/components/map/DisasterMap'), {
  ssr: false,
  loading: () => (
    <div
      className="w-full h-full flex items-center justify-center rounded-2xl"
      style={{ background: 'rgba(13,20,37,0.95)' }}
    >
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm" style={{ color: '#64748b' }}>Loading map...</p>
      </div>
    </div>
  ),
})

interface MapStats {
  totalEmergencies: number
  criticalEmergencies: number
  availableVolunteers: number
  availableResources: number
  activeMissions: number
}

export default function MapPage() {
  const [filters, setFilters] = useState({
    emergencies: true,
    volunteers: true,
    resources: true,
    missions: true,
  })
  const [stats, setStats] = useState<MapStats | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/map-data')
        const data = await res.json() as { stats: MapStats }
        setStats(data.stats)
        setLastUpdated(new Date())
      } catch { /* ignore */ }
    }
    fetchStats()
  }, [refreshKey])

  function toggleFilter(key: keyof typeof filters) {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="p-5 h-screen flex flex-col gap-4 page-enter">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Map className="w-5 h-5 text-blue-400" />
            Disaster Operations Map
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>
            Live view · Pakistan emergency response coverage
          </p>
        </div>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8' }}
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* ── Left Panel ──────────────────────────────── */}
        <div className="w-60 flex-shrink-0 flex flex-col gap-3">
          {/* Layer Filters */}
          <div
            className="rounded-2xl p-4"
            style={{ background: 'rgba(13,20,37,0.95)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#475569' }}>Layer Filters</h2>
            <div className="space-y-2">
              <FilterToggle active={filters.emergencies} color="red" icon={<AlertTriangle className="w-3.5 h-3.5" />} label="Emergencies" onClick={() => toggleFilter('emergencies')} />
              <FilterToggle active={filters.volunteers} color="blue" icon={<Users className="w-3.5 h-3.5" />} label="Volunteers" onClick={() => toggleFilter('volunteers')} />
              <FilterToggle active={filters.resources} color="purple" icon={<Package className="w-3.5 h-3.5" />} label="Resources" onClick={() => toggleFilter('resources')} />
              <FilterToggle active={filters.missions} color="teal" icon={<Target className="w-3.5 h-3.5" />} label="Missions" onClick={() => toggleFilter('missions')} />
            </div>
          </div>

          {/* Legend */}
          <div
            className="rounded-2xl p-4"
            style={{ background: 'rgba(13,20,37,0.95)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#475569' }}>Urgency Scale</h2>
            <div className="space-y-2.5">
              {[
                { color: '#f87171', label: 'Critical', size: 14 },
                { color: '#fb923c', label: 'High', size: 11 },
                { color: '#facc15', label: 'Medium', size: 9 },
                { color: '#4ade80', label: 'Low', size: 7 },
              ].map(({ color, label, size }) => (
                <div key={label} className="flex items-center gap-2.5">
                  <span
                    className="rounded-full flex-shrink-0"
                    style={{ width: size, height: size, backgroundColor: color, opacity: 0.85 }}
                  />
                  <span className="text-xs font-medium" style={{ color: '#94a3b8' }}>{label}</span>
                </div>
              ))}
              <div className="pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-2.5 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#3b82f6' }} />
                  <span className="text-xs" style={{ color: '#94a3b8' }}>Volunteer</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#9333ea' }} />
                  <span className="text-xs" style={{ color: '#94a3b8' }}>Resource Depot</span>
                </div>
              </div>
            </div>
          </div>

          {/* Live Stats */}
          <div
            className="rounded-2xl p-4 flex-1"
            style={{ background: 'rgba(13,20,37,0.95)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#475569' }}>Live Statistics</h2>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 dot-live" />
                <span className="text-[10px] font-medium text-emerald-400">Live</span>
              </div>
            </div>
            {stats ? (
              <div className="space-y-3">
                {[
                  { label: 'Total Emergencies', value: stats.totalEmergencies, color: '#f1f5f9' },
                  { label: 'Critical', value: stats.criticalEmergencies, color: '#f87171' },
                  { label: 'Avail. Volunteers', value: stats.availableVolunteers, color: '#60a5fa' },
                  { label: 'Avail. Resources', value: stats.availableResources, color: '#c084fc' },
                  { label: 'Active Missions', value: stats.activeMissions, color: '#4ade80' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: '#64748b' }}>{label}</span>
                    <span className="font-bold text-sm" style={{ color }}>{value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="skeleton h-4 w-full rounded" />
                ))}
              </div>
            )}
            <p className="text-[10px] mt-3" style={{ color: '#334155' }}>
              Updated {lastUpdated.toLocaleTimeString()}
            </p>
          </div>
        </div>

        {/* ── Map Container ────────────────────────────── */}
        <div
          className="flex-1 rounded-2xl overflow-hidden min-h-0"
          style={{ border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <DisasterMap key={refreshKey} filters={filters} />
        </div>
      </div>
    </div>
  )
}

function FilterToggle({
  active, color, icon, label, onClick,
}: {
  active: boolean
  color: string
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  const colorMap: Record<string, React.CSSProperties> = {
    red: { color: '#f87171', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)' },
    blue: { color: '#60a5fa', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)' },
    purple: { color: '#c084fc', background: 'rgba(192,132,252,0.1)', border: '1px solid rgba(192,132,252,0.2)' },
    teal: { color: '#2dd4bf', background: 'rgba(45,212,191,0.1)', border: '1px solid rgba(45,212,191,0.2)' },
  }
  const inactiveStyle: React.CSSProperties = {
    color: '#475569', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
  }

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
      style={active ? colorMap[color] : inactiveStyle}
    >
      {icon}
      {label}
      <Activity className="ml-auto w-3 h-3 opacity-50" />
    </button>
  )
}
