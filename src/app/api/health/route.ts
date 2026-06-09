import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { checkGeminiStatus, isGeminiEnabled } from '@/lib/gemini'

export const dynamic = 'force-dynamic'

export async function GET() {
  const start = Date.now()

  // MongoDB check
  let mongoStatus: 'ok' | 'error' = 'error'
  let mongoError: string | null = null
  try {
    await connectDB()
    mongoStatus = 'ok'
  } catch (err) {
    mongoError = err instanceof Error ? err.message : String(err)
  }

  // Environment validation
  const envCheck = {
    MONGODB_URI: !!process.env.MONGODB_URI,
    GOOGLE_CLOUD_PROJECT_ID: !!process.env.GOOGLE_CLOUD_PROJECT_ID && process.env.GOOGLE_CLOUD_PROJECT_ID !== 'your_google_cloud_project_id_here',
    GOOGLE_CLOUD_LOCATION: process.env.GOOGLE_CLOUD_LOCATION ?? 'us-central1 (default)',
    GEMINI_MODEL: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash (default)',
    geminiEnabled: isGeminiEnabled(),
  }

  // Gemini status (lightweight check — no test call here, use /api/health/gemini for that)
  const geminiStatus = {
    configured: isGeminiEnabled(),
    project: process.env.GOOGLE_CLOUD_PROJECT_ID ?? null,
    location: process.env.GOOGLE_CLOUD_LOCATION === 'global'
      ? 'us-central1 (corrected from global)'
      : (process.env.GOOGLE_CLOUD_LOCATION ?? 'us-central1'),
    model: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash',
  }

  const overall = mongoStatus === 'ok' ? 'ok' : 'degraded'

  return NextResponse.json({
    status: overall,
    timestamp: new Date().toISOString(),
    latencyMs: Date.now() - start,
    services: {
      mongodb: { status: mongoStatus, error: mongoError },
      gemini: geminiStatus,
    },
    environment: envCheck,
  })
}
