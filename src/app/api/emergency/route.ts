import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import EmergencyRequest from '@/models/EmergencyRequest'

export async function GET() {
  try {
    await connectDB()
    const requests = await EmergencyRequest.find().sort({ createdAt: -1 }).lean()
    return NextResponse.json(requests)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await connectDB()
    const body = await request.json()
    const emergencyRequest = await EmergencyRequest.create(body)
    return NextResponse.json(emergencyRequest, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}