import { GoogleGenAI, Type, createPartFromFunctionResponse } from '@google/genai'
import type { FunctionDeclaration } from '@google/genai'
import { formatKnowledgeForPrompt, type KnowledgeEntry } from './knowledge'

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
  modelUsed: string
}

type OnToolCall = (name: string, args: Record<string, unknown>, resultSummary: string) => void

// ─── Configuration helpers ────────────────────────────────────────────────────

export function isGeminiEnabled(): boolean {
  const project = process.env.GOOGLE_CLOUD_PROJECT_ID
  return !!(project && project !== 'your_google_cloud_project_id_here')
}

export { isGeminiEnabled as isGeminiConfigured }

function getLocation(): string {
  const loc = process.env.GOOGLE_CLOUD_LOCATION ?? 'us-central1'
  // 'global' is not a valid Vertex AI regional endpoint for Gemini models
  if (loc === 'global') {
    console.warn('[Gemini] GOOGLE_CLOUD_LOCATION=global is invalid for Gemini — defaulting to us-central1')
    return 'us-central1'
  }
  return loc
}

// Model fallback chain — tries in order until one succeeds
const MODEL_FALLBACK_CHAIN = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-1.5-flash',
]

function getModelChain(): string[] {
  const preferred = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'
  return [preferred, ...MODEL_FALLBACK_CHAIN.filter((m) => m !== preferred)]
}

function createAI(): GoogleGenAI {
  return new GoogleGenAI({
    vertexai: true,
    project: process.env.GOOGLE_CLOUD_PROJECT_ID!,
    location: getLocation(),
  })
}

// ─── Gemini Status Check ──────────────────────────────────────────────────────

export interface GeminiStatus {
  available: boolean
  model: string | null
  project: string | null
  location: string
  error: string | null
}

export async function checkGeminiStatus(): Promise<GeminiStatus> {
  if (!isGeminiEnabled()) {
    return {
      available: false,
      model: null,
      project: null,
      location: getLocation(),
      error: 'GOOGLE_CLOUD_PROJECT_ID not configured',
    }
  }

  const ai = createAI()
  const project = process.env.GOOGLE_CLOUD_PROJECT_ID!
  const location = getLocation()

  for (const model of getModelChain()) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: 'Respond with exactly: ONLINE',
      })
      const text = response.text?.trim() ?? ''
      if (text) {
        console.log(`[Gemini] Status check OK — model: ${model}`)
        return { available: true, model, project, location, error: null }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[Gemini] Model ${model} unavailable: ${msg}`)
    }
  }

  return {
    available: false,
    model: null,
    project,
    location,
    error: 'All models in fallback chain failed. Check ADC credentials and project billing.',
  }
}

// ─── Single-prompt planner (backward compat / non-streaming route) ───────────

export async function generatePlanWithGemini(input: GeminiPlanInput): Promise<GeminiPlanResult> {
  if (!isGeminiEnabled()) {
    console.log('[Gemini] Not configured — using deterministic fallback')
    return { result: null }
  }

  const ai = createAI()

  for (const model of getModelChain()) {
    try {
      console.log(`[Gemini] Single-prompt planner attempting model: ${model}`)
      const response = await ai.models.generateContent({
        model,
        contents: buildGeminiPrompt(input),
      })
      const text = response.text ?? ''

      const jsonMatch = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/)
      const jsonStr = jsonMatch ? jsonMatch[1] : text
      const parsed = JSON.parse(jsonStr.trim()) as GeminiPlanOutput

      console.log(`[Gemini] Single-prompt success (model: ${model})`)
      return { result: parsed }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[Gemini] Model ${model} failed: ${msg}`)
    }
  }

  const finalErr = 'All Gemini models failed — check Vertex AI credentials and project configuration'
  console.error(`[Gemini] ${finalErr}`)
  return { result: null, geminiError: finalErr }
}

