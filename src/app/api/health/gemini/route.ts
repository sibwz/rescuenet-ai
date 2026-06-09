import { NextResponse } from 'next/server'
import { checkGeminiStatus } from '@/lib/gemini'

export const dynamic = 'force-dynamic'

export async function GET() {
  const start = Date.now()
  const status = await checkGeminiStatus()
  return NextResponse.json({
    ...status,
    latencyMs: Date.now() - start,
    timestamp: new Date().toISOString(),
  })
}
