import { connectDB } from '@/lib/mongodb'
import EmergencyRequest from '@/models/EmergencyRequest'
import AgentLog from '@/models/AgentLog'
import { dispatchEmergency } from '@/lib/dispatch'

type RetriableStatus = 'pending' | 'waiting_for_volunteer' | 'resource_shortage'

/**
 * Scans all retriable emergencies and attempts auto-dispatch.
 * Triggered whenever volunteer or resource availability changes.
 */
export async function autoReassignPending(context = 'unknown'): Promise<void> {
  try {
    await connectDB()

    const retriableStatuses: RetriableStatus[] = ['pending', 'waiting_for_volunteer', 'resource_shortage']
    const pending = await EmergencyRequest.find({ status: { $in: retriableStatuses } }).lean()

    if (pending.length === 0) {
      console.log(`[AutoReassign:${context}] No retriable emergencies`)
      return
    }

    console.log(`[AutoReassign:${context}] ${pending.length} retriable emergency(ies)`)

    // Process critical first, then high, medium, low
    const URGENCY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
    const sorted = [...pending].sort((a, b) =>
      (URGENCY_ORDER[a.urgency as string] ?? 4) - (URGENCY_ORDER[b.urgency as string] ?? 4)
    )

    for (const req of sorted) {
      const emergencyId = String(req._id)
      const prevStatus = req.status as string
      try {
        console.log(`[AutoReassign:${context}] Processing ${emergencyId} (${req.emergencyType as string} · ${req.urgency as string} · was: ${prevStatus})`)
        const result = await dispatchEmergency(emergencyId)

        if (result.missionStatus === 'active') {
          console.log(`[AutoReassign:${context}] SUCCESS — ${emergencyId} assigned to ${result.volunteer?.name}`)
          await AgentLog.create({
            action: 'AUTO_REASSIGN_SUCCESS',
            details: `Pending ${req.emergencyType as string} emergency automatically re-assigned after availability change (${context}). Volunteer: ${result.volunteer?.name}. Mission: ${result.missionId}. Confidence: ${result.volunteerConfidence}%. Success probability: ${result.missionSuccessProbability}%.`,
            relatedIds: [emergencyId, ...(result.missionId ? [result.missionId] : [])],
          })
        } else if (result.awaitingCoordinatorReview) {
          console.log(`[AutoReassign:${context}] CRITICAL — ${emergencyId} routed to coordinator review`)
        } else {
          console.log(`[AutoReassign:${context}] Still blocked — ${emergencyId}: ${result.noMatchReason ?? result.missionStatus}`)
        }
      } catch (err) {
        console.error(`[AutoReassign:${context}] Error on ${emergencyId}: ${String(err)}`)
      }
    }
  } catch (err) {
    console.error(`[AutoReassign:${context}] Fatal: ${String(err)}`)
  }
}
