'use client'

import { useEffect, useState } from 'react'
import { Plus, Package, MapPin } from 'lucide-react'
import type { Resource, ResourceType, ResourceStatus } from '@/types'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'

const defaultForm = {
  resourceType: 'food' as ResourceType,
  quantity: 100,
  location: '',
  status: 'available' as ResourceStatus,
}

const RESOURCE_ICONS: Record<ResourceType, string> = {
  food: '🍱',
  water: '💧',
  medicine: '💊',
  shelter_kits: '⛺',
  vehicles: '🚛',
}

export default function ResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([])
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
      const res = await fetch('/api/resources')
      const data = await res.json()
      if (!res.ok) {
        setDbError(data.error ?? 'Failed to load resources')
        setResources([])
      } else {
        setResources(Array.isArray(data) ? data : [])
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
    await fetch('/api/resources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setShowModal(false)
    setForm(defaultForm)
    await load()
    setSubmitting(false)
  }

  async function handleStatusChange(id: string, status: ResourceStatus) {
    await fetch(`/api/resources/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    await load()
  }

  useEffect(() => { load() }, [])

  const filtered = filter === 'all' ? resources : resources.filter((r) => r.status === filter || r.resourceType === filter)

  // Group by type for summary
  const summary = resources.reduce((acc, r) => {
    if (r.status === 'available') {
      acc[r.resourceType] = (acc[r.resourceType] ?? 0) + r.quantity
    }
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-purple-400" />
            Resource Management
          </h1>
          <p className="text-gray-400 text-sm mt-1">{resources.filter(r => r.status === 'available').length} available resource entries</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4" />
          Add Resource
        </Button>
      </div>

      {dbError && (
        <div className="bg-red-900/30 border border-red-600/40 rounded-lg px-4 py-3 text-red-300 text-sm flex items-center gap-2">
          <span className="text-red-400">⚠</span> {dbError}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(['food', 'water', 'medicine', 'shelter_kits', 'vehicles'] as ResourceType[]).map((type) => (
          <div key={type} className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-center">
            <div className="text-2xl mb-1">{RESOURCE_ICONS[type]}</div>
            <p className="text-white font-bold text-lg">{summary[type] ?? 0}</p>
            <p className="text-gray-400 text-xs capitalize">{type.replace('_', ' ')}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {['all', 'available', 'assigned', 'depleted', 'food', 'water', 'medicine', 'shelter_kits', 'vehicles'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
              filter === f ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Resources Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-5 py-3 text-gray-400 text-xs font-medium uppercase tracking-wider">Type</th>
              <th className="text-left px-5 py-3 text-gray-400 text-xs font-medium uppercase tracking-wider">Quantity</th>
              <th className="text-left px-5 py-3 text-gray-400 text-xs font-medium uppercase tracking-wider">Location</th>
              <th className="text-left px-5 py-3 text-gray-400 text-xs font-medium uppercase tracking-wider">Status</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-500">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-500">No resources found.</td></tr>
            ) : (
              filtered.map((res) => (
                <tr key={res._id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{RESOURCE_ICONS[res.resourceType]}</span>
                      <span className="text-white text-sm font-medium capitalize">{res.resourceType.replace('_', ' ')}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-white text-sm font-bold">{res.quantity.toLocaleString()}</span>
                    <span className="text-gray-500 text-xs ml-1">units</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-gray-300 text-sm flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-gray-500" /> {res.location}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <Badge variant={res.status}>{res.status}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    {res.status !== 'available' && (
                      <button
                        onClick={() => handleStatusChange(res._id!, 'available')}
                        className="text-xs bg-green-900/30 hover:bg-green-900/50 text-green-400 border border-green-700/30 rounded px-2 py-1 transition-colors"
                      >
                        Restock
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Resource Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Resource">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-1">Resource Type</label>
              <select
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                value={form.resourceType}
                onChange={(e) => setForm({ ...form, resourceType: e.target.value as ResourceType })}
              >
                <option value="food">Food</option>
                <option value="water">Water</option>
                <option value="medicine">Medicine</option>
                <option value="shelter_kits">Shelter Kits</option>
                <option value="vehicles">Vehicles</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-1">Quantity</label>
              <input
                required
                type="number"
                min={1}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })}
              />
            </div>
          </div>
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-1">Location / Depot</label>
            <input
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Warehouse, Depot, Center"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={submitting}>Add Resource</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}