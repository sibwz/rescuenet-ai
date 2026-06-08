export type EmergencyType = 'medical' | 'food' | 'water' | 'shelter' | 'evacuation'
export type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical'
export type RequestStatus = 'pending' | 'assigned' | 'completed'

export type VolunteerSkill = 'medical' | 'transport' | 'food_distribution' | 'rescue' | 'logistics'
export type VolunteerStatus = 'available' | 'busy' | 'offline'

export type ResourceType = 'food' | 'water' | 'medicine' | 'shelter_kits' | 'vehicles'
export type ResourceStatus = 'available' | 'assigned' | 'depleted'

export type MissionStatus = 'active' | 'completed' | 'cancelled'

export interface EmergencyRequest {
  _id?: string
  reporterName: string
  location: string
  emergencyType: EmergencyType
  description: string
  urgency: UrgencyLevel
  peopleAffected: number
  status: RequestStatus
  createdAt?: string
  updatedAt?: string
}

export interface Volunteer {
  _id?: string
  name: string
  phone: string
  email: string
  location: string
  skills: VolunteerSkill[]
  hasVehicle: boolean
  status: VolunteerStatus
  createdAt?: string
}

export interface Resource {
  _id?: string
  resourceType: ResourceType
  quantity: number
  location: string
  status: ResourceStatus
  createdAt?: string
}

export interface Mission {
  _id?: string
  emergencyRequestId: string
  emergencyRequest?: EmergencyRequest
  volunteerId: string
  volunteer?: Volunteer
  resourceId: string
  resource?: Resource
  status: MissionStatus
  reasoning: string
  coordinatorConfirmed: boolean
  createdAt?: string
  updatedAt?: string
}

export interface AgentLog {
  _id?: string
  action: string
  details: string
  relatedIds: string[]
  timestamp?: string
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