export function buildGeminiPrompt(input: GeminiPlanInput, knowledgeEntries?: KnowledgeEntry[]): string {
  const knowledgeSection = knowledgeEntries ? formatKnowledgeForPrompt(knowledgeEntries) : ''

  return `You are an AI disaster response coordinator for RescueNet AI.${knowledgeSection}

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
8. Cite the knowledge base source in your reasoning where applicable

Respond with valid JSON only (no markdown fences):
{
  "plans": [
    {
      "requestId": "string",
      "volunteerId": "string or null",
      "resourceId": "string or null",
      "reasoning": "brief 1-2 sentence overall reasoning citing knowledge source",
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

function buildToolCallingSystemPrompt(knowledgeEntries?: KnowledgeEntry[]): string {
  const knowledgeSection = knowledgeEntries ? formatKnowledgeForPrompt(knowledgeEntries) : ''

  return `You are an AI disaster response coordinator for RescueNet AI. Your job is to create an optimized emergency response plan by querying MongoDB and matching the best resources to each emergency.${knowledgeSection}

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

RULES:
- Only assign AVAILABLE volunteers/resources
- Each can only be assigned ONCE across all plans
- Cite the retrieved knowledge base source in your reasoning
- Apply the immediate actions from the knowledge base to the nextAction field

When you have enough data, respond with ONLY valid JSON (no markdown):
{
  "plans": [
    {
      "requestId": "string",
      "volunteerId": "string or null",
      "resourceId": "string or null",
      "reasoning": "1-2 sentence summary citing knowledge source",
      "priorityScore": number,
      "reasoningDetails": {
        "priorityReason": "why this priority level",
        "volunteerMatchReason": "why this volunteer was chosen",
        "resourceAllocationReason": "why this resource was chosen",
        "riskLevel": "low|medium|high|critical",
        "nextAction": "immediate concrete next step from knowledge base"
      }
    }
  ],
  "overallSummary": "2-3 sentence situation overview and strategy"
}`
}

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
  onToolCall?: OnToolCall,
  knowledgeEntries?: KnowledgeEntry[]
): Promise<GeminiToolPlanResult> {
  if (!isGeminiEnabled()) {
    return { result: null, toolCalls: [], turnCount: 0, modelUsed: 'none' }
  }

  const toolCalls: ToolCallRecord[] = []
  const ai = createAI()
  const systemInstruction = buildToolCallingSystemPrompt(knowledgeEntries)

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

  for (const model of getModelChain()) {
    try {
      console.log(`[Gemini] Tool-calling planner attempting model: ${model}`)

      const chat = ai.chats.create({
        model,
        config: {
          systemInstruction,
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
          createPartFromFunctionResponse(fn.id ?? '', fn.name ?? '', {
            result: executeTool(fn.name ?? '', (fn.args ?? {}) as Record<string, unknown>),
          })
        )

        response = await chat.sendMessage({ message: responseParts })
        turnCount++
      }

      const text = response.text ?? ''
      if (!text.trim()) {
        console.warn(`[Gemini] Model ${model} returned empty response — trying next`)
        continue
      }

      const jsonMatch = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/)
      const jsonStr = jsonMatch ? jsonMatch[1] : text
      const parsed = JSON.parse(jsonStr.trim()) as GeminiPlanOutput

      console.log(
        `[Gemini] Tool-calling success — model: ${model}, ${toolCalls.length} tool calls, ${turnCount} turns`
      )
      return { result: parsed, toolCalls, turnCount, modelUsed: model }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[Gemini] Model ${model} tool-calling failed: ${msg}`)
    }
  }

  const finalErr = 'All Gemini models in fallback chain failed — check Vertex AI credentials and project quota'
  console.error(`[Gemini] ${finalErr}`)
  return { result: null, geminiError: finalErr, toolCalls, turnCount: 0, modelUsed: 'none' }
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

  for (const model of getModelChain()) {
    try {
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
    } catch {
      continue
    }
  }

  return {
    answer: 'Failed to process query — Gemini unavailable.',
    collection: null,
    mongoFilter: null,
    error: 'All models failed',
  }
}

// ─── AI Urgency Classification ────────────────────────────────────────────────

export async function classifyEmergencyUrgency(
  description: string,
  emergencyType: string,
  peopleAffected: number
): Promise<{ urgency: 'low' | 'medium' | 'high' | 'critical'; urgencyReason: string }> {
  // Deterministic fallback used when Gemini is unavailable
  function ruleBasedClassify() {
    if (
      description.toLowerCase().includes('collapse') ||
      description.toLowerCase().includes('trapped') ||
      description.toLowerCase().includes('critical') ||
      peopleAffected >= 50
    ) return 'critical'
    if (peopleAffected >= 20 || description.toLowerCase().includes('urgent')) return 'high'
    if (peopleAffected >= 5) return 'medium'
    return 'low'
  }

  if (!isGeminiEnabled()) {
    const urgency = ruleBasedClassify() as 'low' | 'medium' | 'high' | 'critical'
    return { urgency, urgencyReason: 'Rule-based classification (Gemini not configured).' }
  }

  const ai = createAI()
  const prompt = `You are an emergency triage AI for RescueNet disaster response.

Classify the urgency of this emergency report:
- Emergency Type: ${emergencyType}
- Description: "${description}"
- People Affected: ${peopleAffected}

Urgency scale:
- critical: Immediate life-threatening danger (structural collapse, trapped victims, severe injuries, >50 affected)
- high: Significant health/safety risk, time-sensitive, 20-50 people affected
- medium: Needs prompt attention but not immediately life-threatening, 5-20 affected
- low: Manageable situation, few people, can be scheduled

Respond with ONLY valid JSON:
{"urgency":"critical|high|medium|low","urgencyReason":"One sentence explaining this classification."}`

  for (const model of getModelChain()) {
    try {
      const response = await ai.models.generateContent({ model, contents: prompt })
      const text = response.text ?? ''
      const jsonMatch = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/)
      const jsonStr = jsonMatch ? jsonMatch[1] : text
      const parsed = JSON.parse(jsonStr.trim()) as {
        urgency: 'low' | 'medium' | 'high' | 'critical'
        urgencyReason: string
      }
      if (['low', 'medium', 'high', 'critical'].includes(parsed.urgency)) {
        return parsed
      }
    } catch {
      continue
    }
  }

  const urgency = ruleBasedClassify() as 'low' | 'medium' | 'high' | 'critical'
  return { urgency, urgencyReason: 'Classified by rule-based fallback after AI timeout.' }
}

