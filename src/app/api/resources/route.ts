import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { isDbConnectionError, dbOfflineResponse } from '@/lib/db-error'
import Resource from '@/models/Resource'
import AgentLog from '@/models/AgentLog'
import { autoReassignPending } from '@/lib/auto-reassign'
import { validateLocation, isLocationTooVague } from '@/lib/location-validator'

export async function GET() {
  try {
    await connectDB()
    const resources = await Resource.find().sort({ createdAt: -1 }).lean()
    return NextResponse.json(resources)
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
    const location = String(body.location ?? '').trim()
    if (!location) {
      return NextResponse.json({ error: 'Depot location is required.' }, { status: 400 })
    }

    const hasGPS = typeof body.latitude === 'number' && typeof body.longitude === 'number'
    let storedLat: number | undefined = hasGPS ? (body.latitude as number) : undefined
    let storedLng: number | undefined = hasGPS ? (body.longitude as number) : undefined

    if (!hasGPS) {
      if (isLocationTooVague(location)) {
        return NextResponse.json(
          { error: 'Depot location is too broad. Please provide a specific area or landmark (e.g. Edhi Foundation Clifton, not just Karachi).' },
          { status: 400 }
        )
      }
      const locResult = await validateLocation(location)
      if (!locResult.valid) {
        return NextResponse.json(
          { error: locResult.reason ?? 'Please enter a valid depot location.' },
          { status: 400 }
        )
      }
      storedLat = locResult.lat
      storedLng = locResult.lng
    }

    const resource = await Resource.create({
      ...body,
      latitude: storedLat,
      longitude: storedLng,
      locationPrecision: hasGPS ? 'exact' : 'area',
      locationVerified: true,
      dispatchEligible: true,
    })

    await AgentLog.create({
      action: 'RESOURCE_ADDED',
      details: `New resource added: ${resource.quantity} units of ${resource.resourceType} at ${resource.location}. Triggering auto-reassign.`,
      relatedIds: [String(resource._id)],
    })
    autoReassignPending('resource-added').catch((err) =>
      console.error('[POST /api/resources] Auto-reassign error:', String(err))
    )

    return NextResponse.json(resource.toObject(), { status: 201 })
  } catch (error) {
    if (isDbConnectionError(error)) return dbOfflineResponse()
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
