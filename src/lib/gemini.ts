import { GoogleGenAI, Type, createPartFromFunctionResponse } from '@google/genai'
import type { FunctionDeclaration } from '@google/genai'

export interface GeminiPlanInput {
  emergencyRequests: Array<{
    id: string
    location: string
    emergencyType: string
    urgency: string
    peopleAffected: number
    description: string
    status: string
  }>
  volunteers: Array<{
    id: string
    name: string
    location: string
    skills: string[]
    hasVehicle: boolean
    status: string
  }>
  resources: Array<{
    id: string
    resourceType: string
    quantity: number
    location: string
    status: string
  }>
}

export interface GeminiPlanOutput {
  plans: Array<{
    requestId: string
    volunteerId: string | null
    resourceId: string | null
    reasoning: string
    priorityScore: number
    reasoningDetails?: {
      priorityReason: string
      volunteerMatchReason: string
      resourceAllocationReason: string
      riskLevel: string
      nextAction: string
    }
  }>
  overallSummary: string
}

export interface GeminiPlanResult {
  result: GeminiPlanOutput | null
  geminiError?: string
}

export interface ToolCallRecord {
  name: string
  args: Record<string, unknown>
  resultSummary: string
  timestamp: string
}

export interface GeminiToolPlanResult {
  result: GeminiPlanOutput | null
  geminiError?: string
  toolCalls: ToolCallRecord[]
  turnCount: number
}

type OnToolCall = (name: string, args: Record<string, unknown>, resultSummary: string) => void

function isGeminiEnabled(): boolean {
  const project = process.env.GOOGLE_CLOUD_PROJECT_ID
  return !!(project && project !== 'your_google_cloud_project_id_here')
}

export { isGeminiEnabled }

function createAI(): GoogleGenAI {
  return new GoogleGenAI({
    vertexai: true,
    project: process.env.GOOGLE_CLOUD_PROJECT_ID!,
    location: process.env.GOOGLE_CLOUD_LOCATION ?? 'us-central1',
  })
}

// ─── Single-prompt planner (kept for backward compat / non-streaming route) ───

export async function generatePlanWithGemini(input: GeminiPlanInput): Promise<GeminiPlanResult> {
  if (!isGeminiEnabled()) {
    console.log('Vertex AI not configured — using deterministic fallback')
    return { result: null }
  }

  const model = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'
  console.log(`Using Vertex AI Gemini planner (model: ${model})`)

  try {
    const ai = createAI()
    const response = await ai.models.generateContent({
      model,
      contents: buildGeminiPrompt(input),
    })
    const text = response.text ?? ''

    const jsonMatch = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/)
    const jsonStr = jsonMatch ? jsonMatch[1] : text
    const parsed = JSON.parse(jsonStr.trim()) as GeminiPlanOutput

    console.log('Vertex AI Gemini success')
    return { result: parsed }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`Vertex AI Gemini failed, fallback active: ${msg}`)
    return { result: null, geminiError: msg }
  }
}

export function buildGeminiPrompt(input: GeminiPlanInput): string {
  return `You are an AI disaster response coordinator for RescueNet AI.

Analyze the following emergency situation and create an optimized response plan.

EMERGENCY REQUESTS:
${JSON.stringify(input.emergencyRequests, null, 2)}

AVAILABLE VOLUNTEERS:
${JSON.stringify(input.volunteers, null, 2)}

AVAILABLE RESOURCES:
${JSON.stringify(input.resources, null, 2)}

Create a prioritized response plan. Rules:
1. Critical urgency requests get highest priority (score 100)
2. High urgency = score 75, Medium = 50, Low = 25
3. Match volunteers by skill relevance to emergency type
4. Match resources by type relevance to emergency type
5. Prefer volunteers/resources in the same location
6. Only assign available volunteers and resources
7. Each volunteer and resource may only be assigned once

Respond with valid JSON only (no markdown fences):
{
  "plans": [
    {
      "requestId": "string",
      "volunteerId": "string or null",
      "resourceId": "string or null",
      "reasoning": "brief 1-2 sentence overall reasoning",
      "priorityScore": number,
      "reasoningDetails": {
        "priorityReason": "why this request is prioritized at this level above others",
        "volunteerMatchReason": "why this specific volunteer was selected, or why none available",
        "resourceAllocationReason": "why this specific resource was chosen, or why none available",
        "riskLevel": "low|medium|high|critical",
        "nextAction": "immediate concrete next step for the field team"
      }
    }
  ],
  "overallSummary": "2-3 sentence summary of the situation and response strategy"
}`
}

