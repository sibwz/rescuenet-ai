import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import EmergencyRequest from '@/models/EmergencyRequest'
import AgentLog from '@/models/AgentLog'
import { classifyEmergencyUrgency } from '@/lib/gemini'
import { dispatchEmergency } from '@/lib/dispatch'
import { validateLocation, validateGPSLocation, isLocationTooVague } from '@/lib/location-validator'
import type { LocationValidationResult } from '@/lib/location-validator'

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
      lat?: number
      lng?: number
    }

    const { reporterName, phone, location, emergencyType, peopleAffected, description } = body

    if (!reporterName || !location || !emergencyType || !description || !peopleAffected) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    console.log(`[Report] New submission — ${emergencyType} at ${location} by ${reporterName}`)

    // ── Step 0: Validate location BEFORE creating anything ──────────────
    let locResult: LocationValidationResult

    if (typeof body.lat === 'number' && typeof body.lng === 'number') {
      console.log(`[Report] GPS coordinates provided: ${body.lat}, ${body.lng}`)
      locResult = validateGPSLocation(body.lat, body.lng, location)
    } else {
      if (isLocationTooVague(location)) {
        console.log(`[Report] Location too broad: "${location}"`)
        return NextResponse.json(
          { error: 'Location is too broad. Please provide a specific area or landmark (e.g. DHA Lahore, F-7 Islamabad).' },
          { status: 400 }
        )
      }
      console.log('[Report] Validating location text...')
      locResult = await validateLocation(location)
      if (!locResult.valid) {
        console.log(`[Report] Location rejected: "${location}" — ${locResult.reason}`)
        return NextResponse.json(
          { error: locResult.reason ?? 'Please enter a valid emergency location.', detail: locResult.reason },
          { status: 400 }
        )
      }
      console.log(`[Report] Location verified: ${locResult.normalizedAddress ?? location}`)
    }

    // ── Step 1: AI urgency classification ────────────────────────────────
    console.log('[Report] Classifying urgency with Gemini...')
    const { urgency, urgencyReason } = await classifyEmergencyUrgency(
      description,
      emergencyType,
      Number(peopleAffected)
    )
    console.log(`[Report] Urgency classified: ${urgency.toUpperCase()} — ${urgencyReason}`)

    // ── Step 2: Persist emergency (with validated coordinates) ───────────
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
      locationValidated: true,
      latitude: locResult.lat,
      longitude: locResult.lng,
      locationNormalized: locResult.normalizedAddress ?? location,
      dispatchRegion: locResult.dispatchRegion ?? null,
      validationStatus: locResult.validationStatus ?? null,
    })
    emergencyId = String(emergency._id)

    console.log(`[Report] Emergency created: ${emergencyId}`)

    await AgentLog.create({
      action: 'EMERGENCY_SUBMITTED',
      details: `[Step 1] ${reporterName} submitted ${emergencyType} emergency at ${location}. Location: ${locResult.normalizedAddress ?? location} (${locResult.method ?? 'unknown'}). Urgency: ${urgency.toUpperCase()}. Reason: ${urgencyReason}`,
      relatedIds: [emergencyId],
    })

    // ── Step 3: Auto-dispatch ────────────────────────────────────────────
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
        status: dispatch.volunteer ? 'assigned' : 'pending',
        createdAt: emergency.createdAt,
      },
      dispatch,
      message: dispatch.volunteer
        ? `Emergency submitted. ${dispatch.missionStatus === 'active' ? 'Mission created and team dispatched.' : 'Mission created — resource shortage flagged.'}`
        : `Emergency submitted. ${dispatch.noMatchReason ?? 'No available volunteers — request queued as pending.'}`,
    }, { status: 201 })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[Report] Fatal error${emergencyId ? ` after creating ${emergencyId}` : ''}: ${msg}`)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
