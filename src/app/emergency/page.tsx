'use client'

import { useEffect, useState } from 'react'
import { Plus, AlertTriangle, MapPin, Users, Clock, Brain, TrendingUp, Filter } from 'lucide-react'
import type { EmergencyRequest, EmergencyType, UrgencyLevel } from '@/types'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'

const defaultForm = {
  reporterName: '',
  location: '',
  emergencyType: 'medical' as EmergencyType,
  description: '',
  urgency: 'medium' as UrgencyLevel,
  peopleAffected: 1,
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
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
      style={{ background: bg, border: `1px solid ${border}` }}
      title={`AI Priority Score: ${score}/100. Based on urgency, people affected, emergency type, and current status.`}
    >
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
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [submitting, setSubmitting] = useState(false)
  const [filter, setFilter] = useState<string>('all')

  async function load() {
    setLoading(true)
    setDbError(null)
    try {
      const res = await fetch('/api/emergency')
      const data = await res.json()
      if (!res.ok) {
        setDbError(data.error ?? 'Failed to load emergency requests')
        setRequests([])
      } else {
        setRequests(Array.isArray(data) ? data : [])
      }
    } catch {
      setDbError('Network error — check that the dev server is running')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    await fetch('/api/emergency', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setShowModal(false)
    setForm(defaultForm)
    await load()
    setSubmitting(false)
  }

  async function handleStatusChange(id: string, status: string) {
    await fetch(`/api/emergency/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    await load()
  }

  useEffect(() => { load() }, [])

  const filtered = filter === 'all' ? requests : requests.filter((r) => r.urgency === filter || r.status === filter)
  const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 }
  const sorted = [...filtered].sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency])

  const criticalCount = requests.filter((r) => r.urgency === 'critical').length
  const pendingCount = requests.filter((r) => r.status === 'pending').length

  const FILTERS = ['all', 'critical', 'high', 'medium', 'low', 'pending', 'assigned', 'completed']

  return (
    <div className="p-6 space-y-5 page-enter">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            Emergency Requests
          </h1>
          <p className="text-sm mt-1" style={{ color: '#64748b' }}>
            {requests.length} total
            {criticalCount > 0 && <span className="text-red-400 font-medium ml-2">· {criticalCount} critical</span>}
            {pendingCount > 0 && <span className="text-yellow-400 font-medium ml-2">· {pendingCount} pending</span>}
          </p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4" />
          New Request
        </Button>
      </div>

      {dbError && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-2" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)' }}>
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-red-300 text-sm">{dbError}</span>
        </div>
      )}

      {/* ── AI Priority Legend ──────────────────────────── */}
      <div
        className="rounded-xl px-4 py-3 flex items-center gap-6"
        style={{ background: 'rgba(17,27,48,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold text-slate-300">AI Priority Score</span>
          <span className="text-xs" style={{ color: '#475569' }}>— Gemini-computed from urgency, affected count, type & status</span>
        </div>
        <div className="flex items-center gap-3 ml-auto">
          {[{ label: '85–100', color: '#f87171', desc: 'Critical' }, { label: '70–84', color: '#fb923c', desc: 'High' }, { label: '50–69', color: '#facc15', desc: 'Medium' }, { label: '0–49', color: '#4ade80', desc: 'Low' }].map(({ label, color, desc }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[11px] font-medium" style={{ color }}>{desc}</span>
              <span className="text-[10px]" style={{ color: '#334155' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Filter className="w-3.5 h-3.5 mr-1" style={{ color: '#475569' }} />
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
            style={
              filter === f
                ? { background: 'rgba(59,130,246,0.2)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' }
                : { background: 'rgba(255,255,255,0.04)', color: '#64748b', border: '1px solid rgba(255,255,255,0.06)' }
            }
          >
            {f}
          </button>
        ))}
      </div>

      {/* ── Table ──────────────────────────────────────── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'rgba(13,20,37,0.95)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <th className="text-left px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Location / Reporter</th>
              <th className="text-left px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Type</th>
              <th className="text-left px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Urgency</th>
              <th className="text-left px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>
                <div className="flex items-center gap-1">
                  <Brain className="w-3 h-3 text-blue-400" />
                  AI Priority
                </div>
              </th>
              <th className="text-left px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>People</th>
              <th className="text-left px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Status</th>
              <th className="text-left px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Time</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-5 py-12">
                  <div className="space-y-3">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="skeleton h-10 w-full" />
                    ))}
                  </div>
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-14 text-center">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2" style={{ color: '#334155' }} />
                  <p className="text-sm" style={{ color: '#475569' }}>No requests found.</p>
                </td>
              </tr>
            ) : (
              sorted.map((req) => {
                const score = computeAIPriorityScore(req)
                return (
                  <tr
                    key={req._id}
                    className="transition-colors"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    <td className="px-5 py-3.5">
                      <p className="text-white text-sm font-semibold">{req.reporterName}</p>
                      <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: '#64748b' }}>
                        <MapPin className="w-3 h-3" />{req.location}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-medium capitalize text-slate-300">{req.emergencyType}</span>
                      <p className="text-xs mt-0.5 line-clamp-1" style={{ color: '#475569' }}>{req.description}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={req.urgency}>{req.urgency}</Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <PriorityScoreBadge score={score} />
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-medium text-slate-300 flex items-center gap-1">
                        <Users className="w-3 h-3" style={{ color: '#64748b' }} />
                        {req.peopleAffected}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={req.status}>{req.status}</Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs flex items-center gap-1" style={{ color: '#475569' }}>
                        <Clock className="w-3 h-3" />
                        {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {req.status === 'pending' && (
                        <select
                          className="rounded-lg px-2 py-1 text-xs transition-colors"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}
                          onChange={(e) => handleStatusChange(req._id!, e.target.value)}
                          defaultValue=""
                        >
                          <option value="" disabled>Update</option>
                          <option value="assigned">Assigned</option>
                          <option value="completed">Completed</option>
                        </select>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Add Request Modal ───────────────────────────── */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Emergency Request">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 text-xs font-semibold mb-1.5 uppercase tracking-wide">Reporter Name</label>
              <input
                required
                className="w-full rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none transition-colors"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                value={form.reporterName}
                onChange={(e) => setForm({ ...form, reporterName: e.target.value })}
                placeholder="Full name"
              />
            </div>
            <div>
              <label className="block text-slate-300 text-xs font-semibold mb-1.5 uppercase tracking-wide">Location</label>
              <input
                required
                className="w-full rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none transition-colors"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="District, Zone, Block"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 text-xs font-semibold mb-1.5 uppercase tracking-wide">Emergency Type</label>
              <select
                className="w-full rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
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
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
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
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
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
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              value={form.peopleAffected}
              onChange={(e) => setForm({ ...form, peopleAffected: parseInt(e.target.value) || 1 })}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={submitting} variant="danger">Submit Request</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}