import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Volunteer from '@/models/Volunteer'
import AgentLog from '@/models/AgentLog'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    await connectDB()
    const body = await request.json() as { volunteerId: string; otp: string }

    const vol = await Volunteer.findById(body.volunteerId)
    if (!vol) return NextResponse.json({ error: 'Volunteer not found.' }, { status: 404 })
    if (vol.verifiedEmail) return NextResponse.json({ error: 'Email already verified.' }, { status: 400 })

    if (!vol.otpCode || !vol.otpExpiry) {
      return NextResponse.json({ error: 'No OTP found. Please request a new one.' }, { status: 400 })
    }
    if (new Date() > vol.otpExpiry) {
      return NextResponse.json({ error: 'OTP expired. Please request a new one.' }, { status: 400 })
    }
    if (vol.otpCode !== body.otp.trim()) {
      return NextResponse.json({ error: 'Incorrect OTP. Please check and try again.' }, { status: 400 })
    }

    vol.verifiedEmail = true
    vol.approved = false
    vol.status = 'pending_approval'
    vol.otpCode = undefined
    vol.otpExpiry = undefined
    await vol.save()

    await AgentLog.create({
      action: 'VOLUNTEER_EMAIL_VERIFIED',
      details: `${vol.name} (${vol.email}) verified their email. Status: pending_approval. Awaiting coordinator review.`,
      relatedIds: [String(vol._id)],
    })

    return NextResponse.json({
      success: true,
      message: 'Email verified. Your registration is pending coordinator approval.',
      status: 'pending_approval',
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
