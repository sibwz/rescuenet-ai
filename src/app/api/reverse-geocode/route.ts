import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface NominatimReverseResponse {
  display_name?: string
  address?: {
    suburb?: string
    neighbourhood?: string
    residential?: string
    quarter?: string
    city?: string
    town?: string
    city_district?: string
    county?: string
    state?: string
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { lat?: number; lng?: number }
    const { lat, lng } = body

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json({ error: 'lat and lng are required numbers.' }, { status: 400 })
    }

    // Rough Pakistan bounding box
    if (lat < 23 || lat > 37.5 || lng < 60 || lng > 77.5) {
      return NextResponse.json({ error: 'Coordinates appear to be outside Pakistan.' }, { status: 400 })
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4000)

    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'RescueNet-AI/1.0 (hackathon@rescuenet.pk)' },
    })
    clearTimeout(timer)

    if (!res.ok) throw new Error('Nominatim reverse-geocode failed')

    const data = await res.json() as NominatimReverseResponse

    const addr = data.address ?? {}
    const area = addr.suburb ?? addr.neighbourhood ?? addr.residential ?? addr.quarter ?? addr.city_district ?? ''
    const city = addr.city ?? addr.town ?? addr.county ?? ''
    const parts = [area, city].filter(Boolean)

    const location =
      parts.length > 0
        ? parts.join(', ')
        : data.display_name?.split(',').slice(0, 2).join(',').trim() ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`

    return NextResponse.json({ location, lat, lng, fullAddress: data.display_name ?? '' })
  } catch {
    return NextResponse.json({ error: 'Could not reverse-geocode coordinates.' }, { status: 500 })
  }
}
