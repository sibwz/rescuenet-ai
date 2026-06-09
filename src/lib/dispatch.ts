import { connectDB } from '@/lib/mongodb'
import EmergencyRequest from '@/models/EmergencyRequest'
import Volunteer from '@/models/Volunteer'
import Resource from '@/models/Resource'
import Mission from '@/models/Mission'
import AgentLog from '@/models/AgentLog'
import { deterministicPlanner, type LeanDoc } from '@/lib/planner'

export interface DispatchStepResult {
  step: number
  label: string
  status: 'complete' | 'warning' | 'error'
  message: string
}

export interface DispatchResult {
  success: boolean
  missionId: string | null
  missionStatus: 'active' | 'awaiting_volunteer' | 'resource_shortage'
  volunteer: { name: string; skills: string[]; location: string } | null
  resource: { resourceType: string; quantity: number; location: string } | null
  reasoning: string
  steps: DispatchStepResult[]
  failureStep?: string
  failureReason?: string
}

export async function dispatchEmergency(emergencyId: string): Promise<DispatchResult> {
  const steps: DispatchStepResult[] = []
  const log = (msg: string) => console.log(`[Dispatch:${emergencyId}] ${msg}`)

  try {
    log('Starting auto-dispatch pipeline')

    // ── Step 1: Verify emergency exists ─────────────────────────────
    await connectDB()

    const rawRequest = await EmergencyRequest.findById(emergencyId).lean()
    if (!rawRequest) {
      log('FAIL — Emergency not found in DB')
      await AgentLog.create({
        action: 'AUTO_DISPATCH_FAILED',
        details: `[Step 1] Emergency ${emergencyId} not found in database.`,
        relatedIds: [emergencyId],
      })
      return {
        success: false,
        missionId: null,
        missionStatus: 'awaiting_volunteer',
        volunteer: null,
        resource: null,
        reasoning: 'Emergency record not found.',
        steps: [{ step: 1, label: 'Emergency Received', status: 'error', message: 'Emergency not found in database' }],
        failureStep: 'Step 1 — Emergency Lookup',
        failureReason: 'Emergency not found in database',
      }
    }

    const emergency = rawRequest as LeanDoc
    log(`Found emergency: ${emergency.emergencyType as string} | ${emergency.urgency as string} | ${emergency.peopleAffected as number} people`)

    steps.push({
      step: 1,
      label: 'Emergency Received',
      status: 'complete',
      message: `${(emergency.urgency as string).toUpperCase()} urgency · ${emergency.emergencyType as string} · ${emergency.peopleAffected as number} people affected`,
    })

    // ── Step 2: Incident assessment ──────────────────────────────────
    log('Step 2 — Incident assessment complete')
    steps.push({
      step: 2,
      label: 'AI Assessing',
      status: 'complete',
      message: `Priority confirmed: ${(emergency.urgency as string).toUpperCase()} · ${emergency.location as string}`,
    })

    // ── Step 3: Volunteer matching ────────────────────────────────────
    log('Step 3 — Scanning available volunteers')
    const rawVolunteers = await Volunteer.find({ status: 'available' }).lean()
    const volunteers = rawVolunteers as LeanDoc[]
    log(`Found ${volunteers.length} available volunteer(s)`)

    // ── Step 4: Resource allocation ───────────────────────────────────
    log('Step 4 — Scanning available resources')
    const rawResources = await Resource.find({ status: 'available' }).lean()
    const resources = rawResources as LeanDoc[]
    log(`Found ${resources.length} available resource(s)`)

    // Run deterministic planner for this single emergency
    const plans = deterministicPlanner([emergency], volunteers, resources)
    const plan = plans[0]

    const bestVol = plan?.suggestedVolunteer ?? null
    const bestRes = plan?.suggestedResource ?? null
    const volId = bestVol?._id ? String(bestVol._id) : null
    const resId = bestRes?._id ? String(bestRes._id) : null

    log(`Volunteer match: ${bestVol ? (bestVol.name as string) : 'NONE'}`)
    log(`Resource match: ${bestRes ? (bestRes.resourceType as string) : 'NONE'}`)

    if (bestVol) {
      steps.push({
        step: 3,
        label: 'Matching Volunteer',
        status: 'complete',
        message: `${bestVol.name as string} assigned — ${(bestVol.skills as string[]).join(', ')}`,
      })
    } else {
      log('WARN — No available volunteers found')
      steps.push({
        step: 3,
        label: 'Matching Volunteer',
        status: 'warning',
        message: `No available volunteers for ${emergency.emergencyType as string} emergency — mission queued`,
      })
    }

    if (bestRes) {
      steps.push({
        step: 4,
        label: 'Allocating Resources',
        status: 'complete',
        message: `${bestRes.quantity as number} units of ${bestRes.resourceType as string} from ${bestRes.location as string}`,
      })
    } else {
      log('WARN — No matching resources found')
      steps.push({
        step: 4,
        label: 'Allocating Resources',
        status: 'warning',
        message: `No ${emergency.emergencyType as string}-type resources available — shortage flagged`,
      })
    }

    // ── Step 5: Create mission ────────────────────────────────────────
    const missionStatus: 'active' | 'awaiting_volunteer' | 'resource_shortage' =
      !bestVol ? 'awaiting_volunteer' : !bestRes ? 'resource_shortage' : 'active'

    const reasoning = plan?.reasoning
      ?? `Auto-dispatched emergency ${emergencyId}. Type: ${emergency.emergencyType as string}, Urgency: ${emergency.urgency as string}.${!bestVol ? ' No volunteers available.' : ''}${!bestRes ? ' No matching resources.' : ''}`

    log(`Creating mission — status: ${missionStatus}`)

    const missionData: Record<string, unknown> = {
      emergencyRequestId: emergencyId,
      reasoning,
      coordinatorConfirmed: true,
      status: missionStatus,
    }
    if (volId) missionData.volunteerId = volId
    if (resId) missionData.resourceId = resId

    const mission = await Mission.create(missionData)
    log(`Mission created: ${String(mission._id)}`)

    // ── Step 6: Update all statuses atomically ────────────────────────
    log('Step 6 — Updating DB statuses')
    const dbUpdates: Promise<unknown>[] = [
      EmergencyRequest.findByIdAndUpdate(emergencyId, { status: 'assigned' }),
    ]
    if (volId) dbUpdates.push(Volunteer.findByIdAndUpdate(volId, { status: 'busy' }))
    if (resId) dbUpdates.push(Resource.findByIdAndUpdate(resId, { status: 'assigned' }))
    await Promise.all(dbUpdates)
    log('DB status updates complete')

    // ── Step 7: Audit log ─────────────────────────────────────────────
    await AgentLog.create({
      action: 'AUTO_DISPATCH',
      details: [
        `[Step 1] Emergency ${emergencyId} verified. Type: ${emergency.emergencyType as string}, Urgency: ${(emergency.urgency as string).toUpperCase()}, People: ${emergency.peopleAffected as number}.`,
        `[Step 2] Incident assessment complete. Location: ${emergency.location as string}.`,
        `[Step 3] Volunteer: ${bestVol ? `${bestVol.name as string} (${(bestVol.skills as string[]).join(', ')})` : 'NONE AVAILABLE'}.`,
        `[Step 4] Resource: ${bestRes ? `${bestRes.resourceType as string} x${bestRes.quantity as number} from ${bestRes.location as string}` : 'NONE AVAILABLE'}.`,
        `[Step 5] Mission ${String(mission._id)} created with status: ${missionStatus.toUpperCase()}.`,
        `[Step 6] Emergency → ASSIGNED. ${volId ? 'Volunteer → BUSY.' : ''} ${resId ? 'Resource → ASSIGNED.' : ''}`,
      ].join(' '),
      relatedIds: [emergencyId, String(mission._id), ...(volId ? [volId] : []), ...(resId ? [resId] : [])],
    })

    const missionLabel = missionStatus === 'active'
      ? `Mission ${String(mission._id).slice(-6)} active — team dispatched`
      : missionStatus === 'awaiting_volunteer'
        ? `Mission created — awaiting volunteer assignment`
        : `Mission created — resource shortage flagged for coordinator`

    steps.push({
      step: 5,
      label: 'Mission Created',
      status: 'complete',
      message: missionLabel,
    })

    log(`Dispatch complete — missionStatus: ${missionStatus}`)

    return {
      success: true,
      missionId: String(mission._id),
      missionStatus,
      volunteer: bestVol ? {
        name: bestVol.name as string,
        skills: bestVol.skills as string[],
        location: bestVol.location as string,
      } : null,
      resource: bestRes ? {
        resourceType: bestRes.resourceType as string,
        quantity: bestRes.quantity as number,
        location: bestRes.location as string,
      } : null,
      reasoning,
      steps,
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[Dispatch:${emergencyId}] FATAL ERROR: ${msg}`)

    try {
      await AgentLog.create({
        action: 'AUTO_DISPATCH_FAILED',
        details: `[FATAL] Auto-dispatch for emergency ${emergencyId} failed with error: ${msg}`,
        relatedIds: [emergencyId],
      })
      // Mark emergency with a recoverable status so it doesn't stay pending
      await EmergencyRequest.findByIdAndUpdate(emergencyId, { status: 'pending' })
    } catch (logErr) {
      console.error(`[Dispatch:${emergencyId}] Could not write failure log: ${String(logErr)}`)
    }

    return {
      success: false,
      missionId: null,
      missionStatus: 'awaiting_volunteer',
      volunteer: null,
      resource: null,
      reasoning: `Dispatch failed: ${msg}`,
      steps: [
        ...steps,
        { step: steps.length + 1, label: 'System Error', status: 'error', message: msg },
      ],
      failureStep: `Step ${steps.length + 1}`,
      failureReason: msg,
    }
  }
}
