import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { isDbConnectionError, dbOfflineResponse } from '@/lib/db-error'
import Volunteer from '@/models/Volunteer'
import AgentLog from '@/models/AgentLog'
import { validateLocation, isLocationTooVague } from '@/lib/location-validator'

export async function GET() {
  try {
    await connectDB()

    const volunteers = await Volunteer.find()
      .sort({ createdAt: -1 })
      .populate({
        path: 'currentMissionId',
        populate: [
          { path: 'emergencyRequestId', select: 'location emergencyType urgency peopleAffected reporterName' },
          { path: 'resourceId', select: 'resourceType quantity location' },
        ],
      })
      .lean()

    // Reshape: expose currentMission as a clean separate field alongside the original ID
    const enriched = volunteers.map((v) => {
      const vol = v as Record<string, unknown>
      const rawMission = vol.currentMissionId

      let currentMission: Record<string, unknown> | null = null
      if (rawMission && typeof rawMission === 'object' && '_id' in (rawMission as object)) {
        const m = rawMission as Record<string, unknown>
        currentMission = {
          _id: String(m._id),
          status: m.status,
          volunteerConfidence: m.volunteerConfidence,
          missionSuccessProbability: m.missionSuccessProbability,
          emergencyRequest: m.emergencyRequestId as Record<string, unknown> | null,
          resource: m.resourceId as Record<string, unknown> | null,
        }
      }

      return { ...vol, currentMission }
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
    const body = await request.json() as {
      name?: string; phone?: string; email?: string; location?: string
      lat?: number; lng?: number; skills?: string[]; hasVehicle?: boolean; status?: string
    }

    const location = String(body.location ?? '').trim()
    if (!location) return NextResponse.json({ error: 'Volunteer location is required.' }, { status: 400 })

    const emailRaw = String(body.email ?? '').trim().toLowerCase()
    if (!emailRaw) return NextResponse.json({ error: 'Email is required.' }, { status: 400 })

    // Check for duplicate email
    const existing = await Volunteer.findOne({ email: emailRaw })
    if (existing) {
      if (existing.verifiedEmail) {
        return NextResponse.json({ error: 'A volunteer with this email is already registered.' }, { status: 400 })
      }
      // Re-use unverified record: regenerate OTP
      const otp = String(Math.floor(100000 + Math.random() * 900000))
      existing.otpCode = otp
      existing.otpExpiry = new Date(Date.now() + 10 * 60 * 1000)
      await existing.save()
      console.log(`[OTP] Resent OTP for ${existing.name} (${existing.email}): ${otp}`)
      return NextResponse.json({
        success: true,
        volunteerId: String(existing._id),
        message: 'OTP resent to your email.',
        devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined,
      }, { status: 200 })
    }

    let lat: number | undefined = body.lat
    let lng: number | undefined = body.lng
    let locationValidated = false
    let locationPrecision: 'exact' | 'area' | 'city_only' = 'area'

    if (typeof lat === 'number' && typeof lng === 'number') {
      locationValidated = true
      locationPrecision = 'exact'
    } else {
      if (isLocationTooVague(location)) {
        return NextResponse.json(
          { error: 'Location is too broad. Please provide a specific area or neighborhood (e.g. Johar Town Lahore, not just Lahore).' },
          { status: 400 }
        )
      }
      const locResult = await validateLocation(location)
      if (!locResult.valid) {
        return NextResponse.json(
          { error: 'Please enter a valid volunteer location.', detail: locResult.reason },
          { status: 400 }
        )
      }
      lat = locResult.lat
      lng = locResult.lng
      locationValidated = true
      locationPrecision = 'area'
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000))
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000)

    const volunteer = await Volunteer.create({
      name: body.name,
      phone: body.phone,
      email: emailRaw,
      location,
      skills: body.skills ?? [],
      hasVehicle: body.hasVehicle ?? false,
      latitude: lat,
      longitude: lng,
      locationValidated,
      locationPrecision,
      verifiedEmail: false,
      approved: false,
      source: 'user',
      status: 'unverified',
      otpCode: otp,
      otpExpiry,
    })

    console.log(`[OTP] New volunteer ${volunteer.name} (${volunteer.email}) — OTP: ${otp}`)

    await AgentLog.create({
      action: 'VOLUNTEER_REGISTERED',
      details: `${volunteer.name} registered as a volunteer in ${volunteer.location}. Awaiting email verification.`,
      relatedIds: [String(volunteer._id)],
    })

    return NextResponse.json({
      success: true,
      volunteerId: String(volunteer._id),
      message: 'OTP sent to your email. Please verify to complete registration.',
      devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined,
    }, { status: 201 })
  } catch (error) {
    if (isDbConnectionError(error)) return dbOfflineResponse()
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
