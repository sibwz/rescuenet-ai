import { connectDB } from '@/lib/mongodb'
import EmergencyRequest from '@/models/EmergencyRequest'
import Volunteer from '@/models/Volunteer'
import Resource from '@/models/Resource'
import Mission from '@/models/Mission'
import AgentLog from '@/models/AgentLog'
import { deterministicPlanner, EMERGENCY_SKILL_MAP, EMERGENCY_RESOURCE_MAP, MAX_VOL_KM, MAX_RES_KM, type LeanDoc } from '@/lib/planner'
import { validateLocation, getApproxCoords, type LocationValidationResult } from '@/lib/location-validator'

export interface DispatchStepResult {
  step: number
  label: string
  status: 'complete' | 'warning' | 'error'
  message: string
}

export interface DispatchResult {
  success: boolean
  missionId: string | null
  missionStatus: 'active' | 'awaiting_volunteer' | 'resource_shortage' | 'awaiting_coordinator_review' | 'waiting_for_volunteer'
  volunteer: { name: string; skills: string[]; location: string } | null
  resource: { resourceType: string; quantity: number; location: string } | null
  reasoning: string
  steps: DispatchStepResult[]
  failureStep?: string
  failureReason?: string
  noMatchReason?: string
  volunteerConfidence?: number
  resourceConfidence?: number
  missionSuccessProbability?: number
  awaitingCoordinatorReview?: boolean
}

const VEHICLE_PREFERRED_TYPES = new Set(['evacuation', 'transport', 'flood', 'wildfire', 'hurricane', 'rescue'])

const URGENCY_PRIORITY: Record<string, number> = { critical: 95, high: 75, medium: 50, low: 25 }

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const toRad = (d: number) => d * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function locationMatchScore(loc1: string, loc2: string): number {
  const a = loc1.toLowerCase()
  const b = loc2.toLowerCase()
  if (a === b) return 20
  const aTokens = a.split(/[\s,]+/)
  const bTokens = b.split(/[\s,]+/)
  return aTokens.filter((t) => bTokens.includes(t)).length * 5
}

function calcVolunteerConfidence(vol: LeanDoc, emergency: LeanDoc): number {
  const idealSkills = EMERGENCY_SKILL_MAP[emergency.emergencyType as string] ?? []
  const volSkills = vol.skills as string[]
  const matchCount = volSkills.filter((s) => idealSkills.includes(s)).length
  const skillRatio = idealSkills.length > 0 ? matchCount / idealSkills.length : 0.5
  const skillConf = Math.round(skillRatio * 55)

  let locConf: number
  const eLat = emergency.latitude as number | undefined
  const eLng = emergency.longitude as number | undefined
  const vLat = vol.latitude as number | undefined
  const vLng = vol.longitude as number | undefined
  if (eLat && eLng && vLat && vLng) {
    const dist = haversineKm(eLat, eLng, vLat, vLng)
    locConf = dist < 5 ? 20 : dist < 15 ? 14 : dist < 30 ? 9 : dist < 60 ? 5 : 2
  } else {
    locConf = Math.min(20, locationMatchScore(vol.location as string, emergency.location as string))
  }

  const baseConf = 15
  const vehicleBonus = VEHICLE_PREFERRED_TYPES.has(emergency.emergencyType as string) && (vol.hasVehicle as boolean) ? 10 : 0
  return Math.min(100, skillConf + locConf + baseConf + vehicleBonus)
}

function calcResourceConfidence(res: LeanDoc, emergency: LeanDoc): number {
  const idealResources = EMERGENCY_RESOURCE_MAP[emergency.emergencyType as string] ?? []
  const typeMatch = idealResources.includes(res.resourceType as string)
  const typeConf = typeMatch ? 55 : 20
  const locConf = Math.min(25, locationMatchScore(res.location as string, emergency.location as string))
  const qty = res.quantity as number
  const quantConf = Math.min(20, Math.round(qty / 50 * 20))
  return Math.min(100, typeConf + locConf + quantConf)
}

function calcMissionProbability(volConf: number, resConf: number, urgency: string, peopleAffected: number): number {
  const base = Math.round((volConf + resConf) / 2)
  const urgencyAdj: Record<string, number> = { critical: -8, high: -4, medium: 0, low: 5 }
  const peopleAdj = peopleAffected > 100 ? -8 : peopleAffected > 50 ? -4 : 0
  return Math.max(10, Math.min(97, base + (urgencyAdj[urgency] ?? 0) + peopleAdj))
}

