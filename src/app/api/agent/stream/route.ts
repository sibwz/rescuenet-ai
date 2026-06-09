import { connectDB } from '@/lib/mongodb'
import EmergencyRequest from '@/models/EmergencyRequest'
import Volunteer from '@/models/Volunteer'
import Resource from '@/models/Resource'
import AgentLog from '@/models/AgentLog'
import { generatePlanWithGeminiTools, isGeminiEnabled, type ToolCallRecord } from '@/lib/gemini'
import { retrieveKnowledge, type KnowledgeEntry } from '@/lib/knowledge'
import { deterministicPlanner, type LeanDoc } from '@/lib/planner'
import type { AgentPlan } from '@/types'

export const dynamic = 'force-dynamic'

export type StreamEventType =
  | 'step'
  | 'tool_call'
  | 'tool_result'
  | 'agent_handoff'
  | 'knowledge'
  | 'complete'
  | 'error'

export interface StreamEvent {
  type: StreamEventType
  step?: string
  message: string
  icon?: string
  data?: unknown
  timestamp: string
}

export interface AgentHandoffEvent extends StreamEvent {
  type: 'agent_handoff'
  agentId: string
  agentName: string
  agentRole: string
  workflowStep: number
}

export interface KnowledgeEvent extends StreamEvent {
  type: 'knowledge'
  entries: KnowledgeEntry[]
}

export interface StreamCompleteEvent extends StreamEvent {
  type: 'complete'
  plans: AgentPlan[]
  engine: 'gemini' | 'deterministic'
  summary: string
  geminiError: string | null
  toolCalls: ToolCallRecord[]
  modelUsed: string
  knowledge: KnowledgeEntry[]
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

      function emitAgent(
        agentId: string,
        agentName: string,
        agentRole: string,
        workflowStep: number,
        message: string
      ) {
        const event: Omit<AgentHandoffEvent, 'timestamp'> = {
          type: 'agent_handoff',
          agentId,
          agentName,
          agentRole,
          workflowStep,
          message,
          icon: 'agent',
          step: `agent_${agentId}`,
        }
        emit(event as Omit<StreamEvent, 'timestamp'>)
      }