// ─── Gemini Function Calling (Tool Use) — Agent Builder pattern ───────────────

const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'query_pending_emergencies',
    description:
      'Query MongoDB emergency_requests collection for all pending emergencies. Returns id, location, emergency type, urgency, people affected, and description.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
      required: [],
    },
  },
  {
    name: 'find_available_volunteers',
    description:
      'Query MongoDB volunteers collection for available (not busy) volunteers. Optionally filter by skill type or location.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        skill: {
          type: Type.STRING,
          description:
            'Filter by skill type: medical, rescue, logistics, transport, food_distribution',
        },
        location: {
          type: Type.STRING,
          description: 'Filter by location (partial string match)',
        },
      },
    },
  },
  {
    name: 'find_available_resources',
    description:
      'Query MongoDB resources collection for available (not allocated) resources. Optionally filter by resource type or location.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        resourceType: {
          type: Type.STRING,
          description: 'Filter by type: food, water, medicine, shelter_kits, vehicles',
        },
        location: {
          type: Type.STRING,
          description: 'Filter by location (partial string match)',
        },
      },
    },
  },
]

const TOOL_CALLING_SYSTEM_PROMPT = `You are an AI disaster response coordinator for RescueNet AI. Your job is to create an optimized emergency response plan by querying MongoDB and matching the best resources to each emergency.

WORKFLOW — follow these steps in order:
1. Call query_pending_emergencies() to get all active emergencies
2. For each emergency, call find_available_volunteers() filtered by the matching skill type
3. For each emergency, call find_available_resources() filtered by the matching resource type
4. After gathering data, generate the final plan as JSON

SKILL MATCHING:
- medical → skill: "medical", resource: "medicine"
- food/water → skill: "food_distribution" or "logistics"
- shelter → skill: "rescue" or "logistics", resource: "shelter_kits"
- evacuation → skill: "transport" or "rescue", resource: "vehicles"

PRIORITY SCORES: critical=100, high=75, medium=50, low=25

RULES: Only assign AVAILABLE volunteers/resources. Each can only be assigned ONCE across all plans.

When you have enough data, respond with ONLY valid JSON (no markdown):
{
  "plans": [
    {
      "requestId": "string",
      "volunteerId": "string or null",
      "resourceId": "string or null",
      "reasoning": "1-2 sentence summary",
      "priorityScore": number,
      "reasoningDetails": {
        "priorityReason": "why this priority level",
        "volunteerMatchReason": "why this volunteer was chosen",
        "resourceAllocationReason": "why this resource was chosen",
        "riskLevel": "low|medium|high|critical",
        "nextAction": "immediate concrete next step"
      }
    }
  ],
  "overallSummary": "2-3 sentence situation overview and strategy"
}`

function summarizeToolResult(name: string, result: unknown): string {
  const r = result as Record<string, unknown>
  if (name === 'query_pending_emergencies') {
    const emergencies = (r.emergencies as unknown[]) ?? []
    return `${emergencies.length} pending emergencies found`
  }
  if (name === 'find_available_volunteers') {
    const vols = (r.volunteers as unknown[]) ?? []
    return `${vols.length} matching volunteers found`
  }
  if (name === 'find_available_resources') {
    const res = (r.resources as unknown[]) ?? []
    return `${res.length} matching resources found`
  }
  return 'Done'
}

