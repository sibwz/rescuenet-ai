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

// ─── Flood Scenario (Sindh/KPK monsoon floods) ───────────────────────────────
const floodEmergencies = [
  {
    reporterName: 'Tariq Hussain',
    location: 'Sukkur, Sindh',
    emergencyType: 'evacuation',
    description: 'Indus river breach has submerged entire mohallas. Families trapped on rooftops, no boat access. Water level rising rapidly.',
    urgency: 'critical',
    urgency_reason: 'Rapidly rising Indus floodwaters with families trapped on rooftops — imminent drowning risk.',
    peopleAffected: 24,
    status: 'pending',
  },
  {
    reporterName: 'Dr. Hira Baig',
    location: 'Nowshera, KPK',
    emergencyType: 'medical',
    description: 'Flash flood casualties with multiple fracture cases and hypothermia. District hospital overwhelmed. Emergency triage urgently needed.',
    urgency: 'critical',
    urgency_reason: 'Mass casualty flood event with overwhelmed district hospital — immediate medical reinforcement required.',
    peopleAffected: 18,
    status: 'pending',
  },
  {
    reporterName: 'Amjad Qureshi',
    location: 'Thatta, Sindh',
    emergencyType: 'water',
    description: 'Floodwater contaminated all hand pumps and wells in village. 300 displaced persons at risk of cholera from unsafe water sources.',
    urgency: 'high',
    urgency_reason: 'Mass water contamination in flood-affected village posing severe cholera outbreak risk.',
    peopleAffected: 300,
    status: 'pending',
  },
  {
    reporterName: 'Headmaster Khalid Nawaz',
    location: 'Charsadda, KPK',
    emergencyType: 'shelter',
    description: 'Government school converted to flood relief camp — capacity critically exceeded. 120 displaced families sleeping without mattresses or blankets.',
    urgency: 'high',
    urgency_reason: 'Shelter capacity critically exceeded with flood-displaced families in adverse monsoon conditions.',
    peopleAffected: 120,
    status: 'pending',
  },
  {
    reporterName: 'NDMA Officer Asad',
    location: 'DG Khan, Punjab',
    emergencyType: 'food',
    description: 'Food distribution point overwhelmed. Rations for 50 families but 200+ displaced persons waiting. Children visibly malnourished.',
    urgency: 'high',
    urgency_reason: 'Critical food shortage with malnourished children — supply meets only 25% of displaced population.',
    peopleAffected: 200,
    status: 'pending',
  },
]

// ─── Earthquake Scenario (AJK/Balochistan) ───────────────────────────────────
const earthquakeEmergencies = [
  {
    reporterName: 'DSP Imran Butt',
    location: 'Muzaffarabad, AJK',
    emergencyType: 'medical',
    description: 'Magnitude 6.4 earthquake. Multi-story apartment building collapsed near Neelum Road. Estimated 15 people trapped in rubble. USAR teams needed urgently.',
    urgency: 'critical',
    urgency_reason: 'Structural collapse with confirmed trapped survivors — survival window closing rapidly.',
    peopleAffected: 15,
    status: 'pending',
  },
  {
    reporterName: 'Dr. Shabana Rauf',
    location: 'Quetta, Balochistan',
    emergencyType: 'medical',
    description: 'Bolan Medical Complex overwhelmed with earthquake casualties. Blood supply and surgical equipment running critically low. Triage in parking areas.',
    urgency: 'critical',
    urgency_reason: 'Hospital at critical capacity with surgical supply shortage during mass casualty earthquake event.',
    peopleAffected: 60,
    status: 'pending',
  },
  {
    reporterName: 'WASA Supervisor Riaz',
    location: 'Rawalpindi',
    emergencyType: 'water',
    description: 'Earthquake ruptured main water distribution pipelines. Sectors I-8 to I-11 without potable water. Sewage contamination possible.',
    urgency: 'high',
    urgency_reason: 'City sector water disruption with sewage contamination risk affecting thousands of residents.',
    peopleAffected: 5000,
    status: 'pending',
  },
  {
    reporterName: 'Union Council Nazim Sardar',
    location: 'Abbottabad, KPK',
    emergencyType: 'shelter',
    description: 'Approximately 80 families evacuated from cracked buildings after structural assessment by engineers. No temporary shelter available.',
    urgency: 'medium',
    urgency_reason: 'Large number of families displaced from structurally compromised buildings in earthquake aftermath.',
    peopleAffected: 80,
    status: 'pending',
  },
  {
    reporterName: 'Principal Maryam Bibi',
    location: 'Mansehra, KPK',
    emergencyType: 'evacuation',
    description: 'School building severely cracked by tremors. 200 students need safe evacuation. Parents cannot reach due to landslide-blocked roads.',
    urgency: 'high',
    urgency_reason: 'Children in structurally unsafe building requiring immediate evacuation with blocked access routes.',
    peopleAffected: 200,
    status: 'pending',
  },
]

