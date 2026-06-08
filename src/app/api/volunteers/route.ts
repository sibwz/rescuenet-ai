import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Volunteer from '@/models/Volunteer'

export async function GET() {
  try {
    await connectDB()
    const volunteers = await Volunteer.find().sort({ createdAt: -1 }).lean()
    return NextResponse.json(volunteers)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await connectDB()
    const body = await request.json()
    const volunteer = await Volunteer.create(body)
    return NextResponse.json(volunteer, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}