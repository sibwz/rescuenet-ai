'use client'

import { useEffect, useState } from 'react'
import {
  GitBranch,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Target,
  Users,
  Package,
  Brain,
  UserCheck,
  Database,
  Wrench,
  BookOpen,
  Bot,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  ArrowDown,
  Cpu,
} from 'lucide-react'

interface LogEntry {
  _id: string
  action: string
  details: string
  relatedIds: string[]
  createdAt: string
}

interface LogsResponse {
  logs: LogEntry[]
  distinctActions: string[]
  total: number
}

// The 7 workflow steps mapped to agent names and icons
const WORKFLOW_STEPS = [
  {
    step: 1,
    agentName: 'Incident Assessment Agent',
    label: 'Read Emergencies',
    description: 'Connects to MongoDB and retrieves all pending emergency requests',
    icon: Database,
    color: 'blue',
    actions: ['GENERATE_PLAN', 'DEMO_SCENARIO_LOADED', 'SEED_DATA'],
  },
  {
    step: 2,
    agentName: 'Incident Assessment Agent',
    label: 'Analyze Situation',
    description: 'Applies disaster-response knowledge base and assesses severity',
    icon: Target,
    color: 'blue',
    actions: ['GENERATE_PLAN'],
  },
  {
    step: 3,
    agentName: 'Volunteer Matching Agent',
    label: 'Query MongoDB (MCP)',
    description: 'Calls find_available_volunteers() tool via Gemini function calling',
    icon: Wrench,
    color: 'purple',
    actions: ['GENERATE_PLAN'],
  },
  {
    step: 4,
    agentName: 'Volunteer Matching Agent',
    label: 'Match Volunteers',
    description: 'Scores volunteers by skill type, location proximity, and availability',
    icon: Users,
    color: 'purple',
    actions: ['GENERATE_PLAN'],
  },
  {
    step: 5,
    agentName: 'Resource Allocation Agent',
    label: 'Allocate Resources',
    description: 'Calls find_available_resources() and assigns optimal resources per emergency',
    icon: Package,
    color: 'orange',
    actions: ['GENERATE_PLAN'],
  },
  {
    step: 6,
    agentName: 'Mission Planning Agent',
    label: 'Generate Mission Plan',
    description: 'Gemini synthesizes all data into prioritized mission plans with full reasoning',
    icon: Brain,
    color: 'emerald',
    actions: ['GENERATE_PLAN'],
  },
  {
    step: 7,
    agentName: 'Coordinator Approval Agent',
    label: 'Await Human Approval',
    description: 'Plans are presented to coordinator — no mission created without explicit human approval',
    icon: UserCheck,
    color: 'yellow',
    actions: ['MISSION_CREATED'],
  },
]

