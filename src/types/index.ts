export type EmergencyType = 'medical' | 'food' | 'water' | 'shelter' | 'evacuation'
export type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical'
export type RequestStatus =
  | 'pending'
  | 'assigned'
  | 'completed'
  | 'awaiting_coordinator_review'
  | 'waiting_for_volunteer'
  | 'resource_shortage'

export type VolunteerSkill = 'medical' | 'transport' | 'food_distribution' | 'rescue' | 'logistics'
export type VolunteerStatus = 'unverified' | 'pending_approval' | 'available' | 'deployed' | 'busy' | 'offline' | 'location_incomplete' | 'rejected'

export type ResourceType = 'food' | 'water' | 'medicine' | 'shelter_kits' | 'vehicles'
export type ResourceStatus = 'available' | 'assigned' | 'depleted'

export type MissionStatus = 'active' | 'completed' | 'cancelled' | 'awaiting_volunteer' | 'resource_shortage' | 'awaiting_coordinator_review'

export interface CoordinatorRecommendation {
  volunteerId?: string
  volunteerName?: string
  volunteerSkills?: string[]
  volunteerLocation?: string
  resourceId?: string
  resourceType?: string
  resourceQuantity?: number
  volunteerConfidence: number
  resourceConfidence: number
  missionSuccessProbability: number
  reasoning: string
}

export interface EmergencyRequest {
  _id?: string
  reporterName: string
  phone?: string
  location: string
  emergencyType: EmergencyType
  description: string
  urgency: UrgencyLevel
  urgency_reason?: string
  peopleAffected: number
  status: RequestStatus
  assignedVolunteerId?: string
  assignedMissionId?: string
  assignedAt?: string
  noMatchReason?: string
  coordinatorRecommendation?: CoordinatorRecommendation
  latitude?: number
  longitude?: number
  locationValidated?: boolean
  locationNormalized?: string
  dispatchRegion?: 'pakistan' | 'international' | 'unknown'
  validationStatus?: string
  source?: 'user' | 'demo' | 'system'
  createdAt?: string
  updatedAt?: string
  // Enriched fields returned by GET /api/emergency for assigned requests
  assignedVolunteerName?: string | null
  assignedVolunteerLocation?: string | null
  assignedResourceType?: string | null
  assignedResourceQty?: number | null
  estimatedETA?: string | null
}

export interface Volunteer {
  _id?: string
  name: string
  phone: string
  email: string
  location: string
  latitude?: number
  longitude?: number
  locationValidated?: boolean
  locationPrecision?: 'exact' | 'area' | 'city_only' | 'invalid'
  skills: VolunteerSkill[]
  hasVehicle: boolean
  status: VolunteerStatus
  currentMissionId?: string
  source?: 'user' | 'demo' | 'system'
  verifiedEmail?: boolean
  approved?: boolean
  createdAt?: string
}

export interface Resource {
  _id?: string
  resourceType: ResourceType
  quantity: number
  location: string
  latitude?: number
  longitude?: number
  status: ResourceStatus
  locationPrecision?: 'exact' | 'area' | 'city_only' | 'invalid'
  locationVerified?: boolean
  dispatchEligible?: boolean
  source?: 'user' | 'demo' | 'system'
  createdAt?: string
}

export interface Mission {
  _id?: string
  emergencyRequestId: string
  emergencyRequest?: EmergencyRequest
  volunteerId?: string
  volunteer?: Volunteer
  resourceId?: string
  resource?: Resource
  status: MissionStatus
  reasoning: string
  coordinatorConfirmed: boolean
  volunteerConfidence?: number
  resourceConfidence?: number
  missionSuccessProbability?: number
  createdAt?: string
  updatedAt?: string
}

export interface AgentLog {
  _id?: string
  action: string
  details: string
  relatedIds: string[]
  timestamp?: string
  createdAt?: string
}

export interface AgentPlanReasoning {
  priorityReason: string
  volunteerMatchReason: string
  resourceAllocationReason: string
  riskLevel: string
  nextAction: string
}

export interface AgentPlan {
  requestId: string
  request: EmergencyRequest
  suggestedVolunteer: Volunteer | null
  suggestedResource: Resource | null
  reasoning: string
  reasoningDetails?: AgentPlanReasoning
  priorityScore: number
}

export interface DashboardStats {
  totalRequests: number
  criticalRequests: number
  availableVolunteers: number
  availableResources: number
  activeMissions: number
  analytics?: {
    emergencyByType: Array<{ type: string; count: number; peopleAffected: number }>
    urgencyBreakdown: Record<string, number>
    peopleHelped: number
    missionStatus: Record<string, number>
    missionCompletionRate: number
    resourceUtilization: Record<string, number>
    volunteerUtilRate: number
    totalVolunteers: number
    busyVolunteers: number
  }
}

export interface NLQueryResult {
  answer: string
  collection: string | null
  mongoFilter: Record<string, unknown> | null
  results?: unknown[]
  count?: number
  error?: string
}
