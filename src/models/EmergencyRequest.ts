import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IEmergencyRequest extends Document {
  reporterName: string
  location: string
  emergencyType: 'medical' | 'food' | 'water' | 'shelter' | 'evacuation'
  description: string
  urgency: 'low' | 'medium' | 'high' | 'critical'
  peopleAffected: number
  status: 'pending' | 'assigned' | 'completed' | 'awaiting_coordinator_review' | 'waiting_for_volunteer' | 'resource_shortage'
  urgency_reason?: string
  phone?: string
  assignedVolunteerId?: string
  assignedVolunteerName?: string
  assignedMissionId?: string
  assignedAt?: Date
  noMatchReason?: string
  latitude?: number
  longitude?: number
  locationValidated?: boolean
  locationNormalized?: string
  dispatchRegion?: 'pakistan' | 'international' | 'unknown'
  validationStatus?: string
  source: 'user' | 'demo' | 'system'
  coordinatorRecommendation?: {
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
  createdAt: Date
  updatedAt: Date
}

const EmergencyRequestSchema = new Schema<IEmergencyRequest>(
  {
    reporterName: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    emergencyType: {
      type: String,
      enum: ['medical', 'food', 'water', 'shelter', 'evacuation'],
      required: true,
    },
    description: { type: String, required: true },
    urgency: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      required: true,
    },
    peopleAffected: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: [
        'pending', 'assigned', 'completed', 'awaiting_coordinator_review',
        'waiting_for_volunteer', 'resource_shortage',
      ],
      default: 'pending',
    },
    urgency_reason: { type: String },
    phone: { type: String },
    assignedVolunteerId: { type: String },
    assignedVolunteerName: { type: String },
    assignedMissionId: { type: String },
    assignedAt: { type: Date },
    noMatchReason: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },
    locationValidated: { type: Boolean, default: false },
    locationNormalized: { type: String },
    dispatchRegion: { type: String, enum: ['pakistan', 'international', 'unknown'], default: null },
    validationStatus: { type: String, default: null },
    coordinatorRecommendation: {
      type: {
        volunteerId: String,
        volunteerName: String,
        volunteerSkills: [String],
        volunteerLocation: String,
        resourceId: String,
        resourceType: String,
        resourceQuantity: Number,
        volunteerConfidence: Number,
        resourceConfidence: Number,
        missionSuccessProbability: Number,
        reasoning: String,
      },
      required: false,
    },
    source: {
      type: String,
      enum: ['user', 'demo', 'system'],
      default: 'user',
    },
  },
  { timestamps: true }
)

const EmergencyRequest: Model<IEmergencyRequest> =
  mongoose.models.EmergencyRequest ||
  mongoose.model<IEmergencyRequest>('EmergencyRequest', EmergencyRequestSchema)

export default EmergencyRequest
