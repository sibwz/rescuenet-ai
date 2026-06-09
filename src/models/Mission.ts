import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IMission extends Document {
  emergencyRequestId: mongoose.Types.ObjectId
  volunteerId?: mongoose.Types.ObjectId
  resourceId?: mongoose.Types.ObjectId
  status: 'active' | 'completed' | 'cancelled' | 'awaiting_volunteer' | 'resource_shortage'
  reasoning: string
  coordinatorConfirmed: boolean
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
      enum: ['active', 'completed', 'cancelled', 'awaiting_volunteer', 'resource_shortage'],
      default: 'active',
    },
    reasoning: { type: String, required: true },
    coordinatorConfirmed: { type: Boolean, default: true },
  },
  { timestamps: true }
)

const Mission: Model<IMission> =
  mongoose.models.Mission || mongoose.model<IMission>('Mission', MissionSchema)

export default Mission