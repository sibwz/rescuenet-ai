// ── Types ──────────────────────────────────────────────────────────────────────

export interface LocationValidationResult {
  valid: boolean
  pendingReview?: boolean
  lat?: number
  lng?: number
  normalizedAddress?: string
  reason?: string
  confidence?: 'high' | 'medium' | 'low'
  method?: 'geocode' | 'keyword' | 'gps' | 'urdu'
  dispatchRegion?: 'pakistan' | 'international' | 'unknown'
  validationStatus?: 'verified_gps' | 'verified_geocoded' | 'verified_keyword' | 'pending_review' | 'invalid'
}

export interface NormalizeResult {
  normalizedText: string
  city: string | null
  area: string | null
  confidence: number
  hasUrdu: boolean
}

// ── Urdu script detection ───────────────────────────────────────────────────

export function hasUrduScript(text: string): boolean {
  return /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/.test(text)
}

// ── Urdu ↔ English alias map ────────────────────────────────────────────────

const URDU_ALIASES: Record<string, string> = {
  // Cities
  'لاہور': 'lahore', 'کراچی': 'karachi', 'اسلام آباد': 'islamabad',
  'راولپنڈی': 'rawalpindi', 'پشاور': 'peshawar', 'کوئٹہ': 'quetta',
  'ملتان': 'multan', 'فیصل آباد': 'faisalabad', 'حیدرآباد': 'hyderabad',
  'سیالکوٹ': 'sialkot', 'گوجرانوالہ': 'gujranwala', 'گجرات': 'gujrat',
  'سرگودھا': 'sargodha', 'بہاولپور': 'bahawalpur', 'سکھر': 'sukkur',
  'لاڑکانہ': 'larkana', 'مردان': 'mardan', 'مینگورہ': 'mingora',
  'عباس آباد': 'abbottabad', 'ایبٹ آباد': 'abbottabad',
  'سوات': 'swat', 'گوادر': 'gwadar', 'گلگت': 'gilgit',
  'سکردو': 'skardu', 'مظفرآباد': 'muzaffarabad', 'میرپور': 'mirpur',
  // Lahore areas
  'جوہر ٹاؤن': 'johar town', 'جوہر ٹاون': 'johar town', 'جوہر ٹاؤں': 'johar town',
  'ماڈل ٹاؤن': 'model town', 'ماڈل ٹاون': 'model town',
  'بحریہ ٹاؤن': 'bahria town', 'بحریہ ٹاون': 'bahria town',
  'واپڈا ٹاؤن': 'wapda town', 'گلبرگ': 'gulberg',
  'ڈی ایچ اے': 'dha', 'ڈیفنس': 'defence', 'ٹاؤن شپ': 'township',
  'اقبال ٹاؤن': 'iqbal town',
  // Karachi areas
  'کلفٹن': 'clifton', 'گلشن': 'gulshan', 'صدر': 'saddar',
  'نازم آباد': 'nazimabad', 'اورنگی': 'orangi', 'لانڈھی': 'landhi', 'کورنگی': 'korangi',
  // Islamabad / Rawalpindi
  'بحریہ': 'bahria', 'راول': 'rawalpindi',
  // Provinces
  'پنجاب': 'punjab', 'سندھ': 'sindh', 'بلوچستان': 'balochistan', 'خیبر': 'kpk',
}

function urduToEnglish(text: string): string {
  let result = text
  const sorted = Object.entries(URDU_ALIASES).sort((a, b) => b[0].length - a[0].length)
  for (const [urdu, eng] of sorted) {
    result = result.split(urdu).join(eng)
  }
  return result
}

// ── Known Pakistan places ───────────────────────────────────────────────────

