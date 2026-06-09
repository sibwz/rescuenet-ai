import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import EmergencyRequest from '@/models/EmergencyRequest'
import Volunteer from '@/models/Volunteer'
import Resource from '@/models/Resource'
import Mission from '@/models/Mission'
import { coordinatorChat } from '@/lib/gemini'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { message } = await request.json() as { message: string }

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    await connectDB()

    // Fetch live database state for grounded answers
    const [emergencies, volunteers, resources, missions] = await Promise.all([
      EmergencyRequest.find().sort({ urgency: -1, createdAt: -1 }).lean(),
      Volunteer.find().lean(),
      Resource.find().lean(),
      Mission.find().populate('emergencyRequestId').populate('volunteerId').lean(),
    ])

    // Serialize IDs for JSON
    const dbContext = {
      emergencies: emergencies.map((e) => ({
        id: String(e._id),
        reporterName: e.reporterName,
        location: e.location,
        emergencyType: e.emergencyType,
        urgency: e.urgency,
        urgency_reason: e.urgency_reason,
        peopleAffected: e.peopleAffected,
        description: e.description,
        status: e.status,
        createdAt: e.createdAt,
      })),
      volunteers: volunteers.map((v) => ({
        id: String(v._id),
        name: v.name,
        location: v.location,
        skills: v.skills,
        hasVehicle: v.hasVehicle,
        status: v.status,
        phone: v.phone,
      })),
      resources: resources.map((r) => ({
        id: String(r._id),
        resourceType: r.resourceType,
        quantity: r.quantity,
        location: r.location,
        status: r.status,
      })),
      missions: missions.map((m) => ({
        id: String(m._id),
        status: m.status,
        coordinatorConfirmed: m.coordinatorConfirmed,
        reasoning: m.reasoning,
        createdAt: m.createdAt,
      })),
    }

    const result = await coordinatorChat(message, dbContext)

    return NextResponse.json({
      answer: result.answer,
      reasoning: result.reasoning,
      toolCallsUsed: result.toolCallsUsed,
      dataQueried: result.dataQueried,
      counts: {
        emergencies: emergencies.length,
        volunteers: volunteers.length,
        resources: resources.length,
        missions: missions.length,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
