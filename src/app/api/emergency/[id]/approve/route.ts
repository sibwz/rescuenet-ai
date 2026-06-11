import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import EmergencyRequest from '@/models/EmergencyRequest'
import Mission from '@/models/Mission'
import Volunteer from '@/models/Volunteer'
import Resource from '@/models/Resource'
import AgentLog from '@/models/AgentLog'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB()
    const { action } = await request.json() as { action: 'approve' | 'reject' }

    const emergency = await EmergencyRequest.findById(params.id)
    if (!emergency) return NextResponse.json({ error: 'Emergency not found' }, { status: 404 })

    if (emergency.status !== 'awaiting_coordinator_review') {
      return NextResponse.json({ error: 'Emergency is not awaiting coordinator review' }, { status: 400 })
    }

    const rec = emergency.coordinatorRecommendation
    if (!rec) return NextResponse.json({ error: 'No coordinator recommendation found' }, { status: 400 })

    if (action === 'reject') {
      await EmergencyRequest.findByIdAndUpdate(params.id, {
        status: 'pending',
        coordinatorRecommendation: undefined,
        noMatchReason: 'Coordinator rejected AI recommendation — returning to dispatch queue',
      })

      await AgentLog.create({
        action: 'COORDINATOR_REVIEW_REJECTED',
        details: `Coordinator rejected AI recommendation for CRITICAL ${emergency.emergencyType} emergency (${params.id}). Emergency returned to dispatch queue. Recommended volunteer was ${rec.volunteerName ?? 'unknown'} (${rec.volunteerConfidence}% confidence).`,
        relatedIds: [params.id],
      })

      return NextResponse.json({ success: true, action: 'rejected' })
    }

    // action === 'approve'
    const missionData: Record<string, unknown> = {
      emergencyRequestId: params.id,
      reasoning: rec.reasoning,
      coordinatorConfirmed: true,
      status: 'active',
      volunteerConfidence: rec.volunteerConfidence,
      resourceConfidence: rec.resourceConfidence,
      missionSuccessProbability: rec.missionSuccessProbability,
    }

    if (rec.volunteerId) missionData.volunteerId = rec.volunteerId
    if (rec.resourceId) missionData.resourceId = rec.resourceId

    const mission = await Mission.create(missionData)
    const missionId = String(mission._id)

    const updates: Promise<unknown>[] = [
      EmergencyRequest.findByIdAndUpdate(params.id, {
        status: 'assigned',
        assignedMissionId: missionId,
        assignedVolunteerId: rec.volunteerId,
        assignedAt: new Date(),
        coordinatorRecommendation: undefined,
      }),
    ]

    if (rec.volunteerId) {
      updates.push(
        Volunteer.findByIdAndUpdate(rec.volunteerId, { status: 'busy', currentMissionId: mission._id })
      )
    }
    if (rec.resourceId) {
      updates.push(Resource.findByIdAndUpdate(rec.resourceId, { status: 'assigned' }))
    }

    await Promise.all(updates)

    await AgentLog.create({
      action: 'COORDINATOR_REVIEW_APPROVED',
      details: `Coordinator approved AI recommendation for CRITICAL ${emergency.emergencyType} emergency (${params.id}). Mission ${missionId} created and dispatched. Volunteer: ${rec.volunteerName ?? 'unknown'} (${rec.volunteerConfidence}% confidence). Mission success probability: ${rec.missionSuccessProbability}%.`,
      relatedIds: [params.id, missionId, ...(rec.volunteerId ? [rec.volunteerId] : []), ...(rec.resourceId ? [rec.resourceId] : [])],
    })

    return NextResponse.json({ success: true, action: 'approved', missionId })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
