import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import PendingReport from '@/models/PendingReport'
import { validateLocation } from '@/lib/location-validator'
import type { LocationValidationResult } from '@/lib/location-validator'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    await connectDB()
    const body = await request.json() as {
      reporterName?: string
      phone?: string
      location?: string
      emergencyType?: string
      peopleAffected?: number
      description?: string
      lat?: number
      lng?: number
    }

    const { reporterName, phone, location, emergencyType, peopleAffected, description } = body

    if (!reporterName || !location || !emergencyType || !description || !peopleAffected) {
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 })
    }

    // Validate location before creating anything
    let locResult: LocationValidationResult

    if (typeof body.lat === 'number' && typeof body.lng === 'number') {
      locResult = {
        valid: true,
        lat: body.lat,
        lng: body.lng,
        normalizedAddress: location,
        confidence: 'high',
        method: 'gps',
      }
    } else {
      locResult = await validateLocation(location)
      if (!locResult.valid) {
        return NextResponse.json(
          { error: 'Please enter a valid emergency location.', detail: locResult.reason },
          { status: 400 }
        )
      }
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000))
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 min

    const pending = await PendingReport.create({
      reporterName,
      phone: phone ?? '',
      location,
      emergencyType,
      peopleAffected: Number(peopleAffected),
      description,
      lat: locResult.lat,
      lng: locResult.lng,
      locationNormalized: locResult.normalizedAddress ?? location,
      otpCode: otp,
      verified: false,
      expiresAt,
    })

    console.log(`[Report OTP] Reporter: ${reporterName}, Location: ${location} — OTP: ${otp}`)

    return NextResponse.json({
      success: true,
      sessionId: String(pending._id),
      message: 'Verification code sent.',
      devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
