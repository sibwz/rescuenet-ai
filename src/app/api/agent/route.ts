import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { isDbConnectionError, dbOfflineResponse } from '@/lib/db-error'
import EmergencyRequest from '@/models/EmergencyRequest'
import Volunteer from '@/models/Volunteer'
import Resource from '@/models/Resource'
import Mission from '@/models/Mission'
import AgentLog from '@/models/AgentLog'
import { generatePlanWithGemini } from '@/lib/gemini'
import { deterministicPlanner, type LeanDoc } from '@/lib/planner'
import type { AgentPlan } from '@/types'

export async function GET() {
  try {
    await connectDB()

    const [rawRequests, rawVolunteers, rawResources] = await Promise.all([
      EmergencyRequest.find({ status: 'pending' }).lean(),
      Volunteer.find().lean(),
      Resource.find().lean(),
    ])

    const requests = rawRequests as LeanDoc[]
    const volunteers = rawVolunteers as LeanDoc[]
    const resources = rawResources as LeanDoc[]

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

    const { result: geminiResult, geminiError } = await generatePlanWithGemini(geminiInput)

    if (geminiError) {
      console.error(`Gemini failed, fallback active: ${geminiError}`)
    }

    let plans: AgentPlan[]
    const usedEngine = geminiResult ? 'gemini' : 'deterministic'

    if (geminiResult) {
      plans = geminiResult.plans.map((p) => {
        const req = requests.find((r) => r._id.toString() === p.requestId)
        const vol = p.volunteerId ? volunteers.find((v) => v._id.toString() === p.volunteerId) : null
        const res = p.resourceId ? resources.find((r) => r._id.toString() === p.resourceId) : null
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
    } else {
      plans = deterministicPlanner(requests, volunteers, resources)
    }

    await AgentLog.create({
      action: 'GENERATE_PLAN',
      details: `Agent generated ${plans.length} mission plans. Engine: ${geminiResult ? 'Gemini API' : 'Deterministic Planner'}${geminiError ? ' (Gemini failed: fallback used)' : ''}`,
      relatedIds: plans.map((p) => p.requestId),
    })

    const availableVolCount = volunteers.filter((v) => v.status === 'available').length
    const availableResCount = resources.filter((r) => r.status === 'available').length

    return NextResponse.json({
      plans,
      engine: usedEngine,
      geminiError: geminiError ?? null,
      summary:
        geminiResult?.overallSummary ??
        `Analyzed ${requests.length} pending requests, ${availableVolCount} available volunteers, and ${availableResCount} available resources. Generated ${plans.length} prioritized mission plans using the deterministic planner.`,
    })
  } catch (error) {
    if (isDbConnectionError(error)) return dbOfflineResponse()
    console.error('Agent error:', error)
    return NextResponse.json({ error: 'Agent failed to generate plan' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await connectDB()
    const { plans } = await request.json() as { plans: AgentPlan[] }

    const created = []

    for (const plan of plans) {
      if (!plan.suggestedVolunteer) continue

      const missionStatus = plan.suggestedResource ? 'active' : 'resource_shortage'

      const missionData: Record<string, unknown> = {
        emergencyRequestId: plan.requestId,
        volunteerId: plan.suggestedVolunteer._id,
        reasoning: plan.reasoning,
        coordinatorConfirmed: true,
        status: missionStatus,
      }
      if (plan.suggestedResource) {
        missionData.resourceId = plan.suggestedResource._id
      }

      const mission = await Mission.create(missionData)
      const missionId = String(mission._id)

      console.log(`[Agent POST] Mission ${missionId} created for request ${plan.requestId} — volunteer: ${plan.suggestedVolunteer.name}, status: ${missionStatus}`)

      const emergencyUpdate: Record<string, unknown> = {
        status: 'assigned',
        assignedVolunteerId: String(plan.suggestedVolunteer._id),
        assignedMissionId: missionId,
        assignedAt: new Date(),
      }

      const updates: Promise<unknown>[] = [
        EmergencyRequest.findByIdAndUpdate(plan.requestId, emergencyUpdate),
        Volunteer.findByIdAndUpdate(plan.suggestedVolunteer._id, {
          status: 'busy',
          currentMissionId: mission._id,
        }),
      ]
      if (plan.suggestedResource) {
        updates.push(Resource.findByIdAndUpdate(plan.suggestedResource._id, { status: 'assigned' }))
      }
      await Promise.all(updates)

      await AgentLog.create({
        action: 'MISSION_CREATED',
        details: `Mission ${missionId} created for request ${plan.requestId}. Volunteer: ${plan.suggestedVolunteer.name}. Resource: ${plan.suggestedResource?.resourceType ?? 'none'}.`,
        relatedIds: [
          plan.requestId,
          String(plan.suggestedVolunteer._id),
          ...(plan.suggestedResource ? [String(plan.suggestedResource._id)] : []),
        ],
      })

      created.push(mission)
    }

    return NextResponse.json({ created: created.length, missions: created })
  } catch (error) {
    if (isDbConnectionError(error)) return dbOfflineResponse()
    console.error('Mission creation error:', error)
    return NextResponse.json({ error: 'Failed to create missions' }, { status: 500 })
  }
}
