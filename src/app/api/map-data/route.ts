import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import EmergencyRequest from '@/models/EmergencyRequest'
import Volunteer from '@/models/Volunteer'
import Resource from '@/models/Resource'
import Mission from '@/models/Mission'

export const dynamic = 'force-dynamic'

// Pakistani city coordinates for realistic emergency response simulation
const LOCATION_COORDS: Record<string, [number, number]> = {
  // Lahore
  'lahore': [31.5497, 74.3436],
  'mall road': [31.5543, 74.3572],
  'mall road lahore': [31.5543, 74.3572],
  'gulberg': [31.5176, 74.3419],
  'gulberg lahore': [31.5176, 74.3419],
  'model town': [31.4807, 74.3288],
  'model town lahore': [31.4807, 74.3288],
  'johar town': [31.4658, 74.2756],
  'dha lahore': [31.4639, 74.3936],
  'dha phase 5': [31.4639, 74.3936],
  'walled city': [31.5830, 74.3291],
  'old lahore': [31.5830, 74.3291],
  'liberty market': [31.5204, 74.3351],
  'shadman': [31.5317, 74.3261],
  'township': [31.4790, 74.2987],
  'iqbal town': [31.4965, 74.3503],
  'faisal town': [31.4714, 74.3197],
  'allama iqbal town': [31.4965, 74.3503],

  // Karachi
  'karachi': [24.8607, 67.0011],
  'clifton': [24.8224, 67.0344],
  'saddar': [24.8607, 67.0011],
  'saddar karachi': [24.8607, 67.0011],
  'gulshan': [24.9195, 67.0994],
  'gulshan-e-iqbal': [24.9195, 67.0994],
  'korangi': [24.8157, 67.1238],
  'defence karachi': [24.8007, 67.0761],
  'dha karachi': [24.8007, 67.0761],
  'north karachi': [24.9627, 67.0615],
  'federal b area': [24.9311, 67.0636],
  'orangi town': [24.9436, 66.9950],
  'lyari': [24.8638, 66.9820],
  'malir': [24.8920, 67.2093],

  // Islamabad
  'islamabad': [33.6844, 73.0479],
  'f-7': [33.7173, 73.0551],
  'f-8': [33.7089, 73.0449],
  'f-6': [33.7291, 73.0666],
  'g-9': [33.6938, 73.0251],
  'g-10': [33.6812, 73.0174],
  'i-8': [33.6667, 73.0817],
  'i-10': [33.6521, 73.0629],
  'blue area': [33.7286, 73.0937],
  'margalla hills': [33.7498, 73.0764],
  'bahria town islamabad': [33.5355, 73.1044],

  // Peshawar
  'peshawar': [34.0151, 71.5249],
  'hayatabad': [34.0088, 71.4609],
  'university town': [34.0200, 71.4715],
  'peshawar cantonment': [34.0151, 71.5249],
  'cantonment peshawar': [34.0151, 71.5249],
  'board bazaar': [34.0107, 71.5710],
  'saddar peshawar': [34.0145, 71.5771],
  'nowshera': [34.0154, 71.9832],

  // Rawalpindi
  'rawalpindi': [33.6007, 73.0679],
  'saddar rawalpindi': [33.6007, 73.0679],
  'murree road': [33.6284, 73.0764],
  'bahria town rawalpindi': [33.5355, 73.1044],

  // Other cities
  'faisalabad': [31.4504, 73.1350],
  'multan': [30.1575, 71.5249],
  'quetta': [30.1798, 66.9750],
  'hyderabad': [25.3960, 68.3578],
  'gujranwala': [32.1877, 74.1945],
  'sialkot': [32.4945, 74.5229],
  'abbottabad': [34.1688, 73.2215],
  'mansehra': [34.3317, 73.1971],
  'swat': [35.2227, 72.4258],
  'chitral': [35.8511, 71.7864],

  // Legacy generic locations (kept for backward compatibility)
  'downtown district': [31.5543, 74.3572],
  'riverside': [24.8638, 67.0011],
  'northern hills': [33.7498, 73.0764],
  'coastal road': [24.8224, 67.0344],
  'east side': [31.5176, 74.3419],
  'south market': [24.8607, 67.0011],
  'central park': [33.7173, 73.0551],
  'port district': [24.8157, 67.1238],
  'metro center': [31.5497, 74.3436],
}

// Center of Pakistan for fallback hashing
const PK_CENTER: [number, number] = [30.3753, 69.3451]

function hashLocation(str: string): [number, number] {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = (h * 33) ^ str.charCodeAt(i)
    h = h & h
  }
  const latOffset = ((Math.abs(h) % 600) - 300) / 100
  const lngOffset = ((Math.abs(h >> 8) % 600) - 300) / 100
  return [PK_CENTER[0] + latOffset, PK_CENTER[1] + lngOffset]
}

function getCoordinates(location: string): [number, number] {
  const lower = location.toLowerCase().trim()
  for (const [key, coords] of Object.entries(LOCATION_COORDS)) {
    if (lower.includes(key)) return coords
  }
  return hashLocation(location)
}

export async function GET() {
  try {
    await connectDB()

    const [emergencies, volunteers, resources, missions] = await Promise.all([
      EmergencyRequest.find().sort({ createdAt: -1 }).lean(),
      Volunteer.find().lean(),
      Resource.find().lean(),
      Mission.find({ status: 'active' })
        .populate('emergencyRequestId')
        .populate('volunteerId')
        .lean(),
    ])

    const mappedEmergencies = emergencies.map((e) => ({
      ...e,
      _id: String(e._id),
      coords: getCoordinates(e.location),
    }))

    const mappedVolunteers = volunteers.map((v) => ({
      ...v,
      _id: String(v._id),
      coords: getCoordinates(v.location),
    }))

    const mappedResources = resources.map((r) => ({
      ...r,
      _id: String(r._id),
      coords: getCoordinates(r.location),
    }))

    const mappedMissions = missions.map((m) => ({
      ...m,
      _id: String(m._id),
    }))

    return NextResponse.json({
      emergencies: mappedEmergencies,
      volunteers: mappedVolunteers,
      resources: mappedResources,
      missions: mappedMissions,
      stats: {
        totalEmergencies: emergencies.length,
        criticalEmergencies: emergencies.filter((e) => e.urgency === 'critical').length,
        availableVolunteers: volunteers.filter((v) => v.status === 'available').length,
        availableResources: resources.filter((r) => r.status === 'available').length,
        activeMissions: missions.length,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}