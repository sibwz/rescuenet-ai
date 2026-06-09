import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'

export const dynamic = 'force-dynamic'
import EmergencyRequest from '@/models/EmergencyRequest'
import Volunteer from '@/models/Volunteer'
import Resource from '@/models/Resource'
import Mission from '@/models/Mission'
import AgentLog from '@/models/AgentLog'

// ─── Original multi-disaster scenario (Pakistan) ─────────────────────────────
const demoEmergencies = [
  {
    reporterName: 'Dr. Ayesha Khan',
    location: 'Gulberg, Lahore',
    emergencyType: 'medical',
    description: 'Building collapse with multiple casualties. Victims trapped under rubble near Liberty Market. Immediate medical triage required.',
    urgency: 'critical',
    urgency_reason: 'Life-threatening structural collapse with trapped victims requiring immediate intervention.',
    peopleAffected: 12,
    status: 'pending',
  },
  {
    reporterName: 'Ali Raza',
    location: 'Orangi Town, Karachi',
    emergencyType: 'food',
    description: 'Flood-displaced families from Lyari have been without food for 48 hours. Children and elderly require urgent nutrition.',
    urgency: 'high',
    urgency_reason: 'Extended food deprivation affecting vulnerable populations including children and elderly.',
    peopleAffected: 45,
    status: 'pending',
  },
  {
    reporterName: 'Fatima Malik',
    location: 'G-9, Islamabad',
    emergencyType: 'water',
    description: 'Municipal water supply contaminated by monsoon flooding. Entire sector dependent on unsafe water sources.',
    urgency: 'high',
    urgency_reason: 'Contaminated water supply poses severe health risk to large population.',
    peopleAffected: 200,
    status: 'pending',
  },
  {
    reporterName: 'Zainab Ahmed',
    location: 'Clifton, Karachi',
    emergencyType: 'evacuation',
    description: 'Elderly and disabled residents stranded as rising floodwaters cut off Sea View road access. Vehicle evacuation urgent.',
    urgency: 'critical',
    urgency_reason: 'Immobile residents facing rising floodwaters with all escape routes cut off.',
    peopleAffected: 8,
    status: 'pending',
  },
  {
    reporterName: 'Usman Shah',
    location: 'Hayatabad, Peshawar',
    emergencyType: 'shelter',
    description: 'Families displaced from Phase 1 sleeping outdoors. Immediate shelter kits and warmth required in winter conditions.',
    urgency: 'medium',
    urgency_reason: 'Displaced families without shelter in adverse weather conditions.',
    peopleAffected: 30,
    status: 'pending',
  },
]

// ─── Flood Scenario ───────────────────────────────────────────────────────────
const floodEmergencies = [
  {
    reporterName: 'Emma Rodriguez',
    location: 'Riverside District, Block 3',
    emergencyType: 'evacuation',
    description: 'Flash flood has submerged ground floors. Families trapped on upper floors, no boat access. Water rising rapidly.',
    urgency: 'critical',
    urgency_reason: 'Rapidly rising floodwaters with families trapped on upper floors — imminent drowning risk.',
    peopleAffected: 24,
    status: 'pending',
  },
  {
    reporterName: 'Officer James Park',
    location: 'Waterfront Avenue, South End',
    emergencyType: 'medical',
    description: 'Two elderly residents with hypothermia from flood exposure. Require immediate medical attention and warmth.',
    urgency: 'critical',
    urgency_reason: 'Active hypothermia cases from flood exposure — life-threatening without immediate medical care.',
    peopleAffected: 2,
    status: 'pending',
  },
  {
    reporterName: 'Maria Santos',
    location: 'Flood Relief Camp Alpha',
    emergencyType: 'water',
    description: 'Camp water supply contaminated with floodwater runoff. 300 displaced residents at risk of waterborne disease.',
    urgency: 'high',
    urgency_reason: 'Large population at risk of cholera and dysentery from contaminated water supply.',
    peopleAffected: 300,
    status: 'pending',
  },
  {
    reporterName: 'Principal David Kim',
    location: 'Riverside Elementary School',
    emergencyType: 'shelter',
    description: 'School being used as emergency shelter — capacity exceeded. 120 families need additional shelter kits.',
    urgency: 'high',
    urgency_reason: 'Shelter capacity critically exceeded with families sleeping in hallways and classrooms.',
    peopleAffected: 120,
    status: 'pending',
  },
  {
    reporterName: 'NGO Worker Chen Wei',
    location: 'Riverside Market Square',
    emergencyType: 'food',
    description: 'Food distribution point overwhelmed. Supplies for only 50 families but 200+ displaced people waiting.',
    urgency: 'high',
    urgency_reason: 'Critical food shortage affecting four times more people than current supply capacity.',
    peopleAffected: 200,
    status: 'pending',
  },
]

