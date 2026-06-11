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
  Activity,
  BarChart3,
  Zap,
  Shield,
  CheckCircle2,
  ArrowUpRight,
  Bot,
  MapPin,
  Info,
} from 'lucide-react'
import Link from 'next/link'
import type { DashboardStats, EmergencyRequest, Mission } from '@/types'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import DbOfflineBanner from '@/components/ui/DbOfflineBanner'

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

function StatCard({ label, value, iconBg, href, alert, trend, trendUp, icon }: StatCardProps) {
  return (
    <Link href={href}>
      <div
        className="rounded-2xl p-5 cursor-pointer group h-full transition-all duration-200"
        style={{
          background: alert && Number(value) > 0
            ? 'linear-gradient(135deg, rgba(239,68,68,0.10) 0%, #1A2332 100%)'
            : '#1A2332',
          border: alert && Number(value) > 0
            ? '1px solid rgba(239,68,68,0.35)'
            : '1px solid #2A3647',
          boxShadow: alert && Number(value) > 0
            ? '0 4px 20px rgba(239,68,68,0.12)'
            : '0 4px 16px rgba(0,0,0,0.25)',
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLElement
          el.style.transform = 'translateY(-2px)'
          el.style.borderColor = alert && Number(value) > 0
            ? 'rgba(239,68,68,0.55)'
            : 'rgba(16,185,129,0.45)'
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLElement
          el.style.transform = 'translateY(0)'
          el.style.borderColor = alert && Number(value) > 0
            ? 'rgba(239,68,68,0.35)'
            : '#2A3647'
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
            style={{ color: '#94A3B8' }}
          />
        </div>
        <p className="text-sm font-medium mb-1" style={{ color: '#94A3B8' }}>{label}</p>
        <p
          className="text-3xl font-bold tracking-tight"
          style={{ color: alert && Number(value) > 0 ? '#EF4444' : '#E5E7EB' }}
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

const AGENT_STATUS_LABEL: Record<string, { text: string; dot: string }> = {
  active:  { text: 'Active',  dot: '#10B981' },
  running: { text: 'Running', dot: '#22D3EE' },
  ready:   { text: 'Ready',   dot: '#34d399' },
  standby: { text: 'Standby', dot: '#F59E0B' },
}

const EMERGENCY_TYPE_COLORS: Record<string, string> = {
  medical:    '#3b82f6',
  food:       '#f97316',
  water:      '#06b6d4',
  shelter:    '#a855f7',
  evacuation: '#ef4444',
}

const URGENCY_TEXT: Record<string, string> = {
  critical: '#f87171',
  high:     '#fb923c',
  medium:   '#facc15',
  low:      '#4ade80',
}

const DISPATCH_STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string }> = {
  pending:                     { label: 'Awaiting Dispatch',   dot: '#FBBF24', bg: 'rgba(251,191,36,0.08)' },
  waiting_for_volunteer:       { label: 'Waiting Volunteer',   dot: '#A78BFA', bg: 'rgba(167,139,250,0.08)' },
  resource_shortage:           { label: 'Resource Shortage',   dot: '#F97316', bg: 'rgba(249,115,22,0.08)' },
  location_review_required:    { label: 'Location Review',     dot: '#FBBF24', bg: 'rgba(251,191,36,0.08)' },
  awaiting_coordinator_review: { label: 'Coordinator Review',  dot: '#F87171', bg: 'rgba(248,113,113,0.08)' },
  assigned:                    { label: 'Auto-Assigned',        dot: '#10B981', bg: 'rgba(16,185,129,0.08)' },
}

const PRIORITY_SCORES: Record<string, number> = {
  critical: 95, high: 75, medium: 50, low: 25,
}

function getPriorityScore(req: EmergencyRequest): number {
  return PRIORITY_SCORES[req.urgency] ?? 50
}

function getDispatchReason(req: EmergencyRequest): string {
  switch (req.status) {
    case 'pending':
      return 'Queued — auto-dispatch pipeline processing'
    case 'waiting_for_volunteer':
      return req.noMatchReason ?? 'No available volunteers matched this request'
    case 'resource_shortage':
      return req.noMatchReason ?? 'No matching resources available for this emergency type'
    case 'awaiting_coordinator_review':
      return req.coordinatorRecommendation?.reasoning ?? 'Critical case — AI recommendation ready, awaiting coordinator approval'
    case 'assigned':
      return 'Mission created automatically — team dispatched'
    default:
      return ''
  }
}

const ACTIVE_DISPATCH_STATUSES = new Set([
  'pending', 'waiting_for_volunteer', 'resource_shortage',
  'awaiting_coordinator_review', 'assigned',
])

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [allRequests, setAllRequests] = useState<EmergencyRequest[]>([])
  const [activeMissions, setActiveMissions] = useState<Mission[]>([])
  const [loading, setLoading] = useState(true)
  const [dbError, setDbError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [seedMessage, setSeedMessage] = useState('')
  const [seedError, setSeedError] = useState<string | null>(null)

  async function loadDashboard() {
    setLoading(true)
    setDbError(null)
    try {
      const [statsRes, requestsRes, missionsRes] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/emergency'),
        fetch('/api/missions'),
      ])
      const [statsData, requestsData, missionsData] = await Promise.all([
        statsRes.json(),
        requestsRes.json(),
        missionsRes.json(),
      ])
      if (statsData?.offline || requestsData?.offline || missionsData?.offline) {
        setOffline(true)
        setLoading(false)
        return
      }
      setOffline(false)
      if (!statsRes.ok) {
        setDbError(statsData.error ?? 'Failed to connect to database')
        setLoading(false)
        return
      }
      setStats(statsData as DashboardStats)
      setAllRequests(Array.isArray(requestsData) ? requestsData : [])
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
      if (!res.ok) { setSeedError(data.error ?? 'Seed failed'); return }
      const { counts } = data as { counts: { emergencies: number; volunteers: number; resources: number } }
      setSeedMessage(`Seeded ${counts.emergencies} emergencies, ${counts.volunteers} volunteers, ${counts.resources} resources`)
      await loadDashboard()
    } catch {
      setSeedError('Seed request failed — check MongoDB URI in .env.local')
    } finally {
      setSeeding(false)
    }
  }

  useEffect(() => { loadDashboard() }, [])

  const analytics = stats?.analytics
  const recentRequests = allRequests.slice(0, 5)
  const dispatchQueue = allRequests.filter(r => ACTIVE_DISPATCH_STATUSES.has(r.status))

  return (
    <div className="p-6 space-y-6 page-enter">

      {/* ── Hero Header ── */}
      <div
        className="rounded-2xl p-6 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #1A2332 0%, #202B3C 100%)',
          border: '1px solid #2A3647',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}
      >
        <div
          className="absolute top-0 right-0 w-72 h-72 rounded-full opacity-[0.04] pointer-events-none"
          style={{ background: 'radial-gradient(circle, #EF4444 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div
          className="absolute bottom-0 left-1/3 w-48 h-48 rounded-full opacity-[0.04] pointer-events-none"
          style={{ background: 'radial-gradient(circle, #10B981 0%, transparent 70%)', transform: 'translateY(40%)' }}
        />

        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 dot-live" />
                <span className="text-[11px] font-semibold text-emerald-400">OPERATIONAL</span>
              </div>
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(34,211,238,0.10)', border: '1px solid rgba(34,211,238,0.22)' }}
              >
                <Bot className="w-3 h-3" style={{ color: '#22D3EE' }} />
                <span className="text-[11px] font-semibold" style={{ color: '#22D3EE' }}>AI ACTIVE</span>
              </div>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-1">
              Command Center
            </h1>
            <p className="text-sm" style={{ color: '#64748B' }}>
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

        {/* AI Agent Network */}
        <div
          className="mt-5 rounded-xl p-4"
          style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(42,54,71,0.7)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4" style={{ color: '#22D3EE' }} />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#E5E7EB' }}>AI Agent Network</span>
            </div>
            <span className="text-[10px] font-medium" style={{ color: '#475569' }}>5 agents · Multi-agent pipeline</span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {AI_AGENTS.map((agent) => {
              const s = AGENT_STATUS_LABEL[agent.status]
              return (
                <div
                  key={agent.name}
                  className="rounded-lg px-3 py-2.5"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(42,54,71,0.6)' }}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.dot }} />
                    <span className="text-[10px] font-semibold" style={{ color: s.dot }}>{s.text}</span>
                  </div>
                  <p className="text-xs font-medium leading-snug" style={{ color: '#CBD5E1' }}>{agent.name}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Error States ── */}
      {offline && <DbOfflineBanner onRetry={loadDashboard} />}
      {dbError && (
        <div className="rounded-xl px-4 py-3 flex items-start gap-2.5" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" />
          <div>
            <span className="text-red-300 text-sm font-medium">Database Error: </span>
            <span className="text-red-300/80 text-sm">{dbError}</span>
          </div>
        </div>
      )}
      {seedError && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-red-300 text-sm">{seedError}</span>
        </div>
      )}
      {seedMessage && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-2" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.22)' }}>
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="text-emerald-300 text-sm">{seedMessage}</span>
        </div>
      )}

      {/* ── KPI Grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard
          label="Total Requests"
          value={loading ? '—' : (stats?.totalRequests ?? 0)}
          icon={<AlertTriangle style={{ width: 18, height: 18, color: '#fb923c' }} />}
          iconBg="rgba(251,146,60,0.14)"
          color="text-orange-400"
          href="/emergency"
          trend={analytics ? `${analytics.urgencyBreakdown?.pending ?? 0} pending` : undefined}
        />
        <StatCard
          label="Critical Alerts"
          value={loading ? '—' : (stats?.criticalRequests ?? 0)}
          icon={<Flame style={{ width: 18, height: 18, color: '#f87171' }} />}
          iconBg="rgba(239,68,68,0.14)"
          color="text-red-400"
          href="/emergency"
          alert
          trend={stats?.criticalRequests ? 'Needs immediate action' : 'No critical alerts'}
        />
        <StatCard
          label="Available Volunteers"
          value={loading ? '—' : (stats?.availableVolunteers ?? 0)}
          icon={<Users style={{ width: 18, height: 18, color: '#22D3EE' }} />}
          iconBg="rgba(34,211,238,0.12)"
          color="text-cyan-400"
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
          icon={<Target style={{ width: 18, height: 18, color: '#10B981' }} />}
          iconBg="rgba(16,185,129,0.14)"
          color="text-emerald-400"
          href="/missions"
          trend={analytics ? `${analytics.missionCompletionRate}% completion` : undefined}
          trendUp={(analytics?.missionCompletionRate ?? 0) > 50}
        />
      </div>

      {/* ── Analytics Row ── */}
      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Impact */}
          <div className="rounded-2xl p-5" style={{ background: '#1A2332', border: '1px solid #2A3647' }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(244,114,182,0.14)' }}>
                <Heart style={{ width: 14, height: 14, color: '#f472b6' }} />
              </div>
              <h3 className="font-semibold text-sm" style={{ color: '#E5E7EB' }}>Impact Metrics</h3>
            </div>
            <div>
              <p className="text-4xl font-bold" style={{ color: '#f472b6' }}>
                {analytics.peopleHelped.toLocaleString()}
              </p>
              <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>People reached via active missions</p>
            </div>
            <div className="flex gap-4 mt-3 pt-3" style={{ borderTop: '1px solid #2A3647' }}>
              <div>
                <p className="text-[10px] uppercase tracking-wider" style={{ color: '#475569' }}>Completed</p>
                <p className="text-emerald-400 font-bold text-lg">{analytics.missionStatus['completed'] ?? 0}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider" style={{ color: '#475569' }}>Active</p>
                <p className="font-bold text-lg" style={{ color: '#22D3EE' }}>{analytics.missionStatus['active'] ?? 0}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider" style={{ color: '#475569' }}>Completion</p>
                <p className="font-bold text-lg" style={{ color: '#E5E7EB' }}>{analytics.missionCompletionRate}%</p>
              </div>
            </div>
          </div>

          {/* Emergency Breakdown */}
          <div className="rounded-2xl p-5" style={{ background: '#1A2332', border: '1px solid #2A3647' }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(34,211,238,0.10)' }}>
                <BarChart3 style={{ width: 14, height: 14, color: '#22D3EE' }} />
              </div>
              <h3 className="font-semibold text-sm" style={{ color: '#E5E7EB' }}>Emergency Breakdown</h3>
            </div>
            <div className="space-y-2.5">
              {analytics.emergencyByType.slice(0, 4).map(({ type, count, peopleAffected }) => {
                const color = EMERGENCY_TYPE_COLORS[type] ?? '#6b7280'
                const maxCount = Math.max(...analytics.emergencyByType.map((e) => e.count), 1)
                return (
                  <div key={type}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium capitalize" style={{ color: '#94A3B8' }}>{type}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: '#64748B' }}>{peopleAffected} ppl</span>
                        <span className="text-xs font-semibold" style={{ color }}>{count}</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: 'rgba(42,54,71,0.8)' }}>
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
          <div className="rounded-2xl p-5" style={{ background: '#1A2332', border: '1px solid #2A3647' }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.12)' }}>
                <Shield style={{ width: 14, height: 14, color: '#F59E0B' }} />
              </div>
              <h3 className="font-semibold text-sm" style={{ color: '#E5E7EB' }}>Pending Urgency</h3>
            </div>
            <div className="space-y-3">
              {(['critical', 'high', 'medium', 'low'] as const).map((level) => {
                const count = analytics.urgencyBreakdown[level] ?? 0
                const total = Object.values(analytics.urgencyBreakdown).reduce((a, b) => a + (b as number), 0) || 1
                return (
                  <div key={level} className="flex items-center gap-3">
                    <span className="text-xs font-semibold capitalize w-14 flex-shrink-0" style={{ color: URGENCY_TEXT[level] }}>
                      {level}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(42,54,71,0.8)' }}>
                      <div
                        className="h-1.5 rounded-full transition-all duration-700"
                        style={{ width: `${(count / total) * 100}%`, background: URGENCY_TEXT[level] }}
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

      {/* ── Recent Requests + Active Missions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Emergency Requests */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#1A2332', border: '1px solid #2A3647' }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #2A3647' }}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              <h2 className="font-semibold text-sm" style={{ color: '#E5E7EB' }}>Recent Emergencies</h2>
            </div>
            <Link href="/emergency" className="text-xs font-medium flex items-center gap-1" style={{ color: '#10B981' }}>
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div>
            {loading ? (
              <div className="p-5 space-y-3">
                {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-10 w-full" />)}
              </div>
            ) : recentRequests.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2" style={{ color: '#2A3647' }} />
                <p className="text-sm" style={{ color: '#94A3B8' }}>No requests yet.</p>
                <button onClick={handleSeed} className="text-xs hover:underline mt-1" style={{ color: '#10B981' }}>
                  Seed demo data
                </button>
              </div>
            ) : (
              recentRequests.map((req) => (
                <div
                  key={req._id}
                  className="px-5 py-3 flex items-center justify-between transition-colors"
                  style={{ borderBottom: '1px solid #2A3647' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.04)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: '#E5E7EB' }}>{req.location}</p>
                    <p className="text-xs mt-0.5 capitalize" style={{ color: '#64748B' }}>
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
        <div className="rounded-2xl overflow-hidden" style={{ background: '#1A2332', border: '1px solid #2A3647' }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #2A3647' }}>
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-400" />
              <h2 className="font-semibold text-sm" style={{ color: '#E5E7EB' }}>Active Missions</h2>
            </div>
            <Link href="/missions" className="text-xs font-medium flex items-center gap-1" style={{ color: '#10B981' }}>
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div>
            {loading ? (
              <div className="p-5 space-y-3">
                {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-10 w-full" />)}
              </div>
            ) : activeMissions.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <Target className="w-8 h-8 mx-auto mb-2" style={{ color: '#2A3647' }} />
                <p className="text-sm" style={{ color: '#94A3B8' }}>No active missions.</p>
                <p className="text-xs mt-1" style={{ color: '#475569' }}>
                  Missions are created automatically when a volunteer and resource are matched.
                </p>
              </div>
            ) : (
              activeMissions.map((mission) => (
                <div
                  key={mission._id}
                  className="px-5 py-3 transition-colors"
                  style={{ borderBottom: '1px solid #2A3647' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.04)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate" style={{ color: '#E5E7EB' }}>
                      {mission.emergencyRequest?.location ?? 'Mission'}
                    </p>
                    <Badge variant="active">Active</Badge>
                  </div>
                  <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: '#64748B' }}>
                    <Clock className="w-3 h-3" />
                    {mission.createdAt ? new Date(mission.createdAt).toLocaleDateString() : '—'}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Dispatch Queue ── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#1A2332', border: '1px solid #2A3647' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #2A3647' }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(34,211,238,0.10)' }}>
              <Activity style={{ width: 14, height: 14, color: '#22D3EE' }} />
            </div>
            <div>
              <h2 className="font-semibold text-sm" style={{ color: '#E5E7EB' }}>Dispatch Queue</h2>
              <p className="text-[11px]" style={{ color: '#475569' }}>All active requests and their current dispatch status</p>
            </div>
          </div>
          {!loading && (
            <span
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(34,211,238,0.08)', color: '#22D3EE', border: '1px solid rgba(34,211,238,0.22)' }}
            >
              {dispatchQueue.length} active
            </span>
          )}
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-16 w-full rounded-xl" />)}
          </div>
        ) : dispatchQueue.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-400" />
            <p className="text-sm font-medium" style={{ color: '#E5E7EB' }}>Queue is clear</p>
            <p className="text-xs mt-1" style={{ color: '#64748B' }}>
              No pending or waiting requests. All requests have been processed.
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#2A3647' }}>
            {dispatchQueue.map((req) => {
              const statusCfg = DISPATCH_STATUS_CONFIG[req.status] ?? { label: req.status, dot: '#94A3B8', bg: 'rgba(42,54,71,0.1)' }
              const priority = getPriorityScore(req)
              const reason = getDispatchReason(req)
              const typeColor = EMERGENCY_TYPE_COLORS[req.emergencyType] ?? '#6b7280'
              const urgencyColor = URGENCY_TEXT[req.urgency] ?? '#94A3B8'

              return (
                <div
                  key={req._id}
                  className="px-5 py-4 transition-colors"
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.03)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="mt-1 flex-shrink-0">
                        <span className="w-2 h-2 rounded-full block" style={{ backgroundColor: statusCfg.dot }} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <MapPin className="w-3 h-3 flex-shrink-0" style={{ color: '#475569' }} />
                          <span className="text-sm font-semibold truncate" style={{ color: '#E5E7EB' }}>
                            {req.location}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span
                            className="text-[11px] font-medium capitalize px-1.5 py-0.5 rounded"
                            style={{ background: `${typeColor}18`, color: typeColor }}
                          >
                            {req.emergencyType}
                          </span>
                          <span className="text-[11px]" style={{ color: '#64748B' }}>
                            {req.peopleAffected} people affected
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                          style={{ background: `${urgencyColor}18`, color: urgencyColor, border: `1px solid ${urgencyColor}30` }}
                        >
                          {req.urgency}
                        </span>
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: statusCfg.bg, color: statusCfg.dot, border: `1px solid ${statusCfg.dot}30` }}
                        >
                          {statusCfg.label}
                        </span>
                      </div>
                      <span className="text-[10px] font-medium" style={{ color: '#475569' }}>
                        AI priority:&nbsp;
                        <span style={{ color: urgencyColor, fontWeight: 700 }}>{priority}</span>
                      </span>
                    </div>
                  </div>

                  {reason && (
                    <div className="mt-2.5 ml-5 pl-3 border-l-2" style={{ borderColor: `${statusCfg.dot}40` }}>
                      <p className="text-xs leading-snug" style={{ color: '#64748B' }}>{reason}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {!loading && dispatchQueue.length > 0 && (
          <div className="px-5 py-3 flex justify-end" style={{ borderTop: '1px solid #2A3647' }}>
            <Link href="/emergency" className="text-xs font-medium flex items-center gap-1" style={{ color: '#10B981' }}>
              View all emergencies <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        )}
      </div>

      {/* ── How Auto Dispatch Works ── */}
      <div
        className="rounded-2xl p-5"
        style={{ background: '#1A2332', border: '1px solid #2A3647' }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: 'rgba(34,211,238,0.10)', border: '1px solid rgba(34,211,238,0.22)' }}
          >
            <Info style={{ width: 15, height: 15, color: '#22D3EE' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-white">How Auto Dispatch Works</h3>
              <div className="flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-yellow-400" />
                <span className="text-[10px] font-semibold text-yellow-400 uppercase tracking-wider">Automated</span>
              </div>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#94A3B8' }}>
              RescueNet automatically validates the emergency location, checks volunteer availability, checks matching resources, calculates AI priority, and creates a mission when all conditions are satisfied. Critical cases may require coordinator review before dispatch.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { step: '1', label: 'Location Validated', color: '#10B981' },
                { step: '2', label: 'Volunteer Matched',  color: '#22D3EE' },
                { step: '3', label: 'Resources Checked',  color: '#A78BFA' },
                { step: '4', label: 'AI Priority Scored', color: '#F59E0B' },
                { step: '5', label: 'Mission Created',    color: '#F472B6' },
              ].map(({ step, label, color }) => (
                <div
                  key={step}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(42,54,71,0.7)' }}
                >
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                    style={{ background: `${color}20`, color }}
                  >
                    {step}
                  </span>
                  <span className="text-[11px] font-medium" style={{ color: '#CBD5E1' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
