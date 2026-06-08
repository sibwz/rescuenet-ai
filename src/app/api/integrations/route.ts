import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'

export const dynamic = 'force-dynamic'

export async function GET() {
  const gcpProject = process.env.GOOGLE_CLOUD_PROJECT_ID
  const gcpLocation = process.env.GOOGLE_CLOUD_LOCATION ?? 'us-central1'
  const vertexConfigured = !!(gcpProject && gcpProject !== 'your_google_cloud_project_id_here')

  let mongoStatus: 'connected' | 'error' = 'error'
  let mongoError: string | undefined

  try {
    await connectDB()
    mongoStatus = 'connected'
  } catch (err) {
    mongoError = err instanceof Error ? err.message : String(err)
  }

  return NextResponse.json({
    gemini: {
      status: vertexConfigured ? 'configured' : 'unconfigured',
      backend: 'Vertex AI',
      model: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash',
      projectId: vertexConfigured ? gcpProject : null,
      location: gcpLocation,
      note: vertexConfigured
        ? 'Vertex AI configured — Gemini is primary planner via ADC. Fallback activates on errors.'
        : 'Vertex AI not configured — deterministic fallback planner is active. Set GOOGLE_CLOUD_PROJECT_ID and run: gcloud auth application-default login',
    },
    googleCloudAgentBuilder: {
      status: vertexConfigured ? 'configured' : 'unconfigured',
      projectId: vertexConfigured ? gcpProject : null,
      note: 'See docs/google-cloud-agent-builder-setup.md for full Agent Builder integration.',
    },
    mongodb: {
      status: mongoStatus,
      error: mongoError ?? null,
      collections: ['emergency_requests', 'volunteers', 'resources', 'missions', 'agent_logs'],
    },
    mongodbMcp: {
      status: 'configured',
      collections: ['emergency_requests', 'volunteers', 'resources', 'missions', 'agent_logs'],
      note: 'See docs/mongodb-mcp-setup.md for MCP server configuration.',
    },
    humanApprovalWorkflow: {
      status: 'enabled',
      note: 'Coordinator reviews and selects plans before missions are created in MongoDB.',
    },
  })
}
