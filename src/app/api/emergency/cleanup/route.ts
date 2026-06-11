import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import EmergencyRequest from '@/models/EmergencyRequest'
import AgentLog from '@/models/AgentLog'
import { validateLocation } from '@/lib/location-validator'
import { autoReassignPending } from '@/lib/auto-reassign'

export const dynamic = 'force-dynamic'

/**
 * POST /api/emergency/cleanup
 * Finds emergencies stuck in awaiting_coordinator_review (old/demo data) or pending with invalid
 * locations, validates their addresses, and resets them to the correct status.
 */
export async function POST() {
  try {
    await connectDB()

    // Find emergencies that may be stale or misclassified
    const stuckStatuses = ['awaiting_coordinator_review', 'pending', 'waiting_for_volunteer', 'resource_shortage']
    const candidates = await EmergencyRequest.find({ status: { $in: stuckStatuses } }).lean()

    if (candidates.length === 0) {
      return NextResponse.json({ success: true, message: 'No emergencies to clean up.', changed: 0, details: [] })
    }

    const results: Array<{ id: string; location: string; oldStatus: string; newStatus: string; reason: string }> = []

    for (const req of candidates) {
      const id = String(req._id)
      const oldStatus = req.status as string

      const locResult = await validateLocation(req.location as string)

      if (!locResult.valid) {
        // Location is invalid — reset to location_review_required
        if (oldStatus !== 'location_review_required') {
          await EmergencyRequest.findByIdAndUpdate(id, {
            status: 'location_review_required',
            locationValidated: false,
            coordinatorRecommendation: undefined,
            noMatchReason: locResult.reason,
          })
          results.push({
            id, location: req.location as string, oldStatus, newStatus: 'location_review_required',
            reason: `Location invalid: ${locResult.reason}`,
          })
        }
      } else {
        // Location is valid — if stuck in coordinator review, reset to pending for re-dispatch
        if (oldStatus === 'awaiting_coordinator_review') {
          await EmergencyRequest.findByIdAndUpdate(id, {
            status: 'pending',
            locationValidated: true,
            latitude: locResult.lat,
            longitude: locResult.lng,
            locationNormalized: locResult.normalizedAddress,
            coordinatorRecommendation: undefined,
            noMatchReason: 'Reset from stale coordinator review state for re-dispatch.',
          })
          results.push({
            id, location: req.location as string, oldStatus, newStatus: 'pending',
            reason: 'Valid location — reset from stale coordinator review for re-dispatch.',
          })
        } else {
          // Already in a retriable state with valid location — just save location data
          await EmergencyRequest.findByIdAndUpdate(id, {
            locationValidated: true,
            latitude: locResult.lat,
            longitude: locResult.lng,
            locationNormalized: locResult.normalizedAddress,
          })
          results.push({
            id, location: req.location as string, oldStatus, newStatus: oldStatus,
            reason: 'Location validated and saved — will be retried by auto-reassign.',
          })
        }
      }
    }

    const changed = results.filter((r) => r.oldStatus !== r.newStatus).length

    await AgentLog.create({
      action: 'DEMO_QUEUE_CLEANUP',
      details: `Cleanup scan: ${candidates.length} candidate(s). ${changed} status change(s). Invalid locations: ${results.filter(r => r.newStatus === 'location_review_required').length}. Reset to pending: ${results.filter(r => r.newStatus === 'pending').length}.`,
      relatedIds: results.map((r) => r.id),
    })

    // Trigger auto-reassign for any newly-pending emergencies
    if (results.some((r) => r.newStatus === 'pending')) {
      autoReassignPending('cleanup').catch((err) =>
        console.error('[Cleanup] Auto-reassign error:', String(err))
      )
    }

    return NextResponse.json({
      success: true,
      scanned: candidates.length,
      changed,
      details: results,
      message: `Scanned ${candidates.length} emergency(ies). ${changed} status change(s) applied.`,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