// ─── Coordinator AI Chat ──────────────────────────────────────────────────────

export interface CoordinatorChatResult {
  answer: string
  reasoning: string
  toolCallsUsed: string[]
  dataQueried: string[]
  error?: string
}

export async function coordinatorChat(
  question: string,
  dbContext: {
    emergencies: unknown[]
    volunteers: unknown[]
    resources: unknown[]
    missions: unknown[]
  }
): Promise<CoordinatorChatResult> {
  const toolCallsUsed: string[] = []
  const dataQueried: string[] = []

  // Determine which collections are relevant to the question
  const q = question.toLowerCase()
  if (q.includes('emergenc') || q.includes('critical') || q.includes('request') || q.includes('urgent') || q.includes('first') || q.includes('priorit')) {
    dataQueried.push('emergency_requests')
    toolCallsUsed.push('query_emergency_requests')
  }
  if (q.includes('volunteer') || q.includes('available') || q.includes('assign') || q.includes('staff')) {
    dataQueried.push('volunteers')
    toolCallsUsed.push('query_volunteers')
  }
  if (q.includes('resource') || q.includes('supply') || q.includes('food') || q.includes('water') || q.includes('medicine') || q.includes('low') || q.includes('stock')) {
    dataQueried.push('resources')
    toolCallsUsed.push('query_resources')
  }
  if (q.includes('mission') || q.includes('active') || q.includes('complet') || q.includes('status')) {
    dataQueried.push('missions')
    toolCallsUsed.push('query_missions')
  }
  // If no specific match, query all
  if (dataQueried.length === 0) {
    dataQueried.push('emergency_requests', 'volunteers', 'resources', 'missions')
    toolCallsUsed.push('query_all_collections')
  }

  if (!isGeminiEnabled()) {
    return {
      answer: 'Gemini AI is not configured. Please set up Vertex AI credentials to enable the AI coordinator.',
      reasoning: 'Gemini not configured',
      toolCallsUsed,
      dataQueried,
      error: 'Gemini not configured',
    }
  }

  const prompt = `You are the AI Coordinator for RescueNet disaster response system. Answer the coordinator's question using the live database data below.

QUESTION: "${question}"

LIVE DATABASE STATE:
Emergency Requests (${dbContext.emergencies.length} total):
${JSON.stringify(dbContext.emergencies.slice(0, 20), null, 2)}

Volunteers (${dbContext.volunteers.length} total):
${JSON.stringify(dbContext.volunteers.slice(0, 15), null, 2)}

Resources (${dbContext.resources.length} total):
${JSON.stringify(dbContext.resources.slice(0, 15), null, 2)}

Active Missions (${dbContext.missions.length} total):
${JSON.stringify(dbContext.missions.slice(0, 10), null, 2)}

Provide a direct, grounded answer based on the actual data. Be specific with numbers and names.
Respond with ONLY valid JSON:
{
  "answer": "Clear direct answer to the question with specific data points",
  "reasoning": "Brief explanation of how you arrived at this answer and what data you analyzed"
}`

  const ai = createAI()
  for (const model of getModelChain()) {
    try {
      const response = await ai.models.generateContent({ model, contents: prompt })
      const text = response.text ?? ''
      const jsonMatch = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/)
      const jsonStr = jsonMatch ? jsonMatch[1] : text
      const parsed = JSON.parse(jsonStr.trim()) as { answer: string; reasoning: string }
      return { answer: parsed.answer, reasoning: parsed.reasoning, toolCallsUsed, dataQueried }
    } catch {
      continue
    }
  }

  return {
    answer: 'Unable to process query at this time. Please try again.',
    reasoning: 'All Gemini models failed',
    toolCallsUsed,
    dataQueried,
    error: 'All models failed',
  }
}
