import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Volunteer from '@/models/Volunteer'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    await connectDB()
    const body = await request.json() as { volunteerId?: string; email?: string }

    const vol = body.volunteerId
      ? await Volunteer.findById(body.volunteerId)
      : await Volunteer.findOne({ email: body.email?.toLowerCase() })

    if (!vol) return NextResponse.json({ error: 'Volunteer not found.' }, { status: 404 })
    if (vol.verifiedEmail) return NextResponse.json({ error: 'Email already verified.' }, { status: 400 })

    const otp = String(Math.floor(100000 + Math.random() * 900000))
    const expiry = new Date(Date.now() + 10 * 60 * 1000) // 10 min

    vol.otpCode = otp
    vol.otpExpiry = expiry
    await vol.save()

    // In production: send via email service. For dev/demo: return OTP directly.
    console.log(`[OTP] Volunteer ${vol.name} (${vol.email}) — OTP: ${otp}`)

    return NextResponse.json({
      success: true,
      message: `OTP sent to ${vol.email}`,
      volunteerId: String(vol._id),
      // Return OTP in response for hackathon demo (remove in production)
      devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined,
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
