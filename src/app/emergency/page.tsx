'use client'

import { useEffect, useState } from 'react'
import { Plus, AlertTriangle, MapPin, Users, Clock } from 'lucide-react'
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-orange-400" />
            Emergency Requests
          </h1>
          <p className="text-gray-400 text-sm mt-1">{requests.length} total requests</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4" />
          New Request
        </Button>
      </div>

      {dbError && (
        <div className="bg-red-900/30 border border-red-600/40 rounded-lg px-4 py-3 text-red-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          {dbError}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {['all', 'critical', 'high', 'medium', 'low', 'pending', 'assigned', 'completed'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-5 py-3 text-gray-400 text-xs font-medium uppercase tracking-wider">Reporter / Location</th>
              <th className="text-left px-5 py-3 text-gray-400 text-xs font-medium uppercase tracking-wider">Type</th>
              <th className="text-left px-5 py-3 text-gray-400 text-xs font-medium uppercase tracking-wider">Urgency</th>
              <th className="text-left px-5 py-3 text-gray-400 text-xs font-medium uppercase tracking-wider">People</th>
              <th className="text-left px-5 py-3 text-gray-400 text-xs font-medium uppercase tracking-wider">Status</th>
              <th className="text-left px-5 py-3 text-gray-400 text-xs font-medium uppercase tracking-wider">Time</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-500">Loading...</td></tr>
            ) : sorted.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-500">No requests found.</td></tr>
            ) : (
              sorted.map((req) => (
                <tr key={req._id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-5 py-3">
                    <p className="text-white text-sm font-medium">{req.reporterName}</p>
                    <p className="text-gray-400 text-xs flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" />{req.location}
                    </p>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-gray-300 text-sm capitalize">{req.emergencyType}</span>
                    <p className="text-gray-500 text-xs mt-0.5 line-clamp-1">{req.description}</p>
                  </td>
                  <td className="px-5 py-3">
                    <Badge variant={req.urgency}>{req.urgency}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-gray-300 text-sm flex items-center gap-1">
                      <Users className="w-3 h-3 text-gray-500" />
                      {req.peopleAffected}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <Badge variant={req.status}>{req.status}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-gray-500 text-xs flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {req.status === 'pending' && (
                      <select
                        className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded px-2 py-1"
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
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Request Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Emergency Request">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-1">Reporter Name</label>
              <input
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                value={form.reporterName}
                onChange={(e) => setForm({ ...form, reporterName: e.target.value })}
                placeholder="Full name"
              />
            </div>
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-1">Location</label>
              <input
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="District, Zone, Block"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-1">Emergency Type</label>
              <select
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
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
              <label className="block text-gray-300 text-sm font-medium mb-1">Urgency Level</label>
              <select
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
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
            <label className="block text-gray-300 text-sm font-medium mb-1">Description</label>
            <textarea
              required
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe the emergency situation..."
            />
          </div>
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-1">People Affected</label>
            <input
              required
              type="number"
              min={1}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
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
