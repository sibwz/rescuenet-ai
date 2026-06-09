'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Cpu,
  Play,
  CheckCircle,
  AlertTriangle,
  User,
  Package,
  MapPin,
  Zap,
  Brain,
  ChevronRight,
  RefreshCw,
  ShieldAlert,
  ArrowRight,
  Database,
  Wrench,
  Sparkles,
  Bot,
  BarChart3,
  Settings,
  TriangleAlert,
  CircleCheck,
  BookOpen,
  Rocket,
  Users,
  Target,
  Loader2,
  ArrowDown,
} from 'lucide-react'
import type { AgentPlan, EmergencyRequest, Volunteer, Resource } from '@/types'
import type { StreamEvent, StreamCompleteEvent, AgentHandoffEvent, KnowledgeEvent } from '@/app/api/agent/stream/route'
import type { ToolCallRecord } from '@/lib/gemini'
import type { KnowledgeEntry } from '@/lib/knowledge'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'

interface AgentResponse {
  plans: AgentPlan[]
  engine: 'gemini' | 'deterministic'
  summary: string
  geminiError?: string | null
  toolCalls?: ToolCallRecord[]
  modelUsed?: string
  knowledge?: KnowledgeEntry[]
}

const RESOURCE_ICONS: Record<string, string> = {
  food: '🍱',
  water: '💧',
  medicine: '💊',
  shelter_kits: '⛺',
  vehicles: '🚛',
}

const RISK_COLORS: Record<string, string> = {
  critical: 'text-red-400 bg-red-900/20 border-red-700/40',
  high: 'text-orange-400 bg-orange-900/20 border-orange-700/40',
  medium: 'text-yellow-400 bg-yellow-900/20 border-yellow-700/40',
  low: 'text-green-400 bg-green-900/20 border-green-700/40',
}

// The 5 agents in the workflow
const AGENTS = [
  {
    id: 'incident_agent',
    name: 'Incident Assessment',
    shortName: 'Incident',
    role: 'Reads emergencies & retrieves knowledge',
    steps: [1, 2],
    color: 'blue',
    icon: Target,
  },
  {
    id: 'volunteer_agent',
    name: 'Volunteer Matching',
    shortName: 'Volunteer',
    role: 'Finds skill-matched volunteers',
    steps: [3, 4],
    color: 'purple',
    icon: Users,
  },
  {
    id: 'resource_agent',
    name: 'Resource Allocation',
    shortName: 'Resource',
    role: 'Allocates optimal resources',
    steps: [5],
    color: 'orange',
    icon: Package,
  },
  {
    id: 'mission_planner',
    name: 'Mission Planning',
    shortName: 'Planner',
    role: 'Generates prioritized plans',
    steps: [6],
    color: 'emerald',
    icon: Brain,
  },
  {
    id: 'coordinator_agent',
    name: 'Coordinator',
    shortName: 'Approval',
    role: 'Prepares for human review',
    steps: [7],
    color: 'yellow',
    icon: CheckCircle,
  },
]

const AGENT_COLORS: Record<string, { border: string; bg: string; text: string; dot: string }> = {
  blue: {
    border: 'border-blue-500',
    bg: 'bg-blue-900/30',
    text: 'text-blue-300',
    dot: 'bg-blue-400',
  },
  purple: {
    border: 'border-purple-500',
    bg: 'bg-purple-900/30',
    text: 'text-purple-300',
    dot: 'bg-purple-400',
  },
  orange: {
    border: 'border-orange-500',
    bg: 'bg-orange-900/30',
    text: 'text-orange-300',
    dot: 'bg-orange-400',
  },
  emerald: {
    border: 'border-emerald-500',
    bg: 'bg-emerald-900/30',
    text: 'text-emerald-300',
    dot: 'bg-emerald-400',
  },
  yellow: {
    border: 'border-yellow-500',
    bg: 'bg-yellow-900/30',
    text: 'text-yellow-300',
    dot: 'bg-yellow-400',
  },
}

function getRiskStyle(level: string) {
  return RISK_COLORS[level] ?? 'text-gray-400 bg-gray-800 border-gray-700/40'
}

