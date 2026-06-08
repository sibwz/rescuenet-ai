import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IVolunteer extends Document {
  name: string
  phone: string
  email: string
  location: string
  skills: Array<'medical' | 'transport' | 'food_distribution' | 'rescue' | 'logistics'>
  hasVehicle: boolean
  status: 'available' | 'busy' | 'offline'
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
    status: {
      type: String,
      enum: ['available', 'busy', 'offline'],
      default: 'available',
    },
  },
  { timestamps: true }
)

const Volunteer: Model<IVolunteer> =
  mongoose.models.Volunteer || mongoose.model<IVolunteer>('Volunteer', VolunteerSchema)

export default Volunteer