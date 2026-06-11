import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IPendingReport extends Document {
  reporterName: string
  phone?: string
  location: string
  emergencyType: string
  peopleAffected: number
  description: string
  lat?: number
  lng?: number
  locationNormalized?: string
  otpCode: string
  verified: boolean
  expiresAt: Date
  createdAt: Date
}

const PendingReportSchema = new Schema<IPendingReport>(
  {
    reporterName: { type: String, required: true },
    phone: { type: String },
    location: { type: String, required: true },
    emergencyType: { type: String, required: true },
    peopleAffected: { type: Number, required: true },
    description: { type: String, required: true },
    lat: { type: Number },
    lng: { type: Number },
    locationNormalized: { type: String },
    otpCode: { type: String, required: true },
    verified: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true }
)

const PendingReport: Model<IPendingReport> =
  mongoose.models.PendingReport || mongoose.model<IPendingReport>('PendingReport', PendingReportSchema)

export default PendingReport