function getNoMatchReason(allVolunteers: LeanDoc[], emergencyType: string): string {
  const requiredSkills = EMERGENCY_SKILL_MAP[emergencyType] ?? []
  if (requiredSkills.length === 0) return `No skill requirements defined for "${emergencyType}"`

  // Count volunteers by approval state
  const unverified = allVolunteers.filter((v) => !v.verifiedEmail)
  const pendingApproval = allVolunteers.filter((v) => v.verifiedEmail && !v.approved)
  const approvedPool = allVolunteers.filter((v) => v.verifiedEmail && v.approved)

  const skillMatched = approvedPool.filter((v) =>
    (v.skills as string[]).some((s) => requiredSkills.includes(s))
  )
  if (approvedPool.length === 0) {
    if (pendingApproval.length > 0) return `${pendingApproval.length} volunteer(s) awaiting coordinator approval — no approved volunteers available yet`
    if (unverified.length > 0) return `${unverified.length} volunteer(s) registered but email not yet verified`
    return `No verified and approved volunteers registered`
  }
  if (skillMatched.length === 0) return `No approved volunteers with required skills (${requiredSkills.join(', ')}) — ${approvedPool.length} approved volunteer(s) have other skills`
  const offline = skillMatched.filter((v) => v.status === 'offline')
  const busy = skillMatched.filter((v) => v.status === 'busy' || v.status === 'deployed')
  if (offline.length > 0 && busy.length > 0) return `Matching volunteers are offline (${offline.length}) or deployed on other missions (${busy.length})`
  if (offline.length > 0) return `Matching volunteers are offline — ${offline.length} registered but not currently active`
  if (busy.length > 0) return `All matching volunteers are deployed — ${busy.length} currently on other missions`
  return `Waiting for verified approved volunteer with skills: ${requiredSkills.join(', ')}`
}

function buildReasoning(
  emergencyType: string,
  urgency: string,
  locResult: LocationValidationResult,
  rawVol: unknown,
  rawRes: unknown,
  volunteerConfidence: number,
  resourceConfidence: number,
  missionSuccessProbability: number,
  noMatchReason: string | undefined,
  resReason: string | undefined,
): string {
  const bestVol = rawVol as LeanDoc | null
  const bestRes = rawRes as LeanDoc | null
  const priorityScore = URGENCY_PRIORITY[urgency] ?? 50
  const lines: string[] = []

  lines.push(`✓ Location validated: ${locResult.normalizedAddress ?? 'Verified address'}`)
  lines.push(`✓ Emergency type: ${emergencyType} · Urgency: ${urgency.toUpperCase()}`)

  if (bestVol) {
    const volName = bestVol.name as string
    const volSkills = (bestVol.skills as string[]).join(', ')
    const volLoc = bestVol.location as string
    const vLat = bestVol.latitude as number | undefined
    const vLng = bestVol.longitude as number | undefined
    lines.push(`✓ Volunteer matched: ${volName} · Skills: ${volSkills}`)
    lines.push(`✓ Volunteer confidence: ${volunteerConfidence}%`)
    if (locResult.lat && locResult.lng) {
      const volCoords = (vLat && vLng) ? { lat: vLat, lng: vLng } : getApproxCoords(volLoc)
      const dist = haversineKm(locResult.lat, locResult.lng, volCoords.lat, volCoords.lng)
      const accuracy = (vLat && vLng) ? '' : ' (approx.)'
      lines.push(`✓ Volunteer distance: ~${dist.toFixed(1)} km from emergency${accuracy}`)
    }
  } else {
    lines.push(`✗ Volunteer unavailable: ${noMatchReason ?? 'No available volunteers'}`)
  }

  if (bestRes) {
    const resType = bestRes.resourceType as string
    const resQty = bestRes.quantity as number
    const resLoc = bestRes.location as string
    lines.push(`✓ Resources allocated: ${resQty} units of ${resType.replace('_', ' ')}`)
    lines.push(`✓ Resource confidence: ${resourceConfidence}%`)
    if (locResult.lat && locResult.lng) {
      const resCoords = getApproxCoords(resLoc)
      const dist = haversineKm(locResult.lat, locResult.lng, resCoords.lat, resCoords.lng)
      lines.push(`✓ Resource depot estimated distance: ~${dist.toFixed(1)} km`)
    }
  } else {
    lines.push(`✗ Resources unavailable: ${resReason ?? 'No matching resources'}`)
  }

  lines.push(`✓ AI priority score: ${priorityScore}/100`)
  if (missionSuccessProbability > 0) {
    lines.push(`✓ Mission success probability: ${missionSuccessProbability}%`)
  }

  return lines.join('\n')
}

