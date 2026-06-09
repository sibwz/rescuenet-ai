'use client'

import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Users,
  Package,
  Target,
  Flame,
  RefreshCw,
  Database,
  ChevronRight,
  Clock,
  Heart,
  TrendingUp,
  Cpu,
  MessageSquare,
  Send,
  BarChart3,
  Activity,
  Zap,
  Shield,
  CheckCircle2,
  ArrowUpRight,
  Radio,
  Map,
  Bot,
} from 'lucide-react'
import Link from 'next/link'
import type { DashboardStats, EmergencyRequest, Mission, NLQueryResult } from '@/types'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'

interface StatCardProps {
  label: string
  value: number | string
  icon: React.ReactNode
  color: string
  iconBg: string
  href: string
  alert?: boolean
  trend?: string
  trendUp?: boolean
}

function StatCard({ label, value, icon, iconBg, href, alert, trend, trendUp }: StatCardProps) {
  return (
    <Link href={href}>
      <div
        className="card-hover rounded-2xl p-5 cursor-pointer group h-full"
        style={{
          background: alert && Number(value) > 0
            ? 'linear-gradient(135deg, rgba(220,38,38,0.1) 0%, rgba(17,27,48,0.95) 60%)'
            : 'linear-gradient(135deg, rgba(17,27,48,0.95) 0%, rgba(13,20,37,0.9) 100%)',
          border: alert && Number(value) > 0
            ? '1px solid rgba(220,38,38,0.3)'
            : '1px solid rgba(255,255,255,0.07)',
          boxShadow: alert && Number(value) > 0
            ? '0 4px 24px rgba(220,38,38,0.08), inset 0 1px 0 rgba(255,255,255,0.05)'
            : '0 4px 24px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        <div className="flex items-start justify-between mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: iconBg }}
          >
            {icon}
          </div>
          <ArrowUpRight
            className="w-4 h-4 opacity-0 group-hover:opacity-40 transition-opacity"
            style={{ color: '#94a3b8' }}
          />
        </div>
        <p className="text-sm font-medium mb-1" style={{ color: '#64748b' }}>{label}</p>
        <p
          className="text-3xl font-bold tracking-tight"
          style={{ color: alert && Number(value) > 0 ? '#f87171' : '#f1f5f9' }}
        >
          {value}
        </p>
        {trend && (
          <p className={`text-xs mt-1.5 flex items-center gap-1 ${trendUp ? 'text-emerald-400' : 'text-slate-500'}`}>
            {trendUp ? <TrendingUp className="w-3 h-3" /> : null}
            {trend}
          </p>
        )}
      </div>
    </Link>
  )
}

const AI_AGENTS = [
  { name: 'Incident Assessment', status: 'active', color: '#60a5fa' },
  { name: 'Volunteer Matching', status: 'active', color: '#818cf8' },
  { name: 'Resource Allocation', status: 'ready', color: '#fb923c' },
  { name: 'Mission Planning', status: 'ready', color: '#34d399' },
  { name: 'Coordinator AI', status: 'standby', color: '#a78bfa' },
]

const STATUS_LABEL: Record<string, { text: string; dot: string }> = {
  active: { text: 'Active', dot: '#22c55e' },
  running: { text: 'Running', dot: '#60a5fa' },
  ready: { text: 'Ready', dot: '#34d399' },
  standby: { text: 'Standby', dot: '#f59e0b' },
}

const EMERGENCY_TYPE_COLORS: Record<string, string> = {
  medical: '#3b82f6',
  food: '#f97316',
  water: '#06b6d4',
  shelter: '#a855f7',
  evacuation: '#ef4444',
}

const URGENCY_TEXT: Record<string, string> = {
  critical: '#f87171',
  high: '#fb923c',
  medium: '#facc15',
  low: '#4ade80',
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentRequests, setRecentRequests] = useState<EmergencyRequest[]>([])
  const [activeMissions, setActiveMissions] = useState<Mission[]>([])
  const [loading, setLoading] = useState(true)
  const [dbError, setDbError] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)
  const [seedMessage, setSeedMessage] = useState('')
  const [seedError, setSeedError] = useState<string | null>(null)

  const [nlQuestion, setNlQuestion] = useState('')
  const [nlLoading, setNlLoading] = useState(false)
  const [nlResult, setNlResult] = useState<NLQueryResult | null>(null)
  const [nlError, setNlError] = useState<string | null>(null)

  async function loadDashboard() {
    setLoading(true)
    setDbError(null)
    try {
      const [statsRes, requestsRes, missionsRes] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/emergency'),
        fetch('/api/missions'),
      ])

      if (!statsRes.ok) {
        const err = await statsRes.json()
        setDbError(err.error ?? 'Failed to connect to database')
        setLoading(false)
        return
      }

      const statsData: DashboardStats = await statsRes.json()
      const requestsData = await requestsRes.json()
      const missionsData = await missionsRes.json()

      setStats(statsData)
      setRecentRequests(Array.isArray(requestsData) ? requestsData.slice(0, 5) : [])
      setActiveMissions(
        Array.isArray(missionsData)
          ? missionsData.filter((m: Mission) => m.status === 'active').slice(0, 4)
          : []
      )
    } catch (e) {
      setDbError('Network error — is the dev server running?')
      console.error('Dashboard load error:', e)
    } finally {
      setLoading(false)
    }
  }

  async function handleSeed() {
    setSeeding(true)
    setSeedMessage('')
    setSeedError(null)
    try {
      const res = await fetch('/api/seed', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setSeedError(data.error ?? 'Seed failed')
        return
      }
      const { counts } = data as { counts: { emergencies: number; volunteers: number; resources: number } }
      setSeedMessage(`Seeded ${counts.emergencies} emergencies, ${counts.volunteers} volunteers, ${counts.resources} resources`)
      await loadDashboard()
    } catch {
      setSeedError('Seed request failed — check MongoDB URI in .env.local')
    } finally {
      setSeeding(false)
    }
  }

  async function handleNLQuery(e: React.FormEvent) {
    e.preventDefault()
    if (!nlQuestion.trim()) return
    setNlLoading(true)
    setNlResult(null)
    setNlError(null)
    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: nlQuestion }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Query failed')
      setNlResult(data)
    } catch (e) {
      setNlError(e instanceof Error ? e.message : 'Query failed')
    } finally {
      setNlLoading(false)
    }
  }

  useEffect(() => { loadDashboard() }, [])

  const analytics = stats?.analytics

  return (
    <div className="p-6 space-y-6 page-enter">

      {/* ── Hero Header ──────────────────────────────────── */}
      <div
        className="rounded-2xl p-6 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(17,27,48,0.98) 0%, rgba(13,20,37,0.95) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.35)',
        }}
      >
        {/* Background glow */}
        <div
          className="absolute top-0 right-0 w-72 h-72 rounded-full opacity-5 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #dc2626 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div
          className="absolute bottom-0 left-1/3 w-48 h-48 rounded-full opacity-5 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)', transform: 'translateY(40%)' }}
        />

        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.2)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 dot-live" />
                <span className="text-[11px] font-semibold text-emerald-400">OPERATIONAL</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
                <Bot className="w-3 h-3 text-blue-400" />
                <span className="text-[11px] font-semibold text-blue-400">AI ACTIVE</span>
              </div>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-1">
              Command Center
            </h1>
            <p style={{ color: '#64748b', fontSize: 14 }}>
              Real-time disaster response coordination · Powered by Gemini AI
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="ghost" size="sm" onClick={loadDashboard} loading={loading}>
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleSeed} loading={seeding}>
              <Database className="w-3.5 h-3.5" />
              Seed Data
            </Button>
          </div>
        </div>

        {/* ── AI Status Center ────────────────────────────── */}
        <div
          className="mt-5 rounded-xl p-4"
          style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">AI Agent Network</span>
            </div>
            <span className="text-[10px] font-medium text-slate-500">5 agents · Multi-agent pipeline</span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {AI_AGENTS.map((agent) => {
              const s = STATUS_LABEL[agent.status]
              return (
                <div
                  key={agent.name}
                  className="rounded-lg px-3 py-2.5"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.dot }} />
                    <span className="text-[10px] font-semibold" style={{ color: s.dot }}>{s.text}</span>
                  </div>
                  <p className="text-xs text-slate-300 font-medium leading-snug">{agent.name}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Error states */}
      {dbError && (
        <div className="rounded-xl px-4 py-3 flex items-start gap-2.5" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)' }}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" />
          <div>
            <span className="text-red-300 text-sm font-medium">Database Error: </span>
            <span className="text-red-300/80 text-sm">{dbError}</span>
          </div>
        </div>
      )}
      {seedError && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-2" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)' }}>
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-red-300 text-sm">{seedError}</span>
        </div>
      )}
      {seedMessage && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-2" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="text-emerald-300 text-sm">{seedMessage}</span>
        </div>
      )}

      {/* ── KPI Grid ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard
          label="Total Requests"
          value={loading ? '—' : (stats?.totalRequests ?? 0)}
          icon={<AlertTriangle style={{ width: 18, height: 18, color: '#fb923c' }} />}
          iconBg="rgba(251,146,60,0.12)"
          color="text-orange-400"
          href="/emergency"
          trend={analytics ? `${analytics.urgencyBreakdown?.pending ?? 0} pending` : undefined}
        />
        <StatCard
          label="Critical Alerts"
          value={loading ? '—' : (stats?.criticalRequests ?? 0)}
          icon={<Flame style={{ width: 18, height: 18, color: '#f87171' }} />}
          iconBg="rgba(248,113,113,0.12)"
          color="text-red-400"
          href="/emergency"
          alert
          trend={stats?.criticalRequests ? 'Needs immediate action' : 'No critical alerts'}
        />
        <StatCard
          label="Available Volunteers"
          value={loading ? '—' : (stats?.availableVolunteers ?? 0)}
          icon={<Users style={{ width: 18, height: 18, color: '#60a5fa' }} />}
          iconBg="rgba(96,165,250,0.12)"
          color="text-blue-400"
          href="/volunteers"
          trend={analytics ? `${analytics.volunteerUtilRate}% deployed` : undefined}
          trendUp={false}
        />
        <StatCard
          label="Resources Ready"
          value={loading ? '—' : (stats?.availableResources ?? 0)}
          icon={<Package style={{ width: 18, height: 18, color: '#c084fc' }} />}
          iconBg="rgba(192,132,252,0.12)"
          color="text-purple-400"
          href="/resources"
        />
        <StatCard
          label="Active Missions"
          value={loading ? '—' : (stats?.activeMissions ?? 0)}
          icon={<Target style={{ width: 18, height: 18, color: '#34d399' }} />}
          iconBg="rgba(52,211,153,0.12)"
          color="text-emerald-400"
          href="/missions"
          trend={analytics ? `${analytics.missionCompletionRate}% completion` : undefined}
          trendUp={(analytics?.missionCompletionRate ?? 0) > 50}
        />
      </div>

      {/* ── Analytics Row ────────────────────────────────── */}
      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Impact */}
          <div
            className="rounded-2xl p-5"
            style={{ background: 'rgba(13,20,37,0.95)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(244,114,182,0.12)' }}>
                <Heart style={{ width: 14, height: 14, color: '#f472b6' }} />
              </div>
              <h3 className="text-white font-semibold text-sm">Impact Metrics</h3>
            </div>
            <div>
              <p className="text-4xl font-bold" style={{ color: '#f472b6' }}>
                {analytics.peopleHelped.toLocaleString()}
              </p>
              <p className="text-xs mt-1" style={{ color: '#475569' }}>People reached via active missions</p>
            </div>
            <div className="flex gap-4 mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div>
                <p className="text-[10px] uppercase tracking-wider" style={{ color: '#475569' }}>Completed</p>
                <p className="text-emerald-400 font-bold text-lg">{analytics.missionStatus['completed'] ?? 0}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider" style={{ color: '#475569' }}>Active</p>
                <p className="text-blue-400 font-bold text-lg">{analytics.missionStatus['active'] ?? 0}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider" style={{ color: '#475569' }}>Completion</p>
                <p className="text-white font-bold text-lg">{analytics.missionCompletionRate}%</p>
              </div>
            </div>
          </div>

          {/* Emergency Breakdown */}
          <div
            className="rounded-2xl p-5"
            style={{ background: 'rgba(13,20,37,0.95)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(6,182,212,0.1)' }}>
                <BarChart3 style={{ width: 14, height: 14, color: '#22d3ee' }} />
              </div>
              <h3 className="text-white font-semibold text-sm">Emergency Breakdown</h3>
            </div>
            <div className="space-y-2.5">
              {analytics.emergencyByType.slice(0, 4).map(({ type, count, peopleAffected }) => {
                const color = EMERGENCY_TYPE_COLORS[type] ?? '#6b7280'
                const maxCount = Math.max(...analytics.emergencyByType.map((e) => e.count), 1)
                return (
                  <div key={type}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium capitalize" style={{ color: '#94a3b8' }}>{type}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: '#64748b' }}>{peopleAffected} ppl</span>
                        <span className="text-xs font-semibold" style={{ color }}>{count}</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <div
                        className="h-1.5 rounded-full transition-all duration-700"
                        style={{ width: `${(count / maxCount) * 100}%`, background: color }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Urgency Breakdown */}
          <div
            className="rounded-2xl p-5"
            style={{ background: 'rgba(13,20,37,0.95)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(251,191,36,0.1)' }}>
                <Shield style={{ width: 14, height: 14, color: '#fbbf24' }} />
              </div>
              <h3 className="text-white font-semibold text-sm">Pending Urgency</h3>
            </div>
            <div className="space-y-3">
              {(['critical', 'high', 'medium', 'low'] as const).map((level) => {
                const count = analytics.urgencyBreakdown[level] ?? 0
                const total = Object.values(analytics.urgencyBreakdown).reduce((a, b) => a + (b as number), 0) || 1
                return (
                  <div key={level} className="flex items-center gap-3">
                    <span
                      className="text-xs font-semibold capitalize w-14 flex-shrink-0"
                      style={{ color: URGENCY_TEXT[level] }}
                    >
                      {level}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div
                        className="h-1.5 rounded-full transition-all duration-700"
                        style={{
                          width: `${(count / total) * 100}%`,
                          background: URGENCY_TEXT[level],
                        }}
                      />
                    </div>
                    <span className="text-sm font-bold w-5 text-right" style={{ color: URGENCY_TEXT[level] }}>{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Recent Requests + Active Missions ───────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Emergency Requests */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'rgba(13,20,37,0.95)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              <h2 className="text-white font-semibold text-sm">Recent Emergencies</h2>
            </div>
            <Link href="/emergency" className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div>
            {loading ? (
              <div className="p-5 space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="skeleton h-10 w-full" />
                ))}
              </div>
            ) : recentRequests.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2" style={{ color: '#334155' }} />
                <p className="text-sm" style={{ color: '#475569' }}>No requests yet.</p>
                <button onClick={handleSeed} className="text-blue-400 text-xs hover:underline mt-1">
                  Seed demo data
                </button>
              </div>
            ) : (
              recentRequests.map((req) => (
                <div
                  key={req._id}
                  className="px-5 py-3 flex items-center justify-between"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">{req.location}</p>
                    <p className="text-xs mt-0.5 capitalize" style={{ color: '#64748b' }}>
                      {req.emergencyType} · {req.peopleAffected} people
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 ml-3 flex-shrink-0">
                    <Badge variant={req.urgency}>{req.urgency}</Badge>
                    <Badge variant={req.status}>{req.status}</Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Active Missions */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'rgba(13,20,37,0.95)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-400" />
              <h2 className="text-white font-semibold text-sm">Active Missions</h2>
            </div>
            <Link href="/missions" className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div>
            {loading ? (
              <div className="p-5 space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="skeleton h-10 w-full" />
                ))}
              </div>
            ) : activeMissions.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <Target className="w-8 h-8 mx-auto mb-2" style={{ color: '#334155' }} />
                <p className="text-sm" style={{ color: '#475569' }}>No active missions.</p>
                <Link href="/agent" className="text-blue-400 text-xs hover:underline mt-1 block">
                  Launch AI Agent
                </Link>
              </div>
            ) : (
              activeMissions.map((mission) => (
                <div
                  key={mission._id}
                  className="px-5 py-3"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-white text-sm font-medium truncate">
                      {mission.emergencyRequest?.location ?? 'Mission'}
                    </p>
                    <Badge variant="active">Active</Badge>
                  </div>
                  <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: '#475569' }}>
                    <Clock className="w-3 h-3" />
                    {mission.createdAt ? new Date(mission.createdAt).toLocaleDateString() : '—'}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── NL Query ─────────────────────────────────────── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'rgba(13,20,37,0.95)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex items-center gap-2.5 px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(168,85,247,0.12)' }}>
            <MessageSquare style={{ width: 14, height: 14, color: '#c084fc' }} />
          </div>
          <div>
            <h2 className="text-white font-semibold text-sm">Natural Language Database Query</h2>
            <p className="text-[11px]" style={{ color: '#475569' }}>Gemini converts plain English to MongoDB queries</p>
          </div>
          <span
            className="ml-auto text-[10px] font-bold px-2 py-1 rounded-lg"
            style={{ background: 'rgba(168,85,247,0.12)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.2)' }}
          >
            Gemini → MongoDB
          </span>
        </div>
        <div className="p-5">
          <form onSubmit={handleNLQuery} className="flex gap-2">
            <input
              type="text"
              value={nlQuestion}
              onChange={(e) => setNlQuestion(e.target.value)}
              placeholder="e.g. How many critical medical emergencies are pending?"
              className="flex-1 text-white text-sm rounded-xl px-4 py-2.5 placeholder-slate-500 focus:outline-none transition-colors"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
              onFocus={(e) => { e.target.style.borderColor = 'rgba(168,85,247,0.4)' }}
              onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.08)' }}
            />
            <Button type="submit" variant="primary" loading={nlLoading} disabled={!nlQuestion.trim()}>
              <Send className="w-4 h-4" />
              Ask
            </Button>
          </form>

          <div className="flex gap-2 mt-2.5 flex-wrap">
            {[
              'How many volunteers are available?',
              'Which emergencies are critical?',
              'How many missions are completed?',
            ].map((q) => (
              <button
                key={q}
                onClick={() => setNlQuestion(q)}
                className="text-xs rounded-full px-3 py-1 transition-colors"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#64748b' }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.color = '#94a3b8' }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.color = '#64748b' }}
              >
                {q}
              </button>
            ))}
          </div>

          {nlLoading && (
            <div className="mt-4 flex items-center gap-2.5" style={{ color: '#64748b' }}>
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 typing-dot" />
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 typing-dot" />
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 typing-dot" />
              </div>
              <span className="text-sm">Gemini processing query…</span>
            </div>
          )}

          {nlError && (
            <div className="mt-4 text-red-400 text-sm rounded-xl px-4 py-2.5" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)' }}>
              {nlError}
            </div>
          )}

          {nlResult && !nlLoading && (
            <div className="mt-4 rounded-xl p-4 space-y-2.5" style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.15)' }}>
              <p className="text-purple-200 font-medium text-sm">{nlResult.answer}</p>
              {nlResult.collection && (
                <div className="flex items-center gap-2 text-xs" style={{ color: '#64748b' }}>
                  <Database className="w-3 h-3" />
                  <span>Collection: <span className="text-slate-300 font-mono">{nlResult.collection}</span></span>
                  {nlResult.mongoFilter && Object.keys(nlResult.mongoFilter).length > 0 && (
                    <>
                      <span>·</span>
                      <span>Filter: <span className="text-slate-300 font-mono">{JSON.stringify(nlResult.mongoFilter)}</span></span>
                    </>
                  )}
                </div>
              )}
              {nlResult.count !== undefined && (
                <p className="text-emerald-400 text-xs font-medium">{nlResult.count} matching documents</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── AI Agent CTA ─────────────────────────────────── */}
      <div
        className="rounded-2xl p-6 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(168,85,247,0.08) 100%)',
          border: '1px solid rgba(59,130,246,0.2)',
        }}
      >
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at top right, rgba(59,130,246,0.4) 0%, transparent 60%)' }}
        />
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Cpu className="w-5 h-5 text-blue-400" />
              <h3 className="text-white font-bold text-lg">AI Agent Ready</h3>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)' }}
              >
                LIVE
              </span>
            </div>
            <p className="text-sm" style={{ color: '#94a3b8' }}>
              5-agent pipeline: assess → match → allocate → plan → approve. Uses Gemini function calling with MongoDB tool access.
            </p>
            <div className="flex items-center gap-4 mt-3">
              {[
                { icon: <Database className="w-3 h-3" />, label: 'MongoDB Atlas', color: '#34d399' },
                { icon: <Zap className="w-3 h-3" />, label: 'Gemini 2.5 Flash', color: '#60a5fa' },
                { icon: <Radio className="w-3 h-3" />, label: 'Multi-Agent', color: '#c084fc' },
              ].map(({ icon, label, color }) => (
                <div key={label} className="flex items-center gap-1.5" style={{ color }}>
                  {icon}
                  <span className="text-xs font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Link href="/map">
              <Button variant="outline" size="sm">
                <Map className="w-4 h-4" />
                View Map
              </Button>
            </Link>
            <Link href="/agent">
              <Button variant="primary" size="lg">
                Launch AI Agent
                <ChevronRight className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}