      try {
        // ── STEP 0: Initialize ─────────────────────────────────────────────
        emit({
          type: 'step',
          step: 'init',
          message: 'RescueNet AI multi-agent system initializing…',
          icon: 'bot',
        })

        await connectDB()
        emit({
          type: 'step',
          step: 'db_connect',
          message: 'Connected to MongoDB Atlas',
          icon: 'database',
        })

        // ── STEP 1: Incident Assessment Agent ─────────────────────────────
        emitAgent(
          'incident_agent',
          'Incident Assessment Agent',
          'Reads all pending emergencies and assesses severity, type, and priority',
          1,
          'Step 1 → Incident Assessment Agent: Reading active emergencies from MongoDB…'
        )

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
        const criticalCount = requests.filter((r) => r.urgency === 'critical').length

        emit({
          type: 'step',
          step: 'db_query',
          message: `MongoDB query complete: ${pendingCount} pending emergencies (${criticalCount} critical) · ${availVols} available volunteers · ${availRes} available resources`,
          icon: 'chart',
          data: { pendingCount, criticalCount, availVols, availRes },
        })

        // ── STEP 2: Knowledge Retrieval ───────────────────────────────────
        emitAgent(
          'incident_agent',
          'Incident Assessment Agent',
          'Retrieves disaster-specific response protocols from knowledge base',
          2,
          'Step 2 → Retrieving disaster response protocols from knowledge base…'
        )

        const emergencyTypes = requests.map((r) => r.emergencyType as string)
        const knowledgeEntries = retrieveKnowledge(emergencyTypes)

        if (knowledgeEntries.length > 0) {
          const knowledgeEvent: Omit<KnowledgeEvent, 'timestamp'> = {
            type: 'knowledge',
            entries: knowledgeEntries,
            message: `Retrieved ${knowledgeEntries.length} knowledge base article(s): ${knowledgeEntries.map((e) => e.category).join(', ')}`,
            icon: 'book',
            step: 'knowledge',
          }
          emit(knowledgeEvent as Omit<StreamEvent, 'timestamp'>)
        }

        // ── Build Gemini input ────────────────────────────────────────────
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
        let modelUsed = 'deterministic'

        if (isGeminiEnabled()) {
          const model = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'

          // ── STEP 3: Volunteer Matching Agent ────────────────────────────
          emitAgent(
            'volunteer_agent',
            'Volunteer Matching Agent',
            'Queries MongoDB for available volunteers matching each emergency type',
            3,
            `Step 3 → Volunteer Matching Agent: Querying MongoDB for skill-matched volunteers via Gemini tool calls…`
          )

          emit({
            type: 'step',
            step: 'gemini_invoke',
            message: `Invoking Gemini (${model}) with ${knowledgeEntries.length} knowledge articles injected — agentic tool-calling loop starting`,
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

              // Emit resource agent handoff when resource tools are called
              if (name === 'find_available_resources') {
                emitAgent(
                  'resource_agent',
                  'Resource Allocation Agent',
                  'Identifies and reserves optimal resources for each emergency',
                  5,
                  `Step 5 → Resource Allocation Agent: Matching resources to emergency requirements…`
                )
              } else if (name === 'find_available_volunteers') {
                emitAgent(
                  'volunteer_agent',
                  'Volunteer Matching Agent',
                  'Scoring volunteers by skill match and proximity',
                  4,
                  `Step 4 → Volunteer Matching Agent: Scoring volunteer-emergency compatibility…`
                )
              }
            },
            knowledgeEntries
          )

          toolCalls = toolResult.toolCalls
          modelUsed = toolResult.modelUsed

          if (toolResult.result) {
            engine = 'gemini'

            // ── STEP 6: Mission Planning Agent ──────────────────────────
            emitAgent(
              'mission_planner',
              'Mission Planning Agent',
              'Synthesizes all data to generate prioritized, knowledge-grounded mission plans',
              6,
              `Step 6 → Mission Planning Agent: Synthesizing ${toolCalls.length} tool call results into mission plans…`
            )

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
              message: `Gemini reasoning complete — model: ${modelUsed}, ${toolCalls.length} MongoDB tool calls, ${toolResult.turnCount} conversation turns, ${knowledgeEntries.length} knowledge articles applied`,
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

        // ── STEP 7: Coordinator Approval Agent ────────────────────────────
        emitAgent(
          'coordinator_agent',
          'Coordinator Approval Agent',
          'Prepares mission plans for human coordinator review and approval',
          7,
          `Step 7 → Coordinator Approval Agent: ${plans.length} mission plans prepared. Awaiting human coordinator approval…`
        )

        emit({
          type: 'step',
          step: 'plan_ready',
          message: `Generated ${plans.length} mission plan${plans.length !== 1 ? 's' : ''}. Awaiting coordinator approval.`,
          icon: 'check',
        })

        await AgentLog.create({
          action: 'GENERATE_PLAN',
          details: `Multi-agent system generated ${plans.length} plans. Engine: ${engine}${modelUsed !== 'deterministic' ? ` (${modelUsed})` : ''}${toolCalls.length ? ` | ${toolCalls.length} Gemini tool calls` : ''}${knowledgeEntries.length ? ` | ${knowledgeEntries.length} knowledge articles applied` : ''}${geminiError ? ` | Fallback: ${geminiError}` : ''}`,
          relatedIds: plans.map((p) => p.requestId),
        })

        const completeEvent: Omit<StreamCompleteEvent, 'timestamp'> = {
          type: 'complete',
          step: 'complete',
          message: 'Multi-agent run complete',
          plans,
          engine,
          geminiError,
          toolCalls,
          modelUsed,
          knowledge: knowledgeEntries,
          summary:
            engine === 'gemini'
              ? `Multi-agent system analyzed ${pendingCount} pending emergencies using ${modelUsed} with ${toolCalls.length} MongoDB tool calls and ${knowledgeEntries.length} knowledge base articles. Generated ${plans.length} prioritized mission plans.`
              : `Analyzed ${pendingCount} pending emergencies with ${knowledgeEntries.length} knowledge articles. Generated ${plans.length} prioritized mission plans using the deterministic planner.`,
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
