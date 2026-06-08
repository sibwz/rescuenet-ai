'use client'

import { useEffect, useState } from 'react'
import { Target, User, Package, MapPin, Calendar, ChevronDown } from 'lucide-react'
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
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Target className="w-6 h-6 text-green-400" />
            Missions
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {counts.active} active · {counts.completed} completed · {counts.cancelled} cancelled
          </p>
        </div>
        <Link href="/agent">
          <button className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
            <Target className="w-4 h-4" />
            Create via AI Agent
          </button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {(['all', 'active', 'completed', 'cancelled'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium capitalize transition-all flex items-center gap-1.5 ${
              filter === f ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {f}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${filter === f ? 'bg-blue-500' : 'bg-gray-700 text-gray-500'}`}>
              {counts[f]}
            </span>
          </button>
        ))}
      </div>

      {/* Mission Cards */}
      {loading ? (
        <div className="text-center py-10 text-gray-500">Loading missions...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
          <Target className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No {filter !== 'all' ? filter : ''} missions yet</p>
          <p className="text-gray-600 text-sm mt-1">
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
            return (
              <div
                key={mission._id}
                className={`bg-gray-900 border rounded-xl p-5 ${
                  mission.status === 'active'
                    ? 'border-blue-500/30 shadow-blue-900/10 shadow-lg'
                    : 'border-gray-800'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={mission.status}>{mission.status}</Badge>
                      {req && <Badge variant={req.urgency}>{req.urgency}</Badge>}
                      {req && <span className="text-gray-400 text-xs capitalize">· {req.emergencyType}</span>}
                    </div>
                    {req && (
                      <p className="text-white font-semibold flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        {req.location}
                      </p>
                    )}
                    <p className="text-gray-400 text-xs mt-0.5 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {mission.createdAt ? new Date(mission.createdAt).toLocaleString() : '—'}
                    </p>
                  </div>

                  {mission.status === 'active' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateStatus(mission._id!, 'completed')}
                        disabled={updating === mission._id}
                        className="bg-green-600/20 hover:bg-green-600/40 text-green-400 border border-green-600/30 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {updating === mission._id ? 'Updating...' : '✓ Complete'}
                      </button>
                      <button
                        onClick={() => updateStatus(mission._id!, 'cancelled')}
                        disabled={updating === mission._id}
                        className="bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-600/30 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  {/* Volunteer */}
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <p className="text-gray-500 text-xs font-medium uppercase tracking-wide mb-2">Volunteer</p>
                    {vol ? (
                      <>
                        <p className="text-white text-sm font-medium flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-blue-400" />
                          {vol.name}
                        </p>
                        <p className="text-gray-400 text-xs mt-0.5">{vol.location}</p>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {vol.skills?.map((s) => (
                            <span key={s} className="bg-gray-700 text-gray-300 text-[10px] px-1.5 py-0.5 rounded capitalize">
                              {s.replace('_', ' ')}
                            </span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-gray-500 text-sm">Unassigned</p>
                    )}
                  </div>

                  {/* Resource */}
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <p className="text-gray-500 text-xs font-medium uppercase tracking-wide mb-2">Resource</p>
                    {res ? (
                      <>
                        <p className="text-white text-sm font-medium flex items-center gap-1.5">
                          <span>{RESOURCE_ICONS[res.resourceType] ?? '📦'}</span>
                          <span className="capitalize">{res.resourceType.replace('_', ' ')}</span>
                        </p>
                        <p className="text-gray-400 text-xs mt-0.5">{res.quantity} units · {res.location}</p>
                      </>
                    ) : (
                      <p className="text-gray-500 text-sm">None allocated</p>
                    )}
                  </div>

                  {/* Emergency */}
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <p className="text-gray-500 text-xs font-medium uppercase tracking-wide mb-2">Emergency</p>
                    {req ? (
                      <>
                        <p className="text-white text-sm font-medium">{req.reporterName}</p>
                        <p className="text-gray-400 text-xs mt-0.5">{req.peopleAffected} people affected</p>
                        <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{req.description}</p>
                      </>
                    ) : (
                      <p className="text-gray-500 text-sm">No details</p>
                    )}
                  </div>
                </div>

                {/* Reasoning */}
                <div className="bg-blue-950/30 border border-blue-800/30 rounded-lg p-3">
                  <p className="text-blue-400 text-xs font-medium uppercase tracking-wide mb-1 flex items-center gap-1">
                    <ChevronDown className="w-3 h-3" />
                    AI Reasoning
                  </p>
                  <p className="text-gray-300 text-xs leading-relaxed">{mission.reasoning}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}