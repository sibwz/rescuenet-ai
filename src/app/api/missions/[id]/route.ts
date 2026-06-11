import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { isDbConnectionError, dbOfflineResponse } from '@/lib/db-error'
import Mission from '@/models/Mission'
import EmergencyRequest from '@/models/EmergencyRequest'
import Volunteer from '@/models/Volunteer'
import Resource from '@/models/Resource'
import AgentLog from '@/models/AgentLog'
import { autoReassignPending } from '@/lib/auto-reassign'

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB()
    const body = await request.json()
    const mission = await Mission.findById(params.id)
    if (!mission) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    let triggerReassign = false

    if (body.status === 'completed') {
      await EmergencyRequest.findByIdAndUpdate(mission.emergencyRequestId, { status: 'completed' })
      await Volunteer.findByIdAndUpdate(mission.volunteerId, { status: 'available', currentMissionId: undefined })
      await Resource.findByIdAndUpdate(mission.resourceId, { status: 'depleted' })

      await AgentLog.create({
        action: 'MISSION_COMPLETED',
        details: `Mission ${params.id} completed. Volunteer released back to available pool. Triggering auto-reassign for pending emergencies.`,
        relatedIds: [params.id, String(mission.emergencyRequestId), ...(mission.volunteerId ? [String(mission.volunteerId)] : [])],
      })

      triggerReassign = true
    }

    if (body.status === 'cancelled') {
      await EmergencyRequest.findByIdAndUpdate(mission.emergencyRequestId, { status: 'pending' })
      await Volunteer.findByIdAndUpdate(mission.volunteerId, { status: 'available', currentMissionId: undefined })
      await Resource.findByIdAndUpdate(mission.resourceId, { status: 'available' })

      await AgentLog.create({
        action: 'MISSION_CANCELLED',
        details: `Mission ${params.id} cancelled. Volunteer released. Triggering auto-reassign for pending emergencies.`,
        relatedIds: [params.id, String(mission.emergencyRequestId), ...(mission.volunteerId ? [String(mission.volunteerId)] : [])],
      })

      triggerReassign = true
    }

    const updated = await Mission.findByIdAndUpdate(params.id, body, { new: true })
      .populate('emergencyRequestId')
      .populate('volunteerId')
      .populate('resourceId')
      .lean()

    // Non-blocking auto-reassign after volunteer becomes available
    if (triggerReassign) {
      autoReassignPending('mission-status-change').catch((err) =>
        console.error('[PUT /api/missions/:id] Auto-reassign error:', String(err))
      )
    }

    return NextResponse.json(updated)
  } catch (error) {
    if (isDbConnectionError(error)) return dbOfflineResponse()
    return NextResponse.json({ error: 'Failed to update mission' }, { status: 500 })
  }
}
