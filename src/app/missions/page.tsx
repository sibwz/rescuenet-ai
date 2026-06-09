'use client'

import { useEffect, useState } from 'react'
import { Target, User, Package, MapPin, Calendar, Download, Clock, CheckCircle, XCircle, Users, Brain, Timer } from 'lucide-react'
import type { Mission, EmergencyRequest, Volunteer, Resource } from '@/types'
import Badge from '@/components/ui/Badge'
import Link from 'next/link'

type PopulatedMission = Mission & {
  emergencyRequestId: EmergencyRequest
  volunteerId: Volunteer
  resourceId: Resource
}

const RESOURCE_ICONS: Record<string, string> = {
  food: '🍱', water: '💧', medicine: '💊', shelter_kits: '⛺', vehicles: '🚛',
}

function computeETA(mission: PopulatedMission): string {
  const req = mission.emergencyRequestId
  if (!req) return '—'
  const urgencyBase: Record<string, number> = { critical: 10, high: 22, medium: 35, low: 55 }
  const base = urgencyBase[req.urgency] ?? 30
  const peopleMod = Math.floor(Math.min(req.peopleAffected / 50, 1) * 8)
  const total = base + peopleMod
  return `${total} min`
}

const REASONING_FACTORS = [
  { key: 'urgency', label: 'Urgency Level', icon: '🚨' },
  { key: 'people', label: 'People Affected', icon: '👥' },
  { key: 'proximity', label: 'Volunteer Proximity', icon: '📍' },
  { key: 'resources', label: 'Resource Availability', icon: '📦' },
  { key: 'risk', label: 'Escalation Risk', icon: '⚠️' },
]