export async function generatePlanWithGeminiTools(
  input: GeminiPlanInput,
  onToolCall?: OnToolCall
): Promise<GeminiToolPlanResult> {
  if (!isGeminiEnabled()) {
    return { result: null, toolCalls: [], turnCount: 0 }
  }

  const model = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'
  const toolCalls: ToolCallRecord[] = []

  try {
    const ai = createAI()

    const executeTool = (name: string, args: Record<string, unknown>): object => {
      let result: object

      switch (name) {
        case 'query_pending_emergencies':
          result = {
            emergencies: input.emergencyRequests,
            count: input.emergencyRequests.length,
          }
          break

        case 'find_available_volunteers': {
          let vols = input.volunteers.filter((v) => v.status === 'available')
          if (args.skill) vols = vols.filter((v) => v.skills.includes(args.skill as string))
          if (args.location) {
            const loc = (args.location as string).toLowerCase()
            vols = vols.filter((v) => v.location.toLowerCase().includes(loc))
          }
          result = { volunteers: vols, count: vols.length }
          break
        }

        case 'find_available_resources': {
          let res = input.resources.filter((r) => r.status === 'available')
          if (args.resourceType) res = res.filter((r) => r.resourceType === args.resourceType)
          if (args.location) {
            const loc = (args.location as string).toLowerCase()
            res = res.filter((r) => r.location.toLowerCase().includes(loc))
          }
          result = { resources: res, count: res.length }
          break
        }

        default:
          result = { error: `Unknown tool: ${name}` }
      }

      const summary = summarizeToolResult(name, result)
      toolCalls.push({ name, args, resultSummary: summary, timestamp: new Date().toISOString() })
      onToolCall?.(name, args, summary)
      return result
    }

    const chat = ai.chats.create({
      model,
      config: {
        systemInstruction: TOOL_CALLING_SYSTEM_PROMPT,
        tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
      },
    })

    let response = await chat.sendMessage({ message: 'Begin the emergency response planning.' })
    let turnCount = 1
    let maxTurns = 20

    while (maxTurns-- > 0) {
      const fns = response.functionCalls
      if (!fns || fns.length === 0) break

      const responseParts = fns.map((fn) =>
        createPartFromFunctionResponse(
          fn.id ?? '',
          fn.name ?? '',
          { result: executeTool(fn.name ?? '', (fn.args ?? {}) as Record<string, unknown>) }
        )
      )

      response = await chat.sendMessage({ message: responseParts })
      turnCount++
    }

    const text = response.text ?? ''
    if (!text.trim()) {
      return {
        result: null,
        geminiError: 'Vertex AI Gemini returned empty response after tool calls',
        toolCalls,
        turnCount,
      }
    }

    const jsonMatch = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/)
    const jsonStr = jsonMatch ? jsonMatch[1] : text
    const parsed = JSON.parse(jsonStr.trim()) as GeminiPlanOutput

    console.log(
      `Vertex AI Gemini tool calling success — ${toolCalls.length} tool calls, ${turnCount} turns`
    )
    return { result: parsed, toolCalls, turnCount }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`Vertex AI Gemini tool calling failed: ${msg}`)
    return { result: null, geminiError: msg, toolCalls, turnCount: 0 }
  }
}

// ─── Natural Language → MongoDB Query ────────────────────────────────────────

export interface NLQueryResult {
  answer: string
  collection: string | null
  mongoFilter: Record<string, unknown> | null
  error?: string
}

export async function answerNaturalLanguageQuery(
  question: string,
  context: {
    emergencyCount: number
    volunteerCount: number
    resourceCount: number
    missionCount: number
  }
): Promise<NLQueryResult> {
  if (!isGeminiEnabled()) {
    return {
      answer:
        'Vertex AI is not configured. Set GOOGLE_CLOUD_PROJECT_ID and run gcloud auth application-default login to enable natural language queries.',
      collection: null,
      mongoFilter: null,
      error: 'Vertex AI not configured',
    }
  }

  const model = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'

  try {
    const ai = createAI()

    const prompt = `You are a MongoDB query assistant for RescueNet AI, a disaster response coordination system.

Database context:
- emergency_requests: ${context.emergencyCount} documents. Fields: location, emergencyType (medical/food/water/shelter/evacuation), urgency (low/medium/high/critical), peopleAffected, status (pending/assigned/completed), reporterName, description
- volunteers: ${context.volunteerCount} documents. Fields: name, location, skills (medical/rescue/logistics/transport/food_distribution), hasVehicle, status (available/busy/offline)
- resources: ${context.resourceCount} documents. Fields: resourceType (food/water/medicine/shelter_kits/vehicles), quantity, location, status (available/assigned/depleted)
- missions: ${context.missionCount} documents. Fields: status (active/completed/cancelled), reasoning, coordinatorConfirmed

User question: "${question}"

Respond with valid JSON only:
{
  "collection": "emergency_requests|volunteers|resources|missions|null",
  "mongoFilter": { ...MongoDB filter object or null if not applicable },
  "naturalAnswer": "A clear, concise answer to the question in 1-2 sentences"
}`

    const response = await ai.models.generateContent({ model, contents: prompt })
    const text = response.text ?? ''

    const jsonMatch = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/)
    const jsonStr = jsonMatch ? jsonMatch[1] : text
    const parsed = JSON.parse(jsonStr.trim()) as {
      collection: string | null
      mongoFilter: Record<string, unknown> | null
      naturalAnswer: string
    }

    return {
      answer: parsed.naturalAnswer,
      collection: parsed.collection,
      mongoFilter: parsed.mongoFilter,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      answer: 'Failed to process query.',
      collection: null,
      mongoFilter: null,
      error: msg,
    }
  }
}
