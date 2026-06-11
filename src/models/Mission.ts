import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IMission extends Document {
  emergencyRequestId: mongoose.Types.ObjectId
  volunteerId?: mongoose.Types.ObjectId
  resourceId?: mongoose.Types.ObjectId
  status: 'active' | 'completed' | 'cancelled' | 'awaiting_volunteer' | 'resource_shortage' | 'awaiting_coordinator_review'
  reasoning: string
  coordinatorConfirmed: boolean
  volunteerConfidence?: number
  resourceConfidence?: number
  missionSuccessProbability?: number
  createdAt: Date
  updatedAt: Date
}

const MissionSchema = new Schema<IMission>(
  {
    emergencyRequestId: {
      type: Schema.Types.ObjectId,
      ref: 'EmergencyRequest',
      required: true,
    },
    volunteerId: {
      type: Schema.Types.ObjectId,
      ref: 'Volunteer',
      required: false,
    },
    resourceId: {
      type: Schema.Types.ObjectId,
      ref: 'Resource',
      required: false,
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'cancelled', 'awaiting_volunteer', 'resource_shortage', 'awaiting_coordinator_review'],
      default: 'active',
    },
    reasoning: { type: String, required: true },
    coordinatorConfirmed: { type: Boolean, default: true },
    volunteerConfidence: { type: Number, min: 0, max: 100 },
    resourceConfidence: { type: Number, min: 0, max: 100 },
    missionSuccessProbability: { type: Number, min: 0, max: 100 },
  },
  { timestamps: true }
)

const Mission: Model<IMission> =
  mongoose.models.Mission || mongoose.model<IMission>('Mission', MissionSchema)

export default Mission