async function exportMissionPDF(mission: PopulatedMission) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF()
  const req = mission.emergencyRequestId
  const vol = mission.volunteerId
  const res = mission.resourceId

  doc.setFillColor(220, 38, 38)
  doc.rect(0, 0, 210, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('RescueNet AI', 15, 12)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Mission Report', 15, 20)
  doc.text(`Generated: ${new Date().toLocaleString()}`, 105, 20, { align: 'center' })
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('Mission Details', 15, 40)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Mission ID: ${mission._id ?? 'N/A'}`, 15, 48)
  doc.text(`Status: ${mission.status?.toUpperCase() ?? 'N/A'}`, 15, 55)
  doc.text(`Created: ${mission.createdAt ? new Date(mission.createdAt).toLocaleString() : 'N/A'}`, 15, 62)
  doc.text(`ETA: ${computeETA(mission)}`, 15, 69)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('Emergency Details', 15, 82)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  if (req) {
    doc.text(`Location: ${req.location ?? 'N/A'}`, 15, 90)
    doc.text(`Type: ${req.emergencyType ?? 'N/A'} | Urgency: ${(req.urgency ?? 'N/A').toUpperCase()}`, 15, 97)
    doc.text(`People Affected: ${req.peopleAffected ?? 'N/A'}`, 15, 104)
    doc.text(`Reporter: ${req.reporterName ?? 'N/A'}`, 15, 111)
    const descLines = doc.splitTextToSize(`Description: ${req.description ?? 'N/A'}`, 180)
    doc.text(descLines as string[], 15, 118)
  }
  const volY = 140
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('Assigned Volunteer', 15, volY)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  if (vol) {
    doc.text(`Name: ${vol.name ?? 'N/A'}`, 15, volY + 8)
    doc.text(`Location: ${vol.location ?? 'N/A'}`, 15, volY + 15)
    doc.text(`Skills: ${vol.skills?.join(', ').replace(/_/g, ' ') ?? 'N/A'}`, 15, volY + 22)
  }
  const resY = 180
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('Resource Allocation', 15, resY)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  if (res) {
    doc.text(`Type: ${res.resourceType?.replace(/_/g, ' ') ?? 'N/A'}`, 15, resY + 8)
    doc.text(`Quantity: ${res.quantity ?? 'N/A'} units`, 15, resY + 15)
    doc.text(`Location: ${res.location ?? 'N/A'}`, 15, resY + 22)
  }
  const aiY = 220
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('AI Reasoning', 15, aiY)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  if (mission.reasoning) {
    const lines = doc.splitTextToSize(mission.reasoning, 180)
    doc.text(lines as string[], 15, aiY + 8)
  }
  doc.setFillColor(243, 244, 246)
  doc.rect(0, 280, 210, 17, 'F')
  doc.setFontSize(8)
  doc.setTextColor(107, 114, 128)
  doc.text('RescueNet AI — Powered by Gemini AI & MongoDB Atlas | Google Cloud Rapid Agent Hackathon', 105, 289, { align: 'center' })
  doc.save(`mission-report-${mission._id ?? 'export'}.pdf`)
}

export default function MissionsPage() {
  const [missions, setMissions] = useState<PopulatedMission[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [updating, setUpdating] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/missions')
    const data = await res.json()
    setMissions(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  async function updateStatus(id: string, status: string) {
    setUpdating(id)
    await fetch(`/api/missions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    await load()
    setUpdating(null)
  }

  useEffect(() => { load() }, [])

  const filtered = filter === 'all' ? missions : missions.filter((m) => m.status === filter)
  const counts = {
    all: missions.length,
    active: missions.filter((m) => m.status === 'active').length,
    completed: missions.filter((m) => m.status === 'completed').length,
    cancelled: missions.filter((m) => m.status === 'cancelled').length,
  }

  return (
    <div className="p-6 space-y-5 page-enter">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Missions</h1>
          <p className="text-sm mt-1" style={{ color: '#64748b' }}>
            {counts.active} active · {counts.completed} completed · {counts.cancelled} cancelled
          </p>
        </div>
        <Link href="/agent">
          <button
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl transition-all"
            style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)', color: '#60a5fa' }}
          >
            <Target className="w-4 h-4" />
            Create via AI Agent
          </button>
        </Link>
      </div>

      {/* ── Filter tabs ─────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {(['all', 'active', 'completed', 'cancelled'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all flex items-center gap-2"
            style={
              filter === f
                ? { background: 'rgba(59,130,246,0.2)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' }
                : { background: 'rgba(255,255,255,0.04)', color: '#64748b', border: '1px solid rgba(255,255,255,0.06)' }
            }
          >
            {f}
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
              style={filter === f ? { background: 'rgba(59,130,246,0.3)', color: '#93c5fd' } : { background: 'rgba(255,255,255,0.06)', color: '#475569' }}
            >
              {counts[f]}
            </span>
          </button>
        ))}
      </div>

      {/* ── Cards ───────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton h-52 w-full rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ background: 'rgba(13,20,37,0.95)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <Target className="w-10 h-10 mx-auto mb-3" style={{ color: '#1e293b' }} />
          <p className="font-semibold text-slate-400">No {filter !== 'all' ? filter : ''} missions yet</p>
          <p className="text-sm mt-1.5" style={{ color: '#475569' }}>
            Go to{' '}
            <Link href="/agent" className="text-blue-400 hover:underline">
              AI Agent
            </Link>{' '}
            to generate and confirm a mission plan.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((mission) => {
            const req = mission.emergencyRequestId
            const vol = mission.volunteerId
            const res = mission.resourceId
            const eta = computeETA(mission)
            return (
              <div
                key={mission._id}
                className="rounded-2xl p-5"
                style={{
                  background: mission.status === 'active'
                    ? 'linear-gradient(135deg, rgba(13,20,37,0.98) 0%, rgba(17,27,48,0.9) 100%)'
                    : 'rgba(13,20,37,0.95)',
                  border: mission.status === 'active'
                    ? '1px solid rgba(59,130,246,0.2)'
                    : '1px solid rgba(255,255,255,0.06)',
                  boxShadow: mission.status === 'active' ? '0 4px 24px rgba(59,130,246,0.06)' : 'none',
                }}
              >
                {/* ── Mission Header ─────────────────────── */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge variant={mission.status}>{mission.status}</Badge>
                      {req && <Badge variant={req.urgency}>{req.urgency}</Badge>}
                      {req && (
                        <span className="text-xs font-medium capitalize" style={{ color: '#64748b' }}>
                          {req.emergencyType}
                        </span>
                      )}
                      {/* ETA Badge */}
                      {mission.status === 'active' && (
                        <div
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
                          style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.2)' }}
                        >
                          <Timer style={{ width: 11, height: 11, color: '#facc15' }} />
                          <span className="text-xs font-bold" style={{ color: '#facc15' }}>ETA: {eta}</span>
                        </div>
                      )}
                    </div>
                    {req && (
                      <p className="text-white font-semibold flex items-center gap-1.5">
                        <MapPin className="w-4 h-4" style={{ color: '#64748b' }} />
                        {req.location}
                      </p>
                    )}
                    <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: '#475569' }}>
                      <Calendar className="w-3 h-3" />
                      {mission.createdAt ? new Date(mission.createdAt).toLocaleString() : '—'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {mission.status === 'active' && (
                      <>
                        <button
                          onClick={() => updateStatus(mission._id!, 'completed')}
                          disabled={updating === mission._id}
                          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                          style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          {updating === mission._id ? 'Updating…' : 'Complete'}
                        </button>
                        <button
                          onClick={() => updateStatus(mission._id!, 'cancelled')}
                          disabled={updating === mission._id}
                          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                          style={{ background: 'rgba(220,38,38,0.1)', color: '#f87171', border: '1px solid rgba(220,38,38,0.2)' }}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Cancel
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => exportMissionPDF(mission)}
                      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
                      style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      <Download className="w-3.5 h-3.5" />
                      PDF Report
                    </button>
                  </div>
                </div>

                {/* ── Assignment Grid ────────────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                  {/* Volunteer */}
                  <div
                    className="rounded-xl p-3.5"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-widest mb-2.5" style={{ color: '#334155' }}>Volunteer</p>
                    {vol ? (
                      <>
                        <p className="text-white text-sm font-semibold flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-blue-400" />
                          {vol.name}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>{vol.location}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {vol.skills?.slice(0, 3).map((s) => (
                            <span
                              key={s}
                              className="text-[10px] px-2 py-0.5 rounded-full capitalize"
                              style={{ background: 'rgba(96,165,250,0.1)', color: '#93c5fd', border: '1px solid rgba(96,165,250,0.15)' }}
                            >
                              {s.replace('_', ' ')}
                            </span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-sm" style={{ color: '#475569' }}>Unassigned</p>
                    )}
                  </div>

                  {/* Resource */}
                  <div
                    className="rounded-xl p-3.5"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-widest mb-2.5" style={{ color: '#334155' }}>Resource</p>
                    {res ? (
                      <>
                        <p className="text-white text-sm font-semibold flex items-center gap-2">
                          <span className="text-base">{RESOURCE_ICONS[res.resourceType] ?? '📦'}</span>
                          <span className="capitalize">{res.resourceType.replace('_', ' ')}</span>
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>{res.quantity} units · {res.location}</p>
                      </>
                    ) : (
                      <p className="text-sm" style={{ color: '#475569' }}>None allocated</p>
                    )}
                  </div>

                  {/* Emergency */}
                  <div
                    className="rounded-xl p-3.5"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-widest mb-2.5" style={{ color: '#334155' }}>Emergency Info</p>
                    {req ? (
                      <>
                        <p className="text-white text-sm font-semibold">{req.reporterName}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
                          <Users className="w-3 h-3 inline mr-1" />
                          {req.peopleAffected} people affected
                        </p>
                        <p className="text-xs mt-1.5 line-clamp-2" style={{ color: '#475569' }}>{req.description}</p>
                      </>
                    ) : (
                      <p className="text-sm" style={{ color: '#475569' }}>No details</p>
                    )}
                  </div>
                </div>

                {/* ── AI Reasoning ───────────────────────── */}
                <div
                  className="rounded-xl p-4"
                  style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.12)' }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="w-6 h-6 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(59,130,246,0.15)' }}
                    >
                      <Brain style={{ width: 12, height: 12, color: '#60a5fa' }} />
                    </div>
                    <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider">Why This Mission Was Prioritized</p>
                  </div>

                  {/* Reasoning factors checklist */}
                  <div className="grid grid-cols-5 gap-2 mb-3">
                    {REASONING_FACTORS.map(({ key, label, icon }) => {
                      const mentioned = mission.reasoning?.toLowerCase().includes(key) ||
                        (key === 'people' && mission.reasoning?.toLowerCase().includes('affect')) ||
                        (key === 'proximity' && mission.reasoning?.toLowerCase().includes('locat')) ||
                        (key === 'resources' && mission.reasoning?.toLowerCase().includes('resourc')) ||
                        (key === 'risk' && mission.reasoning?.toLowerCase().includes('risk'))
                      return (
                        <div
                          key={key}
                          className="flex flex-col items-center gap-1 py-2 px-2 rounded-lg text-center"
                          style={
                            mentioned
                              ? { background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)' }
                              : { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }
                          }
                        >
                          <span className="text-sm">{icon}</span>
                          <span
                            className="text-[10px] font-medium text-center leading-tight"
                            style={{ color: mentioned ? '#4ade80' : '#334155' }}
                          >
                            {label}
                          </span>
                          {mentioned && <Clock style={{ width: 8, height: 8, color: '#4ade80' }} />}
                        </div>
                      )
                    })}
                  </div>

                  <p className="text-xs leading-relaxed" style={{ color: '#94a3b8' }}>
                    {mission.reasoning}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}