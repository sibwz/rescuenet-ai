'use client'

import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Users,
  Package,
  Target,
  Flame,
  RefreshCw,
  Database,
  ChevronRight,
  Clock,
  Heart,
  TrendingUp,
  Cpu,
  MessageSquare,
  Send,
  BarChart3,
} from 'lucide-react'
import Link from 'next/link'
import type { DashboardStats, EmergencyRequest, Mission, NLQueryResult } from '@/types'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'

interface StatCardProps {
  label: string
  value: number | string
  icon: React.ReactNode
  color: string
  href: string
  alert?: boolean
  sub?: string
}

function StatCard({ label, value, icon, color, href, alert, sub }: StatCardProps) {
  return (
    <Link href={href}>
      <div className={`bg-gray-900 border ${alert && Number(value) > 0 ? 'border-red-500/50 shadow-red-900/20 shadow-lg' : 'border-gray-800'} rounded-xl p-5 hover:border-gray-700 transition-all cursor-pointer group`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-gray-400 text-sm font-medium">{label}</p>
            <p className={`text-3xl font-bold mt-1 ${alert && Number(value) > 0 ? 'text-red-400' : 'text-white'}`}>
              {value}
            </p>
            {sub && <p className="text-gray-600 text-xs mt-0.5">{sub}</p>}
          </div>
          <div className={`p-3 rounded-lg ${color}`}>{icon}</div>
        </div>
        <div className="mt-3 flex items-center gap-1 text-gray-500 text-xs group-hover:text-gray-400 transition-colors">
          <span>View details</span>
          <ChevronRight className="w-3 h-3" />
        </div>
      </div>
    </Link>
  )
}

const EMERGENCY_TYPE_COLORS: Record<string, string> = {
  medical: 'bg-red-500',
  food: 'bg-orange-500',
  water: 'bg-blue-500',
  shelter: 'bg-purple-500',
  evacuation: 'bg-yellow-500',
}

const URGENCY_COLORS: Record<string, string> = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-yellow-400',
  low: 'text-green-400',
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentRequests, setRecentRequests] = useState<EmergencyRequest[]>([])
  const [activeMissions, setActiveMissions] = useState<Mission[]>([])
  const [loading, setLoading] = useState(true)
  const [dbError, setDbError] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)
  const [seedMessage, setSeedMessage] = useState('')
  const [seedError, setSeedError] = useState<string | null>(null)

  // NL Query state
  const [nlQuestion, setNlQuestion] = useState('')
  const [nlLoading, setNlLoading] = useState(false)
  const [nlResult, setNlResult] = useState<NLQueryResult | null>(null)
  const [nlError, setNlError] = useState<string | null>(null)

  async function loadDashboard() {
    setLoading(true)
    setDbError(null)
    try {
      const [statsRes, requestsRes, missionsRes] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/emergency'),
        fetch('/api/missions'),
      ])

      if (!statsRes.ok) {
        const err = await statsRes.json()
        setDbError(err.error ?? 'Failed to connect to database')
        setLoading(false)
        return
      }

      const statsData: DashboardStats = await statsRes.json()
      const requestsData = await requestsRes.json()
      const missionsData = await missionsRes.json()

      setStats(statsData)
      setRecentRequests(Array.isArray(requestsData) ? requestsData.slice(0, 5) : [])
      setActiveMissions(
        Array.isArray(missionsData)
          ? missionsData.filter((m: Mission) => m.status === 'active').slice(0, 4)
          : []
      )
    } catch (e) {
      setDbError('Network error — is the dev server running?')
      console.error('Dashboard load error:', e)
    } finally {
      setLoading(false)
    }
  }

  async function handleSeed() {
    setSeeding(true)
    setSeedMessage('')
    setSeedError(null)
    try {
      const res = await fetch('/api/seed', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        setSeedError(data.error ?? 'Seed failed — check server logs')
        return
      }

      const { counts } = data as { counts: { emergencies: number; volunteers: number; resources: number } }
      setSeedMessage(
        `Seeded ${counts.emergencies} emergencies, ${counts.volunteers} volunteers, ${counts.resources} resources`
      )
      await loadDashboard()
    } catch {
      setSeedError('Seed request failed — check MongoDB URI in .env.local and restart the dev server')
    } finally {
      setSeeding(false)
    }
  }

  async function handleNLQuery(e: React.FormEvent) {
    e.preventDefault()
    if (!nlQuestion.trim()) return
    setNlLoading(true)
    setNlResult(null)
    setNlError(null)

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: nlQuestion }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Query failed')
      setNlResult(data)
    } catch (e) {
      setNlError(e instanceof Error ? e.message : 'Query failed')
    } finally {
      setNlLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  const analytics = stats?.analytics

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Operations Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Real-time disaster response overview · MongoDB aggregation analytics</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={loadDashboard} loading={loading}>
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleSeed} loading={seeding}>
            <Database className="w-4 h-4" />
            Seed Demo Data
          </Button>
        </div>
      </div>

      {dbError && (
        <div className="bg-red-900/30 border border-red-600/40 rounded-lg px-4 py-3 text-red-300 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" />
          <div>
            <span className="font-medium">Database error: </span>{dbError}
          </div>
        </div>
      )}

      {seedError && (
        <div className="bg-red-900/30 border border-red-600/40 rounded-lg px-4 py-3 text-red-300 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" />
          <span>{seedError}</span>
        </div>
      )}

      {seedMessage && (
        <div className="bg-green-900/30 border border-green-600/30 rounded-lg px-4 py-3 text-green-400 text-sm">
          ✓ {seedMessage}
        </div>
      )}

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label="Total Requests"
          value={stats?.totalRequests ?? 0}
          icon={<AlertTriangle className="w-5 h-5 text-orange-400" />}
          color="bg-orange-500/10"
          href="/emergency"
        />
        <StatCard
          label="Critical Alerts"
          value={stats?.criticalRequests ?? 0}
          icon={<Flame className="w-5 h-5 text-red-400" />}
          color="bg-red-500/10"
          href="/emergency"
          alert
        />
        <StatCard
          label="Available Volunteers"
          value={stats?.availableVolunteers ?? 0}
          icon={<Users className="w-5 h-5 text-blue-400" />}
          color="bg-blue-500/10"
          href="/volunteers"
          sub={analytics ? `${analytics.volunteerUtilRate}% deployed` : undefined}
        />
        <StatCard
          label="Available Resources"
          value={stats?.availableResources ?? 0}
          icon={<Package className="w-5 h-5 text-purple-400" />}
          color="bg-purple-500/10"
          href="/resources"
        />
        <StatCard
          label="Active Missions"
          value={stats?.activeMissions ?? 0}
          icon={<Target className="w-5 h-5 text-green-400" />}
          color="bg-green-500/10"
          href="/missions"
          sub={analytics ? `${analytics.missionCompletionRate}% completion rate` : undefined}
        />
      </div>

      {/* Analytics Row — MongoDB Aggregation */}
      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* People Helped */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Heart className="w-4 h-4 text-pink-400" />
              <h3 className="text-white font-semibold text-sm">Impact</h3>
              <span className="text-[10px] text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded font-mono ml-auto">$sum aggregation</span>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-gray-500 text-xs">People helped (completed missions)</p>
                <p className="text-3xl font-bold text-pink-400 mt-0.5">{analytics.peopleHelped.toLocaleString()}</p>
              </div>
              <div className="flex gap-4 text-xs text-gray-400">
                <span>✓ {analytics.missionStatus['completed'] ?? 0} completed</span>
                <span>⟳ {analytics.missionStatus['active'] ?? 0} active</span>
              </div>
            </div>
          </div>

          {/* Emergency by Type */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              <h3 className="text-white font-semibold text-sm">Emergency Breakdown</h3>
              <span className="text-[10px] text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded font-mono ml-auto">$group</span>
            </div>
            <div className="space-y-2">
              {analytics.emergencyByType.slice(0, 4).map(({ type, count, peopleAffected }) => (
                <div key={type} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${EMERGENCY_TYPE_COLORS[type] ?? 'bg-gray-500'}`} />
                  <span className="text-gray-300 text-xs capitalize flex-1">{type}</span>
                  <span className="text-gray-400 text-xs">{count} req</span>
                  <span className="text-gray-600 text-xs">{peopleAffected} ppl</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pending by Urgency */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-yellow-400" />
              <h3 className="text-white font-semibold text-sm">Pending Urgency</h3>
              <span className="text-[10px] text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded font-mono ml-auto">$match+$group</span>
            </div>
            <div className="space-y-2">
              {(['critical', 'high', 'medium', 'low'] as const).map((level) => {
                const count = analytics.urgencyBreakdown[level] ?? 0
                return (
                  <div key={level} className="flex items-center gap-2">
                    <span className={`text-xs font-semibold capitalize w-14 ${URGENCY_COLORS[level]}`}>{level}</span>
                    <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${level === 'critical' ? 'bg-red-500' : level === 'high' ? 'bg-orange-500' : level === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(count * 20, 100)}%` }}
                      />
                    </div>
                    <span className="text-gray-400 text-xs w-4 text-right">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Emergency Requests */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <h2 className="text-white font-semibold">Recent Emergency Requests</h2>
            <Link href="/emergency" className="text-blue-400 text-sm hover:text-blue-300">
              View all
            </Link>
          </div>
          <div className="divide-y divide-gray-800">
            {loading ? (
              <div className="px-5 py-8 text-center text-gray-500">Loading...</div>
            ) : recentRequests.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-500">
                No requests yet.{' '}
                <button onClick={handleSeed} className="text-blue-400 hover:underline">
                  Seed demo data
                </button>
              </div>
            ) : (
              recentRequests.map((req) => (
                <div key={req._id} className="px-5 py-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">{req.location}</p>
                    <p className="text-gray-400 text-xs mt-0.5 capitalize">{req.emergencyType} · {req.peopleAffected} people</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <Badge variant={req.urgency}>{req.urgency}</Badge>
                    <Badge variant={req.status}>{req.status}</Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Active Missions */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <h2 className="text-white font-semibold">Active Missions</h2>
            <Link href="/missions" className="text-blue-400 text-sm hover:text-blue-300">
              View all
            </Link>
          </div>
          <div className="divide-y divide-gray-800">
            {loading ? (
              <div className="px-5 py-8 text-center text-gray-500">Loading...</div>
            ) : activeMissions.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-500">
                No active missions. Go to{' '}
                <Link href="/agent" className="text-blue-400 hover:underline">
                  AI Agent
                </Link>{' '}
                to generate a plan.
              </div>
            ) : (
              activeMissions.map((mission) => (
                <div key={mission._id} className="px-5 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-white text-sm font-medium truncate">
                      {mission.emergencyRequest?.location ?? 'Mission'}
                    </p>
                    <Badge variant="active">Active</Badge>
                  </div>
                  <p className="text-gray-400 text-xs mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {mission.createdAt
                      ? new Date(mission.createdAt).toLocaleDateString()
                      : '—'}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Natural Language Query */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-800">
          <MessageSquare className="w-4 h-4 text-purple-400" />
          <h2 className="text-white font-semibold">Natural Language Database Query</h2>
          <span className="ml-auto text-[10px] text-purple-400 bg-purple-900/30 border border-purple-700/30 px-2 py-0.5 rounded font-medium">
            Gemini → MongoDB
          </span>
        </div>
        <div className="p-5">
          <p className="text-gray-400 text-sm mb-3">
            Ask a question in plain English — Gemini converts it to a MongoDB query and executes it.
          </p>
          <form onSubmit={handleNLQuery} className="flex gap-2">
            <input
              type="text"
              value={nlQuestion}
              onChange={(e) => setNlQuestion(e.target.value)}
              placeholder="e.g. How many critical medical emergencies are pending?"
              className="flex-1 bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-4 py-2.5 placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30"
            />
            <Button type="submit" variant="primary" loading={nlLoading} disabled={!nlQuestion.trim()}>
              <Send className="w-4 h-4" />
              Ask
            </Button>
          </form>

          {/* Quick examples */}
          <div className="flex gap-2 mt-2 flex-wrap">
            {[
              'How many volunteers are available?',
              'Which emergencies are critical?',
              'How many missions are completed?',
            ].map((q) => (
              <button
                key={q}
                onClick={() => setNlQuestion(q)}
                className="text-xs text-gray-500 hover:text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 px-2.5 py-1 rounded-full transition-colors"
              >
                {q}
              </button>
            ))}
          </div>

          {nlLoading && (
            <div className="mt-4 flex items-center gap-2 text-gray-500 text-sm">
              <div className="w-4 h-4 border border-purple-500 border-t-transparent rounded-full animate-spin" />
              Gemini converting query to MongoDB…
            </div>
          )}

          {nlError && (
            <div className="mt-4 text-red-400 text-sm bg-red-900/20 border border-red-700/30 rounded-lg px-4 py-2">
              {nlError}
            </div>
          )}

          {nlResult && !nlLoading && (
            <div className="mt-4 bg-purple-950/30 border border-purple-700/30 rounded-xl p-4 space-y-3">
              <p className="text-purple-200 font-medium text-sm">{nlResult.answer}</p>
              {nlResult.collection && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Database className="w-3 h-3" />
                  <span>Collection: <span className="text-gray-300 font-mono">{nlResult.collection}</span></span>
                  {nlResult.mongoFilter && Object.keys(nlResult.mongoFilter).length > 0 && (
                    <>
                      <span>·</span>
                      <span>Filter: <span className="text-gray-300 font-mono">{JSON.stringify(nlResult.mongoFilter)}</span></span>
                    </>
                  )}
                </div>
              )}
              {nlResult.count !== undefined && (
                <p className="text-emerald-400 text-xs">{nlResult.count} matching documents</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* AI Action Panel CTA */}
      <div className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-blue-700/30 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold text-lg flex items-center gap-2">
              <Cpu className="w-5 h-5 text-blue-400" />
              AI Agent Ready
            </h3>
            <p className="text-gray-300 text-sm mt-1">
              The AI agent will query MongoDB via Gemini tool calls, reason through assignments, and generate a prioritized mission plan in real-time.
            </p>
          </div>
          <Link href="/agent">
            <Button variant="primary" size="lg">
              Run AI Agent
              <ChevronRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