const STEP_COLORS: Record<string, { border: string; bg: string; text: string; icon: string; num: string }> = {
  blue: {
    border: 'border-blue-600/40',
    bg: 'bg-blue-900/20',
    text: 'text-blue-300',
    icon: 'text-blue-400',
    num: 'bg-blue-600/30 border-blue-500/40 text-blue-300',
  },
  purple: {
    border: 'border-purple-600/40',
    bg: 'bg-purple-900/20',
    text: 'text-purple-300',
    icon: 'text-purple-400',
    num: 'bg-purple-600/30 border-purple-500/40 text-purple-300',
  },
  orange: {
    border: 'border-orange-600/40',
    bg: 'bg-orange-900/20',
    text: 'text-orange-300',
    icon: 'text-orange-400',
    num: 'bg-orange-600/30 border-orange-500/40 text-orange-300',
  },
  emerald: {
    border: 'border-emerald-600/40',
    bg: 'bg-emerald-900/20',
    text: 'text-emerald-300',
    icon: 'text-emerald-400',
    num: 'bg-emerald-600/30 border-emerald-500/40 text-emerald-300',
  },
  yellow: {
    border: 'border-yellow-600/40',
    bg: 'bg-yellow-900/20',
    text: 'text-yellow-300',
    icon: 'text-yellow-400',
    num: 'bg-yellow-600/30 border-yellow-500/40 text-yellow-300',
  },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function extractMetrics(logs: LogEntry[]) {
  const planLogs = logs.filter((l) => l.action === 'GENERATE_PLAN')
  const missionLogs = logs.filter((l) => l.action === 'MISSION_CREATED')
  const cancelLogs = logs.filter((l) => l.action === 'MISSION_CANCELLED')
  const completedLogs = logs.filter((l) => l.action === 'MISSION_COMPLETED')

  const geminiRuns = planLogs.filter((l) => l.details.toLowerCase().includes('gemini')).length
  const deterministicRuns = planLogs.length - geminiRuns

  const toolCallMatches = planLogs.map((l) => {
    const m = l.details.match(/(\d+) Gemini tool calls?/)
    return m ? parseInt(m[1]) : 0
  })
  const totalToolCalls = toolCallMatches.reduce((a, b) => a + b, 0)

  const knowledgeMatches = planLogs.map((l) => {
    const m = l.details.match(/(\d+) knowledge articles?/)
    return m ? parseInt(m[1]) : 0
  })
  const totalKnowledge = knowledgeMatches.reduce((a, b) => a + b, 0)

  return {
    totalRuns: planLogs.length,
    geminiRuns,
    deterministicRuns,
    totalMissions: missionLogs.length,
    cancelledMissions: cancelLogs.length,
    completedMissions: completedLogs.length,
    totalToolCalls,
    totalKnowledge,
    successRate:
      missionLogs.length > 0
        ? Math.round((completedLogs.length / missionLogs.length) * 100)
        : 0,
  }
}

export default function ReasoningTracePage() {
  const [data, setData] = useState<LogsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/agent-logs?limit=200')
      if (!res.ok) throw new Error('Failed to load logs')
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const logs = data?.logs ?? []
  const metrics = extractMetrics(logs)
  const recentPlanLogs = logs.filter((l) => l.action === 'GENERATE_PLAN').slice(0, 5)
  const recentMissionLogs = logs.filter((l) => l.action === 'MISSION_CREATED').slice(0, 5)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <GitBranch className="w-6 h-6 text-purple-400" />
            Reasoning Trace
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            7-step multi-agent workflow visualization · Tool call history · Success metrics
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700/30 rounded-xl p-4 text-red-400 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Agent Runs',
            value: metrics.totalRuns,
            icon: <Bot className="w-4 h-4 text-blue-400" />,
            sub: `${metrics.geminiRuns} Gemini · ${metrics.deterministicRuns} fallback`,
            color: 'bg-blue-500/10',
          },
          {
            label: 'Missions Created',
            value: metrics.totalMissions,
            icon: <Target className="w-4 h-4 text-green-400" />,
            sub: `${metrics.completedMissions} completed · ${metrics.cancelledMissions} cancelled`,
            color: 'bg-green-500/10',
          },
          {
            label: 'MongoDB Tool Calls',
            value: metrics.totalToolCalls,
            icon: <Wrench className="w-4 h-4 text-purple-400" />,
            sub: 'via Gemini function calling',
            color: 'bg-purple-500/10',
          },
          {
            label: 'KB Articles Applied',
            value: metrics.totalKnowledge,
            icon: <BookOpen className="w-4 h-4 text-teal-400" />,
            sub: 'disaster response grounding',
            color: 'bg-teal-500/10',
          },
        ].map(({ label, value, icon, sub, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-400 text-xs font-medium">{label}</p>
                <p className="text-2xl font-bold text-white mt-1">{loading ? '—' : value}</p>
                <p className="text-gray-600 text-[10px] mt-0.5">{sub}</p>
              </div>
              <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 7-Step Workflow */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-5 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-blue-400" />
          7-Step Agent Workflow
        </h2>

        <div className="relative">
          {/* Vertical connector line */}
          <div className="absolute left-5 top-8 bottom-8 w-0.5 bg-gray-800 z-0" />

          <div className="space-y-3 relative z-10">
            {WORKFLOW_STEPS.map((ws, idx) => {
              const colors = STEP_COLORS[ws.color]
              const Icon = ws.icon
              const isLastInGroup =
                idx === WORKFLOW_STEPS.length - 1 ||
                WORKFLOW_STEPS[idx + 1].agentName !== ws.agentName

              return (
                <div key={ws.step}>
                  <div className={`flex items-start gap-4 bg-gray-900 border ${colors.border} ${colors.bg} rounded-xl p-4`}>
                    {/* Step number */}
                    <div className={`w-10 h-10 rounded-full border flex items-center justify-center flex-shrink-0 font-bold text-sm ${colors.num}`}>
                      {ws.step}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className={`font-semibold text-sm ${colors.text}`}>{ws.label}</p>
                          <p className="text-gray-500 text-xs mt-0.5">{ws.description}</p>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="text-gray-600 text-[10px] uppercase tracking-wide">{ws.agentName}</p>
                        </div>
                      </div>
                    </div>

                    {/* Icon */}
                    <div className={`p-2 rounded-lg ${colors.bg} border ${colors.border} flex-shrink-0`}>
                      <Icon className={`w-4 h-4 ${colors.icon}`} />
                    </div>
                  </div>

                  {/* Arrow between steps */}
                  {idx < WORKFLOW_STEPS.length - 1 && (
                    <div className="flex items-center justify-center py-1">
                      <ArrowDown className="w-3 h-3 text-gray-700" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Tool Call History + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Plan Runs */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            <h3 className="text-white font-semibold text-sm">Agent Run History</h3>
          </div>
          <div className="divide-y divide-gray-800">
            {loading ? (
              <div className="px-5 py-6 text-center text-gray-500 text-sm">Loading…</div>
            ) : recentPlanLogs.length === 0 ? (
              <div className="px-5 py-6 text-center text-gray-500 text-sm">
                No agent runs yet. Go to{' '}
                <a href="/agent" className="text-blue-400 hover:underline">AI Agent</a> to run.
              </div>
            ) : (
              recentPlanLogs.map((log) => {
                const isGemini = log.details.toLowerCase().includes('gemini')
                const toolMatch = log.details.match(/(\d+) Gemini tool calls?/)
                const toolCount = toolMatch ? toolMatch[1] : null
                const kbMatch = log.details.match(/(\d+) knowledge articles?/)
                const kbCount = kbMatch ? kbMatch[1] : null

                return (
                  <div key={log._id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                          isGemini
                            ? 'text-blue-300 bg-blue-900/30 border-blue-700/40'
                            : 'text-gray-400 bg-gray-800 border-gray-700'
                        }`}>
                          {isGemini ? 'GEMINI' : 'FALLBACK'}
                        </span>
                        <p className="text-gray-300 text-xs truncate">{log.details.split('.')[0]}</p>
                      </div>
                      <p className="text-gray-600 text-[10px] flex-shrink-0 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {timeAgo(log.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {toolCount && (
                        <span className="text-[10px] text-purple-400 bg-purple-900/20 border border-purple-700/30 px-1.5 py-0.5 rounded">
                          {toolCount} tool calls
                        </span>
                      )}
                      {kbCount && (
                        <span className="text-[10px] text-teal-400 bg-teal-900/20 border border-teal-700/30 px-1.5 py-0.5 rounded">
                          {kbCount} KB articles
                        </span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Mission Creation History */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <h3 className="text-white font-semibold text-sm">Mission Creation History</h3>
          </div>
          <div className="divide-y divide-gray-800">
            {loading ? (
              <div className="px-5 py-6 text-center text-gray-500 text-sm">Loading…</div>
            ) : recentMissionLogs.length === 0 ? (
              <div className="px-5 py-6 text-center text-gray-500 text-sm">
                No missions created yet.
              </div>
            ) : (
              recentMissionLogs.map((log) => (
                <div key={log._id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                      <p className="text-gray-300 text-xs truncate">{log.details}</p>
                    </div>
                    <p className="text-gray-600 text-[10px] flex-shrink-0 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {timeAgo(log.createdAt)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Success / Failure Metrics */}
      {!loading && metrics.totalRuns > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4 text-sm flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            Performance Metrics
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Engine Distribution */}
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">AI Engine Usage</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-blue-400 text-xs w-20">Gemini AI</span>
                  <div className="flex-1 bg-gray-800 rounded-full h-2">
                    <div
                      className="h-2 bg-blue-500 rounded-full"
                      style={{
                        width: `${metrics.totalRuns > 0 ? Math.round((metrics.geminiRuns / metrics.totalRuns) * 100) : 0}%`,
                      }}
                    />
                  </div>
                  <span className="text-gray-400 text-xs w-6 text-right">{metrics.geminiRuns}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-xs w-20">Fallback</span>
                  <div className="flex-1 bg-gray-800 rounded-full h-2">
                    <div
                      className="h-2 bg-gray-500 rounded-full"
                      style={{
                        width: `${metrics.totalRuns > 0 ? Math.round((metrics.deterministicRuns / metrics.totalRuns) * 100) : 0}%`,
                      }}
                    />
                  </div>
                  <span className="text-gray-400 text-xs w-6 text-right">{metrics.deterministicRuns}</span>
                </div>
              </div>
            </div>

            {/* Mission Outcomes */}
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Mission Outcomes</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-3 h-3 text-green-400" />
                  <span className="text-green-400 text-xs flex-1">Completed</span>
                  <span className="text-white text-xs font-bold">{metrics.completedMissions}</span>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="w-3 h-3 text-red-400" />
                  <span className="text-red-400 text-xs flex-1">Cancelled</span>
                  <span className="text-white text-xs font-bold">{metrics.cancelledMissions}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3 text-blue-400" />
                  <span className="text-blue-400 text-xs flex-1">Active</span>
                  <span className="text-white text-xs font-bold">
                    {metrics.totalMissions - metrics.completedMissions - metrics.cancelledMissions}
                  </span>
                </div>
              </div>
            </div>

            {/* AI Capability Stats */}
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">AI Capabilities Used</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Wrench className="w-3 h-3 text-purple-400" />
                  <span className="text-purple-400 text-xs flex-1">MongoDB Tool Calls</span>
                  <span className="text-white text-xs font-bold">{metrics.totalToolCalls}</span>
                </div>
                <div className="flex items-center gap-2">
                  <BookOpen className="w-3 h-3 text-teal-400" />
                  <span className="text-teal-400 text-xs flex-1">Knowledge Articles</span>
                  <span className="text-white text-xs font-bold">{metrics.totalKnowledge}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Bot className="w-3 h-3 text-blue-400" />
                  <span className="text-blue-400 text-xs flex-1">Agent Runs</span>
                  <span className="text-white text-xs font-bold">{metrics.totalRuns}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
