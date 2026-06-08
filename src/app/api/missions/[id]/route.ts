import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Mission from '@/models/Mission'
import EmergencyRequest from '@/models/EmergencyRequest'
import Volunteer from '@/models/Volunteer'
import Resource from '@/models/Resource'

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB()
    const body = await request.json()
    const mission = await Mission.findById(params.id)
    if (!mission) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // When mission completes, update related records
    if (body.status === 'completed') {
      await EmergencyRequest.findByIdAndUpdate(mission.emergencyRequestId, { status: 'completed' })
      await Volunteer.findByIdAndUpdate(mission.volunteerId, { status: 'available' })
      await Resource.findByIdAndUpdate(mission.resourceId, { status: 'depleted' })
    }

    if (body.status === 'cancelled') {
      await EmergencyRequest.findByIdAndUpdate(mission.emergencyRequestId, { status: 'pending' })
      await Volunteer.findByIdAndUpdate(mission.volunteerId, { status: 'available' })
      await Resource.findByIdAndUpdate(mission.resourceId, { status: 'available' })
    }

    const updated = await Mission.findByIdAndUpdate(params.id, body, { new: true })
      .populate('emergencyRequestId')
      .populate('volunteerId')
      .populate('resourceId')
      .lean()

    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update mission' }, { status: 500 })
  }
}