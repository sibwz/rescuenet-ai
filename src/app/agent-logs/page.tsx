'use client'

import { useEffect, useState } from 'react'
import { ScrollText, RefreshCw, Filter, Clock, Tag, Link2 } from 'lucide-react'
import type { AgentLog } from '@/types'

interface LogEntry extends AgentLog {
  _id: string
  createdAt: string
}

interface LogsResponse {
  logs: LogEntry[]
  distinctActions: string[]
  total: number
}

const ACTION_STYLES: Record<string, string> = {
  GENERATE_PLAN: 'bg-blue-900/30 border-blue-700/40 text-blue-300',
  MISSION_CREATED: 'bg-green-900/30 border-green-700/40 text-green-300',
  TOOL_CALL: 'bg-purple-900/30 border-purple-700/40 text-purple-300',
  MISSION_COMPLETED: 'bg-emerald-900/30 border-emerald-700/40 text-emerald-300',
  MISSION_CANCELLED: 'bg-red-900/30 border-red-700/40 text-red-300',
}

function actionStyle(action: string) {
  return ACTION_STYLES[action] ?? 'bg-gray-800 border-gray-700 text-gray-300'
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function AgentLogsPage() {
  const [data, setData] = useState<LogsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterAction, setFilterAction] = useState<string>('all')
  const [error, setError] = useState<string | null>(null)

  async function load(action?: string) {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (action && action !== 'all') params.set('action', action)
      const res = await fetch(`/api/agent-logs?${params}`)
      if (!res.ok) throw new Error('Failed to load logs')
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function applyFilter(action: string) {
    setFilterAction(action)
    load(action)
  }

  const logs = data?.logs ?? []
  const actions = ['all', ...(data?.distinctActions ?? [])]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ScrollText className="w-6 h-6 text-yellow-400" />
            Agent Audit Log
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Full audit trail of all agent actions, tool calls, and mission events stored in MongoDB
          </p>
        </div>
        <button
          onClick={() => load(filterAction === 'all' ? undefined : filterAction)}
          disabled={loading}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats banner */}
      {data && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">Total Events</p>
            <p className="text-white text-2xl font-bold mt-1">{data.total}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">Event Types</p>
            <p className="text-white text-2xl font-bold mt-1">{data.distinctActions.length}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">Shown</p>
            <p className="text-white text-2xl font-bold mt-1">{logs.length}</p>
          </div>
        </div>
      )}

      {/* Filter chips */}
      {actions.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-gray-500 flex-shrink-0" />
          {actions.map((a) => (
            <button
              key={a}
              onClick={() => applyFilter(a)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all capitalize ${
                filterAction === a
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'
              }`}
            >
              {a === 'all' ? 'All' : a.replace('_', ' ')}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-700/30 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Log entries */}
      {loading && logs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">Loading agent logs…</div>
      ) : logs.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
          <ScrollText className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No agent logs yet</p>
          <p className="text-gray-600 text-sm mt-1">
            Run the AI Agent to start generating logs.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log._id}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-start gap-3">
                {/* Action badge */}
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-semibold uppercase flex-shrink-0 mt-0.5 ${actionStyle(log.action)}`}
                >
                  <Tag className="w-3 h-3" />
                  {log.action.replace('_', ' ')}
                </span>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-gray-200 text-sm leading-relaxed">{log.details}</p>

                  {log.relatedIds && log.relatedIds.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <Link2 className="w-3 h-3 text-gray-600 flex-shrink-0" />
                      {log.relatedIds.slice(0, 4).map((id) => (
                        <span key={id} className="text-[10px] text-gray-600 font-mono bg-gray-800 px-1.5 py-0.5 rounded">
                          {String(id).slice(-8)}
                        </span>
                      ))}
                      {log.relatedIds.length > 4 && (
                        <span className="text-[10px] text-gray-700">+{log.relatedIds.length - 4} more</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Timestamp */}
                <div className="flex-shrink-0 text-right">
                  <p className="text-gray-500 text-xs flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {timeAgo(log.createdAt)}
                  </p>
                  <p className="text-gray-700 text-[10px] mt-0.5">
                    {new Date(log.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
