'use client'

import { useEffect, useState } from 'react'
import { Plus, Users, MapPin, Phone, Mail, Car, CheckCircle, WifiOff } from 'lucide-react'
import type { Volunteer, VolunteerSkill, VolunteerStatus } from '@/types'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'

const defaultForm = {
  name: '',
  phone: '',
  email: '',
  location: '',
  skills: [] as VolunteerSkill[],
  hasVehicle: false,
  status: 'available' as VolunteerStatus,
}

const ALL_SKILLS: { value: VolunteerSkill; label: string }[] = [
  { value: 'medical', label: 'Medical' },
  { value: 'transport', label: 'Transport' },
  { value: 'food_distribution', label: 'Food Distribution' },
  { value: 'rescue', label: 'Rescue' },
  { value: 'logistics', label: 'Logistics' },
]

const SKILL_COLORS: Record<string, string> = {
  medical: 'rgba(248,113,113,0.12)',
  transport: 'rgba(96,165,250,0.12)',
  food_distribution: 'rgba(74,222,128,0.12)',
  rescue: 'rgba(251,146,60,0.12)',
  logistics: 'rgba(192,132,252,0.12)',
}
const SKILL_TEXT: Record<string, string> = {
  medical: '#f87171', transport: '#60a5fa', food_distribution: '#4ade80', rescue: '#fb923c', logistics: '#c084fc',
}

export default function VolunteersPage() {
  const [volunteers, setVolunteers] = useState<Volunteer[]>([])
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
      const res = await fetch('/api/volunteers')
      const data = await res.json()
      if (!res.ok) { setDbError(data.error ?? 'Failed to load volunteers'); setVolunteers([]) }
      else { setVolunteers(Array.isArray(data) ? data : []) }
    } catch { setDbError('Network error') }
    finally { setLoading(false) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    await fetch('/api/volunteers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setShowModal(false)
    setForm(defaultForm)
    await load()
    setSubmitting(false)
  }

  async function handleStatusChange(id: string, status: VolunteerStatus) {
    await fetch(`/api/volunteers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    await load()
  }

  function toggleSkill(skill: VolunteerSkill) {
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.includes(skill) ? prev.skills.filter((s) => s !== skill) : [...prev.skills, skill],
    }))
  }

  useEffect(() => { load() }, [])

  const filtered = filter === 'all' ? volunteers : volunteers.filter((v) => v.status === filter)
  const counts = {
    available: volunteers.filter((v) => v.status === 'available').length,
    busy: volunteers.filter((v) => v.status === 'busy').length,
    offline: volunteers.filter((v) => v.status === 'offline').length,
  }

  return (
    <div className="p-6 space-y-5 page-enter">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Volunteers</h1>
          <p className="text-sm mt-1" style={{ color: '#64748b' }}>
            <span className="text-emerald-400 font-medium">{counts.available} available</span>
            {' · '}
            <span className="text-orange-400 font-medium">{counts.busy} deployed</span>
            {' · '}
            <span style={{ color: '#475569' }}>{counts.offline} offline</span>
          </p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4" />
          Register Volunteer
        </Button>
      </div>

      {dbError && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-2" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)' }}>
          <span className="text-red-400 text-sm">{dbError}</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        {['all', 'available', 'busy', 'offline'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all"
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

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton h-48 w-full rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: 'rgba(13,20,37,0.95)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <Users className="w-10 h-10 mx-auto mb-3" style={{ color: '#1e293b' }} />
          <p style={{ color: '#475569' }}>No volunteers found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((vol) => (
            <div
              key={vol._id}
              className="rounded-2xl p-5 card-hover"
              style={{ background: 'rgba(13,20,37,0.95)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-white font-semibold">{vol.name}</h3>
                  <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: '#64748b' }}>
                    <MapPin className="w-3 h-3" /> {vol.location}
                  </p>
                </div>
                <Badge variant={vol.status}>{vol.status}</Badge>
              </div>

              <div className="space-y-1.5 mb-3.5">
                <p className="text-xs flex items-center gap-1.5" style={{ color: '#64748b' }}>
                  <Phone className="w-3 h-3" /> {vol.phone}
                </p>
                <p className="text-xs flex items-center gap-1.5" style={{ color: '#64748b' }}>
                  <Mail className="w-3 h-3" /> {vol.email}
                </p>
                {vol.hasVehicle && (
                  <p className="text-xs flex items-center gap-1.5 text-blue-400">
                    <Car className="w-3 h-3" /> Has vehicle
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 mb-4">
                {vol.skills.map((skill) => (
                  <span
                    key={skill}
                    className="text-[11px] px-2.5 py-1 rounded-lg capitalize font-medium"
                    style={{
                      background: SKILL_COLORS[skill] ?? 'rgba(255,255,255,0.05)',
                      color: SKILL_TEXT[skill] ?? '#94a3b8',
                      border: `1px solid ${SKILL_TEXT[skill] ?? '#94a3b8'}20`,
                    }}
                  >
                    {skill.replace('_', ' ')}
                  </span>
                ))}
              </div>

              <div className="flex gap-2">
                {vol.status !== 'available' && (
                  <button
                    onClick={() => handleStatusChange(vol._id!, 'available')}
                    className="flex-1 text-xs flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all"
                    style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}
                  >
                    <CheckCircle className="w-3 h-3" /> Available
                  </button>
                )}
                {vol.status !== 'offline' && (
                  <button
                    onClick={() => handleStatusChange(vol._id!, 'offline')}
                    className="flex-1 text-xs flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all"
                    style={{ background: 'rgba(255,255,255,0.04)', color: '#64748b', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <WifiOff className="w-3 h-3" /> Offline
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Register Volunteer" maxWidth="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[
              { field: 'name', label: 'Full Name', placeholder: 'Dr. Jane Smith', type: 'text' },
              { field: 'location', label: 'Location', placeholder: 'DHA Lahore / Clifton, Karachi', type: 'text' },
              { field: 'phone', label: 'Phone', placeholder: '+92-300-0000000', type: 'tel' },
              { field: 'email', label: 'Email', placeholder: 'volunteer@org.pk', type: 'email' },
            ].map(({ field, label, placeholder, type }) => (
              <div key={field}>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#64748b' }}>{label}</label>
                <input
                  required
                  type={type}
                  className="w-full rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  value={(form as Record<string, unknown>)[field] as string}
                  onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                  placeholder={placeholder}
                />
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#64748b' }}>Skills</label>
            <div className="flex flex-wrap gap-2">
              {ALL_SKILLS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleSkill(value)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={
                    form.skills.includes(value)
                      ? { background: 'rgba(59,130,246,0.2)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' }
                      : { background: 'rgba(255,255,255,0.04)', color: '#64748b', border: '1px solid rgba(255,255,255,0.08)' }
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.hasVehicle}
              onChange={(e) => setForm({ ...form, hasVehicle: e.target.checked })}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm" style={{ color: '#94a3b8' }}>Has Vehicle</span>
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={submitting}>Register</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
