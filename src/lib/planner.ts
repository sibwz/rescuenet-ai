import type { AgentPlan, AgentPlanReasoning } from '@/types'
import { getApproxCoords } from '@/lib/location-validator'

export const MAX_VOL_KM = 50
export const MAX_RES_KM = 80

const EMERGENCY_SKILL_MAP: Record<string, string[]> = {
  medical: ['medical'],
  food: ['food_distribution', 'logistics'],
  water: ['food_distribution', 'logistics'],
  shelter: ['rescue', 'logistics'],
  evacuation: ['transport', 'rescue'],
  flood: ['rescue', 'transport'],
  fire: ['rescue', 'medical'],
  earthquake: ['rescue', 'medical', 'logistics'],
  wildfire: ['transport', 'rescue'],
  hurricane: ['rescue', 'transport'],
}

const EMERGENCY_RESOURCE_MAP: Record<string, string[]> = {
  medical: ['medicine', 'vehicles'],
  food: ['food'],
  water: ['water'],
  shelter: ['shelter_kits'],
  evacuation: ['vehicles'],
  flood: ['vehicles', 'shelter_kits', 'water'],
  fire: ['vehicles', 'medicine'],
  earthquake: ['medicine', 'shelter_kits', 'vehicles'],
  wildfire: ['vehicles', 'shelter_kits', 'food'],
  hurricane: ['vehicles', 'shelter_kits', 'medicine'],
}

const URGENCY_SCORE: Record<string, number> = {
  critical: 100, high: 75, medium: 50, low: 25,
}

const VEHICLE_PREFERRED_TYPES = new Set(['evacuation', 'transport', 'flood', 'wildfire', 'hurricane', 'rescue'])

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const toRad = (d: number) => d * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

interface Coords { lat: number; lng: number; exact: boolean }

function getBestCoords(lat: number | undefined, lng: number | undefined, location: string): Coords {
  if (lat && lng) return { lat, lng, exact: true }
  const approx = getApproxCoords(location)
  return { lat: approx.lat, lng: approx.lng, exact: false }
}

function volDistanceScore(distKm: number): number {
  if (distKm <= 5) return 30
  if (distKm <= 15) return 22
  if (distKm <= 30) return 14
  if (distKm <= MAX_VOL_KM) return 5
  return 0
}

function resDistanceScore(distKm: number): number {
  if (distKm <= 10) return 30
  if (distKm <= 30) return 22
  if (distKm <= 50) return 14
  if (distKm <= MAX_RES_KM) return 5
  return 0
}

export interface LeanDoc {
  _id: { toString: () => string }
  [key: string]: unknown
}

export { EMERGENCY_SKILL_MAP, EMERGENCY_RESOURCE_MAP, URGENCY_SCORE }

