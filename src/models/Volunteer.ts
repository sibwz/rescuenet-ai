import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IVolunteer extends Document {
  name: string
  phone: string
  email: string
  location: string
  latitude?: number
  longitude?: number
  locationValidated?: boolean
  locationPrecision?: 'exact' | 'area' | 'city_only' | 'invalid'
  skills: Array<'medical' | 'transport' | 'food_distribution' | 'rescue' | 'logistics'>
  hasVehicle: boolean
  status: 'unverified' | 'pending_approval' | 'available' | 'deployed' | 'busy' | 'offline' | 'location_incomplete' | 'rejected'
  currentMissionId?: mongoose.Types.ObjectId
  source: 'user' | 'demo' | 'system'
  verifiedEmail: boolean
  approved: boolean
  otpCode?: string
  otpExpiry?: Date
  createdAt: Date
}

const VolunteerSchema = new Schema<IVolunteer>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    location: { type: String, required: true, trim: true },
    skills: [
      {
        type: String,
        enum: ['medical', 'transport', 'food_distribution', 'rescue', 'logistics'],
      },
    ],
    hasVehicle: { type: Boolean, default: false },
    latitude:          { type: Number },
    longitude:         { type: Number },
    locationValidated: { type: Boolean, default: false },
    locationPrecision: {
      type: String,
      enum: ['exact', 'area', 'city_only', 'invalid'],
      default: null,
    },
    status: {
      type: String,
      enum: ['unverified', 'pending_approval', 'available', 'deployed', 'busy', 'offline', 'location_incomplete', 'rejected'],
      default: 'available',
    },
    currentMissionId: {
      type: Schema.Types.ObjectId,
      ref: 'Mission',
      required: false,
    },
    source: {
      type: String,
      enum: ['user', 'demo', 'system'],
      default: 'user',
    },
    verifiedEmail: { type: Boolean, default: false },
    approved: { type: Boolean, default: false },
    otpCode: { type: String },
    otpExpiry: { type: Date },
  },
  { timestamps: true }
)

const Volunteer: Model<IVolunteer> =
  mongoose.models.Volunteer || mongoose.model<IVolunteer>('Volunteer', VolunteerSchema)

export default Volunteer
