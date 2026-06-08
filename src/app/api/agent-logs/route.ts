import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import AgentLog from '@/models/AgentLog'

export async function GET(request: Request) {
  try {
    await connectDB()

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)
    const action = searchParams.get('action')

    const filter = action ? { action } : {}
    const logs = await AgentLog.find(filter).sort({ createdAt: -1 }).limit(limit).lean()

    const distinctActions = await AgentLog.distinct('action')

    return NextResponse.json({ logs, distinctActions, total: await AgentLog.countDocuments(filter) })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