function StepIcon({ icon, type }: { icon?: string; type: string }) {
  const cls = 'w-4 h-4 flex-shrink-0'
  if (type === 'tool_call') return <Wrench className={`${cls} text-purple-400`} />
  if (type === 'tool_result') return <CircleCheck className={`${cls} text-emerald-400`} />
  if (type === 'agent_handoff') return <Bot className={`${cls} text-yellow-400`} />
  if (type === 'knowledge') return <BookOpen className={`${cls} text-teal-400`} />
  if (type === 'error') return <TriangleAlert className={`${cls} text-red-400`} />
  switch (icon) {
    case 'bot': return <Bot className={`${cls} text-blue-400`} />
    case 'database': return <Database className={`${cls} text-green-400`} />
    case 'chart': return <BarChart3 className={`${cls} text-cyan-400`} />
    case 'brain': return <Brain className={`${cls} text-purple-400`} />
    case 'sparkle': return <Sparkles className={`${cls} text-yellow-400`} />
    case 'gear': return <Settings className={`${cls} text-gray-400`} />
    case 'warning': return <TriangleAlert className={`${cls} text-yellow-400`} />
    case 'check': return <CircleCheck className={`${cls} text-green-400`} />
    case 'tool': return <Wrench className={`${cls} text-purple-400`} />
    case 'book': return <BookOpen className={`${cls} text-teal-400`} />
    case 'agent': return <Bot className={`${cls} text-yellow-400`} />
    default: return <Cpu className={`${cls} text-blue-400`} />
  }
}

function stepRowStyle(type: string): string {
  if (type === 'tool_call') return 'ml-4 bg-purple-950/30 border border-purple-800/30 rounded px-3 py-1.5'
  if (type === 'tool_result') return 'ml-8 text-emerald-400/80'
  if (type === 'agent_handoff') return 'bg-yellow-950/20 border border-yellow-800/20 rounded px-3 py-1.5'
  if (type === 'knowledge') return 'bg-teal-950/20 border border-teal-800/20 rounded px-3 py-1.5'
  if (type === 'error') return 'text-red-400'
  return ''
}

