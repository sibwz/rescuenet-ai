export interface KnowledgeEntry {
  category: string
  disasterType: string
  immediateActions: string[]
  resourcePriority: string[]
  skillRequirements: string[]
  warnings: string[]
  source: string
}

export const DISASTER_KNOWLEDGE_BASE: Record<string, KnowledgeEntry> = {
  medical: {
    category: 'Medical Emergency Response Protocol',
    disasterType: 'medical',
    immediateActions: [
      'Apply START triage protocol: immediate → delayed → minor → expectant',
      'Control life-threatening bleeding before airway management',
      'Do NOT move patients with suspected spinal injuries',
      'Establish perimeter and coordinate with receiving hospitals',
      'Deploy medical personnel in pairs — never alone in unsafe zones',
    ],
    resourcePriority: ['medicine', 'medical_equipment', 'ambulances'],
    skillRequirements: ['medical', 'rescue'],
    warnings: [
      'Secondary collapse risk in structural incidents — establish exclusion zone',
      'Mass-casualty infection control: gloves, masks mandatory',
      'Psychological first aid required for survivors within 24h',
    ],
    source: 'WHO Emergency Medical Services & Trauma Care Guidelines (2022)',
  },
  food: {
    category: 'Food Security Emergency Response Protocol',
    disasterType: 'food',
    immediateActions: [
      'Conduct rapid food security and nutrition assessment (SMART survey)',
      'Prioritize vulnerable groups: children <5, pregnant/lactating women, elderly',
      'Establish controlled distribution points in safe, accessible locations',
      'Implement registration and ration-card system to prevent double distribution',
      'Maintain minimum 2,100 kcal/person/day standard',
    ],
    resourcePriority: ['food', 'water', 'cooking_equipment'],
    skillRequirements: ['food_distribution', 'logistics'],
    warnings: [
      'Food safety critical — inspect all items before distribution',
      'Cultural and religious dietary requirements must be respected',
      'Do not create aid dependency where local markets are functional',
    ],
    source: 'WFP Emergency Food Distribution Operations Manual (2023)',
  },
  water: {
    category: 'Water, Sanitation & Hygiene (WASH) Emergency Protocol',
    disasterType: 'water',
    immediateActions: [
      'Minimum immediate provision: 15 liters per person per day',
      'Test water quality before distribution — do not distribute untested water',
      'Apply chlorination: maintain 0.5mg/L residual chlorine at point of use',
      'Deploy sanitation: minimum 1 latrine per 20 persons, gender-separated',
      'Hand-washing stations with soap at all distribution and sanitation points',
    ],
    resourcePriority: ['water', 'purification_tablets', 'storage_containers'],
    skillRequirements: ['logistics', 'food_distribution'],
    warnings: [
      'Waterborne disease outbreak risk peaks at 48–72h — act before symptoms appear',
      'Infant formula requires clean water — priority access for families with infants',
      'Open defecation risk — immediate sanitation setup prevents cholera, typhoid',
    ],
    source: 'UNICEF WASH in Emergencies Technical Handbook (2023)',
  },
  shelter: {
    category: 'Emergency Shelter & Non-Food Items Protocol',
    disasterType: 'shelter',
    immediateActions: [
      'Structural safety assessment before entering or using any building',
      'Minimum sphere standard: 3.5 sq meters per person in emergency shelter',
      'Prioritize vulnerable groups: elderly, disabled, unaccompanied children',
      'Establish family registration at shelter to maintain unity and traceability',
      'Ensure privacy partitions and separate facilities for men and women',
    ],
    resourcePriority: ['shelter_kits', 'blankets', 'lighting', 'tools'],
    skillRequirements: ['rescue', 'logistics'],
    warnings: [
      'Never shelter displaced persons in flood-prone or landslide-risk zones',
      'Fire risk in temporary settlements — establish fire lanes and extinguisher access',
      'GBV risk in communal settings — ensure safe spaces and reporting channels',
    ],
    source: 'UNHCR Emergency Handbook — Shelter & Settlements (2022)',
  },
  evacuation: {
    category: 'Mass Evacuation & Displacement Protocol',
    disasterType: 'evacuation',
    immediateActions: [
      'Map safe evacuation routes and alternates BEFORE movement begins',
      'Prioritize mobility-impaired, elderly, children, and medical cases',
      'Establish numbered assembly points with population headcounts',
      'Coordinate with traffic management — clear priority lanes for evacuation vehicles',
      'Maintain family unity throughout — separate families only as last resort',
    ],
    resourcePriority: ['vehicles', 'fuel', 'communication_devices'],
    skillRequirements: ['transport', 'rescue'],
    warnings: [
      'Never initiate evacuation until receiving site is confirmed ready',
      'Account for pets — refusal to evacuate without pets is a leading cause of casualties',
      'Post-evacuation site security required — evacuated properties targeted by looting',
    ],
    source: 'FEMA Mass Evacuation Incident Support Guide (2021)',
  },
}

export function retrieveKnowledge(emergencyTypes: string[]): KnowledgeEntry[] {
  const unique = Array.from(new Set(emergencyTypes))
  return unique
    .map((type) => DISASTER_KNOWLEDGE_BASE[type])
    .filter((entry): entry is KnowledgeEntry => !!entry)
}

export function formatKnowledgeForPrompt(entries: KnowledgeEntry[]): string {
  if (entries.length === 0) return ''
  return (
    '\n\nRETRIEVED DISASTER RESPONSE KNOWLEDGE BASE (you MUST cite these sources in your reasoning):\n' +
    entries
      .map(
        (e) =>
          `\n[${e.category} — Source: ${e.source}]\n` +
          `Immediate Actions:\n${e.immediateActions.map((a) => `  • ${a}`).join('\n')}\n` +
          `Required Skills: ${e.skillRequirements.join(', ')}\n` +
          `Warnings:\n${e.warnings.map((w) => `  ⚠ ${w}`).join('\n')}`
      )
      .join('\n\n---\n')
  )
}
