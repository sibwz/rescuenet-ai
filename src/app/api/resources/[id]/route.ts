import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { isDbConnectionError, dbOfflineResponse } from '@/lib/db-error'
import Resource from '@/models/Resource'
import AgentLog from '@/models/AgentLog'
import { autoReassignPending } from '@/lib/auto-reassign'

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB()
    const body = await request.json()

    // ── Restock action ─────────────────────────────────────────────────────
    if (body.restock) {
      const { add, reason } = body.restock as { add: number; reason: string }
      const current = await Resource.findById(params.id).lean()
      if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      const addAmount = Math.max(1, Number(add))
      const newQuantity = (current as { quantity: number }).quantity + addAmount
      const updated = await Resource.findByIdAndUpdate(params.id, { quantity: newQuantity, status: 'available' }, { new: true })
      await AgentLog.create({
        action: 'RESOURCE_RESTOCK',
        details: `${(current as { resourceType: string }).resourceType} restocked: +${addAmount} units (${reason}). New total: ${newQuantity}. Location: ${(current as { location: string }).location}`,
        relatedIds: [params.id],
      })
      autoReassignPending('resource-available').catch((err) =>
        console.error('[PUT /api/resources/:id] Restock auto-reassign error:', String(err))
      )
      return NextResponse.json({ ...updated!.toObject(), restocked: addAmount })
    }

    const prev = await Resource.findById(params.id).lean()
    const updated = await Resource.findByIdAndUpdate(params.id, body, { new: true })
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Trigger auto-reassign when resource becomes available
    const wasNotAvailable = prev && (prev as { status: string }).status !== 'available'
    const isNowAvailable = body.status === 'available'
    if (wasNotAvailable && isNowAvailable) {
      await AgentLog.create({
        action: 'RESOURCE_AVAILABLE',
        details: `Resource ${updated.resourceType} (${updated.quantity} units) at ${updated.location} became available. Triggering auto-reassign for resource_shortage emergencies.`,
        relatedIds: [params.id],
      })
      autoReassignPending('resource-available').catch((err) =>
        console.error('[PUT /api/resources/:id] Auto-reassign error:', String(err))
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
    await Resource.findByIdAndDelete(params.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (isDbConnectionError(error)) return dbOfflineResponse()
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
