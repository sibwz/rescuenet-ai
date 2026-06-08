import { connectDB } from '@/lib/mongodb'
import EmergencyRequest from '@/models/EmergencyRequest'
import Volunteer from '@/models/Volunteer'
import Resource from '@/models/Resource'
import AgentLog from '@/models/AgentLog'
import { generatePlanWithGeminiTools, isGeminiEnabled, type ToolCallRecord } from '@/lib/gemini'
import { deterministicPlanner, type LeanDoc } from '@/lib/planner'
import type { AgentPlan } from '@/types'

export const dynamic = 'force-dynamic'

export type StreamEventType = 'step' | 'tool_call' | 'tool_result' | 'complete' | 'error'

export interface StreamEvent {
  type: StreamEventType
  step?: string
  message: string
  icon?: string
  data?: unknown
  timestamp: string
}

export interface StreamCompleteEvent extends StreamEvent {
  type: 'complete'
  plans: AgentPlan[]
  engine: 'gemini' | 'deterministic'
  summary: string
  geminiError: string | null
  toolCalls: ToolCallRecord[]
}

function formatToolArgs(args: Record<string, unknown>): string {
  const parts = Object.entries(args).map(([k, v]) => `${k}="${v}"`)
  return parts.length ? parts.join(', ') : ''
}

export async function GET() {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function emit(event: Omit<StreamEvent, 'timestamp'>) {
        const full: StreamEvent = { ...event, timestamp: new Date().toISOString() }
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(full)}\n\n`))
        } catch {
          // controller already closed
        }
      }

      try {
        emit({ type: 'step', step: 'init', message: 'RescueNet AI Agent initializing…', icon: 'bot' })

        await connectDB()
        emit({ type: 'step', step: 'db_connect', message: 'Connected to MongoDB Atlas', icon: 'database' })

        const [rawRequests, rawVolunteers, rawResources] = await Promise.all([
          EmergencyRequest.find({ status: 'pending' }).lean(),
          Volunteer.find().lean(),
          Resource.find().lean(),
        ])

        const requests = rawRequests as LeanDoc[]
        const volunteers = rawVolunteers as LeanDoc[]
        const resources = rawResources as LeanDoc[]

        const pendingCount = requests.length
        const availVols = volunteers.filter((v) => v.status === 'available').length
        const availRes = resources.filter((r) => r.status === 'available').length

        emit({
          type: 'step',
          step: 'db_query',
          message: `MongoDB query complete: ${pendingCount} pending emergencies · ${availVols} available volunteers · ${availRes} available resources`,
          icon: 'chart',
          data: { pendingCount, availVols, availRes },
        })

        const geminiInput = {
          emergencyRequests: requests.map((r) => ({
            id: r._id.toString(),
            location: r.location as string,
            emergencyType: r.emergencyType as string,
            urgency: r.urgency as string,
            peopleAffected: r.peopleAffected as number,
            description: r.description as string,
            status: r.status as string,
          })),
          volunteers: volunteers.map((v) => ({
            id: v._id.toString(),
            name: v.name as string,
            location: v.location as string,
            skills: v.skills as string[],
            hasVehicle: v.hasVehicle as boolean,
            status: v.status as string,
          })),
          resources: resources.map((r) => ({
            id: r._id.toString(),
            resourceType: r.resourceType as string,
            quantity: r.quantity as number,
            location: r.location as string,
            status: r.status as string,
          })),
        }

        let plans: AgentPlan[]
        let engine: 'gemini' | 'deterministic'
        let geminiError: string | null = null
        let toolCalls: ToolCallRecord[] = []

        if (isGeminiEnabled()) {
          const model = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'
          emit({
            type: 'step',
            step: 'gemini_invoke',
            message: `Invoking Gemini (${model}) with MongoDB tool access — agentic reasoning loop started`,
            icon: 'brain',
          })

          const toolResult = await generatePlanWithGeminiTools(
            geminiInput,
            (name, args, resultSummary) => {
              const argStr = formatToolArgs(args as Record<string, unknown>)
              emit({
                type: 'tool_call',
                step: 'tool_call',
                message: `Tool call → ${name}(${argStr})`,
                icon: 'tool',
                data: { name, args },
              })
              emit({
                type: 'tool_result',
                step: 'tool_result',
                message: resultSummary,
                icon: 'check',
                data: { name, resultSummary },
              })
            }
          )

          toolCalls = toolResult.toolCalls

          if (toolResult.result) {
            engine = 'gemini'
            plans = toolResult.result.plans.map((p) => {
              const req = requests.find((r) => r._id.toString() === p.requestId)
              const vol = p.volunteerId
                ? volunteers.find((v) => v._id.toString() === p.volunteerId)
                : null
              const res = p.resourceId
                ? resources.find((r) => r._id.toString() === p.resourceId)
                : null
              return {
                requestId: p.requestId,
                request: req as unknown as AgentPlan['request'],
                suggestedVolunteer: (vol ?? null) as unknown as AgentPlan['suggestedVolunteer'],
                suggestedResource: (res ?? null) as unknown as AgentPlan['suggestedResource'],
                reasoning: p.reasoning,
                reasoningDetails: p.reasoningDetails,
                priorityScore: p.priorityScore,
              }
            })

            emit({
              type: 'step',
              step: 'gemini_done',
              message: `Gemini reasoning complete — ${toolCalls.length} MongoDB tool calls in ${toolResult.turnCount} conversation turns`,
              icon: 'sparkle',
            })
          } else {
            geminiError = toolResult.geminiError ?? 'Unknown Gemini error'
            emit({
              type: 'step',
              step: 'gemini_fallback',
              message: `Gemini unavailable (${geminiError}) — switching to deterministic rule-based planner`,
              icon: 'warning',
            })
            engine = 'deterministic'
            plans = deterministicPlanner(requests, volunteers, resources)
          }
        } else {
          emit({
            type: 'step',
            step: 'deterministic',
            message: 'Gemini not configured — running deterministic skill/location matching planner',
            icon: 'gear',
          })
          engine = 'deterministic'
          plans = deterministicPlanner(requests, volunteers, resources)
        }

        emit({
          type: 'step',
          step: 'plan_ready',
          message: `Generated ${plans.length} mission plan${plans.length !== 1 ? 's' : ''}. Awaiting coordinator approval.`,
          icon: 'check',
        })

        await AgentLog.create({
          action: 'GENERATE_PLAN',
          details: `Streaming agent generated ${plans.length} plans. Engine: ${engine}${toolCalls.length ? ` | ${toolCalls.length} Gemini tool calls` : ''}${geminiError ? ` | Fallback: ${geminiError}` : ''}`,
          relatedIds: plans.map((p) => p.requestId),
        })

        const completeEvent: Omit<StreamCompleteEvent, 'timestamp'> = {
          type: 'complete',
          step: 'complete',
          message: 'Agent run complete',
          plans,
          engine,
          geminiError,
          toolCalls,
          summary:
            engine === 'gemini'
              ? `Analyzed ${pendingCount} pending emergencies using Gemini AI with ${toolCalls.length} MongoDB tool calls. Generated ${plans.length} prioritized mission plans.`
              : `Analyzed ${pendingCount} pending emergencies, ${availVols} available volunteers, and ${availRes} available resources. Generated ${plans.length} prioritized mission plans using the deterministic planner.`,
        }

        emit(completeEvent)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        emit({ type: 'error', message: msg, icon: 'alert' })
      } finally {
        try {
          controller.close()
        } catch {
          // already closed
        }
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
