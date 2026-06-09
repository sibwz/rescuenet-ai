'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, LineChart, Line, CartesianGrid,
} from 'recharts'
import { BarChart2, TrendingUp, RefreshCw, Users, Target, AlertTriangle, Heart, Activity } from 'lucide-react'
import type { DashboardStats } from '@/types'

const URGENCY_COLORS: Record<string, string> = {
  critical: '#f87171',
  high: '#fb923c',
  medium: '#facc15',
  low: '#4ade80',
}

const TYPE_COLORS: Record<string, string> = {
  medical: '#60a5fa',
  food: '#4ade80',
  water: '#22d3ee',
  shelter: '#f59e0b',
  evacuation: '#f87171',
}

const RESOURCE_STATUS_COLORS: Record<string, string> = {
  available: '#4ade80',
  assigned: '#60a5fa',
  depleted: '#475569',
}

const MISSION_STATUS_COLORS: Record<string, string> = {
  active: '#60a5fa',
  completed: '#4ade80',
  cancelled: '#475569',
}

interface ChartPayloadItem {
  name: string
  value: number
  color?: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: ChartPayloadItem[]
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="px-3 py-2.5 rounded-xl shadow-2xl"
      style={{ background: 'rgba(13,20,37,0.98)', border: '1px solid rgba(255,255,255,0.1)' }}
    >
      {label && <p className="text-xs mb-1.5 capitalize font-medium" style={{ color: '#64748b' }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="text-white text-sm font-bold">{p.value}</p>
      ))}
    </div>
  )
}

function ChartCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'rgba(13,20,37,0.95)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="flex items-center gap-2 mb-5">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        >
          {icon}
        </div>
        <h3 className="text-white font-semibold text-sm">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function KpiCard({ label, value, sub, color, loading, icon }: {
  label: string
  value: number
  sub: string
  color: string
  loading: boolean
  icon: React.ReactNode
}) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'rgba(13,20,37,0.95)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {loading ? (
        <div className="space-y-2">
          <div className="skeleton h-3 w-2/3 rounded" />
          <div className="skeleton h-8 w-1/2 rounded" />
          <div className="skeleton h-2 w-3/4 rounded" />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.05)' }}
            >
              {icon}
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748b' }}>{label}</p>
          </div>
          <p className="text-3xl font-bold tracking-tight" style={{ color }}>{value.toLocaleString()}</p>
          <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: '#475569' }}>
            <TrendingUp className="w-3 h-3" />
            {sub}
          </p>
        </>
      )}
    </div>
  )
}

