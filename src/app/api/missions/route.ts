import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { isDbConnectionError, dbOfflineResponse } from '@/lib/db-error'
import Mission from '@/models/Mission'

export async function GET() {
  try {
    await connectDB()
    const missions = await Mission.find()
      .populate('emergencyRequestId')
      .populate('volunteerId')
      .populate('resourceId')
      .sort({ createdAt: -1 })
      .lean()
    return NextResponse.json(missions)
  } catch (error) {
    if (isDbConnectionError(error)) return dbOfflineResponse()
    return NextResponse.json({ error: 'Failed to fetch missions' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await connectDB()
    const body = await request.json()
    const mission = await Mission.create(body)
    const populated = await Mission.findById(mission._id)
      .populate('emergencyRequestId')
      .populate('volunteerId')
      .populate('resourceId')
      .lean()
    return NextResponse.json(populated, { status: 201 })
  } catch (error) {
    if (isDbConnectionError(error)) return dbOfflineResponse()
    return NextResponse.json({ error: 'Failed to create mission' }, { status: 500 })
  }
}