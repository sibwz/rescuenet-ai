'use client'

import { useEffect, useRef, useState } from 'react'
import { Plus, AlertTriangle, MapPin, Users, Clock, Brain, Filter, Trash2, CheckCircle, UserCheck, Package, Loader2, XCircle } from 'lucide-react'
import type { EmergencyRequest, EmergencyType, UrgencyLevel, RequestStatus } from '@/types'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import UseLocationButton from '@/components/ui/UseLocationButton'
import DbOfflineBanner from '@/components/ui/DbOfflineBanner'

const defaultForm = {
  reporterName: '',
  location: '',
  emergencyType: 'medical' as EmergencyType,
  description: '',
  urgency: 'medium' as UrgencyLevel,
  peopleAffected: 1,
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Awaiting Dispatch',
  assigned: 'Assigned',
  completed: 'Completed',
  awaiting_coordinator_review: 'Coordinator Review',
  waiting_for_volunteer: 'Waiting Volunteer',
  resource_shortage: 'Resource Shortage',
  cancelled: 'Cancelled',
}

function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status
}

function computeAIPriorityScore(req: EmergencyRequest): number {
  const urgencyBase: Record<string, number> = { critical: 78, high: 60, medium: 38, low: 18 }
  const typeBonus: Record<string, number> = { medical: 7, evacuation: 6, water: 5, shelter: 4, food: 3 }
  const peopleFactor = Math.min(12, Math.floor(req.peopleAffected / 15))
  const statusBonus = req.status === 'pending' ? 3 : 0
  const base = urgencyBase[req.urgency] ?? 30
  const type = typeBonus[req.emergencyType] ?? 3
  return Math.min(100, base + type + peopleFactor + statusBonus)
}

function PriorityScoreBadge({ score }: { score: number }) {
  let color: string
  let bg: string
  let border: string
  if (score >= 85) { color = '#f87171'; bg = 'rgba(220,38,38,0.1)'; border = 'rgba(220,38,38,0.25)' }
  else if (score >= 70) { color = '#fb923c'; bg = 'rgba(249,115,22,0.1)'; border = 'rgba(249,115,22,0.25)' }
  else if (score >= 50) { color = '#facc15'; bg = 'rgba(234,179,8,0.1)'; border = 'rgba(234,179,8,0.25)' }
  else { color = '#4ade80'; bg = 'rgba(34,197,94,0.1)'; border = 'rgba(34,197,94,0.25)' }
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: bg, border: `1px solid ${border}` }} title={`AI Priority Score: ${score}/100`}>
      <Brain style={{ width: 11, height: 11, color }} />
      <span className="text-xs font-bold tabular-nums" style={{ color }}>{score}</span>
      <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>/100</span>
    </div>
  )
}