// ─── Earthquake Scenario ──────────────────────────────────────────────────────
const earthquakeEmergencies = [
  {
    reporterName: 'Fire Chief Ahmed Hassan',
    location: 'Old Town District, Sector B',
    emergencyType: 'medical',
    description: 'Magnitude 6.2 earthquake. 4-story apartment building pancaked. Estimated 15 people trapped in rubble. USAR teams needed immediately.',
    urgency: 'critical',
    urgency_reason: 'Structural collapse with confirmed trapped survivors — survival window closing rapidly.',
    peopleAffected: 15,
    status: 'pending',
  },
  {
    reporterName: 'Dr. Priya Nair',
    location: 'City General Hospital — Emergency Bay',
    emergencyType: 'medical',
    description: 'Hospital overwhelmed with earthquake casualties. Running out of blood supply and surgical equipment. Triage overflow in parking lot.',
    urgency: 'critical',
    urgency_reason: 'Hospital at critical capacity with surgical supply shortage during mass casualty event.',
    peopleAffected: 60,
    status: 'pending',
  },
  {
    reporterName: 'Water Authority Supervisor',
    location: 'Metro Center Water Mains',
    emergencyType: 'water',
    description: 'Earthquake damaged main water distribution pipes. 40% of city without potable water. Possible contamination from ruptured sewage lines.',
    urgency: 'high',
    urgency_reason: 'City-wide water disruption with sewage contamination risk affecting tens of thousands.',
    peopleAffected: 5000,
    status: 'pending',
  },
  {
    reporterName: 'Community Leader Rosa Valdez',
    location: 'Highland Residential Zone',
    emergencyType: 'shelter',
    description: 'Approximately 80 families evacuated from unsafe buildings after structural damage assessment. Need temporary shelter.',
    urgency: 'medium',
    urgency_reason: 'Large number of families displaced from structurally compromised buildings.',
    peopleAffected: 80,
    status: 'pending',
  },
  {
    reporterName: 'School Coordinator Liu Yang',
    location: 'East Side Elementary School',
    emergencyType: 'evacuation',
    description: 'School building structurally compromised. 200 students need safe evacuation. Parents cannot reach school due to blocked roads.',
    urgency: 'high',
    urgency_reason: 'Children in structurally unsafe building requiring organized evacuation with blocked access routes.',
    peopleAffected: 200,
    status: 'pending',
  },
]

// ─── Wildfire Scenario ────────────────────────────────────────────────────────
const wildfireEmergencies = [
  {
    reporterName: 'Fire Captain Torres',
    location: 'Mountain Ridge Residential',
    emergencyType: 'evacuation',
    description: 'Wildfire advancing at 50mph. Mandatory evacuation order for 3 neighborhoods. Roads congested. Mobility-impaired residents need vehicle assistance.',
    urgency: 'critical',
    urgency_reason: 'Fast-moving wildfire with mandatory evacuation — mobility-impaired residents at immediate risk.',
    peopleAffected: 35,
    status: 'pending',
  },
  {
    reporterName: 'Paramedic Unit 7',
    location: 'Valley Floor Highway 12',
    emergencyType: 'medical',
    description: 'Multiple smoke inhalation cases at evacuation checkpoint. Three patients in respiratory distress requiring oxygen and nebulizer treatment.',
    urgency: 'critical',
    urgency_reason: 'Acute respiratory distress from smoke inhalation — requires immediate oxygen therapy.',
    peopleAffected: 3,
    status: 'pending',
  },
  {
    reporterName: 'Red Cross Coordinator',
    location: 'Highland Community College',
    emergencyType: 'shelter',
    description: 'College being used as evacuation center. 450 evacuees arrived overnight. Short on cots, blankets, and basic supplies.',
    urgency: 'high',
    urgency_reason: 'Large evacuation center severely undersupplied for the arriving displaced population.',
    peopleAffected: 450,
    status: 'pending',
  },
  {
    reporterName: 'Nutrition Program Director',
    location: 'Suburb Evacuation Camp B',
    emergencyType: 'food',
    description: 'Emergency food program running out of supplies. 180 evacuees including 40 children need meals for next 72 hours.',
    urgency: 'high',
    urgency_reason: 'Food supply depletion imminent with large number of children among evacuees.',
    peopleAffected: 180,
    status: 'pending',
  },
  {
    reporterName: 'WASH Specialist Amara',
    location: 'Evacuee Camp Delta',
    emergencyType: 'water',
    description: 'Wildfire damaged water infrastructure. Evacuation camp has no running water. Health risk rising, especially for children.',
    urgency: 'medium',
    urgency_reason: 'Water infrastructure damage creating sanitation and hygiene risks at evacuation camp.',
    peopleAffected: 90,
    status: 'pending',
  },
]

