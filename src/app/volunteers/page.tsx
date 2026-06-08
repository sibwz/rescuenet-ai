'use client'

import { useEffect, useState } from 'react'
import { Plus, Users, MapPin, Phone, Mail, Car } from 'lucide-react'
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
      if (!res.ok) {
        setDbError(data.error ?? 'Failed to load volunteers')
        setVolunteers([])
      } else {
        setVolunteers(Array.isArray(data) ? data : [])
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
      skills: prev.skills.includes(skill)
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill],
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
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-400" />
            Volunteers
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {counts.available} available · {counts.busy} busy · {counts.offline} offline
          </p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4" />
          Register Volunteer
        </Button>
      </div>

      {dbError && (
        <div className="bg-red-900/30 border border-red-600/40 rounded-lg px-4 py-3 text-red-300 text-sm flex items-center gap-2">
          <span className="text-red-400">⚠</span> {dbError}
        </div>
      )}

      {/* Status filters */}
      <div className="flex items-center gap-2">
        {['all', 'available', 'busy', 'offline'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
              filter === f ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Volunteer Cards Grid */}
      {loading ? (
        <div className="text-center py-10 text-gray-500">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-gray-500">No volunteers found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((vol) => (
            <div key={vol._id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-all">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-white font-semibold">{vol.name}</h3>
                  <p className="text-gray-400 text-xs flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" /> {vol.location}
                  </p>
                </div>
                <Badge variant={vol.status}>{vol.status}</Badge>
              </div>

              <div className="space-y-1.5 mb-3">
                <p className="text-gray-400 text-xs flex items-center gap-1.5">
                  <Phone className="w-3 h-3" /> {vol.phone}
                </p>
                <p className="text-gray-400 text-xs flex items-center gap-1.5">
                  <Mail className="w-3 h-3" /> {vol.email}
                </p>
                {vol.hasVehicle && (
                  <p className="text-blue-400 text-xs flex items-center gap-1.5">
                    <Car className="w-3 h-3" /> Has vehicle
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-1 mb-4">
                {vol.skills.map((skill) => (
                  <span
                    key={skill}
                    className="bg-gray-800 text-gray-300 text-xs px-2 py-0.5 rounded capitalize"
                  >
                    {skill.replace('_', ' ')}
                  </span>
                ))}
              </div>

              <div className="flex gap-2">
                {vol.status !== 'available' && (
                  <button
                    onClick={() => handleStatusChange(vol._id!, 'available')}
                    className="flex-1 text-xs bg-green-900/30 hover:bg-green-900/50 text-green-400 border border-green-700/30 rounded-lg py-1.5 transition-colors"
                  >
                    Mark Available
                  </button>
                )}
                {vol.status !== 'offline' && (
                  <button
                    onClick={() => handleStatusChange(vol._id!, 'offline')}
                    className="flex-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 border border-gray-700 rounded-lg py-1.5 transition-colors"
                  >
                    Go Offline
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Register Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Register Volunteer" maxWidth="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-1">Full Name</label>
              <input
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Dr. Jane Smith"
              />
            </div>
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-1">Location</label>
              <input
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="District / Zone"
              />
            </div>
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-1">Phone</label>
              <input
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+1-555-0100"
              />
            </div>
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-1">Email</label>
              <input
                required
                type="email"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="volunteer@org.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Skills</label>
            <div className="flex flex-wrap gap-2">
              {ALL_SKILLS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleSkill(value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    form.skills.includes(value)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.hasVehicle}
                onChange={(e) => setForm({ ...form, hasVehicle: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              <span className="text-gray-300 text-sm">Has Vehicle</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={submitting}>Register</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}