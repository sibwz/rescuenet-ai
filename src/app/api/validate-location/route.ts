import { NextResponse } from 'next/server'
import { validateLocation, isLocationTooVague } from '@/lib/location-validator'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json() as { location?: string }
    const location = body.location?.trim() ?? ''

    if (!location) {
      return NextResponse.json({ valid: false, tooVague: false, reason: 'Location is required.' })
    }

    const result = await validateLocation(location)
    const tooVague = result.valid && isLocationTooVague(location)

    return NextResponse.json({ ...result, tooVague })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ valid: false, tooVague: false, reason: `Validation error: ${msg}` }, { status: 500 })
  }
}
