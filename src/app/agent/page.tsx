'use client'

import { useState, useRef } from 'react'
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
} from 'lucide-react'
import type { AgentPlan, EmergencyRequest, Volunteer, Resource } from '@/types'
import type { StreamEvent, StreamCompleteEvent } from '@/app/api/agent/stream/route'
import type { ToolCallRecord } from '@/lib/gemini'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'

interface AgentResponse {
  plans: AgentPlan[]
  engine: 'gemini' | 'deterministic'
  summary: string
  geminiError?: string | null
  toolCalls?: ToolCallRecord[]
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

function getRiskStyle(level: string) {
  return RISK_COLORS[level] ?? 'text-gray-400 bg-gray-800 border-gray-700/40'
}

function StepIcon({ icon, type }: { icon?: string; type: string }) {
  const cls = 'w-4 h-4 flex-shrink-0'
  if (type === 'tool_call') return <Wrench className={`${cls} text-purple-400`} />
  if (type === 'tool_result') return <CircleCheck className={`${cls} text-emerald-400`} />
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
    default: return <Cpu className={`${cls} text-blue-400`} />
  }
}

function stepRowStyle(type: string): string {
  if (type === 'tool_call') return 'ml-4 bg-purple-950/30 border border-purple-800/30 rounded px-3 py-1.5'
  if (type === 'tool_result') return 'ml-8 text-emerald-400/80'
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
  const stepBoxRef = useRef<HTMLDivElement>(null)

  function appendStep(step: StreamEvent) {
    setSteps((prev) => [...prev, step])
    setTimeout(() => {
      stepBoxRef.current?.scrollTo({ top: stepBoxRef.current.scrollHeight, behavior: 'smooth' })
    }, 30)
  }

  async function generatePlan() {
    setIsStreaming(true)
    setError(null)
    setResponse(null)
    setConfirmed(false)
    setResult(null)
    setSelectedPlans(new Set())
    setSteps([])

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
              })
              setSelectedPlans(
                new Set(
                  completeEvent.plans
                    .filter((p: AgentPlan) => p.suggestedVolunteer && p.suggestedResource)
                    .map((p: AgentPlan) => p.requestId)
                )
              )
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Stream failed')
    } finally {
      setIsStreaming(false)
    }
  }

  async function confirmPlans() {
    if (!response) return
    setConfirming(true)
    setError(null)

    const toConfirm = response.plans.filter((p) => selectedPlans.has(p.requestId))

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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
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
      ? `Gemini ${process.env.NEXT_PUBLIC_GEMINI_MODEL ?? 'AI'} (Function Calling)`
      : 'Deterministic Planner'

  const toolCallCount = response?.toolCalls?.length ?? 0

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
            Powered by{' '}
            <span className="text-blue-400 font-medium">
              {response ? engineLabel : 'Gemini AI with MongoDB Tool Calling'}
            </span>
          </p>
        </div>
        {response?.engine === 'gemini' && toolCallCount > 0 && (
          <div className="flex items-center gap-1.5 bg-purple-900/30 border border-purple-700/40 px-3 py-1.5 rounded-lg">
            <Wrench className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-purple-300 text-xs font-semibold">{toolCallCount} MongoDB tool calls</span>
          </div>
        )}
      </div>

      {/* Gemini Failure Banner */}
      {response?.geminiError && (
        <div className="bg-yellow-950/40 border border-yellow-600/40 rounded-xl p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-yellow-300 font-semibold text-sm">
              Gemini unavailable — fallback planner active.
            </p>
            <p className="text-yellow-500/80 text-xs mt-1 font-mono break-all">{response.geminiError}</p>
          </div>
        </div>
      )}

      {/* How It Works */}
      {!isStreaming && !response && !confirmed && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Brain className="w-4 h-4 text-purple-400" />
            Agentic Reasoning Loop
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            {[
              { step: '1', label: 'Query MongoDB', desc: 'Agent calls query_pending_emergencies() to load active requests', icon: Database },
              { step: '2', label: 'Tool Calls', desc: 'Gemini calls find_available_volunteers() + find_available_resources() per emergency', icon: Wrench },
              { step: '3', label: 'Reason', desc: 'Multi-turn Gemini conversation builds optimal assignments with full justification', icon: Brain },
              { step: '4', label: 'Plan', desc: 'Produces prioritized mission plans with risk scores and next actions', icon: Zap },
              { step: '5', label: 'Approve', desc: 'Coordinator reviews each plan and approves before saving to MongoDB', icon: CheckCircle },
            ].map(({ step, label, desc, icon: Icon }) => (
              <div key={step} className="flex items-start gap-2">
                <div className="w-6 h-6 bg-blue-600/30 border border-blue-500/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-400 text-xs font-bold">{step}</span>
                </div>
                <div>
                  <p className="text-white text-xs font-medium flex items-center gap-1">
                    <Icon className="w-3 h-3 text-blue-400" />
                    {label}
                  </p>
                  <p className="text-gray-500 text-xs mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Button — initial state */}
      {!isStreaming && !response && !confirmed && (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-blue-600/20 border border-blue-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Cpu className="w-8 h-8 text-blue-400" />
          </div>
          <h3 className="text-white font-semibold text-lg mb-2">Ready to Analyze</h3>
          <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
            The agent will query MongoDB via Gemini tool calls, reason through assignments, and generate a prioritized mission plan in real-time.
          </p>
          <Button onClick={generatePlan} size="lg" variant="primary">
            <Play className="w-5 h-5" />
            Run AI Agent
          </Button>
          {error && (
            <p className="mt-4 text-red-400 text-sm bg-red-900/20 border border-red-700/30 rounded-lg px-4 py-2 inline-block">
              {error}
            </p>
          )}
        </div>
      )}

      {/* Live Step Log — shown during streaming and after */}
      {(isStreaming || (steps.length > 0 && !confirmed)) && (
        <div className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-blue-400" />
              <span className="text-white text-sm font-semibold">Agent Activity</span>
            </div>
            <div className="flex items-center gap-2">
              {isStreaming && (
                <>
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-green-400 text-xs font-medium">Live</span>
                </>
              )}
              {!isStreaming && steps.length > 0 && (
                <span className="text-gray-500 text-xs">Complete</span>
              )}
            </div>
          </div>
          <div
            ref={stepBoxRef}
            className="p-4 space-y-1.5 max-h-64 overflow-y-auto font-mono text-xs"
          >
            {steps.map((step, i) => (
              <div key={i} className={`flex items-start gap-2 ${stepRowStyle(step.type)}`}>
                <StepIcon icon={step.icon} type={step.type} />
                <div className="min-w-0">
                  <span className={`${step.type === 'tool_call' ? 'text-purple-300' : step.type === 'tool_result' ? 'text-emerald-300' : step.type === 'error' ? 'text-red-300' : 'text-gray-300'}`}>
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
              </p>
              <p className="text-green-400/70 text-sm mt-0.5">
                Volunteers marked busy · Resources allocated · Missions saved to MongoDB · Agent log recorded
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => {
                setResponse(null)
                setConfirmed(false)
                setResult(null)
                setSteps([])
              }}
            >
              <RefreshCw className="w-4 h-4" />
              New Plan
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
              {response.engine === 'gemini' && toolCallCount > 0 && (
                <div className="flex-shrink-0 text-right">
                  <p className="text-purple-400 text-xs font-semibold">{toolCallCount} tool calls</p>
                  <p className="text-gray-600 text-[10px]">via Gemini function calling</p>
                </div>
              )}
            </div>
          </div>

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
                  Suggested Mission Plans ({response.plans.length})
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
                      onClick={confirmPlans}
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
            </>
          )}
        </div>
      )}
    </div>
  )
}
