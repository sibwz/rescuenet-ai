import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import PendingReport from '@/models/PendingReport'
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
    const body = await request.json() as { sessionId: string; otp: string }

    if (!body.sessionId || !body.otp) {
      return NextResponse.json({ error: 'Session ID and OTP are required.' }, { status: 400 })
    }

    const pending = await PendingReport.findById(body.sessionId)
    if (!pending) {
      return NextResponse.json({ error: 'Session expired or not found. Please resubmit the form.' }, { status: 404 })
    }
    if (pending.verified) {
      return NextResponse.json({ error: 'This report has already been submitted.' }, { status: 400 })
    }
    if (new Date() > pending.expiresAt) {
      await PendingReport.findByIdAndDelete(body.sessionId)
      return NextResponse.json({ error: 'Verification code expired. Please resubmit the form.' }, { status: 400 })
    }
    if (pending.otpCode !== body.otp.trim()) {
      return NextResponse.json({ error: 'Incorrect verification code. Please try again.' }, { status: 400 })
    }

    // Mark as verified to prevent double submission
    pending.verified = true
    await pending.save()

    // Classify urgency with Gemini
    console.log(`[Report OTP] OTP verified for ${pending.reporterName}. Classifying urgency...`)
    const { urgency, urgencyReason } = await classifyEmergencyUrgency(
      pending.description,
      pending.emergencyType,
      pending.peopleAffected
    )

    // Determine initial status
    const hasCoords = typeof pending.lat === 'number' && typeof pending.lng === 'number'
    const initialStatus = 'pending'

    const emergency = await EmergencyRequest.create({
      reporterName: pending.reporterName,
      phone: pending.phone ?? '',
      location: pending.location,
      emergencyType: pending.emergencyType,
      description: pending.description,
      urgency,
      urgency_reason: urgencyReason,
      peopleAffected: pending.peopleAffected,
      status: initialStatus,
      locationValidated: hasCoords,
      latitude: pending.lat,
      longitude: pending.lng,
      locationNormalized: pending.locationNormalized ?? pending.location,
      source: 'user',
    })
    emergencyId = String(emergency._id)

    console.log(`[Report OTP] Emergency created: ${emergencyId} (urgency: ${urgency})`)

    await AgentLog.create({
      action: 'EMERGENCY_SUBMITTED',
      details: `${pending.reporterName} submitted ${pending.emergencyType} emergency at ${pending.location} (OTP verified). Urgency: ${urgency.toUpperCase()}. Reason: ${urgencyReason}`,
      relatedIds: [emergencyId],
    })

    // Auto-dispatch
    console.log(`[Report OTP] Starting auto-dispatch for ${emergencyId}...`)
    const dispatch = await dispatchEmergency(emergencyId)
    console.log(`[Report OTP] Dispatch complete in ${Date.now() - startTime}ms — status: ${dispatch.missionStatus}`)

    // Clean up pending record
    await PendingReport.findByIdAndDelete(body.sessionId)

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
        status: dispatch.volunteer ? 'assigned' : 'pending',
        createdAt: emergency.createdAt,
      },
      dispatch,
      message: dispatch.volunteer
        ? `Emergency submitted. ${dispatch.missionStatus === 'active' ? 'Mission created and team dispatched.' : 'Mission created.'}`
        : `Emergency submitted. ${dispatch.noMatchReason ?? 'No available volunteers — request queued.'}`,
    }, { status: 201 })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[Report OTP] Error${emergencyId ? ` after creating ${emergencyId}` : ''}: ${msg}`)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