// ─── Forest Fire Scenario (KPK/Murree Hills) ─────────────────────────────────
const wildfireEmergencies = [
  {
    reporterName: 'Forest Officer Zubair',
    location: 'Nathiagali, KPK',
    emergencyType: 'evacuation',
    description: 'Forest fire advancing rapidly through Galliyat. Mandatory evacuation ordered for hillside villages. Elderly residents unable to descend steep paths without assistance.',
    urgency: 'critical',
    urgency_reason: 'Fast-moving forest fire with mandatory evacuation — mobility-impaired elderly at immediate risk on steep terrain.',
    peopleAffected: 35,
    status: 'pending',
  },
  {
    reporterName: 'THQ Hospital Nowshera',
    location: 'Swat, KPK',
    emergencyType: 'medical',
    description: 'Multiple smoke inhalation cases from Swat valley forest fires. Three patients in severe respiratory distress. Oxygen cylinders urgently needed.',
    urgency: 'critical',
    urgency_reason: 'Acute respiratory distress from forest fire smoke — oxygen therapy required immediately.',
    peopleAffected: 3,
    status: 'pending',
  },
  {
    reporterName: 'Edhi Foundation Murree',
    location: 'Murree, Punjab',
    emergencyType: 'shelter',
    description: 'Government school used as evacuation centre for 450 fire-displaced persons. Severely short on bedding, blankets, and cooking fuel.',
    urgency: 'high',
    urgency_reason: 'Large evacuation centre severely undersupplied with cold mountain nights adding urgency.',
    peopleAffected: 450,
    status: 'pending',
  },
  {
    reporterName: 'WFP Coordinator Anila',
    location: 'Kaghan, KPK',
    emergencyType: 'food',
    description: 'Forest fire displaced 180 families from Kaghan valley villages. Food rations for only 3 days remain. Children and elderly at nutritional risk.',
    urgency: 'high',
    urgency_reason: 'Food supply depletion imminent with vulnerable populations including elderly and children.',
    peopleAffected: 180,
    status: 'pending',
  },
  {
    reporterName: 'PDMA Officer Babar',
    location: 'Abbottabad, KPK',
    emergencyType: 'water',
    description: 'Fire damaged water supply infrastructure in Abbottabad hills. Evacuation camp of 90 persons has no running water. Sanitation risk rising.',
    urgency: 'medium',
    urgency_reason: 'Water infrastructure damage at evacuation camp creating hygiene crisis.',
    peopleAffected: 90,
    status: 'pending',
  },
]