const PAKISTAN_PLACES = [
  // Major cities
  'karachi', 'lahore', 'islamabad', 'rawalpindi', 'peshawar', 'quetta', 'multan',
  'faisalabad', 'hyderabad', 'sialkot', 'gujranwala', 'sargodha', 'bahawalpur',
  'sukkur', 'larkana', 'mirpur', 'muzaffarabad', 'abbottabad', 'mardan',
  'mingora', 'gujrat', 'jhang', 'sahiwal', 'okara', 'nowshera', 'swat',
  'mansehra', 'thatta', 'gwadar', 'ormara', 'pasni', 'badin',
  'ziarat', 'nathiagali', 'murree', 'swabi', 'charsadda', 'kohat',
  'bannu', 'chitral', 'jacobabad', 'shikarpur', 'mirpurkhas',
  'dera ghazi khan', 'dera ismail khan', 'rahim yar khan',
  'waziristan', 'tank', 'hangu', 'attock', 'chakwal', 'mandi bahauddin',
  'narowal', 'hafizabad', 'kasur', 'sheikhupura', 'nankana', 'toba tek singh',
  'chiniot', 'mianwali', 'khushab', 'bhakkar', 'layyah', 'muzaffargarh',
  'vehari', 'pakpattan', 'khanewal', 'lodhran', 'bahawalnagar',
  'dera bugti', 'turbat', 'khuzdar', 'hub', 'uthal', 'zhob', 'loralai',
  'gilgit', 'skardu', 'hunza', 'ghanche', 'astore', 'diamer',
  // Provinces / regions
  'sindh', 'punjab', 'balochistan', 'kpk', 'azad kashmir', 'gilgit baltistan',
  // Karachi neighbourhoods
  'dha', 'clifton', 'saddar', 'gulshan', 'orangi', 'korangi', 'lyari',
  'malir', 'landhi', 'site', 'pechs', 'liaquatabad', 'north nazimabad',
  'north karachi', 'new karachi', 'surjani', 'gulberg', 'bath island',
  'defence karachi', 'manora', 'keamari', 'nazimabad',
  // Lahore neighbourhoods
  'model town', 'johar town', 'bahria town', 'liberty market', 'mall road',
  'raiwind', 'shahdra', 'wazirabad', 'shalimar', 'township', 'iqbal town',
  'garden town', 'samanabad', 'gulshan ravi', 'mughalpura', 'wapda town',
  'faisal town', 'allama iqbal town', 'defence lahore', 'valencia',
  'bahria', 'johar', 'gulberg lahore',
  // Islamabad / Rawalpindi sectors
  'g-9', 'g-10', 'g-11', 'g-6', 'g-7', 'g-8', 'f-7', 'f-8', 'f-10', 'f-11',
  'i-8', 'i-9', 'i-10', 'e-7', 'e-11', 'd-12', 'h-9', 'h-10',
  'bahria islamabad', 'dha islamabad', 'cbr town', 'media town',
  // Peshawar
  'hayatabad', 'university town', 'cantonment', 'cantt',
  'dalazak road', 'pajagi road',
]

// ── Approximate city coordinates ────────────────────────────────────────────

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  karachi: { lat: 24.8607, lng: 67.0011 }, lahore: { lat: 31.5204, lng: 74.3587 },
  islamabad: { lat: 33.7294, lng: 73.0931 }, rawalpindi: { lat: 33.5651, lng: 73.0169 },
  peshawar: { lat: 34.0151, lng: 71.5249 }, quetta: { lat: 30.1798, lng: 66.9750 },
  multan: { lat: 30.1575, lng: 71.5249 }, faisalabad: { lat: 31.4504, lng: 73.1350 },
  hyderabad: { lat: 25.3960, lng: 68.3578 }, abbottabad: { lat: 34.1463, lng: 73.2117 },
  sukkur: { lat: 27.7244, lng: 68.8571 }, gwadar: { lat: 25.1216, lng: 62.3254 },
  nowshera: { lat: 34.0153, lng: 71.9747 }, swat: { lat: 34.9077, lng: 72.3562 },
  mansehra: { lat: 34.3292, lng: 73.1956 }, mirpur: { lat: 33.1481, lng: 73.7507 },
  muzaffarabad: { lat: 34.3700, lng: 73.4710 }, sialkot: { lat: 32.4945, lng: 74.5229 },
  gujranwala: { lat: 32.1877, lng: 74.1945 }, sahiwal: { lat: 30.6706, lng: 73.1063 },
  sargodha: { lat: 32.0836, lng: 72.6711 }, bahawalpur: { lat: 29.3956, lng: 71.6722 },
  larkana: { lat: 27.5570, lng: 68.2102 }, mardan: { lat: 34.2010, lng: 72.0414 },
}

// ── Location vagueness detection ────────────────────────────────────────────
// Names at city-level or broader — not specific enough for distance-based dispatch

export const LOCATION_VAGUE_NAMES = new Set<string>([
  // Major cities (single-word, directly from CITY_COORDS)
  'karachi', 'lahore', 'islamabad', 'rawalpindi', 'peshawar', 'quetta', 'multan',
  'faisalabad', 'hyderabad', 'abbottabad', 'sukkur', 'gwadar', 'nowshera', 'swat',
  'mansehra', 'mirpur', 'muzaffarabad', 'sialkot', 'gujranwala', 'sahiwal',
  'sargodha', 'bahawalpur', 'larkana', 'mardan',
  // Multi-word cities (checked as full string)
  'dera ghazi khan', 'dera ismail khan', 'rahim yar khan',
  // Provinces / regions
  'sindh', 'punjab', 'balochistan', 'kpk', 'azad kashmir', 'gilgit baltistan', 'pakistan',
  // Stopwords that carry no location specificity on their own
  'city', 'area', 'district', 'province', 'region',
])

