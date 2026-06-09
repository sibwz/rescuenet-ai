import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import EmergencyRequest from '@/models/EmergencyRequest'
import AgentLog from '@/models/AgentLog'
import { classifyEmergencyUrgency } from '@/lib/gemini'
import { dispatchEmergency } from '@/lib/dispatch'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const startTime = Date.now()
  let emergencyId: string | null = null

  try {
    await connectDB()
    const body = await request.json() as {
      reporterName: string
      phone?: string
      location: string
      emergencyType: string
      peopleAffected: number
      description: string
    }

    const { reporterName, phone, location, emergencyType, peopleAffected, description } = body

    if (!reporterName || !location || !emergencyType || !description || !peopleAffected) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    console.log(`[Report] New submission — ${emergencyType} at ${location} by ${reporterName}`)

    // ── Step 1: AI urgency classification ────────────────────────────
    console.log('[Report] Classifying urgency with Gemini...')
    const { urgency, urgencyReason } = await classifyEmergencyUrgency(
      description,
      emergencyType,
      Number(peopleAffected)
    )
    console.log(`[Report] Urgency classified: ${urgency.toUpperCase()} — ${urgencyReason}`)

    // ── Step 2: Persist emergency ────────────────────────────────────
    const emergency = await EmergencyRequest.create({
      reporterName,
      phone: phone ?? '',
      location,
      emergencyType,
      description,
      urgency,
      urgency_reason: urgencyReason,
      peopleAffected: Number(peopleAffected),
      status: 'pending',
    })
    emergencyId = String(emergency._id)

    console.log(`[Report] Emergency created: ${emergencyId}`)

    await AgentLog.create({
      action: 'EMERGENCY_SUBMITTED',
      details: `[Step 1] ${reporterName} submitted ${emergencyType} emergency at ${location}. Gemini classified urgency as ${urgency.toUpperCase()}. Reason: ${urgencyReason}`,
      relatedIds: [emergencyId],
    })

    // ── Step 3: Auto-dispatch (server-side, synchronous) ─────────────
    // Runs fully server-side — no SSE, no client dependency.
    // Emergency will always be dispatched before this response returns.
    console.log(`[Report] Starting auto-dispatch for ${emergencyId}...`)
    const dispatch = await dispatchEmergency(emergencyId)
    console.log(`[Report] Dispatch complete in ${Date.now() - startTime}ms — missionStatus: ${dispatch.missionStatus}`)

    return NextResponse.json({
      success: true,
      emergency: {
        _id: emergencyId,
        reporterName: emergency.reporterName,
        location: emergency.location,
        emergencyType: emergency.emergencyType,
        urgency: emergency.urgency,
        urgency_reason: emergency.urgency_reason,
        peopleAffected: emergency.peopleAffected,
        status: dispatch.success ? 'assigned' : 'pending',
        createdAt: emergency.createdAt,
      },
      dispatch,
      message: dispatch.success
        ? `Emergency submitted. ${dispatch.missionStatus === 'active' ? 'Mission created and team dispatched.' : dispatch.missionStatus === 'awaiting_volunteer' ? 'Mission created — awaiting volunteer.' : 'Mission created — resource shortage flagged.'}`
        : `Emergency submitted but dispatch encountered an issue: ${dispatch.failureReason ?? 'Unknown error'}`,
    }, { status: 201 })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[Report] Fatal error${emergencyId ? ` after creating ${emergencyId}` : ''}: ${msg}`)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