export function deterministicPlanner(
  requests: LeanDoc[],
  volunteers: LeanDoc[],
  resources: LeanDoc[]
): AgentPlan[] {
  const sortedRequests = [...requests].sort(
    (a, b) => URGENCY_SCORE[b.urgency as string] - URGENCY_SCORE[a.urgency as string]
  )

  const assignedVolunteers = new Set<string>()
  const assignedResources = new Set<string>()
  const plans: AgentPlan[] = []

  const RETRIABLE = new Set(['pending', 'waiting_for_volunteer', 'resource_shortage'])

  for (const req of sortedRequests) {
    if (!RETRIABLE.has(req.status as string)) continue

    const emergencyType = req.emergencyType as string
    const idealSkills = EMERGENCY_SKILL_MAP[emergencyType] ?? []
    const idealResources = EMERGENCY_RESOURCE_MAP[emergencyType] ?? []

    const eCoords = getBestCoords(
      req.latitude as number | undefined,
      req.longitude as number | undefined,
      req.location as string
    )

    // ── Volunteer selection: require skill match + within 50km ─────────
    interface ScoredVol { volunteer: LeanDoc; score: number; distKm: number }
    const scoredVols: ScoredVol[] = []

    for (const v of volunteers) {
      if (v.status !== 'available' || assignedVolunteers.has(v._id.toString())) continue

      // Skip city-only (legacy records) or records without coordinates
      const volLocPrec = v.locationPrecision as string | undefined
      if (volLocPrec === 'city_only') continue
      if (!v.latitude || !v.longitude) continue

      // Require at least one matching skill
      const volSkills = v.skills as string[]
      const skillMatches = idealSkills.length > 0
        ? volSkills.filter((s) => idealSkills.includes(s)).length
        : 1
      if (idealSkills.length > 0 && skillMatches === 0) continue

      const vCoords = getBestCoords(
        v.latitude as number | undefined,
        v.longitude as number | undefined,
        v.location as string
      )
      const distKm = haversineKm(eCoords.lat, eCoords.lng, vCoords.lat, vCoords.lng)

      if (distKm > MAX_VOL_KM) continue

      const sScore = skillMatches * 15
      const dScore = volDistanceScore(distKm)
      const vScore = VEHICLE_PREFERRED_TYPES.has(emergencyType) && (v.hasVehicle as boolean) ? 10 : 0
      scoredVols.push({ volunteer: v, score: sScore + dScore + vScore, distKm })
    }

    scoredVols.sort((a, b) => b.score - a.score)
    const bestVolEntry = scoredVols[0] ?? null
    const bestVol = bestVolEntry?.volunteer ?? null

    // ── Resource selection: require type match + within 80km ──────────
    interface ScoredRes { resource: LeanDoc; score: number; distKm: number }
    const scoredRes: ScoredRes[] = []

    for (const r of resources) {
      if (r.status !== 'available' || assignedResources.has(r._id.toString())) continue

      // Skip city-only depots (legacy) or records without coordinates
      if (r.dispatchEligible === false) continue
      if (!r.latitude || !r.longitude) continue

      // Only matching resource types qualify
      if (!idealResources.includes(r.resourceType as string)) continue

      const rCoords = getBestCoords(
        r.latitude as number | undefined,
        r.longitude as number | undefined,
        r.location as string
      )
      const distKm = haversineKm(eCoords.lat, eCoords.lng, rCoords.lat, rCoords.lng)

      if (distKm > MAX_RES_KM) continue

      // First preferred type in the map gets a higher base score
      const typeScore = idealResources.indexOf(r.resourceType as string) === 0 ? 40 : 30
      const dScore = resDistanceScore(distKm)
      const qtyScore = Math.min(10, Math.round((r.quantity as number) / 50 * 10))
      scoredRes.push({ resource: r, score: typeScore + dScore + qtyScore, distKm })
    }

    scoredRes.sort((a, b) => b.score - a.score)
    const bestResEntry = scoredRes[0] ?? null
    const bestRes = bestResEntry?.resource ?? null

    if (bestVol) assignedVolunteers.add(bestVol._id.toString())
    if (bestRes) assignedResources.add(bestRes._id.toString())

    const urgency = req.urgency as string
    const location = req.location as string
    const peopleAffected = req.peopleAffected as number

    const volDistStr = bestVolEntry ? ` (~${bestVolEntry.distKm.toFixed(1)} km)` : ''
    const resDistStr = bestResEntry ? ` (~${bestResEntry.distKm.toFixed(1)} km)` : ''

    const reasoningDetails: AgentPlanReasoning = {
      priorityReason: `${urgency.charAt(0).toUpperCase() + urgency.slice(1)} urgency — ${peopleAffected} people affected. Priority score: ${URGENCY_SCORE[urgency]}. Processed among ${sortedRequests.length} pending requests.`,
      volunteerMatchReason: bestVol
        ? `${bestVol.name as string} has ${(bestVol.skills as string[]).filter((s) => idealSkills.includes(s)).length} matching skill(s) and is ${volDistStr.trim()} from the emergency. Score: ${bestVolEntry?.score ?? 0}.`
        : `No available volunteers within ${MAX_VOL_KM}km with required skills (${idealSkills.join(', ')}).`,
      resourceAllocationReason: bestRes
        ? `${bestRes.resourceType as string} (${bestRes.quantity as number} units) at ${bestRes.location as string}${resDistStr} — nearest matching depot within ${MAX_RES_KM}km.`
        : `No matching resources (${idealResources.join(', ')}) within ${MAX_RES_KM}km.`,
      riskLevel: urgency,
      nextAction: bestVol
        ? `Contact ${bestVol.name as string} immediately and dispatch to ${location}.`
        : `Issue volunteer recruitment alert for ${idealSkills.join('/')} specialists near ${location}.`,
    }

    const reasonParts: string[] = [
      `Emergency "${emergencyType}" in ${location} rated ${urgency.toUpperCase()} urgency affecting ${peopleAffected} people.`,
    ]
    if (bestVol) {
      reasonParts.push(
        `Assigned volunteer ${bestVol.name as string} (${(bestVol.skills as string[]).join(', ')})${volDistStr} — best skill+distance match.`
      )
    } else {
      reasonParts.push(`No available volunteers within ${MAX_VOL_KM}km with required skills — mission queued.`)
    }
    if (bestRes) {
      reasonParts.push(
        `Allocated ${bestRes.quantity as number} units of ${bestRes.resourceType as string} from ${bestRes.location as string}${resDistStr}.`
      )
    } else {
      reasonParts.push(`No matching resources within ${MAX_RES_KM}km — flagged for procurement.`)
    }

    plans.push({
      requestId: req._id.toString(),
      request: req as unknown as AgentPlan['request'],
      suggestedVolunteer: (bestVol ?? null) as unknown as AgentPlan['suggestedVolunteer'],
      suggestedResource: (bestRes ?? null) as unknown as AgentPlan['suggestedResource'],
      reasoning: reasonParts.join(' '),
      reasoningDetails,
      priorityScore: URGENCY_SCORE[urgency],
    })
  }

  return plans
}
