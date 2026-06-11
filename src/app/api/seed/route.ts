import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { isDbConnectionError, dbOfflineResponse } from '@/lib/db-error'
import EmergencyRequest from '@/models/EmergencyRequest'
import Volunteer from '@/models/Volunteer'
import Resource from '@/models/Resource'
import Mission from '@/models/Mission'
import AgentLog from '@/models/AgentLog'

const seedEmergencies = [
  {
    reporterName: 'Sarah Johnson',
    location: 'Downtown District, Block 7',
    emergencyType: 'medical',
    description: 'Multiple casualties from building collapse. Require immediate medical attention and extraction.',
    urgency: 'critical',
    peopleAffected: 12,
    status: 'pending',
  },
  {
    reporterName: 'Mike Torres',
    location: 'Riverside Camp, Sector A',
    emergencyType: 'food',
    description: 'Flood displaced families have been without food for 2 days. Urgent food distribution needed.',
    urgency: 'high',
    peopleAffected: 45,
    status: 'pending',
  },
  {
    reporterName: 'Aisha Patel',
    location: 'Northern Hills, Zone 3',
    emergencyType: 'water',
    description: 'Water supply contaminated. Entire neighborhood relying on unsafe water sources.',
    urgency: 'high',
    peopleAffected: 200,
    status: 'pending',
  },
  {
    reporterName: 'Carlos Rivera',
    location: 'East Side Community Center',
    emergencyType: 'shelter',
    description: 'Families displaced by wildfire are sleeping outdoors. Need shelter kits immediately.',
    urgency: 'medium',
    peopleAffected: 30,
    status: 'assigned',
  },
  {
    reporterName: 'Linda Chen',
    location: 'Coastal Road, Marker 12',
    emergencyType: 'evacuation',
    description: 'Elderly residents stranded due to road flooding. Need vehicle evacuation.',
    urgency: 'critical',
    peopleAffected: 8,
    status: 'pending',
  },
  {
    reporterName: 'James Williams',
    location: 'South Market District',
    emergencyType: 'food',
    description: 'Community shelter running out of food supplies for overnight guests.',
    urgency: 'low',
    peopleAffected: 60,
    status: 'pending',
  },
]

const seedVolunteers = [
  {
    name: 'Dr. Emily Carter',
    phone: '+1-555-0101',
    email: 'emily.carter@medvolunteer.org',
    location: 'Downtown District',
    skills: ['medical', 'logistics'],
    hasVehicle: true,
    status: 'available',
  },
  {
    name: 'Marcus Johnson',
    phone: '+1-555-0102',
    email: 'marcus.j@rescuecorps.net',
    location: 'Riverside Camp',
    skills: ['rescue', 'transport'],
    hasVehicle: true,
    status: 'available',
  },
  {
    name: 'Priya Sharma',
    phone: '+1-555-0103',
    email: 'priya.s@airelief.org',
    location: 'Northern Hills',
    skills: ['food_distribution', 'logistics'],
    hasVehicle: false,
    status: 'available',
  },
  {
    name: 'Tom Bradley',
    phone: '+1-555-0104',
    email: 'tom.bradley@volunteer.com',
    location: 'East Side',
    skills: ['rescue', 'logistics'],
    hasVehicle: true,
    status: 'busy',
  },
  {
    name: 'Angela Wu',
    phone: '+1-555-0105',
    email: 'angela.wu@medteam.org',
    location: 'Coastal Road',
    skills: ['medical', 'transport'],
    hasVehicle: true,
    status: 'available',
  },
  {
    name: 'David Nguyen',
    phone: '+1-555-0106',
    email: 'd.nguyen@commserve.org',
    location: 'South Market',
    skills: ['food_distribution', 'logistics'],
    hasVehicle: false,
    status: 'available',
  },
  {
    name: 'Rachel Foster',
    phone: '+1-555-0107',
    email: 'r.foster@rescuenet.org',
    location: 'Downtown District',
    skills: ['rescue', 'medical'],
    hasVehicle: true,
    status: 'offline',
  },
]

const seedResources = [
  {
    resourceType: 'medicine',
    quantity: 500,
    location: 'Downtown District Medical Depot',
    status: 'available',
  },
  {
    resourceType: 'food',
    quantity: 2000,
    location: 'Riverside Distribution Center',
    status: 'available',
  },
  {
    resourceType: 'water',
    quantity: 5000,
    location: 'Northern Hills Supply Hub',
    status: 'available',
  },
  {
    resourceType: 'shelter_kits',
    quantity: 75,
    location: 'East Side Warehouse',
    status: 'assigned',
  },
  {
    resourceType: 'vehicles',
    quantity: 12,
    location: 'Coastal Road Depot',
    status: 'available',
  },
  {
    resourceType: 'food',
    quantity: 800,
    location: 'South Market Storage',
    status: 'available',
  },
  {
    resourceType: 'medicine',
    quantity: 150,
    location: 'Northern Hills Clinic',
    status: 'available',
  },
  {
    resourceType: 'water',
    quantity: 1000,
    location: 'Downtown District Tank',
    status: 'depleted',
  },
]

export async function POST() {
  if (!process.env.MONGODB_URI) {
    return NextResponse.json(
      { error: 'MONGODB_URI is not set. Add it to .env.local and restart the dev server.' },
      { status: 503 }
    )
  }

  try {
    await connectDB()

    // Clear all existing data first
    await Promise.all([
      EmergencyRequest.deleteMany({}),
      Volunteer.deleteMany({}),
      Resource.deleteMany({}),
      Mission.deleteMany({}),
      AgentLog.deleteMany({}),
    ])

    // Insert seed data sequentially so counts are reliable
    const emergencies = await EmergencyRequest.insertMany(seedEmergencies)
    const volunteers = await Volunteer.insertMany(seedVolunteers)
    const resources = await Resource.insertMany(seedResources)

    const eCnt = emergencies.length
    const vCnt = volunteers.length
    const rCnt = resources.length

    await AgentLog.create({
      action: 'SEED_DATA',
      details: `Database seeded with ${eCnt} emergencies, ${vCnt} volunteers, ${rCnt} resources.`,
      relatedIds: [],
    })

    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully',
      counts: {
        emergencies: eCnt,
        volunteers: vCnt,
        resources: rCnt,
      },
    })
  } catch (error) {
    if (isDbConnectionError(error)) return dbOfflineResponse()
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Seed error:', msg)
    return NextResponse.json(
      { error: `Seed failed: ${msg}` },
      { status: 500 }
    )
  }
}