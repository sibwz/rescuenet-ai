import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IResource extends Document {
  resourceType: 'food' | 'water' | 'medicine' | 'shelter_kits' | 'vehicles'
  quantity: number
  location: string
  status: 'available' | 'assigned' | 'depleted'
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
    status: {
      type: String,
      enum: ['available', 'assigned', 'depleted'],
      default: 'available',
    },
  },
  { timestamps: true }
)

const Resource: Model<IResource> =
  mongoose.models.Resource || mongoose.model<IResource>('Resource', ResourceSchema)

export default Resource