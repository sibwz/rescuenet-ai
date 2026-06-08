import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import EmergencyRequest from '@/models/EmergencyRequest'
import Volunteer from '@/models/Volunteer'
import Resource from '@/models/Resource'
import Mission from '@/models/Mission'
import AgentLog from '@/models/AgentLog'
import { answerNaturalLanguageQuery } from '@/lib/gemini'

const COLLECTIONS: Record<string, { model: typeof EmergencyRequest; label: string }> = {
  emergency_requests: { model: EmergencyRequest, label: 'Emergency Requests' },
  volunteers: { model: Volunteer as unknown as typeof EmergencyRequest, label: 'Volunteers' },
  resources: { model: Resource as unknown as typeof EmergencyRequest, label: 'Resources' },
  missions: { model: Mission as unknown as typeof EmergencyRequest, label: 'Missions' },
  agent_logs: { model: AgentLog as unknown as typeof EmergencyRequest, label: 'Agent Logs' },
}

export async function POST(request: Request) {
  try {
    await connectDB()

    const { question } = (await request.json()) as { question?: string }
    if (!question?.trim()) {
      return NextResponse.json({ error: 'question is required' }, { status: 400 })
    }

    const [emergencyCount, volunteerCount, resourceCount, missionCount] = await Promise.all([
      EmergencyRequest.countDocuments(),
      Volunteer.countDocuments(),
      Resource.countDocuments(),
      Mission.countDocuments(),
    ])

    const nlResult = await answerNaturalLanguageQuery(question, {
      emergencyCount,
      volunteerCount,
      resourceCount,
      missionCount,
    })

    if (nlResult.error) {
      return NextResponse.json({
        answer: nlResult.answer,
        collection: null,
        mongoFilter: null,
        error: nlResult.error,
      })
    }

    let results: unknown[] = []
    let count = 0

    if (nlResult.collection && nlResult.collection in COLLECTIONS) {
      const { model } = COLLECTIONS[nlResult.collection]
      const filter = nlResult.mongoFilter ?? {}
      try {
        const docs = await (model as typeof EmergencyRequest).find(filter).limit(10).lean()
        results = docs
        count = await (model as typeof EmergencyRequest).countDocuments(filter)
      } catch {
        // Invalid filter — return just the natural language answer
      }
    }

    return NextResponse.json({
      answer: nlResult.answer,
      collection: nlResult.collection,
      mongoFilter: nlResult.mongoFilter,
      results,
      count,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