/**
 * Returns true when the location string is at city-level or broader granularity
 * (e.g. "Lahore", "Karachi", "Pakistan") and is therefore not specific enough
 * for distance-based dispatch. Area-level inputs like "DHA Lahore" return false.
 */
export function isLocationTooVague(location: string): boolean {
  const normalized = location.toLowerCase().replace(/[,\-\.]/g, ' ').trim()
  if (!normalized) return true

  // Full-string match catches multi-word city names like "Dera Ghazi Khan"
  if (LOCATION_VAGUE_NAMES.has(normalized)) return true

  // All individual tokens must be vague names for the location to be considered vague
  const tokens = normalized.split(/\s+/).filter((t) => t.length >= 2)
  return tokens.length > 0 && tokens.every((t) => LOCATION_VAGUE_NAMES.has(t))
}

export function getApproxCoords(location: string): { lat: number; lng: number } {
  const lower = location.toLowerCase()
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (lower.includes(city)) return coords
  }
  return { lat: 30.3753, lng: 69.3451 } // Pakistan centroid
}

// ── normalizeLocation ───────────────────────────────────────────────────────

export function normalizeLocation(input: string): NormalizeResult {
  const trimmed = input?.trim() ?? ''
  const isUrdu = hasUrduScript(trimmed)
  const transliterated = isUrdu ? urduToEnglish(trimmed) : trimmed
  const lower = transliterated.toLowerCase()

  let city: string | null = null
  let area: string | null = null
  let confidence = 0

  for (const place of PAKISTAN_PLACES) {
    if (lower.includes(place)) {
      if (CITY_COORDS[place]) {
        city = place
        confidence = Math.max(confidence, 0.85)
      } else {
        area = area ?? place
        confidence = Math.max(confidence, 0.75)
      }
    }
  }

  return { normalizedText: transliterated, city, area, confidence, hasUrdu: isUrdu }
}

// ── Pakistan bounds / name check ────────────────────────────────────────────

function isInPakistanByBounds(lat: number, lng: number): boolean {
  return lat >= 23.5 && lat <= 37.5 && lng >= 60.8 && lng <= 77.9
}

function isInPakistanByName(displayName: string): boolean {
  const lower = displayName.toLowerCase()
  return lower.includes('pakistan') || lower.includes('azad kashmir') || lower.includes('gilgit-baltistan')
}

// ── GPS location validation (for routes — no text validation needed) ─────────

export function validateGPSLocation(lat: number, lng: number, addressText: string): LocationValidationResult {
  const inPak = isInPakistanByBounds(lat, lng)
  return {
    valid: true,
    pendingReview: !inPak,
    lat,
    lng,
    normalizedAddress: addressText,
    confidence: 'high',
    method: 'gps',
    dispatchRegion: inPak ? 'pakistan' : 'international',
    validationStatus: 'verified_gps',
  }
}

// ── Nominatim helper ────────────────────────────────────────────────────────