// ─── Cyclone/Storm Scenario (Makran Coast, Balochistan/Sindh) ────────────────
const hurricaneEmergencies = [
  {
    reporterName: 'Pakistan Navy Station Gwadar',
    location: 'Gwadar, Balochistan',
    emergencyType: 'evacuation',
    description: 'Cyclone landfall expected in 4 hours. Coastal settlements along Makran must be fully evacuated. Several fishing families refusing to abandon boats.',
    urgency: 'critical',
    urgency_reason: 'Imminent cyclone landfall requiring mandatory evacuation from coastal storm surge zone.',
    peopleAffected: 50,
    status: 'pending',
  },
  {
    reporterName: 'PESSI Home Director Ormara',
    location: 'Ormara, Balochistan',
    emergencyType: 'evacuation',
    description: 'Old age home with 30 bedridden residents in storm surge zone. Cannot self-evacuate. Medical transport vehicles needed urgently before landfall.',
    urgency: 'critical',
    urgency_reason: 'Immobile patients in storm surge zone with cyclone imminent — requires specialized medical transport.',
    peopleAffected: 30,
    status: 'pending',
  },
  {
    reporterName: 'PDMA Coordinator Karachi',
    location: 'Karachi, Sindh',
    emergencyType: 'shelter',
    description: 'Cyclone relief camp at capacity. 600 evacuees from Ibrahim Hyderi and Rehri expected, supplies for only 400. Immediate shelter kits needed.',
    urgency: 'high',
    urgency_reason: 'Primary relief camp expected to exceed capacity by 50% before cyclone arrival.',
    peopleAffected: 200,
    status: 'pending',
  },
  {
    reporterName: 'RHC Nurse Fatima Pasni',
    location: 'Pasni, Balochistan',
    emergencyType: 'medical',
    description: 'Pre-cyclone medical crisis: 8 dialysis patients cannot reach PIMS. Roads closing. Emergency dialysis support and transport needed immediately.',
    urgency: 'high',
    urgency_reason: 'Dialysis patients requiring urgent medical intervention before Makran Coast roads close.',
    peopleAffected: 8,
    status: 'pending',
  },
  {
    reporterName: 'WFP Officer Hyderabad',
    location: 'Hyderabad, Sindh',
    emergencyType: 'food',
    description: 'Pre-positioning food supplies for post-cyclone Sindh coast recovery. 1,000 families need 5-day emergency ration kits before roads become impassable.',
    urgency: 'medium',
    urgency_reason: 'Pre-positioning critical for post-cyclone food security when Makran Highway may be blocked.',
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
    latitude: 31.4720,
    longitude: 74.3873,
    locationValidated: true,
    skills: ['medical', 'logistics'],
    hasVehicle: true,
    status: 'available',
  },
  {
    name: 'Imran Hussain',
    phone: '+92-333-5550102',
    email: 'imran.h@rescuepk.net',
    location: 'Saddar, Karachi',
    latitude: 24.8588,
    longitude: 67.0104,
    locationValidated: true,
    skills: ['rescue', 'transport'],
    hasVehicle: true,
    status: 'available',
  },
  {
    name: 'Rabia Farooq',
    phone: '+92-300-5550103',
    email: 'rabia.f@reliefpk.org',
    location: 'F-7, Islamabad',
    latitude: 33.7380,
    longitude: 73.0651,
    locationValidated: true,
    skills: ['food_distribution', 'logistics'],
    hasVehicle: false,
    status: 'available',
  },
  {
    name: 'Dr. Kamran Ali',
    phone: '+92-345-5550105',
    email: 'kamran.ali@medteam.pk',
    location: 'Clifton, Karachi',
    latitude: 24.8223,
    longitude: 67.0277,
    locationValidated: true,
    skills: ['medical', 'transport'],
    hasVehicle: true,
    status: 'available',
  },
  {
    name: 'Nadia Sheikh',
    phone: '+92-311-5550106',
    email: 'nadia.s@commserve.pk',
    location: 'Model Town, Lahore',
    latitude: 31.4760,
    longitude: 74.3268,
    locationValidated: true,
    skills: ['food_distribution', 'logistics'],
    hasVehicle: false,
    status: 'available',
  },
  {
    name: 'Tariq Mehmood',
    phone: '+92-315-5550104',
    email: 'tariq.m@rescue.pk',
    location: 'University Town, Peshawar',
    latitude: 34.0021,
    longitude: 71.4800,
    locationValidated: true,
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
    name: 'Sindh & KPK Monsoon Flood Response',
    emergencies: floodEmergencies,
    volunteers: demoVolunteers,
    resources: [
      { resourceType: 'vehicles', quantity: 8, location: 'Sukkur PDMA Vehicle Depot', status: 'available' },
      { resourceType: 'water', quantity: 10000, location: 'Hyderabad Water Purification Unit', status: 'available' },
      { resourceType: 'shelter_kits', quantity: 200, location: 'Nowshera Relief Warehouse', status: 'available' },
      { resourceType: 'food', quantity: 5000, location: 'Sukkur WFP Distribution Point', status: 'available' },
      { resourceType: 'medicine', quantity: 300, location: 'Charsadda Mobile Medical Unit', status: 'available' },
    ],
  },
  earthquake: {
    name: 'AJK/Balochistan Earthquake Response',
    emergencies: earthquakeEmergencies,
    volunteers: [
      { name: 'Dr. Zafar Iqbal (USAR)', phone: '+92-321-0201', email: 'zafar@rescuepk.org', location: 'Muzaffarabad, AJK', latitude: 34.3700, longitude: 73.4710, locationValidated: true, skills: ['rescue', 'medical'], hasVehicle: true, status: 'available' },
      { name: 'Dr. Sara Nawaz', phone: '+92-300-0202', email: 'sara.nawaz@bmcquetta.pk', location: 'Quetta, Balochistan', latitude: 30.1798, longitude: 66.9750, locationValidated: true, skills: ['medical', 'logistics'], hasVehicle: false, status: 'available' },
      { name: 'Engr. Hassan Gillani', phone: '+92-345-0203', email: 'hassan@nespak.pk', location: 'Rawalpindi', latitude: 33.5651, longitude: 73.0169, locationValidated: true, skills: ['logistics', 'rescue'], hasVehicle: true, status: 'available' },
      { name: 'Edhi Nurse Team AJK', phone: '+92-311-0204', email: 'ajkteam@edhi.org', location: 'Abbottabad, KPK', latitude: 34.1463, longitude: 73.2117, locationValidated: true, skills: ['medical'], hasVehicle: true, status: 'available' },
      { name: 'Rescue 1122 Coordinator', phone: '+92-315-0205', email: 'rescue@punjab.gov.pk', location: 'Rawalpindi', latitude: 33.5651, longitude: 73.0169, locationValidated: true, skills: ['transport', 'logistics'], hasVehicle: true, status: 'available' },
      { name: 'WFP Logistics Sadia', phone: '+92-333-0206', email: 'sadia@wfp.org.pk', location: 'Mansehra, KPK', latitude: 34.3292, longitude: 73.1956, locationValidated: true, skills: ['food_distribution', 'logistics'], hasVehicle: false, status: 'available' },
    ],
    resources: [
      { resourceType: 'medicine', quantity: 1000, location: 'Muzaffarabad CMH Medical Cache', status: 'available' },
      { resourceType: 'water', quantity: 8000, location: 'Rawalpindi WASA Emergency Tankers', status: 'available' },
      { resourceType: 'shelter_kits', quantity: 150, location: 'Mansehra PDMA Disaster Depot', status: 'available' },
      { resourceType: 'vehicles', quantity: 10, location: 'Abbottabad Rescue 1122 Hub', status: 'available' },
      { resourceType: 'food', quantity: 3000, location: 'Quetta WFP Relief Kitchen', status: 'available' },
    ],
  },
  wildfire: {
    name: 'KPK Forest Fire Response',
    emergencies: wildfireEmergencies,
    volunteers: [
      { name: 'Forest Rescue Lead Bilal', phone: '+92-321-0301', email: 'bilal@kpkforest.gov.pk', location: 'Nathiagali, KPK', latitude: 34.0750, longitude: 73.3741, locationValidated: true, skills: ['transport', 'rescue'], hasVehicle: true, status: 'available' },
      { name: 'Dr. Huma Paramedic Swat', phone: '+92-300-0302', email: 'huma@swatems.pk', location: 'Swat, KPK', latitude: 34.9077, longitude: 72.3562, locationValidated: true, skills: ['medical'], hasVehicle: true, status: 'available' },
      { name: 'Edhi Relief Murree', phone: '+92-345-0303', email: 'murree@edhi.org', location: 'Murree, Punjab', latitude: 33.9071, longitude: 73.3943, locationValidated: true, skills: ['logistics', 'food_distribution'], hasVehicle: false, status: 'available' },
      { name: 'WFP Field Officer Kaghan', phone: '+92-311-0304', email: 'kaghan@wfp.org.pk', location: 'Kaghan, KPK', latitude: 34.7550, longitude: 73.5280, locationValidated: true, skills: ['food_distribution'], hasVehicle: true, status: 'available' },
      { name: 'PDMA WASH Officer KPK', phone: '+92-315-0305', email: 'wash@pdma.kpk.pk', location: 'Abbottabad, KPK', latitude: 34.1463, longitude: 73.2117, locationValidated: true, skills: ['logistics', 'rescue'], hasVehicle: false, status: 'available' },
    ],
    resources: [
      { resourceType: 'vehicles', quantity: 12, location: 'Abbottabad KPK Forest Department Fleet', status: 'available' },
      { resourceType: 'medicine', quantity: 400, location: 'Nathiagali THQ Medical Cache', status: 'available' },
      { resourceType: 'shelter_kits', quantity: 300, location: 'Mansehra PDMA Forest Fire Depot', status: 'available' },
      { resourceType: 'food', quantity: 6000, location: 'Kaghan WFP Emergency Stores', status: 'available' },
      { resourceType: 'water', quantity: 4000, location: 'Swat Mobile Water Tankers', status: 'available' },
    ],
  },
  hurricane: {
    name: 'Makran Coast Cyclone Response',
    emergencies: hurricaneEmergencies,
    volunteers: [
      { name: 'Pakistan Navy Rescue Gwadar', phone: '+92-321-0401', email: 'rescue@paknavy.gwadar', location: 'Gwadar, Balochistan', latitude: 25.1216, longitude: 62.3254, locationValidated: true, skills: ['rescue', 'transport'], hasVehicle: true, status: 'available' },
      { name: 'Dr. Shahida Med Transport', phone: '+92-300-0402', email: 'shahida@pmcormara.pk', location: 'Ormara, Balochistan', latitude: 25.2065, longitude: 64.6345, locationValidated: true, skills: ['medical', 'transport'], hasVehicle: true, status: 'available' },
      { name: 'PDMA Shelter Coordinator', phone: '+92-345-0403', email: 'shelter@pdma.sindh.pk', location: 'Karachi, Sindh', latitude: 24.8607, longitude: 67.0011, locationValidated: true, skills: ['logistics', 'food_distribution'], hasVehicle: false, status: 'available' },
      { name: 'RHC Nurse Zakia Pasni', phone: '+92-311-0404', email: 'zakia@rhcpasni.pk', location: 'Pasni, Balochistan', latitude: 25.2651, longitude: 63.4708, locationValidated: true, skills: ['medical', 'logistics'], hasVehicle: false, status: 'available' },
      { name: 'WFP Distribution Lead Hyd', phone: '+92-333-0405', email: 'hyd@wfp.org.pk', location: 'Hyderabad, Sindh', latitude: 25.3960, longitude: 68.3578, locationValidated: true, skills: ['food_distribution', 'logistics'], hasVehicle: true, status: 'available' },
    ],
    resources: [
      { resourceType: 'vehicles', quantity: 15, location: 'Gwadar Pakistan Navy Evacuation Fleet', status: 'available' },
      { resourceType: 'shelter_kits', quantity: 400, location: 'Karachi PDMA Cyclone Shelter Cache', status: 'available' },
      { resourceType: 'medicine', quantity: 600, location: 'Ormara CMH Storm Medical Supplies', status: 'available' },
      { resourceType: 'food', quantity: 8000, location: 'Hyderabad WFP Cyclone Food Stockpile', status: 'available' },
      { resourceType: 'water', quantity: 12000, location: 'Karachi KWSB Emergency Water Reserve', status: 'available' },
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
      EmergencyRequest.insertMany(scenario.emergencies.map(e => ({ ...e, source: 'demo' }))),
      Volunteer.insertMany(scenario.volunteers.map(v => ({ ...v, source: 'demo', verifiedEmail: true, approved: true }))),
      Resource.insertMany(scenario.resources.map(r => ({ ...r, source: 'demo' }))),
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