export async function dispatchEmergency(emergencyId: string): Promise<DispatchResult> {
  const steps: DispatchStepResult[] = []
  const log = (msg: string) => console.log(`[Dispatch:${emergencyId}] ${msg}`)

  try {
    log('Starting auto-dispatch pipeline')
    await connectDB()

    // ── Step 1: Verify emergency ──────────────────────────────────────
    const rawRequest = await EmergencyRequest.findById(emergencyId).lean()
    if (!rawRequest) {
      await AgentLog.create({ action: 'AUTO_DISPATCH_FAILED', details: `Emergency ${emergencyId} not found.`, relatedIds: [emergencyId] })
      return { success: false, missionId: null, missionStatus: 'awaiting_volunteer', volunteer: null, resource: null, reasoning: 'Emergency not found.', steps: [{ step: 1, label: 'Emergency Received', status: 'error', message: 'Not found in database' }], failureStep: 'Step 1', failureReason: 'Emergency not found' }
    }

    const emergency = rawRequest as LeanDoc
    const urgency = emergency.urgency as string
    const emergencyType = emergency.emergencyType as string
    const location = emergency.location as string
    const peopleAffected = emergency.peopleAffected as number

    log(`type=${emergencyType} | urgency=${urgency} | location=${location}`)

    steps.push({ step: 1, label: 'Emergency Received', status: 'complete', message: `${urgency.toUpperCase()} · ${emergencyType} · ${peopleAffected} people` })

    // ── Step 2: Location Coordinates ─────────────────────────────────────
    let locResult: LocationValidationResult

    if (emergency.latitude && emergency.longitude) {
      locResult = {
        valid: true,
        lat: emergency.latitude as number,
        lng: emergency.longitude as number,
        normalizedAddress: (emergency.locationNormalized as string) ?? location,
      }
      steps.push({ step: 2, label: 'Location Validated', status: 'complete', message: `${locResult.normalizedAddress} · lat:${locResult.lat?.toFixed(4)}, lng:${locResult.lng?.toFixed(4)}` })
    } else {
      // Fallback: geocode if coordinates are missing (legacy records)
      log('Step 2 — Geocoding location (no stored coords)')
      locResult = await validateLocation(location)
      if (!locResult.valid) {
        log(`LOCATION INVALID: ${locResult.reason}`)
        steps.push({ step: 2, label: 'Location Validation', status: 'error', message: `Invalid location: ${locResult.reason}` })
        await EmergencyRequest.findByIdAndUpdate(emergencyId, { status: 'waiting_for_volunteer', noMatchReason: locResult.reason })
        return { success: false, missionId: null, missionStatus: 'waiting_for_volunteer', volunteer: null, resource: null, reasoning: `Location validation failed: ${locResult.reason}`, steps, failureStep: 'Step 2', failureReason: locResult.reason, noMatchReason: locResult.reason }
      }
      await EmergencyRequest.findByIdAndUpdate(emergencyId, { locationValidated: true, latitude: locResult.lat, longitude: locResult.lng, locationNormalized: locResult.normalizedAddress })
      steps.push({ step: 2, label: 'Location Validated', status: 'complete', message: `${locResult.normalizedAddress ?? location} · lat:${locResult.lat?.toFixed(4)}, lng:${locResult.lng?.toFixed(4)}` })
    }

    // ── Step 3: Incident Assessment ───────────────────────────────────
    const priorityScore = URGENCY_PRIORITY[urgency] ?? 50
    steps.push({ step: 3, label: 'AI Assessing', status: 'complete', message: `Priority confirmed: ${urgency.toUpperCase()} · Score: ${priorityScore}/100 · ${emergencyType}` })

    // ── Step 4: Volunteer Scan ────────────────────────────────────────
    log('Step 4 — Scanning volunteers')
    const rawAllVolunteers = await Volunteer.find({ source: { $ne: 'demo' } }).lean()
    const allVolunteers = rawAllVolunteers as LeanDoc[]
    const availableVolunteers = allVolunteers.filter((v) =>
      (v.status === 'available') &&
      (v.verifiedEmail === true) &&
      (v.approved === true)
    )
    const pendingCount = allVolunteers.filter((v) => v.status === 'pending_approval').length
    const unverifiedCount = allVolunteers.filter((v) => !v.verifiedEmail).length
    log(`${availableVolunteers.length} eligible (verified+approved) of ${allVolunteers.length} total (${pendingCount} pending approval, ${unverifiedCount} unverified)`)

    // ── Step 5: Resource Scan ─────────────────────────────────────────
    log('Step 5 — Scanning resources')
    const rawResources = await Resource.find({ status: 'available' }).lean()
    const resources = rawResources as LeanDoc[]

    const requiredResourceTypes = EMERGENCY_RESOURCE_MAP[emergencyType] ?? []
    const hasMatchingResource = resources.some((r) => requiredResourceTypes.includes(r.resourceType as string))
    log(`Required resource types: [${requiredResourceTypes.join(', ')}] — match found: ${hasMatchingResource}`)

    // Run planner
    const plans = deterministicPlanner([emergency], availableVolunteers, resources)
    const plan = plans[0]

    const bestVol = plan?.suggestedVolunteer ?? null
    const bestRes = plan?.suggestedResource ?? null
    const volId = bestVol?._id ? String(bestVol._id) : null
    const resId = bestRes?._id ? String(bestRes._id) : null

    log(`Volunteer: ${bestVol ? (bestVol.name as string) : 'NONE'}`)
    log(`Resource: ${bestRes ? (bestRes.resourceType as string) : 'NONE'}`)

    // Confidence scores
    const bestVolDoc = volId ? (availableVolunteers.find((v) => v._id.toString() === volId) ?? null) : null
    const bestResDoc = resId ? (resources.find((r) => r._id.toString() === resId) ?? null) : null
    const volunteerConfidence = bestVolDoc ? calcVolunteerConfidence(bestVolDoc, emergency) : 0
    const resourceConfidence = bestResDoc ? calcResourceConfidence(bestResDoc, emergency) : 0
    const missionSuccessProbability = (bestVol && bestRes)
      ? calcMissionProbability(volunteerConfidence, resourceConfidence, urgency, peopleAffected)
      : 0

    log(`Confidence — vol:${volunteerConfidence}% res:${resourceConfidence}% mission:${missionSuccessProbability}%`)

    // Distance-aware no-match reason: detect when skill-matched volunteers exist but are too far
    let noMatchReason: string | undefined
    if (!bestVol) {
      const requiredSkills = EMERGENCY_SKILL_MAP[emergencyType] ?? []
      const skillMatchedAvailable = availableVolunteers.filter((v) =>
        (v.skills as string[]).some((s) => requiredSkills.includes(s))
      )
      if (skillMatchedAvailable.length > 0 && locResult.lat && locResult.lng) {
        const withCoords = skillMatchedAvailable.filter((v) => v.latitude && v.longitude)
        if (withCoords.length > 0) {
          const distances = withCoords.map((v) =>
            haversineKm(locResult.lat!, locResult.lng!, v.latitude as number, v.longitude as number)
          )
          const nearest = Math.min(...distances)
          noMatchReason = `No volunteers within ${MAX_VOL_KM}km — nearest match is ~${nearest.toFixed(0)}km away`
        } else {
          noMatchReason = `Matching volunteers exist but location data incomplete — coordinator review needed`
        }
      } else {
        noMatchReason = getNoMatchReason(allVolunteers, emergencyType)
      }
    }

    // ── Step 6: No Volunteer → WAITING_FOR_VOLUNTEER ──────────────────
    if (!bestVol) {
      log(`No volunteer available: ${noMatchReason}`)
      steps.push({ step: 4, label: 'Volunteer Search', status: 'warning', message: noMatchReason ?? 'No available volunteers' })
      steps.push({ step: 5, label: 'Resource Check', status: 'warning', message: 'Skipped — no volunteer to dispatch' })

      const reasoning = buildReasoning(emergencyType, urgency, locResult, null, null, 0, 0, 0, noMatchReason, undefined)
      await EmergencyRequest.findByIdAndUpdate(emergencyId, { status: 'waiting_for_volunteer', noMatchReason })
      await AgentLog.create({
        action: 'WAITING_FOR_VOLUNTEER',
        details: `Emergency ${emergencyId} (${emergencyType} · ${urgency}) waiting for volunteer. ${noMatchReason}. No mission created.`,
        relatedIds: [emergencyId],
      })
      return { success: false, missionId: null, missionStatus: 'waiting_for_volunteer', volunteer: null, resource: null, reasoning, steps, noMatchReason, volunteerConfidence: 0, resourceConfidence: 0, missionSuccessProbability: 0 }
    }

    // ── Step 7: No Resource → RESOURCE_SHORTAGE ───────────────────────
    if (!bestRes) {
      let resReason: string
      if (requiredResourceTypes.length === 0) {
        resReason = 'No resource requirements defined for this emergency type.'
      } else {
        const matchingTypeRes = resources.filter((r) => requiredResourceTypes.includes(r.resourceType as string))
        if (matchingTypeRes.length === 0) {
          resReason = `No ${requiredResourceTypes.join(' or ')} resources in the system`
        } else {
          resReason = `No ${requiredResourceTypes.join(' or ')} depot within ${MAX_RES_KM}km of emergency location`
        }
      }

      log(`Resource shortage: ${resReason}`)
      steps.push({ step: 4, label: 'Volunteer Matched', status: 'complete', message: `${bestVol.name as string} — ${volunteerConfidence}% match confidence` })
      steps.push({ step: 5, label: 'Resource Check', status: 'error', message: resReason })

      const reasoning = buildReasoning(emergencyType, urgency, locResult, bestVol, null, volunteerConfidence, 0, 0, undefined, resReason)
      await EmergencyRequest.findByIdAndUpdate(emergencyId, { status: 'resource_shortage', noMatchReason: resReason })
      await AgentLog.create({
        action: 'RESOURCE_SHORTAGE',
        details: `Emergency ${emergencyId} (${emergencyType} · ${urgency}) has volunteer ${bestVol.name as string} matched but no resources available. ${resReason}. No mission created. Auto-retry when resources are restocked.`,
        relatedIds: [emergencyId, ...(volId ? [volId] : []), ...(resId ? [resId] : [])],
      })
      return { success: false, missionId: null, missionStatus: 'resource_shortage', volunteer: { name: bestVol.name as string, skills: bestVol.skills as string[], location: bestVol.location as string }, resource: null, reasoning, steps, noMatchReason: resReason, volunteerConfidence, resourceConfidence: 0, missionSuccessProbability: 0 }
    }

    // Both volunteer and resource found
    const vLat = (bestVol.latitude as number | undefined)
    const vLng = (bestVol.longitude as number | undefined)
    const volDistKm = (locResult.lat && locResult.lng && vLat && vLng)
      ? haversineKm(locResult.lat, locResult.lng, vLat, vLng)
      : null
    const volDistLabel = volDistKm !== null ? ` · ~${volDistKm.toFixed(1)} km away` : ''
    steps.push({ step: 4, label: 'Volunteer Matched', status: 'complete', message: `${bestVol.name as string} — ${(bestVol.skills as string[]).join(', ')}${volDistLabel} · ${volunteerConfidence}% confidence` })
    steps.push({ step: 5, label: 'Resource Allocated', status: 'complete', message: `${bestRes.quantity as number} units of ${bestRes.resourceType as string} · ${resourceConfidence}% confidence` })

    const fullReasoning = buildReasoning(emergencyType, urgency, locResult, bestVol, bestRes, volunteerConfidence, resourceConfidence, missionSuccessProbability, undefined, undefined)

    // ── Step 8: CRITICAL → Coordinator Review ─────────────────────────
    if (urgency === 'critical') {
      log('CRITICAL emergency → coordinator review')
      const rec = {
        volunteerId: volId ?? undefined,
        volunteerName: bestVol.name as string,
        volunteerSkills: bestVol.skills as string[],
        volunteerLocation: bestVol.location as string,
        resourceId: resId ?? undefined,
        resourceType: bestRes.resourceType as string,
        resourceQuantity: bestRes.quantity as number,
        volunteerConfidence,
        resourceConfidence,
        missionSuccessProbability,
        reasoning: fullReasoning,
      }
      await EmergencyRequest.findByIdAndUpdate(emergencyId, { status: 'awaiting_coordinator_review', coordinatorRecommendation: rec })
      await AgentLog.create({
        action: 'COORDINATOR_REVIEW_TRIGGERED',
        details: `CRITICAL ${emergencyType} emergency ${emergencyId} requires human oversight. ${fullReasoning.replace(/\n/g, ' | ')}`,
        relatedIds: [emergencyId, ...(volId ? [volId] : []), ...(resId ? [resId] : [])],
      })
      steps.push({ step: 6, label: 'Coordinator Review', status: 'warning', message: `CRITICAL — AI recommendation ready (${missionSuccessProbability}% success probability). Awaiting coordinator approval.` })
      return { success: true, missionId: null, missionStatus: 'awaiting_coordinator_review', volunteer: { name: bestVol.name as string, skills: bestVol.skills as string[], location: bestVol.location as string }, resource: { resourceType: bestRes.resourceType as string, quantity: bestRes.quantity as number, location: bestRes.location as string }, reasoning: fullReasoning, steps, volunteerConfidence, resourceConfidence, missionSuccessProbability, awaitingCoordinatorReview: true }
    }

    // ── Step 9: Create Active Mission (non-critical) ───────────────────
    const missionData: Record<string, unknown> = {
      emergencyRequestId: emergencyId,
      reasoning: fullReasoning,
      coordinatorConfirmed: true,
      status: 'active',
      volunteerId: volId,
      resourceId: resId,
      volunteerConfidence,
      resourceConfidence,
      missionSuccessProbability,
    }
    const mission = await Mission.create(missionData)
    const missionId = String(mission._id)
    log(`Mission created: ${missionId}`)

    // ── Step 10: Update DB ────────────────────────────────────────────
    await Promise.all([
      EmergencyRequest.findByIdAndUpdate(emergencyId, {
        status: 'assigned',
        assignedMissionId: missionId,
        assignedVolunteerId: volId,
        assignedVolunteerName: bestVol.name as string,
        assignedAt: new Date(),
        $unset: { noMatchReason: '' },
      }),
      Volunteer.findByIdAndUpdate(volId, { status: 'busy', currentMissionId: mission._id }),
      Resource.findByIdAndUpdate(resId, { status: 'assigned' }),
    ])

    // ── Step 11: Audit Log ────────────────────────────────────────────
    await AgentLog.create({
      action: 'AUTO_DISPATCH',
      details: `Emergency ${emergencyId} (${emergencyType} · ${urgency.toUpperCase()}) dispatched. ${fullReasoning.replace(/\n/g, ' | ')}`,
      relatedIds: [emergencyId, missionId, ...(volId ? [volId] : []), ...(resId ? [resId] : [])],
    })

    steps.push({ step: 6, label: 'Mission Created', status: 'complete', message: `Mission ${missionId.slice(-6)} active — team dispatched (${missionSuccessProbability}% success probability)` })
    log(`Dispatch complete — mission active`)

    return {
      success: true, missionId, missionStatus: 'active',
      volunteer: { name: bestVol.name as string, skills: bestVol.skills as string[], location: bestVol.location as string },
      resource: { resourceType: bestRes.resourceType as string, quantity: bestRes.quantity as number, location: bestRes.location as string },
      reasoning: fullReasoning, steps, volunteerConfidence, resourceConfidence, missionSuccessProbability,
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[Dispatch:${emergencyId}] FATAL: ${msg}`)
    try {
      await AgentLog.create({ action: 'AUTO_DISPATCH_FAILED', details: `[FATAL] Emergency ${emergencyId}: ${msg}`, relatedIds: [emergencyId] })
      await EmergencyRequest.findByIdAndUpdate(emergencyId, { status: 'pending' })
    } catch { /* ignore secondary failure */ }
    return { success: false, missionId: null, missionStatus: 'awaiting_volunteer', volunteer: null, resource: null, reasoning: `Dispatch failed: ${msg}`, steps: [...steps, { step: steps.length + 1, label: 'System Error', status: 'error', message: msg }], failureStep: `Step ${steps.length + 1}`, failureReason: msg }
  }
}