// ─── Hurricane Scenario ───────────────────────────────────────────────────────
const hurricaneEmergencies = [
  {
    reporterName: 'Coast Guard Station Alpha',
    location: 'Port District, Marina',
    emergencyType: 'evacuation',
    description: 'Category 3 hurricane landfall expected in 4 hours. Port district must be completely evacuated. Several families refusing to leave.',
    urgency: 'critical',
    urgency_reason: 'Imminent Category 3 hurricane landfall requiring immediate evacuation from storm surge zone.',
    peopleAffected: 50,
    status: 'pending',
  },
  {
    reporterName: 'Nursing Home Director',
    location: 'Coastal Road Senior Living',
    emergencyType: 'evacuation',
    description: 'Nursing home with 30 bedridden residents in storm surge zone. Cannot self-evacuate. Need medical transport vehicles urgently.',
    urgency: 'critical',
    urgency_reason: 'Immobile patients in nursing home within storm surge zone with hurricane imminent.',
    peopleAffected: 30,
    status: 'pending',
  },
  {
    reporterName: 'Emergency Manager Webb',
    location: 'Central Emergency Shelter',
    emergencyType: 'shelter',
    description: 'Main hurricane shelter reaching capacity. 600 evacuees expected, currently have supplies for 400. Need immediate shelter kits.',
    urgency: 'high',
    urgency_reason: 'Primary shelter expected to exceed capacity by 50% before hurricane arrival.',
    peopleAffected: 200,
    status: 'pending',
  },
  {
    reporterName: 'Clinic Nurse Patterson',
    location: 'South Market Medical Clinic',
    emergencyType: 'medical',
    description: 'Pre-storm medical emergency: 8 dialysis patients cannot access hospital. Need emergency medical intervention and transport.',
    urgency: 'high',
    urgency_reason: 'Dialysis patients requiring urgent medical intervention before hospital becomes inaccessible.',
    peopleAffected: 8,
    status: 'pending',
  },
  {
    reporterName: 'Food Bank Coordinator',
    location: 'Metro Center Distribution Hub',
    emergencyType: 'food',
    description: 'Pre-positioning food supplies for post-hurricane recovery. Need distribution plan for 1,000 families for 5-day recovery period.',
    urgency: 'medium',
    urgency_reason: 'Pre-positioning critical for post-hurricane food security when roads may be blocked.',
    peopleAffected: 1000,
    status: 'pending',
  },
]

// ─── Volunteer pools for each scenario (Pakistan) ────────────────────────────
const demoVolunteers = [
  {
    name: 'Dr. Sana Mirza',
    phone: '+92-321-5550101',
    email: 'sana.mirza@medrelief.pk',
    location: 'DHA Lahore',
    skills: ['medical', 'logistics'],
    hasVehicle: true,
    status: 'available',
  },
  {
    name: 'Imran Hussain',
    phone: '+92-333-5550102',
    email: 'imran.h@rescuepk.net',
    location: 'Saddar, Karachi',
    skills: ['rescue', 'transport'],
    hasVehicle: true,
    status: 'available',
  },
  {
    name: 'Rabia Farooq',
    phone: '+92-300-5550103',
    email: 'rabia.f@reliefpk.org',
    location: 'F-7, Islamabad',
    skills: ['food_distribution', 'logistics'],
    hasVehicle: false,
    status: 'available',
  },
  {
    name: 'Dr. Kamran Ali',
    phone: '+92-345-5550105',
    email: 'kamran.ali@medteam.pk',
    location: 'Clifton, Karachi',
    skills: ['medical', 'transport'],
    hasVehicle: true,
    status: 'available',
  },
  {
    name: 'Nadia Sheikh',
    phone: '+92-311-5550106',
    email: 'nadia.s@commserve.pk',
    location: 'Model Town, Lahore',
    skills: ['food_distribution', 'logistics'],
    hasVehicle: false,
    status: 'available',
  },
  {
    name: 'Tariq Mehmood',
    phone: '+92-315-5550104',
    email: 'tariq.m@rescue.pk',
    location: 'University Town, Peshawar',
    skills: ['rescue', 'logistics'],
    hasVehicle: true,
    status: 'available',
  },
]

