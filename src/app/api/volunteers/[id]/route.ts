import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Volunteer from '@/models/Volunteer'

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB()
    const body = await request.json()
    const updated = await Volunteer.findByIdAndUpdate(params.id, body, { new: true })
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB()
    await Volunteer.findByIdAndDelete(params.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}