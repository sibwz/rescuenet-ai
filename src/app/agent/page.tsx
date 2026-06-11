'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Cpu,
  Brain,
  Users,
  Package,
  Target,
  CheckCircle,
  AlertTriangle,
  Activity,
  Zap,
  ShieldAlert,
  Clock,
  TrendingUp,
  Bot,
  Database,
  Radio,
  GitBranch,
  ArrowRight,
  BarChart3,
  Loader2,
  MapPin,
  RefreshCw,
  User,
  XCircle,
} from 'lucide-react'
import type { EmergencyRequest, Mission, AgentLog, CoordinatorRecommendation } from '@/types'
import Badge from '@/components/ui/Badge'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardData {
  pendingCount: number
  criticalReviewCount: number
  availableVolunteers: number
  activeMissions: number
  todayDispatches: number
  avgConfidence: number
}

interface CoordinatorReviewItem {
  emergency: EmergencyRequest
  recommendation: CoordinatorRecommendation
}

interface RecentMission extends Mission {
  volunteerConfidence?: number
  resourceConfidence?: number
  missionSuccessProbability?: number
}

// ─── Agent definitions ────────────────────────────────────────────────────────

const AGENTS = [
  {
    id: 'incident_agent',
    name: 'Incident Assessment',
    role: 'Reads emergencies & classifies incidents',
    icon: ShieldAlert,
    color: { border: 'border-blue-500/50', bg: 'bg-blue-900/20', text: 'text-blue-300', dot: 'bg-blue-400', glow: 'rgba(59,130,246,0.15)' },
  },
  {
    id: 'volunteer_agent',
    name: 'Volunteer Matching',
    role: 'Scores & matches volunteers by skill',
    icon: Users,
    color: { border: 'border-purple-500/50', bg: 'bg-purple-900/20', text: 'text-purple-300', dot: 'bg-purple-400', glow: 'rgba(168,85,247,0.15)' },
  },
  {
    id: 'resource_agent',
    name: 'Resource Allocation',
    role: 'Selects optimal resource units',
    icon: Package,
    color: { border: 'border-orange-500/50', bg: 'bg-orange-900/20', text: 'text-orange-300', dot: 'bg-orange-400', glow: 'rgba(249,115,22,0.15)' },
  },
  {
    id: 'mission_planner',
    name: 'Mission Planning',
    role: 'Generates prioritized mission plans',
    icon: Brain,
    color: { border: 'border-emerald-500/50', bg: 'bg-emerald-900/20', text: 'text-emerald-300', dot: 'bg-emerald-400', glow: 'rgba(16,185,129,0.15)' },
  },
  {
    id: 'coordinator_agent',
    name: 'Coordinator Oversight',
    role: 'Human-in-the-loop for critical events',
    icon: CheckCircle,
    color: { border: 'border-yellow-500/50', bg: 'bg-yellow-900/20', text: 'text-yellow-300', dot: 'bg-yellow-400', glow: 'rgba(234,179,8,0.15)' },
  },
]

// ─── Confidence Bar ───────────────────────────────────────────────────────────

function ConfidenceBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
      <span className="text-xs font-bold tabular-nums" style={{ color }}>{value}%</span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AIDecisionCenter() {
  const [dashboard, setDashboard] = useState<DashboardData>({
    pendingCount: 0,
    criticalReviewCount: 0,
    availableVolunteers: 0,
    activeMissions: 0,
    todayDispatches: 0,
    avgConfidence: 0,
  })
  const [coordinatorQueue, setCoordinatorQueue] = useState<CoordinatorReviewItem[]>([])
  const [recentMissions, setRecentMissions] = useState<RecentMission[]>([])
  const [recentLogs, setRecentLogs] = useState<AgentLog[]>([])
  const [activeAgentIdx, setActiveAgentIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [approvingId, setApprovingId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [emergencyRes, missionsRes, volunteersRes, logsRes] = await Promise.all([
        fetch('/api/emergency'),
        fetch('/api/missions'),
        fetch('/api/volunteers'),
        fetch('/api/agent-logs?limit=20'),
      ])

      const [emergencies, missions, volunteers, logsData] = await Promise.all([
        emergencyRes.json(),
        missionsRes.json(),
        volunteersRes.json(),
        logsRes.json(),
      ])

      const emergencyList: EmergencyRequest[] = Array.isArray(emergencies) ? emergencies : []
      const missionList: RecentMission[] = Array.isArray(missions) ? missions : []
      const volunteerList = Array.isArray(volunteers) ? volunteers : []
      const logList: AgentLog[] = logsData?.logs ?? []

      // Build coordinator review queue
      const reviewItems: CoordinatorReviewItem[] = emergencyList
        .filter((e) => e.status === 'awaiting_coordinator_review' && e.coordinatorRecommendation)
        .map((e) => ({ emergency: e, recommendation: e.coordinatorRecommendation! }))

      setCoordinatorQueue(reviewItems)

      // Recent missions (last 6)
      setRecentMissions(missionList.slice(0, 6))

      // Logs
      setRecentLogs(logList)

      // Dashboard stats
      const pendingCount = emergencyList.filter((e) => e.status === 'pending').length
      const criticalReviewCount = reviewItems.length
      const availableVolunteers = volunteerList.filter((v: { status: string }) => v.status === 'available').length
      const activeMissions = missionList.filter((m) => m.status === 'active').length

      // Count today's dispatches
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayDispatches = logList.filter((l) => {
        const d = new Date(l.createdAt ?? l.timestamp ?? '')
        return d >= today && (l.action === 'AUTO_DISPATCH' || l.action === 'AUTO_REASSIGN_SUCCESS' || l.action === 'COORDINATOR_REVIEW_APPROVED')
      }).length

      // Average confidence from missions that have it
      const confs = missionList
        .filter((m) => typeof m.missionSuccessProbability === 'number')
        .map((m) => m.missionSuccessProbability!)
      const avgConfidence = confs.length > 0 ? Math.round(confs.reduce((a, b) => a + b, 0) / confs.length) : 0

      setDashboard({ pendingCount, criticalReviewCount, availableVolunteers, activeMissions, todayDispatches, avgConfidence })
      setLastUpdated(new Date())
    } catch (err) {
      console.error('[AI Decision Center] Load error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load + 12s polling
  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 12000)
    return () => clearInterval(interval)
  }, [loadData])

  // Cycle active agent animation
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveAgentIdx((prev) => (prev + 1) % AGENTS.length)
    }, 2800)
    return () => clearInterval(interval)
  }, [])

  async function handleCoordinatorDecision(emergencyId: string, action: 'approve' | 'reject') {
    setApprovingId(emergencyId)
    try {
      await fetch(`/api/emergency/${emergencyId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      await loadData()
    } catch (err) {
      console.error('Coordinator decision error:', err)
    } finally {
      setApprovingId(null)
    }
  }

  const DISPATCH_ACTIONS = new Set(['AUTO_DISPATCH', 'AUTO_REASSIGN_SUCCESS', 'COORDINATOR_REVIEW_APPROVED', 'COORDINATOR_REVIEW_TRIGGERED', 'COORDINATOR_REVIEW_REJECTED', 'VOLUNTEER_REGISTERED', 'VOLUNTEER_AVAILABLE', 'MISSION_COMPLETED', 'MISSION_CANCELLED'])
  const dispatchEvents = recentLogs.filter((l) => DISPATCH_ACTIONS.has(l.action))

  function actionLabel(action: string): { label: string; color: string } {
    const map: Record<string, { label: string; color: string }> = {
      AUTO_DISPATCH: { label: 'Auto Dispatched', color: '#34d399' },
      AUTO_REASSIGN_SUCCESS: { label: 'Auto Reassigned', color: '#34d399' },
      COORDINATOR_REVIEW_APPROVED: { label: 'Critical Approved', color: '#60a5fa' },
      COORDINATOR_REVIEW_TRIGGERED: { label: 'Critical Review', color: '#fb923c' },
      COORDINATOR_REVIEW_REJECTED: { label: 'Recommendation Rejected', color: '#f87171' },
      VOLUNTEER_REGISTERED: { label: 'Volunteer Registered', color: '#a78bfa' },
      VOLUNTEER_AVAILABLE: { label: 'Volunteer Available', color: '#a78bfa' },
      MISSION_COMPLETED: { label: 'Mission Completed', color: '#34d399' },
      MISSION_CANCELLED: { label: 'Mission Cancelled', color: '#94a3b8' },
    }
    return map[action] ?? { label: action, color: '#94a3b8' }
  }

  return (
    <div className="p-6 space-y-6 page-enter">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-900/40 border border-blue-500/40 flex items-center justify-center">
              <Cpu className="w-4 h-4 text-blue-400" />
            </div>
            AI Decision Center
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Autonomous Emergency Operations Platform · Powered by{' '}
            <span className="text-blue-400 font-medium">Gemini + Vertex AI</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-emerald-900/20 border border-emerald-600/30 px-3 py-1.5 rounded-lg">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-emerald-300 text-xs font-semibold">SYSTEM LIVE</span>
          </div>
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300 transition-colors text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {loading ? 'Updating…' : `Updated ${lastUpdated.toLocaleTimeString()}`}
          </button>
        </div>
      </div>

      {/* ── 4-Layer Architecture Banner ──────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'CITIZEN LAYER', desc: 'Incident Reporting', icon: Radio, color: '#64748b' },
          { label: 'AI DECISION LAYER', desc: '5-Agent Pipeline', icon: Brain, color: '#60a5fa', active: true },
          { label: 'COORDINATION LAYER', desc: 'Human Oversight', icon: GitBranch, color: '#a78bfa' },
          { label: 'OPERATIONS LAYER', desc: 'Field Execution', icon: Target, color: '#34d399' },
        ].map(({ label, desc, icon: Icon, color, active }) => (
          <div
            key={label}
            className="rounded-xl px-3 py-2.5 flex items-center gap-2.5"
            style={{
              background: active ? `rgba(59,130,246,0.10)` : 'rgba(255,255,255,0.02)',
              border: `1px solid ${active ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.06)'}`,
            }}
          >
            <Icon style={{ width: 16, height: 16, color, flexShrink: 0 }} />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest truncate" style={{ color }}>{label}</p>
              <p className="text-[11px] text-gray-500 truncate">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── KPI Strip ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-6 gap-3">
        {[
          { label: 'Pending', value: dashboard.pendingCount, color: '#fbbf24', icon: Clock },
          { label: 'Review Queue', value: dashboard.criticalReviewCount, color: '#f87171', icon: ShieldAlert },
          { label: 'Volunteers Ready', value: dashboard.availableVolunteers, color: '#34d399', icon: Users },
          { label: 'Active Missions', value: dashboard.activeMissions, color: '#60a5fa', icon: Target },
          { label: 'Dispatched Today', value: dashboard.todayDispatches, color: '#a78bfa', icon: Zap },
          { label: 'Avg Confidence', value: `${dashboard.avgConfidence}%`, color: '#fb923c', icon: TrendingUp },
        ].map(({ label, value, color, icon: Icon }) => (
          <div
            key={label}
            className="rounded-xl p-4"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <Icon style={{ width: 12, height: 12, color }} />
              <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">{label}</span>
            </div>
            <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Active AI Agents ──────────────────────────────────────────────── */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold flex items-center gap-2 text-sm">
            <Bot className="w-4 h-4 text-blue-400" />
            Active AI Agents
            <span className="ml-2 text-[10px] font-bold bg-emerald-900/30 border border-emerald-600/30 text-emerald-300 px-1.5 py-0.5 rounded">5 RUNNING</span>
          </h2>
          <p className="text-gray-600 text-xs">Continuously monitoring all emergency events</p>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {AGENTS.map((agent, idx) => {
            const isProcessing = idx === activeAgentIdx
            const colors = agent.color
            const Icon = agent.icon

            return (
              <div
                key={agent.id}
                className="rounded-xl p-4 border transition-all duration-500"
                style={{
                  background: isProcessing ? colors.glow : 'rgba(255,255,255,0.02)',
                  borderColor: isProcessing ? colors.border.replace('border-', '').replace('/50', '') : 'rgba(255,255,255,0.06)',
                  boxShadow: isProcessing ? `0 0 20px ${colors.glow}` : 'none',
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: isProcessing ? colors.glow : 'rgba(255,255,255,0.04)' }}
                  >
                    <Icon
                      style={{
                        width: 16,
                        height: 16,
                        color: isProcessing ? colors.text.replace('text-', '') : '#64748b',
                      }}
                      className={isProcessing ? colors.text : 'text-gray-500'}
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span
                      className="w-1.5 h-1.5 rounded-full animate-pulse"
                      style={{ backgroundColor: isProcessing ? colors.dot.replace('bg-', '') : '#374151' }}
                    />
                    <span
                      className="text-[9px] font-bold uppercase"
                      style={{ color: isProcessing ? colors.text.replace('text-', '') : '#374151' }}
                    >
                      {isProcessing ? 'ACTIVE' : 'READY'}
                    </span>
                  </div>
                </div>
                <p
                  className="text-xs font-semibold leading-tight mb-1"
                  style={{ color: isProcessing ? '#f8fafc' : '#64748b' }}
                >
                  {agent.name}
                </p>
                <p className="text-[10px] text-gray-600 leading-tight">{agent.role}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Coordinator Review Queue ──────────────────────────────────────── */}
      {coordinatorQueue.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-white font-semibold flex items-center gap-2 text-sm">
            <ShieldAlert className="w-4 h-4 text-red-400" />
            Coordinator Review Required
            <span className="ml-1 text-[10px] font-bold bg-red-900/30 border border-red-600/30 text-red-300 px-1.5 py-0.5 rounded animate-pulse">
              {coordinatorQueue.length} CRITICAL
            </span>
          </h2>

          {coordinatorQueue.map(({ emergency, recommendation }) => {
            const isApproving = approvingId === emergency._id
            return (
              <div
                key={emergency._id}
                className="rounded-xl border p-5"
                style={{
                  background: 'linear-gradient(135deg, rgba(220,38,38,0.08) 0%, rgba(239,68,68,0.04) 100%)',
                  border: '1px solid rgba(239,68,68,0.35)',
                  boxShadow: '0 0 24px rgba(220,38,38,0.08)',
                }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="critical">CRITICAL</Badge>
                      <span className="text-white font-semibold capitalize">{emergency.emergencyType} Emergency</span>
                    </div>
                    <p className="text-gray-400 text-sm flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {emergency.location} · {emergency.peopleAffected} people affected
                    </p>
                    <p className="text-gray-500 text-xs mt-1 line-clamp-2">{emergency.description}</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <p className="text-red-300 text-xs font-semibold">AI Recommendation Ready</p>
                    <p className="text-gray-500 text-xs mt-0.5">Human approval required</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  {/* Volunteer */}
                  <div className="bg-purple-900/20 border border-purple-700/30 rounded-lg p-3">
                    <p className="text-gray-500 text-[10px] uppercase tracking-wide mb-1.5 flex items-center gap-1">
                      <User className="w-3 h-3" />Recommended Volunteer
                    </p>
                    <p className="text-white text-sm font-semibold">{recommendation.volunteerName ?? '—'}</p>
                    <p className="text-purple-300 text-xs mt-0.5">
                      {recommendation.volunteerSkills?.join(', ') ?? '—'}
                    </p>
                    <p className="text-gray-500 text-xs">{recommendation.volunteerLocation ?? '—'}</p>
                    <div className="mt-2">
                      <p className="text-[10px] text-gray-600 mb-1">Match Confidence</p>
                      <ConfidenceBar value={recommendation.volunteerConfidence} color="#a78bfa" />
                    </div>
                  </div>

                  {/* Resource */}
                  <div className="bg-orange-900/20 border border-orange-700/30 rounded-lg p-3">
                    <p className="text-gray-500 text-[10px] uppercase tracking-wide mb-1.5 flex items-center gap-1">
                      <Package className="w-3 h-3" />Recommended Resource
                    </p>
                    <p className="text-white text-sm font-semibold capitalize">
                      {recommendation.resourceType?.replace('_', ' ') ?? 'None available'}
                    </p>
                    {recommendation.resourceQuantity && (
                      <p className="text-orange-300 text-xs mt-0.5">{recommendation.resourceQuantity} units</p>
                    )}
                    <div className="mt-2">
                      <p className="text-[10px] text-gray-600 mb-1">Allocation Confidence</p>
                      <ConfidenceBar value={recommendation.resourceConfidence} color="#fb923c" />
                    </div>
                  </div>

                  {/* Success probability */}
                  <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3">
                    <p className="text-gray-500 text-[10px] uppercase tracking-wide mb-1.5 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />Mission Success Probability
                    </p>
                    <p className="text-white text-3xl font-bold mt-2">
                      {recommendation.missionSuccessProbability}
                      <span className="text-gray-400 text-lg">%</span>
                    </p>
                    <div className="mt-3">
                      <ConfidenceBar value={recommendation.missionSuccessProbability} color="#60a5fa" />
                    </div>
                  </div>
                </div>

                {/* AI Reasoning */}
                <div className="bg-gray-900/60 border border-gray-700/40 rounded-lg p-3 mb-4">
                  <p className="text-gray-500 text-[10px] uppercase tracking-wide mb-1 flex items-center gap-1">
                    <Brain className="w-3 h-3" />AI Reasoning
                  </p>
                  <p className="text-gray-300 text-xs leading-relaxed">{recommendation.reasoning}</p>
                </div>

                {/* Approve / Reject */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleCoordinatorDecision(emergency._id!, 'approve')}
                    disabled={isApproving}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all"
                    style={{
                      background: isApproving ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.2)',
                      border: '1px solid rgba(34,197,94,0.45)',
                      color: '#86efac',
                      opacity: isApproving ? 0.6 : 1,
                    }}
                  >
                    {isApproving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    Approve & Dispatch
                  </button>
                  <button
                    onClick={() => handleCoordinatorDecision(emergency._id!, 'reject')}
                    disabled={isApproving}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all"
                    style={{
                      background: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.35)',
                      color: '#fca5a5',
                      opacity: isApproving ? 0.6 : 1,
                    }}
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                  <p className="text-gray-600 text-xs ml-auto">
                    Ethical AI · Human oversight for all CRITICAL decisions
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Main Grid ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-5">

        {/* Live Pipeline Monitor */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              <span className="text-white text-sm font-semibold">Live Pipeline Monitor</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
              <span className="text-blue-400 text-xs font-medium">LIVE</span>
            </div>
          </div>

          <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
            {recentLogs.length === 0 ? (
              <div className="text-center py-8">
                <Database className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                <p className="text-gray-600 text-sm">No pipeline events yet</p>
                <p className="text-gray-700 text-xs">Submit an emergency to see AI activity</p>
              </div>
            ) : (
              recentLogs.map((log, i) => {
                const { label, color } = actionLabel(log.action)
                return (
                  <div key={i} className="flex items-start gap-3 py-2 border-b border-gray-800/50 last:border-0">
                    <div
                      className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold" style={{ color }}>{label}</span>
                        <span className="text-gray-600 text-[10px] ml-auto flex-shrink-0">
                          {log.createdAt ? new Date(log.createdAt).toLocaleTimeString() : '—'}
                        </span>
                      </div>
                      <p className="text-gray-500 text-[11px] leading-tight line-clamp-2 mt-0.5">
                        {log.details}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Confidence Score Matrix */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-orange-400" />
              <span className="text-white text-sm font-semibold">Confidence Score Matrix</span>
            </div>
            <span className="text-gray-600 text-xs">Recent missions</span>
          </div>

          <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
            {recentMissions.length === 0 ? (
              <div className="text-center py-8">
                <Target className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                <p className="text-gray-600 text-sm">No missions dispatched yet</p>
              </div>
            ) : (
              recentMissions.map((mission, i) => {
                const volConf = mission.volunteerConfidence ?? (mission.status === 'active' ? 75 : mission.status === 'awaiting_volunteer' ? 0 : 45)
                const resConf = mission.resourceConfidence ?? (mission.status === 'active' ? 72 : mission.status === 'awaiting_volunteer' ? 30 : 40)
                const prob = mission.missionSuccessProbability ?? (mission.status === 'completed' ? 95 : mission.status === 'active' ? 78 : 35)

                return (
                  <div key={i} className="bg-gray-800/40 border border-gray-700/40 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant={mission.status as 'active' | 'completed' | 'cancelled' | 'awaiting_volunteer' | 'resource_shortage'}>{mission.status}</Badge>
                      <span className="text-gray-600 text-[10px]">
                        {mission.createdAt ? new Date(mission.createdAt).toLocaleDateString() : '—'}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <div>
                        <div className="flex justify-between text-[10px] mb-0.5">
                          <span className="text-gray-500">Volunteer Match</span>
                        </div>
                        <ConfidenceBar value={volConf} color="#a78bfa" />
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] mb-0.5">
                          <span className="text-gray-500">Resource Allocation</span>
                        </div>
                        <ConfidenceBar value={resConf} color="#fb923c" />
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] mb-0.5">
                          <span className="text-gray-500">Success Probability</span>
                        </div>
                        <ConfidenceBar value={prob} color="#60a5fa" />
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Auto-Dispatch Event Feed ──────────────────────────────────────── */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-white text-sm font-semibold">Auto-Dispatch Events</span>
          </div>
          <span className="text-gray-600 text-xs">AI-driven decisions · no manual trigger required</span>
        </div>

        {dispatchEvents.length === 0 ? (
          <div className="p-8 text-center">
            <Zap className="w-8 h-8 text-gray-700 mx-auto mb-2" />
            <p className="text-gray-600 text-sm">No auto-dispatch events yet</p>
            <p className="text-gray-700 text-xs mt-1">Register a volunteer or submit an emergency to see the AI system activate</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800/50">
            {dispatchEvents.slice(0, 8).map((log, i) => {
              const { label, color } = actionLabel(log.action)
              return (
                <div key={i} className="px-4 py-3 flex items-start gap-4">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: `${color}18`, border: `1px solid ${color}30` }}
                  >
                    <Zap style={{ width: 14, height: 14, color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold" style={{ color }}>{label}</span>
                      <ArrowRight className="w-3 h-3 text-gray-700" />
                      <span className="text-gray-500 text-xs">Autonomous AI Decision</span>
                      <span className="text-gray-600 text-xs ml-auto flex-shrink-0">
                        {log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}
                      </span>
                    </div>
                    <p className="text-gray-400 text-xs leading-relaxed line-clamp-2">{log.details}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Platform Identity Footer ──────────────────────────────────────── */}
      <div
        className="rounded-xl p-5"
        style={{
          background: 'linear-gradient(135deg, rgba(59,130,246,0.06) 0%, rgba(168,85,247,0.04) 50%, rgba(16,185,129,0.04) 100%)',
          border: '1px solid rgba(59,130,246,0.15)',
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-bold text-sm">Autonomous AI-Powered Emergency Operations Platform</h3>
            <p className="text-gray-500 text-xs mt-1">
              Citizens report → AI analyzes → AI matches volunteers → AI allocates resources → AI creates missions → Coordinators supervise critical decisions
            </p>
          </div>
          <div className="flex items-center gap-4 flex-shrink-0 ml-6">
            {['Government Agencies', 'NGOs', 'Disaster Response Teams', 'Humanitarian Organizations'].map((org) => (
              <span key={org} className="text-[10px] text-gray-600 font-medium">
                {org}
              </span>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
