import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Resource from '@/models/Resource'

export async function GET() {
  try {
    await connectDB()
    const resources = await Resource.find().sort({ createdAt: -1 }).lean()
    return NextResponse.json(resources)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await connectDB()
    const body = await request.json()
    const resource = await Resource.create(body)
    return NextResponse.json(resource, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}