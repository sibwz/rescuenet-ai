import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IEmergencyRequest extends Document {
  reporterName: string
  location: string
  emergencyType: 'medical' | 'food' | 'water' | 'shelter' | 'evacuation'
  description: string
  urgency: 'low' | 'medium' | 'high' | 'critical'
  peopleAffected: number
  status: 'pending' | 'assigned' | 'completed'
  urgency_reason?: string
  phone?: string
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
      enum: ['pending', 'assigned', 'completed'],
      default: 'pending',
    },
    urgency_reason: { type: String },
    phone: { type: String },
  },
  { timestamps: true }
)

const EmergencyRequest: Model<IEmergencyRequest> =
  mongoose.models.EmergencyRequest ||
  mongoose.model<IEmergencyRequest>('EmergencyRequest', EmergencyRequestSchema)

export default EmergencyRequest