// ─── Resource pools for each scenario (Pakistan) ─────────────────────────────
const demoResources = [
  { resourceType: 'medicine', quantity: 500, location: 'Mall Road, Lahore Medical Depot', status: 'available' },
  { resourceType: 'food', quantity: 2000, location: 'Gulshan, Karachi Distribution Center', status: 'available' },
  { resourceType: 'water', quantity: 5000, location: 'G-10, Islamabad Supply Hub', status: 'available' },
  { resourceType: 'vehicles', quantity: 6, location: 'Saddar, Rawalpindi Vehicle Depot', status: 'available' },
  { resourceType: 'shelter_kits', quantity: 50, location: 'Hayatabad, Peshawar Warehouse', status: 'available' },
  { resourceType: 'food', quantity: 800, location: 'DHA Karachi Food Storage', status: 'available' },
]

type ScenarioKey = 'multi' | 'flood' | 'earthquake' | 'wildfire' | 'hurricane'

const SCENARIOS: Record<ScenarioKey, {
  name: string
  emergencies: typeof demoEmergencies
  volunteers: typeof demoVolunteers
  resources: typeof demoResources
}> = {
  multi: {
    name: 'Multi-Disaster Response Scenario',
    emergencies: demoEmergencies,
    volunteers: demoVolunteers,
    resources: demoResources,
  },
  flood: {
    name: 'Major Flood Event',
    emergencies: floodEmergencies,
    volunteers: demoVolunteers,
    resources: [
      { resourceType: 'vehicles', quantity: 8, location: 'Riverside Motor Pool', status: 'available' },
      { resourceType: 'water', quantity: 10000, location: 'City Water Reserve', status: 'available' },
      { resourceType: 'shelter_kits', quantity: 200, location: 'Flood Relief Warehouse', status: 'available' },
      { resourceType: 'food', quantity: 5000, location: 'Riverside Distribution Center', status: 'available' },
      { resourceType: 'medicine', quantity: 300, location: 'Mobile Medical Unit', status: 'available' },
    ],
  },
  earthquake: {
    name: 'Urban Earthquake Response',
    emergencies: earthquakeEmergencies,
    volunteers: [
      { name: 'USAR Team Leader Rodriguez', phone: '+1-555-0201', email: 'usar@rescue.org', location: 'Old Town District', skills: ['rescue', 'medical'], hasVehicle: true, status: 'available' },
      { name: 'Dr. Chen Li', phone: '+1-555-0202', email: 'chen.li@trauma.org', location: 'City Hospital', skills: ['medical', 'logistics'], hasVehicle: false, status: 'available' },
      { name: 'Engineer Sofia Martini', phone: '+1-555-0203', email: 'sofia@struct.org', location: 'Metro Center', skills: ['logistics', 'rescue'], hasVehicle: true, status: 'available' },
      { name: 'Nurse Team Alpha', phone: '+1-555-0204', email: 'alpha@medteam.org', location: 'Highland Zone', skills: ['medical'], hasVehicle: true, status: 'available' },
      { name: 'Transport Coordinator Webb', phone: '+1-555-0205', email: 'webb@transport.org', location: 'East Side', skills: ['transport', 'logistics'], hasVehicle: true, status: 'available' },
      { name: 'Food Logistics Kim', phone: '+1-555-0206', email: 'kim@foodaid.org', location: 'South Market', skills: ['food_distribution', 'logistics'], hasVehicle: false, status: 'available' },
    ],
    resources: [
      { resourceType: 'medicine', quantity: 1000, location: 'Earthquake Medical Cache', status: 'available' },
      { resourceType: 'water', quantity: 8000, location: 'Emergency Water Tankers', status: 'available' },
      { resourceType: 'shelter_kits', quantity: 150, location: 'Disaster Relief Depot', status: 'available' },
      { resourceType: 'vehicles', quantity: 10, location: 'Emergency Transport Hub', status: 'available' },
      { resourceType: 'food', quantity: 3000, location: 'Earthquake Relief Kitchen', status: 'available' },
    ],
  },
  wildfire: {
    name: 'Wildfire Evacuation Response',
    emergencies: wildfireEmergencies,
    volunteers: [
      { name: 'Evacuation Lead Torres', phone: '+1-555-0301', email: 'torres@evac.org', location: 'Mountain Ridge', skills: ['transport', 'rescue'], hasVehicle: true, status: 'available' },
      { name: 'EMT Unit Bravo', phone: '+1-555-0302', email: 'bravo@ems.org', location: 'Valley Floor', skills: ['medical'], hasVehicle: true, status: 'available' },
      { name: 'Shelter Manager Ortiz', phone: '+1-555-0303', email: 'ortiz@shelter.org', location: 'Highland College', skills: ['logistics', 'food_distribution'], hasVehicle: false, status: 'available' },
      { name: 'Food Aid Coordinator', phone: '+1-555-0304', email: 'foodaid@relief.org', location: 'Suburb Camp B', skills: ['food_distribution'], hasVehicle: true, status: 'available' },
      { name: 'WASH Expert Amara', phone: '+1-555-0305', email: 'amara@wash.org', location: 'Evacuee Camp', skills: ['logistics', 'rescue'], hasVehicle: false, status: 'available' },
    ],
    resources: [
      { resourceType: 'vehicles', quantity: 12, location: 'Wildfire Evacuation Fleet', status: 'available' },
      { resourceType: 'medicine', quantity: 400, location: 'Wildfire Medical Cache', status: 'available' },
      { resourceType: 'shelter_kits', quantity: 300, location: 'Wildfire Shelter Depot', status: 'available' },
      { resourceType: 'food', quantity: 6000, location: 'Evacuation Food Stores', status: 'available' },
      { resourceType: 'water', quantity: 4000, location: 'Mobile Water Tankers', status: 'available' },
    ],
  },
  hurricane: {
    name: 'Hurricane Landfall Response',
    emergencies: hurricaneEmergencies,
    volunteers: [
      { name: 'Coast Guard Team Alpha', phone: '+1-555-0401', email: 'cg.alpha@uscg.gov', location: 'Port District', skills: ['rescue', 'transport'], hasVehicle: true, status: 'available' },
      { name: 'Medical Transport Webb', phone: '+1-555-0402', email: 'webb@medtransport.org', location: 'Coastal Road', skills: ['medical', 'transport'], hasVehicle: true, status: 'available' },
      { name: 'Shelter Manager Davis', phone: '+1-555-0403', email: 'davis@redcross.org', location: 'Central Shelter', skills: ['logistics', 'food_distribution'], hasVehicle: false, status: 'available' },
      { name: 'Nurse Coordinator Kim', phone: '+1-555-0404', email: 'kim@clinicteam.org', location: 'South Market', skills: ['medical', 'logistics'], hasVehicle: false, status: 'available' },
      { name: 'Food Distribution Lead', phone: '+1-555-0405', email: 'food@hurricane.org', location: 'Metro Center', skills: ['food_distribution', 'logistics'], hasVehicle: true, status: 'available' },
    ],
    resources: [
      { resourceType: 'vehicles', quantity: 15, location: 'Hurricane Evacuation Fleet', status: 'available' },
      { resourceType: 'shelter_kits', quantity: 400, location: 'Hurricane Shelter Cache', status: 'available' },
      { resourceType: 'medicine', quantity: 600, location: 'Storm Medical Supplies', status: 'available' },
      { resourceType: 'food', quantity: 8000, location: 'Hurricane Food Stockpile', status: 'available' },
      { resourceType: 'water', quantity: 12000, location: 'Emergency Water Reserve', status: 'available' },
    ],
  },
}