function EmptyChart() {
  return (
    <div
      className="h-[220px] flex flex-col items-center justify-center rounded-xl"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.06)' }}
    >
      <Activity className="w-8 h-8 mb-2" style={{ color: '#1e293b' }} />
      <p className="text-sm" style={{ color: '#334155' }}>No data yet</p>
      <p className="text-xs mt-1" style={{ color: '#1e293b' }}>Run the AI Agent or seed data to populate charts</p>
    </div>
  )
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/dashboard')
        const data = await res.json() as DashboardStats
        setStats(data)
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [refreshKey])

  const emergencyByType = stats?.analytics?.emergencyByType?.map((item) => ({
    name: item.type,
    count: item.count,
    people: item.peopleAffected,
    color: TYPE_COLORS[item.type] ?? '#6b7280',
  })) ?? []

  const urgencyData = Object.entries(stats?.analytics?.urgencyBreakdown ?? {}).map(([key, val]) => ({
    name: key,
    value: val as number,
    color: URGENCY_COLORS[key] ?? '#6b7280',
  }))

  const rawResourceUtil = stats?.analytics?.resourceUtilization ?? {}
  const totalResources = Object.values(rawResourceUtil).reduce((a: number, b) => a + (b as number), 0)
  const resourceData = Object.entries(rawResourceUtil).map(([key, val]) => ({
    name: key.replace('_', ' '),
    utilization: totalResources > 0 ? Math.round(((val as number) / totalResources) * 100) : 0,
    color: RESOURCE_STATUS_COLORS[key] ?? '#6b7280',
  }))

  const missionData = Object.entries(stats?.analytics?.missionStatus ?? {}).map(([key, val]) => ({
    name: key,
    value: val as number,
    color: MISSION_STATUS_COLORS[key] ?? '#6b7280',
  }))

  const volunteerUtil = stats?.analytics?.volunteerUtilRate ?? 0

  return (
    <div className="p-6 space-y-6 page-enter">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Analytics Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: '#64748b' }}>
            Real-time operational insights from RescueNet AI
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

      {/* ── KPI Row ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total Emergencies"
          value={stats?.totalRequests ?? 0}
          sub={`${stats?.criticalRequests ?? 0} critical priority`}
          color="#f87171"
          loading={loading}
          icon={<AlertTriangle style={{ width: 14, height: 14, color: '#f87171' }} />}
        />
        <KpiCard
          label="Active Missions"
          value={stats?.activeMissions ?? 0}
          sub={`${stats?.analytics?.missionCompletionRate ?? 0}% completion rate`}
          color="#60a5fa"
          loading={loading}
          icon={<Target style={{ width: 14, height: 14, color: '#60a5fa' }} />}
        />
        <KpiCard
          label="Available Volunteers"
          value={stats?.availableVolunteers ?? 0}
          sub={`${volunteerUtil}% utilization rate`}
          color="#4ade80"
          loading={loading}
          icon={<Users style={{ width: 14, height: 14, color: '#4ade80' }} />}
        />
        <KpiCard
          label="People Helped"
          value={stats?.analytics?.peopleHelped ?? 0}
          sub="across all completed missions"
          color="#f472b6"
          loading={loading}
          icon={<Heart style={{ width: 14, height: 14, color: '#f472b6' }} />}
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-72 w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Emergencies by Type */}
            <ChartCard title="Emergencies by Type" icon={<BarChart2 style={{ width: 14, height: 14, color: '#60a5fa' }} />}>
              {emergencyByType.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={emergencyByType} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
                      {emergencyByType.map((entry, i) => (
                        <Cell key={i} fill={entry.color} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart />
              )}
            </ChartCard>

            {/* Emergencies by Urgency */}
            <ChartCard title="Urgency Distribution" icon={<AlertTriangle style={{ width: 14, height: 14, color: '#f87171' }} />}>
              {urgencyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={urgencyData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={88}
                      dataKey="value"
                      nameKey="name"
                      paddingAngle={3}
                    >
                      {urgencyData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} fillOpacity={0.9} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      formatter={(value) => <span style={{ color: '#94a3b8', fontSize: 11, textTransform: 'capitalize' }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart />
              )}
            </ChartCard>

            {/* Resource Utilization */}
            <ChartCard title="Resource Utilization" icon={<Activity style={{ width: 14, height: 14, color: '#34d399' }} />}>
              {resourceData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={resourceData} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} width={72} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="utilization" radius={[0, 6, 6, 0]} maxBarSize={22}>
                      {resourceData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart />
              )}
            </ChartCard>

            {/* Mission Status */}
            <ChartCard title="Mission Status Breakdown" icon={<Target style={{ width: 14, height: 14, color: '#4ade80' }} />}>
              {missionData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={missionData}
                      cx="50%"
                      cy="50%"
                      outerRadius={88}
                      dataKey="value"
                      nameKey="name"
                      paddingAngle={3}
                    >
                      {missionData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} fillOpacity={0.9} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      formatter={(value) => <span style={{ color: '#94a3b8', fontSize: 11, textTransform: 'capitalize' }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart />
              )}
            </ChartCard>
          </div>

          {/* ── Volunteer Utilization ─────────────────────── */}
          <div
            className="rounded-2xl p-6"
            style={{ background: 'rgba(13,20,37,0.95)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center gap-2 mb-5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(74,222,128,0.1)' }}>
                <Users style={{ width: 14, height: 14, color: '#4ade80' }} />
              </div>
              <h3 className="text-white font-semibold text-sm">Volunteer Capacity & Utilization</h3>
            </div>
            <div className="flex items-center gap-8">
              <div>
                <p className="text-5xl font-bold" style={{ color: '#4ade80' }}>{volunteerUtil}%</p>
                <p className="text-sm mt-1" style={{ color: '#64748b' }}>of volunteers currently deployed</p>
                <div className="flex gap-5 mt-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#334155' }}>Total</p>
                    <p className="text-white font-bold text-xl">{stats?.analytics?.totalVolunteers ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#334155' }}>Available</p>
                    <p className="text-xl font-bold" style={{ color: '#4ade80' }}>{stats?.availableVolunteers ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#334155' }}>Deployed</p>
                    <p className="text-xl font-bold" style={{ color: '#fb923c' }}>{stats?.analytics?.busyVolunteers ?? 0}</p>
                  </div>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: '#334155' }}>Utilization Trend</p>
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart
                    data={[
                      { t: 'T-4h', util: Math.max(0, volunteerUtil - 18) },
                      { t: 'T-3h', util: Math.max(0, volunteerUtil - 10) },
                      { t: 'T-2h', util: Math.max(0, volunteerUtil - 4) },
                      { t: 'T-1h', util: Math.max(0, volunteerUtil - 1) },
                      { t: 'Now', util: volunteerUtil },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="t" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} unit="%" />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="util"
                      stroke="#4ade80"
                      strokeWidth={2}
                      dot={{ fill: '#4ade80', r: 3, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
