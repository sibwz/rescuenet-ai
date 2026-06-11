'use client'

import { useEffect, useRef, useState } from 'react'
import { Plus, Users, MapPin, Phone, Mail, Car, UserCheck, WifiOff, RefreshCw, AlertTriangle, ExternalLink, Clock, Package, CheckCircle, ShieldCheck, XCircle, Loader2 } from 'lucide-react'
import type { VolunteerSkill, VolunteerStatus } from '@/types'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import UseLocationButton from '@/components/ui/UseLocationButton'
import DbOfflineBanner from '@/components/ui/DbOfflineBanner'
import Link from 'next/link'
import { computeETAMinutes, formatETA } from '@/lib/eta'

// ── Types ────────────────────────────────────────────────────────────────────

interface MissionInfo {
  _id: string
  status: string
  volunteerConfidence?: number
  missionSuccessProbability?: number
  emergencyRequest?: {
    _id?: string
    location?: string
    emergencyType?: string
    urgency?: string
    peopleAffected?: number
    reporterName?: string
  } | null
  resource?: {
    _id?: string
    resourceType?: string
    quantity?: number
    location?: string
  } | null
}

interface VolunteerWithMission {
  _id?: string
  name: string
  phone: string
  email: string
  location: string
  latitude?: number
  longitude?: number
  locationValidated?: boolean
  locationPrecision?: 'exact' | 'area' | 'city_only' | 'invalid'
  skills: VolunteerSkill[]
  hasVehicle: boolean
  status: VolunteerStatus
  currentMissionId?: string
  currentMission?: MissionInfo | null
  verifiedEmail?: boolean
  approved?: boolean
  source?: string
  createdAt?: string
}

type RegistrationStep = 'idle' | 'sending_otp' | 'otp_modal' | 'verifying' | 'success'

// ── Static config ────────────────────────────────────────────────────────────

const defaultForm = {
  name: '',
  phone: '',
  email: '',
  location: '',
  skills: [] as VolunteerSkill[],
  hasVehicle: false,
}

