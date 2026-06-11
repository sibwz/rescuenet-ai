'use client'

import { useEffect, useRef, useState } from 'react'
import { Plus, Package, MapPin, RefreshCw, AlertTriangle, Loader2, CheckCircle, XCircle } from 'lucide-react'
import type { Resource, ResourceType, ResourceStatus } from '@/types'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import UseLocationButton from '@/components/ui/UseLocationButton'
import DbOfflineBanner from '@/components/ui/DbOfflineBanner'

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

const RESOURCE_LABELS: Record<ResourceType, string> = {
  food: 'Food',
  water: 'Water',
  medicine: 'Medicine',
  shelter_kits: 'Shelter Kits',
  vehicles: 'Vehicles',
}

export default function ResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [dbError, setDbError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null)

  // Real-time location validation for Add modal
  const [addLocStatus, setAddLocStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle')
  const [addLocError, setAddLocError] = useState<string | null>(null)
  const addLocTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Restock modal state
  const [restockId, setRestockId] = useState<string | null>(null)
  const [restockResource, setRestockResource] = useState<Resource | null>(null)
  const [restockForm, setRestockForm] = useState({ add: 100, reason: 'Donation received' })
  const [restockSubmitting, setRestockSubmitting] = useState(false)
  const [restockSuccess, setRestockSuccess] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setDbError(null)
    try {
      const res = await fetch('/api/resources')
      const data = await res.json()
      if (data?.offline) { setOffline(true); setLoading(false); return }
      setOffline(false)
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

  function handleAddLocChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setForm((prev) => ({ ...prev, location: val }))
    setGpsCoords(null)
    setAddLocError(null)

    if (addLocTimerRef.current) clearTimeout(addLocTimerRef.current)
    if (!val.trim()) { setAddLocStatus('idle'); return }
    setAddLocStatus('validating')

    addLocTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/validate-location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ location: val }),
        })
        const data = await res.json() as { valid: boolean; tooVague?: boolean; normalizedAddress?: string; reason?: string }
        if (data.valid && !data.tooVague) {
          setAddLocStatus('valid')
          setAddLocError(null)
        } else if (data.tooVague) {
          setAddLocStatus('invalid')
          setAddLocError('Depot location is too broad. Use a specific area (e.g. Edhi Foundation Clifton, not just Karachi).')
        } else {
          setAddLocStatus('invalid')
          setAddLocError(data.reason ?? 'Location not recognized. Enter a real depot address or area.')
        }
      } catch {
        setAddLocStatus('idle')
      }
    }, 700)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.location.trim()) {
      setSubmitError('Please enter a depot location.')
      return
    }
    if (!gpsCoords && addLocStatus !== 'valid') {
      setSubmitError('Please wait for location to be verified before submitting.')
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          source: 'user',
          ...(gpsCoords ? { latitude: gpsCoords.lat, longitude: gpsCoords.lng } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.error ?? 'Failed to add resource.')
        return
      }
      setShowModal(false)
      setForm(defaultForm)
      setGpsCoords(null)
      setAddLocStatus('idle')
      setAddLocError(null)
      setSubmitError(null)
      await load()
    } catch {
      setSubmitError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function openRestock(res: Resource) {
    setRestockId(res._id!)
    setRestockResource(res)
    setRestockForm({ add: 100, reason: 'Donation received' })
    setRestockSuccess(null)
  }

  async function handleRestockSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!restockId) return
    setRestockSubmitting(true)
    setRestockSuccess(null)
    try {
      const res = await fetch(`/api/resources/${restockId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restock: { add: restockForm.add, reason: restockForm.reason } }),
      })
      const data = await res.json() as { restocked?: number; error?: string }
      if (!res.ok) {
        setRestockSuccess(`Error: ${data.error ?? 'Restock failed.'}`)
        return
      }
      const added = data.restocked ?? restockForm.add
      setRestockSuccess(`${added} units added successfully`)
      await load()
    } catch {
      setRestockSuccess('Error: Network error — please try again.')
    } finally {
      setRestockSubmitting(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = filter === 'all'
    ? resources
    : resources.filter((r) => r.status === filter || r.resourceType === filter)

  const summary = resources.reduce((acc, r) => {
    if (r.status === 'available') {
      acc[r.resourceType] = (acc[r.resourceType] ?? 0) + r.quantity
    }
    return acc
  }, {} as Record<string, number>)

  const addSubmitDisabled = submitting || (!gpsCoords && addLocStatus !== 'valid')

  return (
    <div className="p-6 space-y-5 page-enter">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.25)' }}>
              <Package className="w-4 h-4 text-purple-400" />
            </div>
            Resource Management
          </h1>
          <p className="text-sm mt-1" style={{ color: '#64748b' }}>
            {resources.filter((r) => r.status === 'available').length} available depot entries
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
          <Button onClick={() => { setShowModal(true); setSubmitError(null); setGpsCoords(null); setAddLocStatus('idle'); setAddLocError(null) }}>
            <Plus className="w-4 h-4" />
            Add Resource
          </Button>
        </div>
      </div>

      {offline && <DbOfflineBanner onRetry={load} />}
      {dbError && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-2" style={{ background: 'rgba(220,38,68,0.08)', border: '1px solid rgba(220,38,38,0.2)' }}>
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-red-300 text-sm">{dbError}</span>
        </div>
      )}

      {/* ── Summary Cards ──────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(['food', 'water', 'medicine', 'shelter_kits', 'vehicles'] as ResourceType[]).map((type) => (
          <div
            key={type}
            className="rounded-2xl p-4 text-center cursor-pointer transition-all"
            style={{
              background: filter === type ? 'rgba(168,85,247,0.16)' : '#202B3C',
              border: filter === type ? '1px solid rgba(168,85,247,0.4)' : '1px solid #2A3647',
            }}
            onClick={() => setFilter(filter === type ? 'all' : type)}
          >
            <div className="text-2xl mb-1">{RESOURCE_ICONS[type]}</div>
            <p className="text-white font-bold text-lg">{summary[type] ?? 0}</p>
            <p className="text-xs capitalize" style={{ color: '#64748b' }}>{RESOURCE_LABELS[type]}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {['all', 'available', 'assigned', 'depleted'].map((f) => (
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
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* ── Table ──────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#1A2332', border: '1px solid #2A3647' }}>
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid #2A3647', background: '#202B3C' }}>
              <th className="text-left px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Type</th>
              <th className="text-left px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Quantity</th>
              <th className="text-left px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Depot Location</th>
              <th className="text-left px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Status</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center">
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="skeleton h-10 w-full rounded-xl" />
                    ))}
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-14 text-center">
                  <Package className="w-8 h-8 mx-auto mb-2" style={{ color: '#334155' }} />
                  <p className="text-sm" style={{ color: '#475569' }}>No resources found.</p>
                  <p className="text-xs mt-1" style={{ color: '#64748B' }}>Add a resource depot to enable automatic dispatch.</p>
                </td>
              </tr>
            ) : (
              filtered.map((res) => (
                <tr
                  key={res._id}
                  className="transition-colors"
                  style={{ borderBottom: '1px solid #2A3647' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.04)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{RESOURCE_ICONS[res.resourceType]}</span>
                      <span className="text-sm font-semibold capitalize" style={{ color: '#E5E7EB' }}>
                        {RESOURCE_LABELS[res.resourceType]}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-sm font-bold" style={{ color: '#E5E7EB' }}>{res.quantity.toLocaleString()}</span>
                    <span className="text-xs ml-1" style={{ color: '#64748B' }}>units</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div>
                      <p className="text-sm flex items-center gap-1" style={{ color: '#94A3B8' }}>
                        <MapPin className="w-3 h-3 flex-shrink-0" style={{ color: '#64748b' }} />
                        {res.location}
                      </p>
                      {res.latitude && res.longitude && (
                        <p className="text-[10px] mt-0.5 font-mono" style={{ color: '#10b981' }}>
                          ✓ {res.latitude.toFixed(4)}, {res.longitude.toFixed(4)}
                        </p>
                      )}
                      {res.dispatchEligible === true && (
                        <p className="text-[10px] mt-0.5 font-semibold" style={{ color: '#34d399' }}>
                          ✓ Dispatch eligible
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge variant={res.status}>{res.status}</Badge>
                  </td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => openRestock(res)}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap"
                      style={{ background: 'rgba(168,85,247,0.08)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.2)' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(168,85,247,0.15)' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(168,85,247,0.08)' }}
                    >
                      Restock
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Add Resource Modal ──────────────────────────── */}
      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); setSubmitError(null); setGpsCoords(null); setAddLocStatus('idle'); setAddLocError(null) }}
        title="Add Resource Depot"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {submitError && (
            <div className="rounded-xl px-3 py-2.5 flex items-center gap-2" style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.25)' }}>
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span className="text-red-300 text-sm">{submitError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#6b7280' }}>
                Resource Type
              </label>
              <select
                className="w-full rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none"
                style={{ background: '#1e293b', border: '1px solid #334155' }}
                value={form.resourceType}
                onChange={(e) => setForm({ ...form, resourceType: e.target.value as ResourceType })}
              >
                <option value="food">🍱 Food</option>
                <option value="water">💧 Water</option>
                <option value="medicine">💊 Medicine</option>
                <option value="shelter_kits">⛺ Shelter Kits</option>
                <option value="vehicles">🚛 Vehicles</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#6b7280' }}>
                Quantity (units)
              </label>
              <input
                required
                type="number"
                min={1}
                className="w-full rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none"
                style={{ background: '#1e293b', border: '1px solid #334155' }}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })}
              />
            </div>
          </div>

          {/* Location with real-time validation */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#6b7280' }}>
              Depot Location <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: gpsCoords || addLocStatus === 'valid' ? '#22c55e' : addLocStatus === 'invalid' ? '#ef4444' : '#475569' }} />
              <input
                required
                type="text"
                className="w-full rounded-xl pl-9 pr-9 py-2.5 text-white text-sm focus:outline-none transition-all"
                style={{
                  background: '#1e293b',
                  border: gpsCoords || addLocStatus === 'valid'
                    ? '1px solid rgba(34,197,94,0.5)'
                    : addLocStatus === 'invalid'
                      ? '1px solid rgba(239,68,68,0.5)'
                      : '1px solid #334155',
                }}
                value={form.location}
                onChange={handleAddLocChange}
                placeholder="e.g. Edhi Foundation Warehouse, Karachi"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {!gpsCoords && addLocStatus === 'validating' && <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#475569' }} />}
                {(gpsCoords || addLocStatus === 'valid') && <CheckCircle className="w-4 h-4" style={{ color: '#22c55e' }} />}
                {!gpsCoords && addLocStatus === 'invalid' && <XCircle className="w-4 h-4" style={{ color: '#ef4444' }} />}
              </div>
            </div>
            {!gpsCoords && addLocStatus === 'invalid' && addLocError && (
              <p className="text-xs mt-1 flex items-center gap-1" style={{ color: '#f87171' }}>
                <AlertTriangle className="w-3 h-3 flex-shrink-0" />{addLocError}
              </p>
            )}
            {!gpsCoords && addLocStatus === 'idle' && (
              <p className="text-[10px] mt-1" style={{ color: '#475569' }}>
                Must be a specific area or landmark — city-only names will be rejected.
              </p>
            )}
            <div className="flex items-center justify-between mt-1.5">
              <UseLocationButton
                onLocation={({ location, lat, lng }) => {
                  setForm((prev) => ({ ...prev, location }))
                  setGpsCoords({ lat, lng })
                  setAddLocStatus('valid')
                  setAddLocError(null)
                }}
              />
              {gpsCoords ? (
                <span className="text-[10px] font-semibold" style={{ color: '#34d399' }}>✓ GPS coordinates saved</span>
              ) : (
                <span className="text-[10px]" style={{ color: '#334155' }}>GPS improves dispatch accuracy</span>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button
              type="submit"
              loading={submitting}
              disabled={addSubmitDisabled}
              title={addSubmitDisabled && !submitting ? 'Verify location before submitting' : undefined}
            >
              Add Resource
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Restock Modal ───────────────────────────────── */}
      <Modal
        open={restockId !== null}
        onClose={() => { setRestockId(null); setRestockResource(null); setRestockSuccess(null) }}
        title="Restock Resource"
      >
        {restockResource && (
          <form onSubmit={handleRestockSubmit} className="space-y-4">
            {/* Resource info */}
            <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.15)' }}>
              <span className="text-2xl">{RESOURCE_ICONS[restockResource.resourceType]}</span>
              <div>
                <p className="text-white font-semibold text-sm">{RESOURCE_LABELS[restockResource.resourceType]}</p>
                <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>
                  Current quantity: <span className="font-bold text-white">{restockResource.quantity.toLocaleString()} units</span>
                </p>
                <p className="text-[10px] flex items-center gap-1 mt-0.5" style={{ color: '#64748b' }}>
                  <MapPin className="w-3 h-3" />{restockResource.location}
                </p>
              </div>
            </div>

            {restockSuccess && (
              <div
                className="rounded-xl px-3 py-2.5 flex items-center gap-2"
                style={
                  restockSuccess.startsWith('Error')
                    ? { background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.25)' }
                    : { background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }
                }
              >
                {restockSuccess.startsWith('Error')
                  ? <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  : <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                }
                <span className={`text-sm ${restockSuccess.startsWith('Error') ? 'text-red-300' : 'text-green-300'}`}>
                  {restockSuccess}
                </span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#6b7280' }}>
                Add Quantity (units)
              </label>
              <input
                required
                type="number"
                min={1}
                className="w-full rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none"
                style={{ background: '#1e293b', border: '1px solid #334155' }}
                value={restockForm.add}
                onChange={(e) => setRestockForm((prev) => ({ ...prev, add: Math.max(1, parseInt(e.target.value) || 1) }))}
              />
              <p className="text-[10px] mt-1" style={{ color: '#475569' }}>
                New total will be: <span className="font-semibold" style={{ color: '#c084fc' }}>
                  {(restockResource.quantity + restockForm.add).toLocaleString()} units
                </span>
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#6b7280' }}>
                Restock Reason
              </label>
              <select
                className="w-full rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none"
                style={{ background: '#1e293b', border: '1px solid #334155' }}
                value={restockForm.reason}
                onChange={(e) => setRestockForm((prev) => ({ ...prev, reason: e.target.value }))}
              >
                <option value="Donation received">Donation received</option>
                <option value="Government supply">Government supply</option>
                <option value="Purchase">Purchase</option>
                <option value="Transfer">Transfer</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" type="button" onClick={() => { setRestockId(null); setRestockResource(null); setRestockSuccess(null) }}>
                Cancel
              </Button>
              <Button type="submit" loading={restockSubmitting} disabled={restockSubmitting}>
                Add Units
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
