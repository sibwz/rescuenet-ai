import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IResource extends Document {
  resourceType: 'food' | 'water' | 'medicine' | 'shelter_kits' | 'vehicles'
  quantity: number
  location: string
  latitude?: number
  longitude?: number
  status: 'available' | 'assigned' | 'depleted'
  locationPrecision?: 'exact' | 'area' | 'city_only' | 'invalid'
  locationVerified?: boolean
  dispatchEligible?: boolean
  source: 'user' | 'demo' | 'system'
  createdAt: Date
}

const ResourceSchema = new Schema<IResource>(
  {
    resourceType: {
      type: String,
      enum: ['food', 'water', 'medicine', 'shelter_kits', 'vehicles'],
      required: true,
    },
    quantity: { type: Number, required: true, min: 0 },
    location: { type: String, required: true, trim: true },
    latitude:  { type: Number },
    longitude: { type: Number },
    status: {
      type: String,
      enum: ['available', 'assigned', 'depleted'],
      default: 'available',
    },
    locationPrecision: {
      type: String,
      enum: ['exact', 'area', 'city_only', 'invalid'],
      default: null,
    },
    locationVerified: { type: Boolean, default: null },
    dispatchEligible: { type: Boolean, default: null },
    source: {
      type: String,
      enum: ['user', 'demo', 'system'],
      default: 'user',
    },
  },
  { timestamps: true }
)

const Resource: Model<IResource> =
  mongoose.models.Resource || mongoose.model<IResource>('Resource', ResourceSchema)

export default Resource