export async function POST(request: Request) {
  try {
    await connectDB()

    const url = new URL(request.url)
    const scenarioParam = (url.searchParams.get('scenario') ?? 'multi') as ScenarioKey
    const scenario = SCENARIOS[scenarioParam] ?? SCENARIOS.multi

    // Clear all existing data
    await Promise.all([
      EmergencyRequest.deleteMany({}),
      Volunteer.deleteMany({}),
      Resource.deleteMany({}),
      Mission.deleteMany({}),
      AgentLog.deleteMany({}),
    ])

    const [emergencies, volunteers, resources] = await Promise.all([
      EmergencyRequest.insertMany(scenario.emergencies),
      Volunteer.insertMany(scenario.volunteers),
      Resource.insertMany(scenario.resources),
    ])

    await AgentLog.create({
      action: 'DEMO_SCENARIO_LOADED',
      details: `${scenario.name} loaded: ${emergencies.length} emergencies (${emergencies.filter((e) => e.urgency === 'critical').length} critical), ${volunteers.length} volunteers, ${resources.length} resources. Ready for AI agent run.`,
      relatedIds: [],
    })

    return NextResponse.json({
      success: true,
      scenario: scenario.name,
      scenarioKey: scenarioParam,
      counts: {
        emergencies: emergencies.length,
        volunteers: volunteers.length,
        resources: resources.length,
        criticalEmergencies: emergencies.filter((e) => e.urgency === 'critical').length,
      },
      message: `${scenario.name} loaded. Run the AI agent to see multi-agent coordination in action.`,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