async function nominatimSearch(
  query: string,
  countrycodes: string | null,
  timeoutMs: number
): Promise<{ lat: number; lng: number; displayName: string } | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const searchQuery = countrycodes === 'pk' ? `${query}, Pakistan` : query
    const encoded = encodeURIComponent(searchQuery)
    const ccParam = countrycodes ? `&countrycodes=${countrycodes}` : ''
    const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1${ccParam}`
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'RescueNet-AI/1.0 (hackathon@rescuenet.pk)' },
    })
    clearTimeout(timer)
    if (!res.ok) return null
    const data = await res.json() as Array<{ lat: string; lon: string; display_name: string }>
    if (data.length === 0) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), displayName: data[0].display_name }
  } catch {
    return null
  }
}

// ── Fake-location heuristic ─────────────────────────────────────────────────

function isLikelyFakeLocation(location: string): boolean {
  const s = location.trim()

  if (s.length < 3) return true
  if (hasUrduScript(s)) return false
  if (!/[a-zA-Z]/.test(s)) return true

  const words = s.split(/[\s,\-\/]+/).filter((w) => w.length > 0)

  // Every word > 3 letters must have at least one vowel
  const hasAnyRealWord = words.some((word) => {
    const w = word.replace(/[^a-zA-Z]/g, '').toLowerCase()
    if (w.length === 0) return false
    if (w.length <= 3) return true
    return /[aeiou]/.test(w)
  })
  if (!hasAnyRealWord) return true

  // Reject words that are obviously repeating keyboard mash (e.g. "asdasd", "abcabc")
  for (const word of words) {
    const letters = word.replace(/[^a-zA-Z]/g, '').toLowerCase()
    if (letters.length < 6) continue
    for (let patLen = 2; patLen <= Math.min(4, Math.floor(letters.length / 2)); patLen++) {
      const pat = letters.slice(0, patLen)
      if (letters === pat.repeat(Math.ceil(letters.length / patLen)).slice(0, letters.length)) {
        return true
      }
    }
  }

  return false
}

function keywordMatch(lower: string): boolean {
  return PAKISTAN_PLACES.some((p) => lower.includes(p))
}

// ── Main validation function ────────────────────────────────────────────────

export async function validateLocation(location: string): Promise<LocationValidationResult> {
  const trimmed = location?.trim() ?? ''

  if (!trimmed) {
    return { valid: false, reason: 'Location is required.', validationStatus: 'invalid' }
  }

  // ── Urdu script fast-path ────────────────────────────────────────────────
  if (hasUrduScript(trimmed)) {
    const norm = normalizeLocation(trimmed)
    const approx = getApproxCoords(norm.normalizedText)

    if (norm.confidence >= 0.75) {
      return {
        valid: true,
        lat: approx.lat,
        lng: approx.lng,
        normalizedAddress: norm.city
          ? `${norm.city.charAt(0).toUpperCase() + norm.city.slice(1)}, Pakistan`
          : norm.normalizedText,
        confidence: norm.city ? 'high' : 'medium',
        method: 'urdu',
        dispatchRegion: 'pakistan',
        validationStatus: 'verified_keyword',
      }
    }

    // Urdu text but city not recognised — coordinator review, stay in Pakistan region
    return {
      valid: true,
      pendingReview: true,
      lat: approx.lat,
      lng: approx.lng,
      normalizedAddress: trimmed,
      confidence: 'low',
      method: 'urdu',
      dispatchRegion: 'unknown',
      validationStatus: 'pending_review',
    }
  }

  const lower = trimmed.toLowerCase()

  // ── Pakistan keyword match (fast — no network call) ──────────────────────
  // Runs BEFORE the fake check so valid abbreviations like "cantt", "dha", "f-7"
  // are never tested against the heuristic vowel/repetition filters.
  if (keywordMatch(lower)) {
    const approx = getApproxCoords(trimmed)
    return {
      valid: true,
      lat: approx.lat,
      lng: approx.lng,
      normalizedAddress: trimmed,
      confidence: 'medium',
      method: 'keyword',
      dispatchRegion: 'pakistan',
      validationStatus: 'verified_keyword',
    }
  }

  // ── Hard fake check ──────────────────────────────────────────────────────
  if (isLikelyFakeLocation(trimmed)) {
    return {
      valid: false,
      reason: 'Please enter a real city, area, or address.',
      validationStatus: 'invalid',
    }
  }

  // ── Nominatim: Pakistan-restricted search ────────────────────────────────
  const pkResult = await nominatimSearch(trimmed, 'pk', 3000)
  if (pkResult) {
    return {
      valid: true,
      lat: pkResult.lat,
      lng: pkResult.lng,
      normalizedAddress: pkResult.displayName,
      confidence: 'high',
      method: 'geocode',
      dispatchRegion: 'pakistan',
      validationStatus: 'verified_geocoded',
    }
  }

  // ── Nominatim: global search (may find international locations) ──────────
  const globalResult = await nominatimSearch(trimmed, null, 3000)
  if (globalResult) {
    const inPak = isInPakistanByName(globalResult.displayName) || isInPakistanByBounds(globalResult.lat, globalResult.lng)
    if (inPak) {
      return {
        valid: true,
        lat: globalResult.lat,
        lng: globalResult.lng,
        normalizedAddress: globalResult.displayName,
        confidence: 'high',
        method: 'geocode',
        dispatchRegion: 'pakistan',
        validationStatus: 'verified_geocoded',
      }
    }
    // Valid address but outside Pakistan dispatch region
    return {
      valid: true,
      pendingReview: true,
      lat: globalResult.lat,
      lng: globalResult.lng,
      normalizedAddress: globalResult.displayName,
      confidence: 'medium',
      method: 'geocode',
      dispatchRegion: 'international',
      validationStatus: 'verified_geocoded',
    }
  }

  // ── Nothing confirmed — reject ───────────────────────────────────────────
  return {
    valid: false,
    reason: 'Location could not be verified. Please include a city or area name (e.g. "Gulberg, Lahore" or "G-9, Islamabad").',
    validationStatus: 'invalid',
  }
}
