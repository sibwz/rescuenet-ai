import type { AgentPlan, AgentPlanReasoning } from '@/types'

const EMERGENCY_SKILL_MAP: Record<string, string[]> = {
  medical: ['medical'],
  food: ['food_distribution', 'logistics'],
  water: ['food_distribution', 'logistics'],
  shelter: ['rescue', 'logistics'],
  evacuation: ['transport', 'rescue'],
}

const EMERGENCY_RESOURCE_MAP: Record<string, string[]> = {
  medical: ['medicine'],
  food: ['food'],
  water: ['water'],
  shelter: ['shelter_kits'],
  evacuation: ['vehicles'],
}

const URGENCY_SCORE: Record<string, number> = {
  critical: 100,
  high: 75,
  medium: 50,
  low: 25,
}

function locationScore(loc1: string, loc2: string): number {
  const a = loc1.toLowerCase()
  const b = loc2.toLowerCase()
  if (a === b) return 20
  const aTokens = a.split(/[\s,]+/)
  const bTokens = b.split(/[\s,]+/)
  return aTokens.filter((t) => bTokens.includes(t)).length * 5
}

function skillScore(volunteerSkills: string[], emergencyType: string): number {
  const ideal = EMERGENCY_SKILL_MAP[emergencyType] ?? []
  return volunteerSkills.filter((s) => ideal.includes(s)).length * 15
}

function resourceScore(resourceType: string, emergencyType: string): number {
  const ideal = EMERGENCY_RESOURCE_MAP[emergencyType] ?? []
  return ideal.includes(resourceType) ? 30 : 0
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

  for (const req of sortedRequests) {
    if ((req.status as string) !== 'pending') continue

    const availableVols = volunteers.filter(
      (v) => v.status === 'available' && !assignedVolunteers.has(v._id.toString())
    )
    const scoredVols = availableVols.map((v) => ({
      volunteer: v,
      score:
        skillScore(v.skills as string[], req.emergencyType as string) +
        locationScore(v.location as string, req.location as string),
    }))
    scoredVols.sort((a, b) => b.score - a.score)
    const bestVolEntry = scoredVols[0] ?? null
    const bestVol = bestVolEntry?.volunteer ?? null

    const availableRes = resources.filter(
      (r) => r.status === 'available' && !assignedResources.has(r._id.toString())
    )
    const scoredRes = availableRes.map((r) => ({
      resource: r,
      score:
        resourceScore(r.resourceType as string, req.emergencyType as string) +
        locationScore(r.location as string, req.location as string),
    }))
    scoredRes.sort((a, b) => b.score - a.score)
    const bestRes = scoredRes[0]?.resource ?? null

    if (bestVol) assignedVolunteers.add(bestVol._id.toString())
    if (bestRes) assignedResources.add(bestRes._id.toString())

    const urgency = req.urgency as string
    const emergencyType = req.emergencyType as string
    const location = req.location as string
    const peopleAffected = req.peopleAffected as number

    const idealSkills = EMERGENCY_SKILL_MAP[emergencyType] ?? []
    const idealResources = EMERGENCY_RESOURCE_MAP[emergencyType] ?? []

    const reasoningDetails: AgentPlanReasoning = {
      priorityReason: `${urgency.charAt(0).toUpperCase() + urgency.slice(1)} urgency — ${peopleAffected} people affected. Priority score: ${URGENCY_SCORE[urgency]}. Processed among ${sortedRequests.length} pending requests.`,
      volunteerMatchReason: bestVol
        ? `${bestVol.name as string} has ${(bestVol.skills as string[]).filter((s) => idealSkills.includes(s)).length} matching skill(s) (${(bestVol.skills as string[]).join(', ')}) and is located at ${bestVol.location as string}. Combined score: ${bestVolEntry?.score ?? 0}.`
        : `No available volunteers with required skills (${idealSkills.join(', ')}) found.`,
      resourceAllocationReason: bestRes
        ? `${bestRes.resourceType as string} resources are the primary requirement for ${emergencyType} emergencies. ${bestRes.quantity as number} units available at ${bestRes.location as string}.`
        : `No matching resources (${idealResources.join(', ')}) currently available.`,
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
        `Assigned volunteer ${bestVol.name as string} (${(bestVol.skills as string[]).join(', ')}) — best skill/location match.`
      )
    } else {
      reasonParts.push('No available volunteers matched — mission queued without volunteer assignment.')
    }
    if (bestRes) {
      reasonParts.push(
        `Allocated ${bestRes.quantity as number} units of ${bestRes.resourceType as string} from ${bestRes.location as string}.`
      )
    } else {
      reasonParts.push('No matching resources available — flagged for procurement.')
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