export default function EmergencyPage() {
  const [requests, setRequests] = useState<EmergencyRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [dbError, setDbError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [submitting, setSubmitting] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const [cleaningDemo, setCleaningDemo] = useState(false)
  const [cleanDemoResult, setCleanDemoResult] = useState<string | null>(null)
  const [modalError, setModalError] = useState<string | null>(null)
  const [modalGpsCoords, setModalGpsCoords] = useState<{ lat: number; lng: number } | null>(null)

  // Real-time location validation for new request modal
  const [modalLocStatus, setModalLocStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle')
  const [modalLocNormalized, setModalLocNormalized] = useState<string | null>(null)
  const [modalLocError, setModalLocError] = useState<string | null>(null)
  const modalLocTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function load(silent = false) {
    if (!silent) setLoading(true)
    setDbError(null)
    try {
      const res = await fetch('/api/emergency')
      const data = await res.json()
      if (data?.offline) {
        if (!silent) { setOffline(true); setLoading(false) }
        return
      }
      setOffline(false)
      if (!res.ok) {
        setDbError(data.error ?? 'Failed to load emergency requests')
        setRequests([])
      } else {
        setRequests(Array.isArray(data) ? data : [])
      }
    } catch {
      if (!silent) setDbError('Network error — check that the dev server is running')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  function handleModalLocationChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setForm((prev) => ({ ...prev, location: val }))
    setModalGpsCoords(null)
    setModalLocNormalized(null)
    setModalLocError(null)

    if (modalLocTimerRef.current) clearTimeout(modalLocTimerRef.current)
    if (!val.trim()) { setModalLocStatus('idle'); return }
    setModalLocStatus('validating')

    modalLocTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/validate-location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ location: val }),
        })
        const data = await res.json() as { valid: boolean; tooVague?: boolean; normalizedAddress?: string; reason?: string }
        if (data.valid && !data.tooVague) {
          setModalLocStatus('valid')
          setModalLocNormalized(data.normalizedAddress ?? val)
          setModalLocError(null)
        } else if (data.tooVague) {
          setModalLocStatus('invalid')
          setModalLocError('Location is too broad. Please provide a specific area or landmark.')
        } else {
          setModalLocStatus('invalid')
          setModalLocError(data.reason ?? 'Location not recognized. Enter a real area or address.')
        }
      } catch {
        setModalLocStatus('idle')
      }
    }, 700)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!modalGpsCoords && modalLocStatus !== 'valid') {
      setModalError('Please wait for location to be verified before submitting.')
      return
    }
    setSubmitting(true)
    setModalError(null)
    try {
      const res = await fetch('/api/emergency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          ...(modalGpsCoords ? { lat: modalGpsCoords.lat, lng: modalGpsCoords.lng } : {}),
        }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setModalError(data.error ?? 'Request failed. Check the location.')
        return
      }
      setShowModal(false)
      setForm(defaultForm)
      setModalGpsCoords(null)
      setModalLocStatus('idle')
      setModalLocNormalized(null)
      setModalLocError(null)
      await load()
    } catch {
      setModalError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCleanupDemo() {
    setCleaningDemo(true)
    setCleanDemoResult(null)
    try {
      const res = await fetch('/api/admin/cleanup-demo', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setCleanDemoResult(data.message ?? 'Demo records cleared.')
        await load()
      } else {
        setCleanDemoResult(`Cleanup failed: ${data.error}`)
      }
    } catch {
      setCleanDemoResult('Cleanup request failed — check network connection.')
    } finally {
      setCleaningDemo(false)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(() => load(true), 15000)
    return () => clearInterval(interval)
  }, [])

  const FILTERS = [
    'all', 'critical', 'high', 'medium', 'low',
    'pending', 'waiting_for_volunteer', 'resource_shortage',
    'awaiting_coordinator_review', 'assigned', 'completed',
  ]

  const filtered = filter === 'all' ? requests : requests.filter((r) => r.urgency === filter || r.status === filter)
  const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 }
  const sorted = [...filtered].sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency])

  const criticalCount = requests.filter((r) => r.urgency === 'critical').length
  const pendingCount = requests.filter((r) => ['pending', 'waiting_for_volunteer', 'resource_shortage'].includes(r.status)).length
  const reviewCount = requests.filter((r) => r.status === 'awaiting_coordinator_review').length

  const submitDisabled = submitting || (!modalGpsCoords && modalLocStatus !== 'valid')

  return (
    <div className="p-6 space-y-5 page-enter">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Emergency Requests</h1>
          <p className="text-sm mt-1" style={{ color: '#64748b' }}>
            {requests.length} total
            {criticalCount > 0 && <span className="text-red-400 font-medium ml-2">· {criticalCount} critical</span>}
            {pendingCount > 0 && <span className="text-yellow-400 font-medium ml-2">· {pendingCount} pending/waiting</span>}
            {reviewCount > 0 && <span className="text-orange-400 font-medium ml-2">· {reviewCount} coordinator review</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleCleanupDemo} loading={cleaningDemo} title="Delete all records with source=demo from the database">
            <Trash2 className="w-4 h-4" />
            Clear Demo Records
          </Button>
          <Button onClick={() => { setShowModal(true); setModalLocStatus('idle'); setModalLocNormalized(null); setModalLocError(null) }}>
            <Plus className="w-4 h-4" />
            New Request
          </Button>
        </div>
      </div>

      {cleanDemoResult && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-2" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
          <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
          <span className="text-green-300 text-sm">{cleanDemoResult}</span>
          <button className="ml-auto text-gray-600 hover:text-gray-400 text-xs" onClick={() => setCleanDemoResult(null)}>✕</button>
        </div>
      )}

      {offline && <DbOfflineBanner onRetry={load} />}
      {dbError && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-2" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)' }}>
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-red-300 text-sm">{dbError}</span>
        </div>
      )}

      {/* ── Status Legend ──────────────────────────────────────────── */}
      <div className="rounded-xl px-4 py-3" style={{ background: '#1A2332', border: '1px solid #2A3647' }}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-semibold" style={{ color: '#E5E7EB' }}>Status Guide</span>
          </div>
          {[
            { label: 'Pending', color: '#FBBF24', desc: 'Awaiting dispatch' },
            { label: 'Waiting Volunteer', color: '#A78BFA', desc: 'No volunteer available' },
            { label: 'Resource Shortage', color: '#F97316', desc: 'No matching resources' },
            { label: 'Awaiting Review', color: '#FCA5A5', desc: 'Critical — coordinator needed' },
            { label: 'Assigned', color: '#10B981', desc: 'Dispatched' },
          ].map(({ label, color, desc }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[11px] font-medium" style={{ color: '#E5E7EB' }}>{label}</span>
              <span className="text-[10px]" style={{ color: '#64748B' }}>({desc})</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Filter className="w-3.5 h-3.5 mr-1" style={{ color: '#475569' }} />
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
            style={
              filter === f
                ? { background: 'rgba(16,185,129,0.16)', color: '#34d399', border: '1px solid rgba(16,185,129,0.35)' }
                : { background: 'rgba(42,54,71,0.4)', color: '#64748B', border: '1px solid rgba(42,54,71,0.7)' }
            }
          >
            {f === 'all' ? 'All' : getStatusLabel(f).replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* ── Table ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#1A2332', border: '1px solid #2A3647' }}>
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid #2A3647', background: '#202B3C' }}>
              <th className="text-left px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Location / Reporter</th>
              <th className="text-left px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Type</th>
              <th className="text-left px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Urgency</th>
              <th className="text-left px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>
                <div className="flex items-center gap-1"><Brain className="w-3 h-3 text-blue-400" />AI Priority</div>
              </th>
              <th className="text-left px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>People</th>
              <th className="text-left px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Status</th>
              <th className="text-left px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Note</th>
              <th className="text-left px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Time</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-5 py-12">
                <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-10 w-full" />)}</div>
              </td></tr>
            ) : sorted.length === 0 ? (
              <tr><td colSpan={8} className="px-5 py-14 text-center">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2" style={{ color: '#334155' }} />
                <p className="text-sm" style={{ color: '#475569' }}>No requests found.</p>
              </td></tr>
            ) : (
              sorted.map((req) => {
                const score = computeAIPriorityScore(req)
                return (
                  <tr
                    key={req._id}
                    className="transition-colors"
                    style={{ borderBottom: '1px solid #2A3647' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.04)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-semibold" style={{ color: '#E5E7EB' }}>{req.reporterName}</p>
                      <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: '#64748b' }}>
                        <MapPin className="w-3 h-3" />{req.location}
                      </p>
                      {req.locationValidated && req.latitude && (
                        <p className="text-[10px] mt-0.5" style={{ color: '#10b981' }}>
                          ✓ {req.latitude.toFixed(4)}, {req.longitude?.toFixed(4)}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-medium capitalize text-slate-300">{req.emergencyType}</span>
                      <p className="text-xs mt-0.5 line-clamp-1" style={{ color: '#475569' }}>{req.description}</p>
                    </td>
                    <td className="px-5 py-3.5"><Badge variant={req.urgency}>{req.urgency}</Badge></td>
                    <td className="px-5 py-3.5"><PriorityScoreBadge score={score} /></td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-medium text-slate-300 flex items-center gap-1">
                        <Users className="w-3 h-3" style={{ color: '#64748b' }} />{req.peopleAffected}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={req.status as RequestStatus}>{getStatusLabel(req.status)}</Badge>
                    </td>
                    <td className="px-5 py-3.5 max-w-[200px]">
                      {req.status === 'assigned' ? (
                        <div className="space-y-1">
                          {req.assignedVolunteerName && (
                            <p className="text-[11px] flex items-center gap-1 font-semibold" style={{ color: '#34d399' }}>
                              <UserCheck style={{ width: 11, height: 11, flexShrink: 0 }} />{req.assignedVolunteerName}
                            </p>
                          )}
                          {req.assignedResourceType && (
                            <p className="text-[11px] flex items-center gap-1" style={{ color: '#60a5fa' }}>
                              <Package style={{ width: 10, height: 10, flexShrink: 0 }} />{req.assignedResourceType}
                            </p>
                          )}
                          {req.estimatedETA && (
                            <p className="text-[11px] flex items-center gap-1" style={{ color: '#facc15' }}>
                              <Clock style={{ width: 10, height: 10, flexShrink: 0 }} />ETA {req.estimatedETA}
                            </p>
                          )}
                        </div>
                      ) : req.status === 'waiting_for_volunteer' ? (
                        <p className="text-[11px]" style={{ color: '#fde68a' }}>No available volunteer nearby</p>
                      ) : req.status === 'resource_shortage' ? (
                        <p className="text-[11px]" style={{ color: '#fed7aa' }}>Required resource unavailable</p>
                      ) : req.noMatchReason ? (
                        <p className="text-[11px] leading-tight" style={{ color: '#94a3b8' }} title={req.noMatchReason}>
                          {req.noMatchReason.slice(0, 60)}{req.noMatchReason.length > 60 ? '…' : ''}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs flex items-center gap-1" style={{ color: '#475569' }}>
                        <Clock className="w-3 h-3" />
                        {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : '—'}
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Add Request Modal ──────────────────────────────────────── */}
      <Modal
        open={showModal}
        onClose={() => {
          setShowModal(false)
          setModalError(null)
          setModalGpsCoords(null)
          setModalLocStatus('idle')
          setModalLocNormalized(null)
          setModalLocError(null)
        }}
        title="New Emergency Request"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {modalError && (
            <div className="rounded-xl px-3 py-2.5 flex items-center gap-2" style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.25)' }}>
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span className="text-red-300 text-sm">{modalError}</span>
            </div>
          )}
          <div>
            <label className="block text-slate-300 text-xs font-semibold mb-1.5 uppercase tracking-wide">Reporter Name</label>
            <input
              required
              className="w-full rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none transition-colors"
              style={{ background: '#1e293b', border: '1px solid #334155' }}
              value={form.reporterName}
              onChange={(e) => setForm({ ...form, reporterName: e.target.value })}
              placeholder="Full name"
            />
          </div>
          <div>
            <label className="block text-slate-300 text-xs font-semibold mb-1.5 uppercase tracking-wide">Location</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: modalGpsCoords ? '#22c55e' : modalLocStatus === 'valid' ? '#22c55e' : modalLocStatus === 'invalid' ? '#ef4444' : '#475569' }} />
              <input
                required
                className="w-full rounded-xl pl-9 pr-9 py-2.5 text-white text-sm focus:outline-none transition-colors"
                style={{
                  background: '#1e293b',
                  border: modalGpsCoords || modalLocStatus === 'valid'
                    ? '1px solid rgba(34,197,94,0.5)'
                    : modalLocStatus === 'invalid'
                      ? '1px solid rgba(239,68,68,0.5)'
                      : '1px solid #334155',
                }}
                value={form.location}
                onChange={handleModalLocationChange}
                placeholder="e.g. Gulberg Lahore or G-9 Islamabad"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {!modalGpsCoords && modalLocStatus === 'validating' && <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#475569' }} />}
                {(modalGpsCoords || modalLocStatus === 'valid') && <CheckCircle className="w-4 h-4" style={{ color: '#22c55e' }} />}
                {!modalGpsCoords && modalLocStatus === 'invalid' && <XCircle className="w-4 h-4" style={{ color: '#ef4444' }} />}
              </div>
            </div>
            {!modalGpsCoords && modalLocStatus === 'invalid' && modalLocError && (
              <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: '#f87171' }}>
                <AlertTriangle className="w-3 h-3 flex-shrink-0" />{modalLocError}
              </p>
            )}
            {!modalGpsCoords && modalLocStatus === 'valid' && modalLocNormalized && (
              <p className="text-xs mt-1.5" style={{ color: '#4ade80' }}>✓ {modalLocNormalized}</p>
            )}
            {!modalGpsCoords && modalLocStatus === 'idle' && (
              <p className="text-[10px] mt-1" style={{ color: '#475569' }}>
                Accepted: DHA Lahore, F-7 Islamabad, Clifton Karachi · Rejected: Lahore, Pakistan
              </p>
            )}
            <UseLocationButton
              onLocation={({ location, lat, lng }) => {
                setForm((prev) => ({ ...prev, location }))
                setModalGpsCoords({ lat, lng })
                setModalLocStatus('valid')
                setModalLocNormalized(location)
                setModalLocError(null)
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 text-xs font-semibold mb-1.5 uppercase tracking-wide">Emergency Type</label>
              <select
                className="w-full rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none"
                style={{ background: '#1e293b', border: '1px solid #334155' }}
                value={form.emergencyType}
                onChange={(e) => setForm({ ...form, emergencyType: e.target.value as EmergencyType })}
              >
                <option value="medical">Medical</option>
                <option value="food">Food</option>
                <option value="water">Water</option>
                <option value="shelter">Shelter</option>
                <option value="evacuation">Evacuation</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-300 text-xs font-semibold mb-1.5 uppercase tracking-wide">Urgency Level</label>
              <select
                className="w-full rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none"
                style={{ background: '#1e293b', border: '1px solid #334155' }}
                value={form.urgency}
                onChange={(e) => setForm({ ...form, urgency: e.target.value as UrgencyLevel })}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-slate-300 text-xs font-semibold mb-1.5 uppercase tracking-wide">Description</label>
            <textarea
              required
              rows={3}
              className="w-full rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none resize-none"
              style={{ background: '#1e293b', border: '1px solid #334155' }}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe the emergency situation..."
            />
          </div>
          <div>
            <label className="block text-slate-300 text-xs font-semibold mb-1.5 uppercase tracking-wide">People Affected</label>
            <input
              required
              type="number"
              min={1}
              className="w-full rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none"
              style={{ background: '#1e293b', border: '1px solid #334155' }}
              value={form.peopleAffected}
              onChange={(e) => setForm({ ...form, peopleAffected: parseInt(e.target.value) || 1 })}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button
              type="submit"
              loading={submitting}
              disabled={submitDisabled}
              variant="danger"
              title={submitDisabled && !submitting ? 'Verify location before submitting' : undefined}
            >
              Submit Request
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
