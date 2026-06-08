import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IAgentLog extends Document {
  action: string
  details: string
  relatedIds: string[]
  createdAt: Date
}

const AgentLogSchema = new Schema<IAgentLog>(
  {
    action: { type: String, required: true },
    details: { type: String, required: true },
    relatedIds: [{ type: String }],
  },
  { timestamps: true }
)

const AgentLog: Model<IAgentLog> =
  mongoose.models.AgentLog || mongoose.model<IAgentLog>('AgentLog', AgentLogSchema)

export default AgentLog