const ALL_SKILLS: { value: VolunteerSkill; label: string; color: string; bg: string }[] = [
  { value: 'medical',          label: 'Medical',        color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
  { value: 'transport',        label: 'Transport',      color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  { value: 'food_distribution',label: 'Food Distrib.',  color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
  { value: 'rescue',           label: 'Rescue',         color: '#fb923c', bg: 'rgba(251,146,60,0.1)' },
  { value: 'logistics',        label: 'Logistics',      color: '#c084fc', bg: 'rgba(192,132,252,0.1)' },
]

const SKILL_MAP = Object.fromEntries(ALL_SKILLS.map((s) => [s.value, s]))

const STATUS_BORDER: Partial<Record<VolunteerStatus, string>> & { default: string } = {
  available:           'rgba(16,185,129,0.65)',
  busy:                'rgba(249,115,22,0.65)',
  deployed:            'rgba(249,115,22,0.65)',
  offline:             'rgba(71,85,105,0.35)',
  location_incomplete: 'rgba(234,179,8,0.55)',
  unverified:          'rgba(234,179,8,0.45)',
  pending_approval:    'rgba(96,165,250,0.55)',
  rejected:            'rgba(220,38,38,0.45)',
  default:             'rgba(71,85,105,0.35)',
}

function getStatusBorder(status: VolunteerStatus): string {
  return STATUS_BORDER[status] ?? STATUS_BORDER.default
}

const STATUS_META: Record<VolunteerStatus, { label: string; dot: string; desc: string }> = {
  available:           { label: 'Available',                  dot: '#34d399', desc: 'Ready for assignment' },
  busy:                { label: 'Deployed',                   dot: '#fb923c', desc: 'On active mission' },
  deployed:            { label: 'Deployed',                   dot: '#fb923c', desc: 'On active mission' },
  offline:             { label: 'Offline',                    dot: '#64748b', desc: 'Not currently active' },
  location_incomplete: { label: 'Location Incomplete',        dot: '#facc15', desc: 'Update location to receive assignments' },
  unverified:          { label: 'Awaiting Verification',      dot: '#facc15', desc: 'Awaiting email verification' },
  pending_approval:    { label: 'Pending Approval',           dot: '#60a5fa', desc: 'Awaiting coordinator approval' },
  rejected:            { label: 'Rejected',                   dot: '#f87171', desc: 'Registration rejected' },
}

const FILTER_TABS = [
  { key: 'all',             label: 'All' },
  { key: 'available',       label: 'Available' },
  { key: 'busy',            label: 'Deployed' },
  { key: 'pending_approval',label: 'Pending Approval' },
  { key: 'offline',         label: 'Offline' },
  { key: 'rejected',        label: 'Rejected' },
]

const RESOURCE_LABELS: Record<string, string> = {
  medicine: 'Medicine',
  food: 'Food',
  water: 'Water',
  shelter_kits: 'Shelter Kits',
  vehicles: 'Vehicles',
}

function urgencyColor(u?: string): string {
  const map: Record<string, string> = {
    critical: '#f87171', high: '#fb923c', medium: '#facc15', low: '#4ade80',
  }
  return map[u ?? ''] ?? '#94a3b8'
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function VolunteersPage() {
  const [volunteers, setVolunteers] = useState<VolunteerWithMission[]>([])
  const [loading, setLoading] = useState(true)
  const [dbError, setDbError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null)

  // Real-time location validation
  const [volLocStatus, setVolLocStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle')
  const [volLocError, setVolLocError] = useState<string | null>(null)
  const volLocTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // OTP / registration flow
  const [regStep, setRegStep] = useState<RegistrationStep>('idle')
  const [pendingVolunteerId, setPendingVolunteerId] = useState<string | null>(null)
  const [devOtp, setDevOtp] = useState<string | null>(null)
  const [otpInput, setOtpInput] = useState('')
  const [otpError, setOtpError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setDbError(null)
    try {
      const res = await fetch('/api/volunteers')
      const data = await res.json()
      if (data?.offline) { setOffline(true); setLoading(false); return }
      setOffline(false)
      if (!res.ok) { setDbError(data.error ?? 'Failed to load volunteers'); setVolunteers([]) }
      else { setVolunteers(Array.isArray(data) ? data : []) }
    } catch { setDbError('Network error') }
    finally { setLoading(false) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setRegStep('sending_otp')
    setSubmitError(null)
    try {
      const res = await fetch('/api/volunteers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, ...(gpsCoords ? { lat: gpsCoords.lat, lng: gpsCoords.lng } : {}) }),
      })
      const data = await res.json()
      if (!res.ok) { setSubmitError(data.error ?? 'Registration failed.'); setRegStep('idle'); return }
      setPendingVolunteerId(data.volunteerId)
      setDevOtp(data.devOtp ?? null)
      setOtpInput('')
      setOtpError(null)
      setRegStep('otp_modal')
    } catch { setSubmitError('Network error.'); setRegStep('idle') }
  }

  async function handleVerifyOtp() {
    setRegStep('verifying')
    try {
      const res = await fetch('/api/volunteers/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volunteerId: pendingVolunteerId, otp: otpInput }),
      })
      const data = await res.json()
      if (!res.ok) { setOtpError(data.error ?? 'Verification failed.'); setRegStep('otp_modal'); return }
      setRegStep('success')
      setTimeout(() => {
        setShowModal(false)
        setRegStep('idle')
        setForm(defaultForm)
        setGpsCoords(null)
        setPendingVolunteerId(null)
        setDevOtp(null)
        setOtpInput('')
        load()
      }, 2000)
    } catch { setOtpError('Network error.'); setRegStep('otp_modal') }
  }

  async function handleStatusChange(id: string, status: VolunteerStatus) {
    await fetch(`/api/volunteers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    await load()
  }

  async function handleApprove(id: string) {
    await fetch(`/api/volunteers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    })
    await load()
  }

  async function handleReject(id: string) {
    await fetch(`/api/volunteers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject' }),
    })
    await load()
  }

  function toggleSkill(skill: VolunteerSkill) {
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill],
    }))
  }

  function handleVolLocChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setForm((prev) => ({ ...prev, location: val }))
    setGpsCoords(null)
    setVolLocError(null)

    if (volLocTimerRef.current) clearTimeout(volLocTimerRef.current)
    if (!val.trim()) { setVolLocStatus('idle'); return }
    setVolLocStatus('validating')

    volLocTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/validate-location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ location: val }),
        })
        const data = await res.json() as { valid: boolean; tooVague?: boolean; normalizedAddress?: string; reason?: string }
        if (data.valid && !data.tooVague) {
          setVolLocStatus('valid')
          setVolLocError(null)
        } else if (data.tooVague) {
          setVolLocStatus('invalid')
          setVolLocError('Location is too broad. Use a specific area like Johar Town Lahore, not just Lahore.')
        } else {
          setVolLocStatus('invalid')
          setVolLocError(data.reason ?? 'Location not recognized. Enter a real area or address.')
        }
      } catch {
        setVolLocStatus('idle')
      }
    }, 700)
  }

  useEffect(() => { load() }, [])

  const filtered = filter === 'all'
    ? volunteers
    : volunteers.filter((v) => v.status === filter || (filter === 'busy' && v.status === 'deployed'))

  const counts = {
    available:        volunteers.filter((v) => v.status === 'available').length,
    busy:             volunteers.filter((v) => v.status === 'busy' || v.status === 'deployed').length,
    offline:          volunteers.filter((v) => v.status === 'offline').length,
    pending_approval: volunteers.filter((v) => v.status === 'pending_approval').length,
    rejected:         volunteers.filter((v) => v.status === 'rejected').length,
  }

  const pendingApprovalVolunteers = volunteers.filter((v) => v.status === 'pending_approval')

  return (
    <div className="p-6 space-y-5 page-enter">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#E5E7EB' }}>Volunteers</h1>
          <p className="text-sm mt-1 flex items-center gap-2" style={{ color: '#94A3B8' }}>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              <span className="text-emerald-400 font-semibold">{counts.available} available</span>
            </span>
            <span style={{ color: '#475569' }}>·</span>
            <span className="text-orange-400 font-semibold">{counts.busy} deployed</span>
            {counts.pending_approval > 0 && (
              <>
                <span style={{ color: '#475569' }}>·</span>
                <span className="text-blue-400 font-semibold">{counts.pending_approval} pending approval</span>
              </>
            )}
            <span style={{ color: '#475569' }}>·</span>
            <span style={{ color: '#6b7280' }}>{counts.offline} offline</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-2 rounded-lg transition-all"
            style={{ background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.10)', color: '#64748b' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#94a3b8' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#64748b' }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <Button onClick={() => { setShowModal(true); setRegStep('idle'); setSubmitError(null) }}>
            <Plus className="w-4 h-4" />
            Register Volunteer
          </Button>
        </div>
      </div>

      {offline && <DbOfflineBanner onRetry={load} />}
      {dbError && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-2" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)' }}>
          <span className="text-red-400 text-sm">{dbError}</span>
        </div>
      )}

      {/* ── Pending Approval Section ──────────────────── */}
      {pendingApprovalVolunteers.length > 0 && (
        <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)' }}>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-blue-300">Pending Coordinator Approval ({pendingApprovalVolunteers.length})</span>
          </div>
          <div className="space-y-2">
            {pendingApprovalVolunteers.map((vol) => (
              <div key={vol._id} className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(96,165,250,0.15)' }}>
                <div>
                  <p className="text-sm font-semibold text-white">{vol.name}</p>
                  <p className="text-xs" style={{ color: '#64748b' }}>{vol.email} · {vol.location}</p>
                  {vol.skills.length > 0 && (
                    <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>Skills: {vol.skills.join(', ')}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(vol._id!)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.18)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.1)' }}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(vol._id!)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{ background: 'rgba(220,38,38,0.1)', color: '#f87171', border: '1px solid rgba(220,38,38,0.25)' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(220,38,38,0.18)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(220,38,38,0.1)' }}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Filter Tabs ──────────────────────────────── */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {FILTER_TABS.map(({ key, label }) => {
          const active = filter === key
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150"
              style={
                active
                  ? { background: 'rgba(16,185,129,0.16)', color: '#34d399', border: '1px solid rgba(16,185,129,0.35)' }
                  : { background: 'rgba(42,54,71,0.4)', color: '#64748B', border: '1px solid rgba(42,54,71,0.7)' }
              }
              onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.color = '#94a3b8' }}
              onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.color = '#64748B' }}
            >
              {label}
              {key !== 'all' && (
                <span className="ml-1.5 text-[10px] opacity-70">
                  {counts[key as keyof typeof counts] ?? 0}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Cards ──────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton h-52 w-full rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: '#1A2332', border: '1px solid #2A3647' }}>
          <Users className="w-10 h-10 mx-auto mb-3" style={{ color: '#2A3647' }} />
          <p style={{ color: '#94A3B8' }}>No volunteers found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((vol) => {
            const meta = STATUS_META[vol.status] ?? { label: vol.status, dot: '#64748b', desc: '' }
            const mission = vol.currentMission
            const req = mission?.emergencyRequest
            const resource = mission?.resource
            const isDeployed = vol.status === 'busy' || vol.status === 'deployed'
            const etaMin = (isDeployed && req?.urgency && req?.peopleAffected)
              ? computeETAMinutes(req.urgency, req.peopleAffected)
              : null

            return (
              <div
                key={vol._id}
                className="rounded-2xl overflow-hidden card-hover flex flex-col"
                style={{
                  background: '#1A2332',
                  border: '1px solid #2A3647',
                  borderLeft: `3px solid ${getStatusBorder(vol.status)}`,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                }}
              >
                <div className="p-5 flex-1">
                  {/* Name + Status Badge */}
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm leading-tight truncate" style={{ color: '#E5E7EB' }}>{vol.name}</h3>
                      <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: '#94A3B8' }}>
                        <MapPin style={{ width: 11, height: 11 }} />
                        <span className="truncate">{vol.location}</span>
                      </p>
                      {vol.locationPrecision === 'city_only' && (
                        <p className="text-[10px] mt-0.5 font-semibold" style={{ color: '#fbbf24' }}>
                          ⚠ Location too broad — excluded from auto-dispatch
                        </p>
                      )}
                      {vol.locationPrecision === 'exact' && (
                        <p className="text-[10px] mt-0.5 font-semibold" style={{ color: '#34d399' }}>
                          ✓ GPS verified
                        </p>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      <Badge variant={
                        isDeployed ? 'busy' :
                        vol.status === 'offline' ? 'offline' :
                        vol.status === 'location_incomplete' ? 'pending' :
                        vol.status === 'pending_approval' ? 'pending' :
                        vol.status === 'rejected' ? 'offline' :
                        'available'
                      }>
                        {meta.label}
                      </Badge>
                    </div>
                  </div>

                  {/* ── DEPLOYED: Mission Details ─────────── */}
                  {isDeployed && mission ? (
                    <div className="mb-3 space-y-2">
                      {/* Assignment block */}
                      <div
                        className="rounded-xl p-3"
                        style={{ background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.2)' }}
                      >
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#fb923c' }}>
                          Active Assignment
                        </p>
                        {req ? (
                          <>
                            <p className="text-xs font-semibold text-white capitalize">
                              {req.emergencyType} emergency
                            </p>
                            <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: '#94a3b8' }}>
                              <MapPin style={{ width: 10, height: 10 }} />
                              {req.location}
                            </p>
                            {req.urgency && (
                              <p className="text-[10px] mt-0.5 font-semibold uppercase" style={{ color: urgencyColor(req.urgency) }}>
                                {req.urgency} priority
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-xs" style={{ color: '#94a3b8' }}>Assignment details loading…</p>
                        )}
                      </div>

                      {/* ETA + Resource row */}
                      <div className="flex items-center gap-2">
                        {etaMin !== null && (
                          <div
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg flex-shrink-0"
                            style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)' }}
                          >
                            <Clock style={{ width: 11, height: 11, color: '#facc15' }} />
                            <span className="text-[11px] font-semibold" style={{ color: '#facc15' }}>
                              ETA {formatETA(etaMin)}
                            </span>
                          </div>
                        )}
                        {resource?.resourceType && (
                          <div
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg min-w-0"
                            style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)' }}
                          >
                            <Package style={{ width: 11, height: 11, color: '#60a5fa', flexShrink: 0 }} />
                            <span className="text-[11px] font-medium truncate" style={{ color: '#93c5fd' }}>
                              {RESOURCE_LABELS[resource.resourceType] ?? resource.resourceType}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Mission ID + confidence */}
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono" style={{ color: '#475569' }}>
                          Mission {mission._id.slice(-6).toUpperCase()}
                        </span>
                        {mission.volunteerConfidence != null && (
                          <span className="text-[10px]" style={{ color: '#475569' }}>
                            {mission.volunteerConfidence}% confidence
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Non-deployed: standard status pill */
                    <div
                      className="flex items-center gap-1.5 mb-3 px-2.5 py-1.5 rounded-lg"
                      style={{
                        background: vol.status === 'available' ? 'rgba(16,185,129,0.07)'
                          : vol.status === 'pending_approval' ? 'rgba(96,165,250,0.07)'
                          : vol.status === 'rejected' ? 'rgba(220,38,38,0.07)'
                          : vol.status === 'unverified' ? 'rgba(234,179,8,0.07)'
                          : vol.status === 'location_incomplete' ? 'rgba(234,179,8,0.07)'
                          : 'rgba(71,85,105,0.08)',
                        border: `1px solid ${
                          vol.status === 'available' ? 'rgba(16,185,129,0.15)'
                          : vol.status === 'pending_approval' ? 'rgba(96,165,250,0.15)'
                          : vol.status === 'rejected' ? 'rgba(220,38,38,0.15)'
                          : vol.status === 'unverified' ? 'rgba(234,179,8,0.15)'
                          : vol.status === 'location_incomplete' ? 'rgba(234,179,8,0.15)'
                          : 'rgba(71,85,105,0.15)'}`,
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: meta.dot }} />
                      <span className="text-[11px] font-medium" style={{ color: meta.dot }}>{meta.desc}</span>
                    </div>
                  )}

                  {/* Contact */}
                  <div className="space-y-1 mb-3">
                    <p className="text-xs flex items-center gap-1.5" style={{ color: '#94A3B8' }}>
                      <Phone style={{ width: 11, height: 11 }} />{vol.phone}
                    </p>
                    <p className="text-xs flex items-center gap-1.5" style={{ color: '#94A3B8' }}>
                      <Mail style={{ width: 11, height: 11 }} />{vol.email}
                    </p>
                    {vol.hasVehicle && (
                      <p className="text-xs flex items-center gap-1.5" style={{ color: '#60a5fa' }}>
                        <Car style={{ width: 11, height: 11 }} />Has vehicle
                      </p>
                    )}
                  </div>

                  {/* Skills */}
                  <div className="flex flex-wrap gap-1.5">
                    {vol.skills.map((skill) => {
                      const sk = SKILL_MAP[skill]
                      return (
                        <span
                          key={skill}
                          className="text-[11px] px-2 py-0.5 rounded-md font-semibold capitalize"
                          style={{
                            background: sk?.bg ?? 'rgba(148,163,184,0.07)',
                            color: sk?.color ?? '#94a3b8',
                            border: `1px solid ${sk?.color ? sk.color + '28' : 'rgba(148,163,184,0.15)'}`,
                          }}
                        >
                          {skill.replace('_', ' ')}
                        </span>
                      )
                    })}
                  </div>
                </div>

                {/* ── Action Buttons ──────────────────────── */}
                <div
                  className="px-5 py-3 flex gap-2 flex-wrap"
                  style={{ borderTop: '1px solid #2A3647', background: '#202B3C' }}
                >
                  {/* Pending approval: Approve / Reject */}
                  {vol.status === 'pending_approval' && (
                    <>
                      <button
                        onClick={() => handleApprove(vol._id!)}
                        className="flex-1 text-xs flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all duration-150 font-semibold"
                        style={{ background: 'rgba(16,185,129,0.08)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}
                        onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(16,185,129,0.14)' }}
                        onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(16,185,129,0.08)' }}
                      >
                        <CheckCircle style={{ width: 12, height: 12 }} />
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(vol._id!)}
                        className="flex-1 text-xs flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all duration-150 font-semibold"
                        style={{ background: 'rgba(220,38,38,0.08)', color: '#f87171', border: '1px solid rgba(220,38,38,0.2)' }}
                        onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(220,38,38,0.14)' }}
                        onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(220,38,38,0.08)' }}
                      >
                        <XCircle style={{ width: 12, height: 12 }} />
                        Reject
                      </button>
                    </>
                  )}

                  {/* View Mission button when deployed */}
                  {isDeployed && mission && (
                    <Link href="/missions" className="flex-1">
                      <button
                        className="w-full text-xs flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all duration-150 font-semibold"
                        style={{ background: 'rgba(249,115,22,0.1)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.25)' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(249,115,22,0.16)' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(249,115,22,0.1)' }}
                      >
                        <ExternalLink style={{ width: 12, height: 12 }} />
                        View Mission
                      </button>
                    </Link>
                  )}

                  {/* Mark available button (not for pending/unverified/rejected) */}
                  {vol.status !== 'available' && vol.status !== 'pending_approval' && vol.status !== 'unverified' && vol.status !== 'rejected' && (
                    <button
                      onClick={() => handleStatusChange(vol._id!, 'available')}
                      className="flex-1 text-xs flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all duration-150 font-semibold"
                      style={{ background: 'rgba(16,185,129,0.08)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}
                      onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(16,185,129,0.14)'; el.style.borderColor = 'rgba(16,185,129,0.35)' }}
                      onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(16,185,129,0.08)'; el.style.borderColor = 'rgba(16,185,129,0.2)' }}
                    >
                      <UserCheck style={{ width: 12, height: 12 }} />
                      {isDeployed ? 'Release' : 'Mark Available'}
                    </button>
                  )}

                  {/* Set offline (not for already offline, rejected, unverified, pending) */}
                  {vol.status !== 'offline' && vol.status !== 'rejected' && vol.status !== 'unverified' && vol.status !== 'pending_approval' && (
                    <button
                      onClick={() => handleStatusChange(vol._id!, 'offline')}
                      className="flex-1 text-xs flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all duration-150 font-semibold"
                      style={{ background: 'rgba(71,85,105,0.08)', color: '#64748b', border: '1px solid rgba(71,85,105,0.18)' }}
                      onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(71,85,105,0.14)'; el.style.color = '#94a3b8'; el.style.borderColor = 'rgba(71,85,105,0.3)' }}
                      onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(71,85,105,0.08)'; el.style.color = '#64748b'; el.style.borderColor = 'rgba(71,85,105,0.18)' }}
                    >
                      <WifiOff style={{ width: 12, height: 12 }} />
                      Set Offline
                    </button>
                  )}

                  {/* Offline: no actions */}
                  {vol.status === 'offline' && (
                    <p className="flex-1 text-center text-[11px]" style={{ color: '#9ca3af' }}>
                      Not accepting assignments
                    </p>
                  )}

                  {/* Rejected: info */}
                  {vol.status === 'rejected' && (
                    <p className="flex-1 text-center text-[11px]" style={{ color: '#f87171' }}>
                      Registration rejected
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Register Modal ────────────────────────────── */}
      <Modal
        open={showModal}
        onClose={() => {
          if (regStep === 'otp_modal' || regStep === 'verifying') return
          setShowModal(false)
          setSubmitError(null)
          setGpsCoords(null)
          setVolLocStatus('idle')
          setVolLocError(null)
          setRegStep('idle')
        }}
        title="Register Volunteer"
        maxWidth="max-w-lg"
      >
        {(regStep === 'otp_modal' || regStep === 'verifying' || regStep === 'success') ? (
          <div className="space-y-4 text-center py-2">
            {regStep === 'success' ? (
              <div>
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <p className="text-white font-semibold">Email Verified!</p>
                <p className="text-sm text-slate-400 mt-1">Your registration is pending coordinator approval.</p>
              </div>
            ) : (
              <>
                <div>
                  <Mail className="w-10 h-10 text-blue-400 mx-auto mb-2" />
                  <p className="text-white font-semibold">Enter Verification Code</p>
                  <p className="text-sm text-slate-400 mt-1">A 6-digit code was sent to your email.</p>
                  {devOtp && (
                    <p className="text-xs mt-2 px-3 py-1.5 rounded-lg inline-block" style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)', color: '#facc15' }}>
                      Demo code: <strong>{devOtp}</strong>
                    </p>
                  )}
                </div>
                {otpError && (
                  <div className="rounded-xl px-3 py-2.5 flex items-center gap-2" style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.25)' }}>
                    <span className="text-red-300 text-sm">{otpError}</span>
                  </div>
                )}
                <input
                  type="text"
                  maxLength={6}
                  className="w-full text-center text-2xl tracking-widest rounded-xl px-3 py-3 text-white focus:outline-none"
                  style={{ background: '#1e293b', border: '1px solid #334155', letterSpacing: '0.3em' }}
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="• • • • • •"
                />
                <div className="flex gap-3">
                  <Button variant="ghost" type="button" onClick={() => { setRegStep('idle'); setPendingVolunteerId(null) }}>Back</Button>
                  <Button type="button" loading={regStep === 'verifying'} onClick={handleVerifyOtp} disabled={otpInput.length !== 6}>Verify</Button>
                </div>
              </>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {submitError && (
              <div className="rounded-xl px-3 py-2.5 flex items-center gap-2" style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.25)' }}>
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span className="text-red-300 text-sm">{submitError}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              {[
                { field: 'name',  label: 'Full Name', placeholder: 'Dr. Jane Smith',   type: 'text' },
                { field: 'phone', label: 'Phone',     placeholder: '+92-300-0000000',  type: 'tel' },
                { field: 'email', label: 'Email',     placeholder: 'volunteer@org.pk', type: 'email' },
              ].map(({ field, label, placeholder, type }) => (
                <div key={field}>
                  <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#6b7280' }}>
                    {label}
                  </label>
                  <input
                    required
                    type={type}
                    className="w-full rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none transition-all"
                    style={{ background: '#1e293b', border: '1px solid #334155' }}
                    value={(form as Record<string, unknown>)[field] as string}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                    placeholder={placeholder}
                  />
                </div>
              ))}
            </div>

            {/* Location with GPS button + real-time validation */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#6b7280' }}>
                Location
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: gpsCoords || volLocStatus === 'valid' ? '#22c55e' : volLocStatus === 'invalid' ? '#ef4444' : '#475569' }} />
                <input
                  required
                  type="text"
                  className="w-full rounded-xl pl-9 pr-9 py-2.5 text-white text-sm focus:outline-none transition-all"
                  style={{
                    background: '#1e293b',
                    border: gpsCoords || volLocStatus === 'valid'
                      ? '1px solid rgba(34,197,94,0.5)'
                      : volLocStatus === 'invalid'
                        ? '1px solid rgba(239,68,68,0.5)'
                        : '1px solid #334155',
                  }}
                  value={form.location}
                  onChange={handleVolLocChange}
                  placeholder="DHA Lahore / Johar Town / Clifton, Karachi"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {!gpsCoords && volLocStatus === 'validating' && <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#475569' }} />}
                  {(gpsCoords || volLocStatus === 'valid') && <CheckCircle className="w-4 h-4" style={{ color: '#22c55e' }} />}
                  {!gpsCoords && volLocStatus === 'invalid' && <XCircle className="w-4 h-4" style={{ color: '#ef4444' }} />}
                </div>
              </div>
              {!gpsCoords && volLocStatus === 'invalid' && volLocError && (
                <p className="text-xs mt-1 flex items-center gap-1" style={{ color: '#f87171' }}>
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />{volLocError}
                </p>
              )}
              {!gpsCoords && volLocStatus === 'idle' && (
                <p className="text-[10px] mt-1" style={{ color: '#475569' }}>
                  Use a specific area — e.g. Johar Town Lahore, not just Lahore.
                </p>
              )}
              <div className="flex items-center justify-between mt-1">
                <UseLocationButton
                  onLocation={({ location, lat, lng }) => {
                    setForm((prev) => ({ ...prev, location }))
                    setGpsCoords({ lat, lng })
                    setVolLocStatus('valid')
                    setVolLocError(null)
                  }}
                />
                <span className="text-[10px]" style={{ color: '#334155' }}>Used for nearest-response matching</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: '#6b7280' }}>
                Skills
              </label>
              <div className="flex flex-wrap gap-2">
                {ALL_SKILLS.map(({ value, label, color, bg }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleSkill(value)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
                    style={
                      form.skills.includes(value)
                        ? { background: bg, color, border: `1px solid ${color}40` }
                        : { background: 'rgba(148,163,184,0.05)', color: '#6b7280', border: '1px solid rgba(148,163,184,0.1)' }
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.hasVehicle}
                onChange={(e) => setForm({ ...form, hasVehicle: e.target.checked })}
                className="w-4 h-4 rounded accent-blue-500"
              />
              <span className="text-sm" style={{ color: '#7b8fa8' }}>Has Vehicle</span>
            </label>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button
                type="submit"
                loading={regStep === 'sending_otp'}
                disabled={regStep === 'sending_otp' || (!gpsCoords && volLocStatus !== 'valid')}
                title={!gpsCoords && volLocStatus !== 'valid' ? 'Verify location before registering' : undefined}
              >
                Register
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
