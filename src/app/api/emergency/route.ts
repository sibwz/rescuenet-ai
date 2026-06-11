import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { isDbConnectionError, dbOfflineResponse } from '@/lib/db-error'
import EmergencyRequest from '@/models/EmergencyRequest'
import Mission from '@/models/Mission'
import Volunteer from '@/models/Volunteer'
import { dispatchEmergency } from '@/lib/dispatch'
import { validateLocation, validateGPSLocation, isLocationTooVague } from '@/lib/location-validator'
import { computeETAMinutes } from '@/lib/eta'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await connectDB()
    const requests = await EmergencyRequest.find().sort({ createdAt: -1 }).lean()

    // Enrich assigned requests with volunteer name + resource + ETA
    const assignedReqs = requests.filter(
      (r) => r.status === 'assigned' && r.assignedMissionId
    )

    let missionMap: Record<string, Record<string, unknown>> = {}
    let volunteerMap: Record<string, { name: string; location: string }> = {}

    if (assignedReqs.length > 0) {
      const missionIds = assignedReqs.map((r) => r.assignedMissionId!)
      const missions = await Mission.find({ _id: { $in: missionIds } })
        .populate('resourceId', 'resourceType quantity')
        .lean()
      missionMap = Object.fromEntries(missions.map((m) => [String(m._id), m as Record<string, unknown>]))

      const volunteerIds = assignedReqs
        .map((r) => r.assignedVolunteerId)
        .filter(Boolean) as string[]
      if (volunteerIds.length > 0) {
        const vols = await Volunteer.find({ _id: { $in: volunteerIds } })
          .select('name location')
          .lean()
        volunteerMap = Object.fromEntries(vols.map((v) => [String(v._id), { name: v.name, location: v.location }]))
      }
    }

    const enriched = requests.map((req) => {
      if (req.status !== 'assigned' || !req.assignedMissionId) return req
      const mission = missionMap[req.assignedMissionId]
      const vol = req.assignedVolunteerId ? volunteerMap[req.assignedVolunteerId] : null
      const resource = mission?.resourceId as { resourceType?: string; quantity?: number } | null
      const etaMin = computeETAMinutes(req.urgency, req.peopleAffected)
      return {
        ...req,
        assignedVolunteerName: vol?.name ?? req.assignedVolunteerName ?? null,
        assignedVolunteerLocation: vol?.location ?? null,
        assignedResourceType: resource?.resourceType ?? null,
        assignedResourceQty: resource?.quantity ?? null,
        estimatedETA: `${etaMin} min`,
      }
    })

    return NextResponse.json(enriched)
  } catch (error) {
    if (isDbConnectionError(error)) return dbOfflineResponse()
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await connectDB()
    const body = await request.json() as Record<string, unknown>
    const location = String(body.location ?? '')

    console.log(`[Emergency API] New request — type=${body.emergencyType}, location=${location}, urgency=${body.urgency}`)

    // Parse GPS coordinates if provided by the browser
    const rawLat = body.lat
    const rawLng = body.lng
    const providedLat = typeof rawLat === 'number' ? rawLat : (rawLat != null && !isNaN(Number(rawLat)) ? Number(rawLat) : undefined)
    const providedLng = typeof rawLng === 'number' ? rawLng : (rawLng != null && !isNaN(Number(rawLng)) ? Number(rawLng) : undefined)
    const hasGPS = providedLat !== undefined && providedLng !== undefined

    let locResult: Awaited<ReturnType<typeof validateLocation>>
    if (hasGPS) {
      console.log(`[Emergency API] GPS coordinates provided (${providedLat}, ${providedLng})`)
      locResult = validateGPSLocation(providedLat!, providedLng!, location)
    } else {
      const result = await validateLocation(location)
      if (!result.valid) {
        console.log(`[Emergency API] Location rejected: "${location}" — ${result.reason}`)
        return NextResponse.json(
          { error: result.reason ?? 'Please enter a valid emergency location.', detail: result.reason },
          { status: 400 }
        )
      }
      if (isLocationTooVague(location)) {
        console.log(`[Emergency API] Location too broad: "${location}"`)
        return NextResponse.json(
          { error: 'Location is too broad. Please provide a specific area or landmark (e.g. DHA Lahore, F-7 Islamabad).' },
          { status: 400 }
        )
      }
      locResult = result
    }

    // Create the emergency record with validated coordinates
    const emergencyRequest = await EmergencyRequest.create({
      ...body,
      status: 'pending',
      locationValidated: true,
      latitude: locResult.lat,
      longitude: locResult.lng,
      locationNormalized: locResult.normalizedAddress ?? location,
      dispatchRegion: locResult.dispatchRegion ?? null,
      validationStatus: locResult.validationStatus ?? null,
    })
    const emergencyId = String(emergencyRequest._id)
    console.log(`[Emergency API] Emergency created: ${emergencyId}`)

    // Auto-dispatch
    console.log(`[Emergency API] Starting auto-dispatch for ${emergencyId}...`)
    const dispatch = await dispatchEmergency(emergencyId)

    if (dispatch.volunteer) {
      console.log(`[Emergency API] Dispatch SUCCESS — volunteer: ${dispatch.volunteer.name}, mission: ${dispatch.missionId}`)
    } else {
      console.log(`[Emergency API] Dispatch — no volunteer assigned. Reason: ${dispatch.noMatchReason ?? 'unknown'}`)
    }

    return NextResponse.json({
      ...emergencyRequest.toObject(),
      status: dispatch.volunteer ? 'assigned' : 'pending',
      dispatch,
    }, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`[Emergency API] Error: ${msg}`)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