export default function AgentPage() {
  const [isStreaming, setIsStreaming] = useState(false)
  const [steps, setSteps] = useState<StreamEvent[]>([])
  const [confirming, setConfirming] = useState(false)
  const [response, setResponse] = useState<AgentResponse | null>(null)
  const [selectedPlans, setSelectedPlans] = useState<Set<string>>(new Set())
  const [confirmed, setConfirmed] = useState(false)
  const [result, setResult] = useState<{ created: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [completedAgents, setCompletedAgents] = useState<Set<string>>(new Set())

  // Demo mode state
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [demoPhase, setDemoPhase] = useState<'idle' | 'seeding' | 'running' | 'countdown' | 'approving' | 'done'>('idle')
  const [demoCountdown, setDemoCountdown] = useState(0)
  const [selectedScenario, setSelectedScenario] = useState<'multi' | 'flood' | 'earthquake' | 'wildfire' | 'hurricane'>('multi')
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stepBoxRef = useRef<HTMLDivElement>(null)

  function appendStep(step: StreamEvent) {
    setSteps((prev) => [...prev, step])
    setTimeout(() => {
      stepBoxRef.current?.scrollTo({ top: stepBoxRef.current.scrollHeight, behavior: 'smooth' })
    }, 30)
  }

  async function generatePlan(demoAuto = false) {
    setIsStreaming(true)
    setError(null)
    setResponse(null)
    setConfirmed(false)
    setResult(null)
    setSelectedPlans(new Set())
    setSteps([])
    setActiveAgentId(null)
    setCompletedAgents(new Set())

    try {
      const res = await fetch('/api/agent/stream')
      if (!res.body) throw new Error('No response body from stream')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6)) as StreamEvent

            if (event.type === 'complete') {
              const completeEvent = event as unknown as StreamCompleteEvent
              setResponse({
                plans: completeEvent.plans,
                engine: completeEvent.engine,
                summary: completeEvent.summary,
                geminiError: completeEvent.geminiError,
                toolCalls: completeEvent.toolCalls,
                modelUsed: completeEvent.modelUsed,
                knowledge: completeEvent.knowledge,
              })
              setSelectedPlans(
                new Set(
                  completeEvent.plans
                    .filter((p: AgentPlan) => p.suggestedVolunteer && p.suggestedResource)
                    .map((p: AgentPlan) => p.requestId)
                )
              )
              // Mark last agent complete
              setActiveAgentId(null)
              setCompletedAgents(new Set(AGENTS.map((a) => a.id)))
            } else if (event.type === 'agent_handoff') {
              const handoff = event as unknown as AgentHandoffEvent
              setActiveAgentId(handoff.agentId)
              setCompletedAgents((prev) => {
                const agentIdx = AGENTS.findIndex((a) => a.id === handoff.agentId)
                const done = new Set(prev)
                AGENTS.slice(0, agentIdx).forEach((a) => done.add(a.id))
                return done
              })
              appendStep(event)
            } else if (event.type === 'error') {
              setError(event.message)
            } else {
              appendStep(event)
            }
          } catch {
            // malformed SSE line — skip
          }
        }
      }

      // Demo auto-approve after stream completes
      if (demoAuto) {
        setDemoPhase('countdown')
        setDemoCountdown(5)
        countdownRef.current = setInterval(() => {
          setDemoCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(countdownRef.current!)
              setDemoPhase('approving')
              return 0
            }
            return prev - 1
          })
        }, 1000)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Stream failed')
    } finally {
      setIsStreaming(false)
    }
  }

  // Auto-approve when demo countdown reaches 0
  useEffect(() => {
    if (demoPhase === 'approving' && response) {
      confirmPlans(true)
    }
  }, [demoPhase]) // eslint-disable-line react-hooks/exhaustive-deps

  async function runDemoMode(scenario = selectedScenario) {
    setIsDemoMode(true)
    setDemoPhase('seeding')
    setError(null)
    setResponse(null)
    setConfirmed(false)
    setResult(null)
    setSteps([])

    try {
      const seedRes = await fetch(`/api/demo?scenario=${scenario}`, { method: 'POST' })
      const seedData = await seedRes.json()
      if (!seedRes.ok) throw new Error(seedData.error ?? 'Demo seed failed')

      setDemoPhase('running')
      await generatePlan(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Demo mode failed')
      setDemoPhase('idle')
      setIsDemoMode(false)
    }
  }

  function resetDemo() {
    if (countdownRef.current) clearInterval(countdownRef.current)
    setIsDemoMode(false)
    setDemoPhase('idle')
    setDemoCountdown(0)
    setResponse(null)
    setConfirmed(false)
    setResult(null)
    setSteps([])
    setActiveAgentId(null)
    setCompletedAgents(new Set())
    setError(null)
  }

  async function confirmPlans(autoApprove = false) {
    if (!response) return
    setConfirming(true)
    setError(null)

    const toConfirm = response.plans.filter(
      (p) => autoApprove
        ? (p.suggestedVolunteer && p.suggestedResource)
        : selectedPlans.has(p.requestId)
    )

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plans: toConfirm }),
      })
      if (!res.ok) throw new Error('Failed to create missions')
      const data = await res.json()
      setResult(data)
      setConfirmed(true)
      if (isDemoMode) setDemoPhase('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      if (isDemoMode) setDemoPhase('idle')
    } finally {
      setConfirming(false)
    }
  }

  function togglePlan(requestId: string) {
    setSelectedPlans((prev) => {
      const next = new Set(prev)
      if (next.has(requestId)) next.delete(requestId)
      else next.add(requestId)
      return next
    })
  }

  const engineLabel =
    response?.engine === 'gemini'
      ? `${response.modelUsed ?? 'Gemini AI'} (Function Calling + Knowledge Grounding)`
      : 'Deterministic Planner'

  const toolCallCount = response?.toolCalls?.length ?? 0
  const knowledgeCount = response?.knowledge?.length ?? 0

  const showInitial = !isStreaming && !response && !confirmed && demoPhase === 'idle'
  const showAgentFlow = isStreaming || (steps.length > 0 && !confirmed) || demoPhase === 'countdown' || demoPhase === 'approving'

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Cpu className="w-6 h-6 text-blue-400" />
            AI Response Agent
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Multi-agent system powered by{' '}
            <span className="text-blue-400 font-medium">
              {response ? engineLabel : 'Gemini AI + Knowledge Grounding'}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {response?.engine === 'gemini' && toolCallCount > 0 && (
            <div className="flex items-center gap-1.5 bg-purple-900/30 border border-purple-700/40 px-3 py-1.5 rounded-lg">
              <Wrench className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-purple-300 text-xs font-semibold">{toolCallCount} tool calls</span>
            </div>
          )}
          {knowledgeCount > 0 && (
            <div className="flex items-center gap-1.5 bg-teal-900/30 border border-teal-700/40 px-3 py-1.5 rounded-lg">
              <BookOpen className="w-3.5 h-3.5 text-teal-400" />
              <span className="text-teal-300 text-xs font-semibold">{knowledgeCount} articles</span>
            </div>
          )}
        </div>
      </div>

      {/* Gemini Failure Banner */}
      {response?.geminiError && (
        <div className="bg-yellow-950/40 border border-yellow-600/40 rounded-xl p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-yellow-300 font-semibold text-sm">
              Gemini unavailable — deterministic fallback active.
            </p>
            <p className="text-yellow-500/80 text-xs mt-1 font-mono break-all">{response.geminiError}</p>
          </div>
        </div>
      )}

      {/* Multi-Agent Workflow Visualization */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-4 flex items-center gap-2 text-sm">
          <Brain className="w-4 h-4 text-purple-400" />
          Multi-Agent Workflow
        </h2>
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {AGENTS.map((agent, idx) => {
            const isActive = activeAgentId === agent.id
            const isDone = completedAgents.has(agent.id)
            const colors = AGENT_COLORS[agent.color]
            const Icon = agent.icon

            return (
              <div key={agent.id} className="flex items-center gap-1 flex-shrink-0">
                <div
                  className={`relative flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl border transition-all duration-300 min-w-[100px] ${
                    isActive
                      ? `${colors.border} ${colors.bg}`
                      : isDone
                      ? 'border-green-600/50 bg-green-900/20'
                      : 'border-gray-700 bg-gray-800/50'
                  }`}
                >
                  {isActive && (
                    <span className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${colors.dot} animate-pulse`} />
                  )}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isActive ? colors.bg : isDone ? 'bg-green-900/30' : 'bg-gray-800'
                  }`}>
                    {isDone && !isActive ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <Icon className={`w-4 h-4 ${isActive ? colors.text : 'text-gray-500'}`} />
                    )}
                  </div>
                  <div className="text-center">
                    <p className={`text-[11px] font-semibold leading-tight ${
                      isActive ? colors.text : isDone ? 'text-green-300' : 'text-gray-500'
                    }`}>
                      {agent.shortName}
                    </p>
                    <p className="text-[9px] text-gray-600 mt-0.5">Step {agent.steps.join('–')}</p>
                  </div>
                </div>
                {idx < AGENTS.length - 1 && (
                  <ArrowRight className={`w-3 h-3 flex-shrink-0 ${
                    completedAgents.has(agent.id) ? 'text-green-600' : 'text-gray-700'
                  }`} />
                )}
              </div>
            )
          })}
        </div>
        <div className="mt-3 grid grid-cols-5 gap-1">
          {AGENTS.map((agent) => (
            <p key={agent.id} className="text-[10px] text-gray-600 text-center leading-tight px-1">
              {agent.role}
            </p>
          ))}
        </div>
      </div>

      {/* Initial State */}
      {showInitial && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Demo Mode Card */}
          <div className="bg-gradient-to-br from-red-900/30 to-orange-900/20 border border-red-700/40 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-2">
              <Rocket className="w-5 h-5 text-red-400" />
              <h3 className="text-white font-semibold">Demo Mode</h3>
              <span className="text-[10px] bg-red-600/30 text-red-300 border border-red-600/30 px-1.5 py-0.5 rounded font-medium">LIVE DEMO</span>
            </div>
            <p className="text-gray-400 text-sm mb-3 leading-relaxed">
              One-click disaster scenario: seeds realistic data, runs all 5 AI agents, auto-approves missions.
            </p>

            {/* Scenario selector */}
            <div className="mb-4">
              <p className="text-gray-500 text-xs font-medium mb-2 uppercase tracking-wider">Select Scenario</p>
              <div className="grid grid-cols-5 gap-1.5">
                {([
                  { key: 'multi', icon: '🌐', label: 'Multi' },
                  { key: 'flood', icon: '🌊', label: 'Flood' },
                  { key: 'earthquake', icon: '🏚️', label: 'Quake' },
                  { key: 'wildfire', icon: '🔥', label: 'Fire' },
                  { key: 'hurricane', icon: '🌀', label: 'Storm' },
                ] as const).map(({ key, icon, label }) => (
                  <button
                    key={key}
                    onClick={() => setSelectedScenario(key)}
                    className={`flex flex-col items-center gap-0.5 py-2 rounded-lg border text-[10px] font-medium transition-all ${
                      selectedScenario === key
                        ? 'bg-red-600/20 border-red-500/50 text-red-300'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <span className="text-base leading-none">{icon}</span>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <ul className="text-xs text-gray-500 space-y-1 mb-4">
              <li className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-green-500" /> Realistic scenario data seeded</li>
              <li className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-green-500" /> All 5 agents activate in sequence</li>
              <li className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-green-500" /> Knowledge base consulted automatically</li>
              <li className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-green-500" /> Auto-approves in 5s for live demo</li>
            </ul>
            <Button onClick={() => runDemoMode(selectedScenario)} variant="primary" className="w-full justify-center bg-red-600 hover:bg-red-500 border-red-500">
              <Rocket className="w-4 h-4" />
              Run {selectedScenario === 'multi' ? 'Multi-Disaster' : selectedScenario.charAt(0).toUpperCase() + selectedScenario.slice(1)} Scenario
            </Button>
          </div>

          {/* Manual Mode Card */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-5 h-5 text-blue-400" />
              <h3 className="text-white font-semibold">Manual Mode</h3>
            </div>
            <p className="text-gray-400 text-sm mb-4 leading-relaxed">
              Run the agent against current database state. Review and selectively approve generated mission plans.
            </p>
            <ul className="text-xs text-gray-500 space-y-1 mb-5">
              <li className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-blue-500" /> Uses current pending emergencies</li>
              <li className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-blue-500" /> Gemini function calling with tool use</li>
              <li className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-blue-500" /> Knowledge grounding applied</li>
              <li className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-blue-500" /> Coordinator approves each plan</li>
            </ul>
            <Button onClick={() => generatePlan()} variant="primary" className="w-full justify-center">
              <Play className="w-4 h-4" />
              Run AI Agent
            </Button>
          </div>
        </div>
      )}

      {error && !isStreaming && (
        <div className="bg-red-900/20 border border-red-700/30 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
          <TriangleAlert className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Demo Phase Indicators */}
      {isDemoMode && demoPhase === 'seeding' && (
        <div className="bg-orange-950/30 border border-orange-700/30 rounded-xl p-4 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />
          <div>
            <p className="text-orange-300 font-medium text-sm">Loading demo scenario…</p>
            <p className="text-orange-500/70 text-xs">Seeding 5 emergencies, 6 volunteers, 6 resources</p>
          </div>
        </div>
      )}

      {isDemoMode && demoPhase === 'countdown' && (
        <div className="bg-green-950/30 border border-green-600/40 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-600/30 border border-green-500/50 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-green-300 font-bold text-lg">{demoCountdown}</span>
          </div>
          <div>
            <p className="text-green-300 font-semibold text-sm">Auto-approving all valid mission plans in {demoCountdown}s…</p>
            <p className="text-green-500/70 text-xs">Demo mode: coordinator approval will be automatic</p>
          </div>
        </div>
      )}

      {isDemoMode && demoPhase === 'approving' && (
        <div className="bg-blue-950/30 border border-blue-600/40 rounded-xl p-4 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
          <p className="text-blue-300 font-medium text-sm">Creating missions in MongoDB…</p>
        </div>
      )}

      {/* Live Step Log */}
      {showAgentFlow && steps.length > 0 && (
        <div className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-blue-400" />
              <span className="text-white text-sm font-semibold">Agent Activity Log</span>
            </div>
            <div className="flex items-center gap-2">
              {isStreaming && (
                <>
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-green-400 text-xs font-medium">Live</span>
                </>
              )}
              {!isStreaming && steps.length > 0 && (
                <span className="text-gray-500 text-xs">Complete — {steps.length} events</span>
              )}
            </div>
          </div>
          <div
            ref={stepBoxRef}
            className="p-4 space-y-1.5 max-h-72 overflow-y-auto font-mono text-xs"
          >
            {steps.map((step, i) => (
              <div key={i} className={`flex items-start gap-2 ${stepRowStyle(step.type)}`}>
                <StepIcon icon={step.icon} type={step.type} />
                <div className="min-w-0 flex-1">
                  <span
                    className={`${
                      step.type === 'tool_call'
                        ? 'text-purple-300'
                        : step.type === 'tool_result'
                        ? 'text-emerald-300'
                        : step.type === 'agent_handoff'
                        ? 'text-yellow-300 font-semibold'
                        : step.type === 'knowledge'
                        ? 'text-teal-300'
                        : step.type === 'error'
                        ? 'text-red-300'
                        : 'text-gray-300'
                    }`}
                  >
                    {step.message}
                  </span>
                  <span className="text-gray-700 ml-2 text-[10px]">
                    {new Date(step.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
            {isStreaming && (
              <div className="flex items-center gap-2 text-gray-500">
                <div className="w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                <span>Running…</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Success Banner */}
      {confirmed && result && (
        <div className="bg-green-900/30 border border-green-600/30 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0" />
            <div>
              <p className="text-green-300 font-semibold">
                {result.created} mission{result.created !== 1 ? 's' : ''} created successfully
                {isDemoMode && ' (Demo Mode)'}
              </p>
              <p className="text-green-400/70 text-sm mt-0.5">
                Volunteers marked busy · Resources allocated · Missions saved to MongoDB · Agent log recorded
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={isDemoMode ? resetDemo : () => {
                setResponse(null)
                setConfirmed(false)
                setResult(null)
                setSteps([])
                setActiveAgentId(null)
                setCompletedAgents(new Set())
              }}
            >
              <RefreshCw className="w-4 h-4" />
              {isDemoMode ? 'Reset Demo' : 'New Plan'}
            </Button>
          </div>
        </div>
      )}

      {/* Agent Response & Plans */}
      {response && !confirmed && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-blue-950/40 border border-blue-700/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Zap className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-blue-300 font-medium text-sm mb-1">Agent Summary</p>
                <p className="text-gray-300 text-sm leading-relaxed">{response.summary}</p>
              </div>
              <div className="flex-shrink-0 text-right space-y-1">
                {response.engine === 'gemini' && toolCallCount > 0 && (
                  <p className="text-purple-400 text-xs font-semibold">{toolCallCount} tool calls</p>
                )}
                {knowledgeCount > 0 && (
                  <p className="text-teal-400 text-xs font-semibold">{knowledgeCount} KB articles</p>
                )}
              </div>
            </div>
          </div>

          {/* Retrieved Knowledge */}
          {response.knowledge && response.knowledge.length > 0 && (
            <div className="bg-teal-950/30 border border-teal-700/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-teal-400" />
                <h3 className="text-teal-300 font-semibold text-sm">Knowledge Base Retrieved</h3>
                <span className="ml-auto text-[10px] text-teal-600 bg-teal-900/30 border border-teal-700/30 px-1.5 py-0.5 rounded">Grounded Reasoning</span>
              </div>
              <div className="space-y-3">
                {response.knowledge.map((entry) => (
                  <div key={entry.disasterType} className="border border-teal-800/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-teal-300 text-xs font-semibold">{entry.category}</span>
                      <span className="text-[10px] text-teal-600 font-mono ml-auto">{entry.source}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-gray-500 uppercase tracking-wide text-[10px] mb-1">Immediate Actions</p>
                        <ul className="space-y-0.5">
                          {entry.immediateActions.slice(0, 2).map((action, i) => (
                            <li key={i} className="text-gray-400 flex items-start gap-1">
                              <span className="text-teal-500 flex-shrink-0">•</span>
                              <span className="leading-tight">{action}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-gray-500 uppercase tracking-wide text-[10px] mb-1">Warnings</p>
                        <ul className="space-y-0.5">
                          {entry.warnings.slice(0, 2).map((w, i) => (
                            <li key={i} className="text-orange-400/70 flex items-start gap-1">
                              <span className="flex-shrink-0">⚠</span>
                              <span className="leading-tight">{w}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-gray-500 uppercase tracking-wide text-[10px] mb-1">Required Skills</p>
                        <div className="flex flex-wrap gap-1">
                          {entry.skillRequirements.map((s) => (
                            <span key={s} className="text-[10px] bg-teal-900/30 border border-teal-700/30 text-teal-300 px-1.5 py-0.5 rounded capitalize">
                              {s.replace('_', ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {response.plans.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
              <AlertTriangle className="w-10 h-10 text-yellow-500 mx-auto mb-3" />
              <p className="text-white font-medium">No pending requests to action</p>
              <p className="text-gray-400 text-sm mt-1">All requests are already assigned or completed.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-white font-semibold">
                  Mission Plans ({response.plans.length})
                </h2>
                <p className="text-gray-400 text-sm">
                  {selectedPlans.size} of {response.plans.length} selected
                </p>
              </div>

              <div className="space-y-3">
                {response.plans.map((plan) => {
                  const isSelected = selectedPlans.has(plan.requestId)
                  const canSelect = !!(plan.suggestedVolunteer && plan.suggestedResource)
                  const req = plan.request as EmergencyRequest
                  const vol = plan.suggestedVolunteer as Volunteer | null
                  const res = plan.suggestedResource as Resource | null
                  const rd = plan.reasoningDetails

                  return (
                    <div
                      key={plan.requestId}
                      className={`bg-gray-900 border rounded-xl p-5 transition-all ${
                        isSelected
                          ? 'border-blue-500/50 shadow-blue-900/20 shadow-lg'
                          : 'border-gray-800'
                      } ${canSelect ? 'cursor-pointer' : 'opacity-60'}`}
                      onClick={() => canSelect && togglePlan(plan.requestId)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${
                              isSelected
                                ? 'bg-blue-600 border-blue-500'
                                : 'border-gray-600 bg-gray-800'
                            }`}
                          >
                            {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant={req?.urgency}>{req?.urgency}</Badge>
                              <span className="text-gray-400 text-xs capitalize">
                                {req?.emergencyType} emergency
                              </span>
                              <span className="text-gray-600 text-xs">
                                Priority: {plan.priorityScore}
                              </span>
                            </div>
                            <p className="text-white font-semibold mt-1 flex items-center gap-1.5">
                              <MapPin className="w-4 h-4 text-gray-400" />
                              {req?.location}
                            </p>
                            <p className="text-gray-400 text-xs mt-0.5">
                              {req?.peopleAffected} people · {req?.reporterName}
                            </p>
                          </div>
                        </div>
                        {!canSelect && (
                          <span className="text-yellow-500 text-xs bg-yellow-900/20 border border-yellow-700/30 px-2 py-1 rounded">
                            Insufficient resources
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-3">
                        {/* Volunteer */}
                        <div className="bg-gray-800/60 rounded-lg p-3">
                          <p className="text-gray-500 text-xs uppercase tracking-wide mb-1.5">Assigned Volunteer</p>
                          {vol ? (
                            <div className="flex items-start gap-2">
                              <User className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-white text-sm font-medium">{vol.name}</p>
                                <p className="text-gray-400 text-xs">{vol.location}</p>
                                <p className="text-gray-500 text-xs capitalize mt-0.5">
                                  {vol.skills?.map((s) => s.replace('_', ' ')).join(', ')}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <p className="text-yellow-400 text-xs flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> No match found
                            </p>
                          )}
                        </div>

                        {/* Resource */}
                        <div className="bg-gray-800/60 rounded-lg p-3">
                          <p className="text-gray-500 text-xs uppercase tracking-wide mb-1.5">Allocated Resource</p>
                          {res ? (
                            <div className="flex items-start gap-2">
                              <span className="text-lg leading-none">{RESOURCE_ICONS[res.resourceType] ?? '📦'}</span>
                              <div>
                                <p className="text-white text-sm font-medium capitalize">
                                  {res.resourceType.replace('_', ' ')}
                                </p>
                                <p className="text-gray-400 text-xs">{res.quantity} units</p>
                                <p className="text-gray-500 text-xs">{res.location}</p>
                              </div>
                            </div>
                          ) : (
                            <p className="text-yellow-400 text-xs flex items-center gap-1">
                              <Package className="w-3 h-3" /> No match found
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Reasoning */}
                      <div className="bg-gray-800/40 border border-gray-700/50 rounded-lg p-3 space-y-3">
                        <div>
                          <p className="text-gray-500 text-xs font-medium uppercase tracking-wide mb-1">
                            Agent Reasoning
                          </p>
                          <p className="text-gray-300 text-xs leading-relaxed">{plan.reasoning}</p>
                        </div>

                        {rd && (
                          <div className="pt-2 border-t border-gray-700/50 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <p className="text-gray-600 text-[10px] uppercase tracking-wide mb-1">Priority Reason</p>
                                <p className="text-gray-400 text-xs leading-relaxed">{rd.priorityReason}</p>
                              </div>
                              <div>
                                <p className="text-gray-600 text-[10px] uppercase tracking-wide mb-1">Risk Level</p>
                                <span className={`inline-flex items-center gap-1 text-xs font-semibold uppercase px-2 py-0.5 rounded border ${getRiskStyle(rd.riskLevel)}`}>
                                  <ShieldAlert className="w-3 h-3" />
                                  {rd.riskLevel}
                                </span>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <p className="text-gray-600 text-[10px] uppercase tracking-wide mb-1">Volunteer Match</p>
                                <p className="text-gray-400 text-xs leading-relaxed">{rd.volunteerMatchReason}</p>
                              </div>
                              <div>
                                <p className="text-gray-600 text-[10px] uppercase tracking-wide mb-1">Resource Allocation</p>
                                <p className="text-gray-400 text-xs leading-relaxed">{rd.resourceAllocationReason}</p>
                              </div>
                            </div>
                            <div className="bg-blue-950/40 border border-blue-800/30 rounded p-2 flex items-start gap-2">
                              <ArrowRight className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-gray-600 text-[10px] uppercase tracking-wide mb-0.5">Next Action</p>
                                <p className="text-blue-300 text-xs font-medium">{rd.nextAction}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Confirm Actions */}
              {demoPhase === 'idle' && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">
                        Approve and create {selectedPlans.size} mission{selectedPlans.size !== 1 ? 's' : ''}?
                      </p>
                      <p className="text-gray-400 text-sm mt-0.5">
                        This will assign volunteers, allocate resources, and save missions to MongoDB.
                      </p>
                      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setResponse(null)
                          setSteps([])
                          setActiveAgentId(null)
                          setCompletedAgents(new Set())
                          generatePlan()
                        }}
                        loading={isStreaming}
                      >
                        <RefreshCw className="w-4 h-4" />
                        Regenerate
                      </Button>
                      <Button
                        variant="success"
                        size="lg"
                        onClick={() => confirmPlans(false)}
                        loading={confirming}
                        disabled={selectedPlans.size === 0}
                      >
                        <CheckCircle className="w-5 h-5" />
                        Approve and Create Missions
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Arrow to Reasoning Trace */}
      {confirmed && result && (
        <div className="flex items-center justify-center gap-2 text-gray-600 text-sm">
          <ArrowDown className="w-4 h-4" />
          <a href="/reasoning-trace" className="text-blue-400 hover:text-blue-300 hover:underline">
            View full reasoning trace and agent metrics →
          </a>
        </div>
      )}
    </div>
  )
}
