import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { isDbConnectionError, dbOfflineResponse } from '@/lib/db-error'
import Volunteer from '@/models/Volunteer'
import AgentLog from '@/models/AgentLog'
import { autoReassignPending } from '@/lib/auto-reassign'

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB()
    const body = await request.json() as Record<string, unknown>
    const prev = await Volunteer.findById(params.id).lean() as Record<string, unknown> | null
    if (!prev) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Handle coordinator approve/reject actions
    const action = body.action as string | undefined

    if (action === 'approve') {
      const updated = await Volunteer.findByIdAndUpdate(
        params.id,
        { approved: true, status: 'available' },
        { new: true }
      )
      await AgentLog.create({
        action: 'VOLUNTEER_APPROVED',
        details: `Coordinator approved volunteer ${updated?.name} (${updated?.email}). Status: available.`,
        relatedIds: [params.id],
      })
      autoReassignPending('volunteer-approved').catch((err) =>
        console.error('[PUT /api/volunteers/:id] Auto-reassign error:', String(err))
      )
      return NextResponse.json(updated)
    }

    if (action === 'reject') {
      const reason = (body.reason as string) ?? 'No reason provided'
      const updated = await Volunteer.findByIdAndUpdate(
        params.id,
        { approved: false, status: 'rejected' },
        { new: true }
      )
      await AgentLog.create({
        action: 'VOLUNTEER_REJECTED',
        details: `Coordinator rejected volunteer ${updated?.name} (${updated?.email}). Reason: ${reason}.`,
        relatedIds: [params.id],
      })
      return NextResponse.json(updated)
    }

    // General update
    const updated = await Volunteer.findByIdAndUpdate(params.id, body, { new: true })
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const wasNotAvailable = (prev.status as string) !== 'available'
    const isNowAvailable = body.status === 'available'
    if (wasNotAvailable && isNowAvailable) {
      await AgentLog.create({
        action: 'VOLUNTEER_AVAILABLE',
        details: `Volunteer ${updated.name} status changed to AVAILABLE. Triggering auto-reassign for pending emergencies.`,
        relatedIds: [params.id],
      })
      autoReassignPending('volunteer-available').catch((err) =>
        console.error('[PUT /api/volunteers/:id] Auto-reassign error:', String(err))
      )
    }

    return NextResponse.json(updated)
  } catch (error) {
    if (isDbConnectionError(error)) return dbOfflineResponse()
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB()
    await Volunteer.findByIdAndDelete(params.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (isDbConnectionError(error)) return dbOfflineResponse()
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
