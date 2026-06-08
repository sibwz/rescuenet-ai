'use client'

import { useEffect, useState } from 'react'
import {
  Cpu,
  Cloud,
  Database,
  Network,
  UserCheck,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
} from 'lucide-react'

interface IntegrationStatus {
  gemini: {
    status: 'configured' | 'unconfigured'
    backend: string
    model: string
    projectId: string | null
    location: string
    note: string
  }
  googleCloudAgentBuilder: {
    status: 'configured' | 'unconfigured'
    projectId: string | null
    note: string
  }
  mongodb: {
    status: 'connected' | 'error'
    error: string | null
    collections: string[]
  }
  mongodbMcp: {
    status: 'configured'
    collections: string[]
    note: string
  }
  humanApprovalWorkflow: {
    status: 'enabled'
    note: string
  }
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { icon: React.ReactNode; cls: string; label: string }> = {
    configured: {
      icon: <CheckCircle className="w-4 h-4" />,
      cls: 'text-green-400 bg-green-900/20 border-green-700/40',
      label: 'Configured',
    },
    connected: {
      icon: <CheckCircle className="w-4 h-4" />,
      cls: 'text-green-400 bg-green-900/20 border-green-700/40',
      label: 'Connected',
    },
    enabled: {
      icon: <CheckCircle className="w-4 h-4" />,
      cls: 'text-green-400 bg-green-900/20 border-green-700/40',
      label: 'Enabled',
    },
    unconfigured: {
      icon: <AlertTriangle className="w-4 h-4" />,
      cls: 'text-yellow-400 bg-yellow-900/20 border-yellow-700/40',
      label: 'Unconfigured — Fallback Active',
    },
    error: {
      icon: <XCircle className="w-4 h-4" />,
      cls: 'text-red-400 bg-red-900/20 border-red-700/40',
      label: 'Error',
    },
  }

  const s = styles[status] ?? styles.unconfigured
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${s.cls}`}>
      {s.icon}
      {s.label}
    </span>
  )
}

const integrations = [
  {
    key: 'gemini' as const,
    label: 'Gemini AI (Vertex AI)',
    icon: Cpu,
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-900/30 border-blue-700/30',
    description: 'Primary AI planner powered by Vertex AI Gemini. Uses Application Default Credentials (ADC) — no API key required. Falls back to deterministic planner on errors.',
  },
  {
    key: 'googleCloudAgentBuilder' as const,
    label: 'Google Cloud Agent Builder',
    icon: Cloud,
    iconColor: 'text-sky-400',
    iconBg: 'bg-sky-900/30 border-sky-700/30',
    description: 'Google Cloud Vertex AI Agent Builder integration point. Configured via GOOGLE_CLOUD_PROJECT_ID. See docs/google-cloud-agent-builder-setup.md.',
  },
  {
    key: 'mongodb' as const,
    label: 'MongoDB Atlas',
    icon: Database,
    iconColor: 'text-green-400',
    iconBg: 'bg-green-900/30 border-green-700/30',
    description: 'Primary database for all emergency requests, volunteers, resources, missions, and agent logs. Connected via Mongoose.',
  },
  {
    key: 'mongodbMcp' as const,
    label: 'MongoDB MCP Server',
    icon: Network,
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-900/30 border-emerald-700/30',
    description: 'MongoDB MCP (Model Context Protocol) server exposes all 5 collections to AI agents as queryable tools. See docs/mongodb-mcp-setup.md.',
  },
  {
    key: 'humanApprovalWorkflow' as const,
    label: 'Human Approval Workflow',
    icon: UserCheck,
    iconColor: 'text-purple-400',
    iconBg: 'bg-purple-900/30 border-purple-700/30',
    description: 'Coordinator-in-the-loop: the agent generates plans but missions are only created after explicit coordinator approval. Satisfies human oversight requirement.',
  },
]

export default function IntegrationsPage() {
  const [status, setStatus] = useState<IntegrationStatus | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/integrations')
      const data = await res.json()
      setStatus(data)
    } catch {
      // show skeleton
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function getStatus(key: keyof IntegrationStatus): string {
    if (!status) return 'unconfigured'
    const s = status[key] as { status: string }
    return s.status
  }

  function getNote(key: keyof IntegrationStatus): string {
    if (!status) return ''
    const s = status[key] as { note?: string; error?: string | null }
    return s.error ?? s.note ?? ''
  }

  function getExtra(key: keyof IntegrationStatus): string[] {
    if (!status) return []
    if (key === 'gemini') {
      const extras = [`Model: ${status.gemini.model}`, `Backend: ${status.gemini.backend}`]
      if (status.gemini.projectId) extras.push(`Project: ${status.gemini.projectId}`, `Location: ${status.gemini.location}`)
      return extras
    }
    if (key === 'googleCloudAgentBuilder' && status.googleCloudAgentBuilder.projectId)
      return [`Project: ${status.googleCloudAgentBuilder.projectId}`]
    if (key === 'mongodb') return status.mongodb.collections.map((c) => `Collection: ${c}`)
    if (key === 'mongodbMcp') return status.mongodbMcp.collections.map((c) => `Exposed: ${c}`)
    return []
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Network className="w-6 h-6 text-emerald-400" />
            Integrations
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Status of all AI, database, and workflow integrations powering RescueNet AI.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Hackathon Compliance Note */}
      <div className="bg-blue-950/30 border border-blue-700/30 rounded-xl p-4">
        <p className="text-blue-300 text-sm font-medium mb-1">Hackathon Compliance</p>
        <p className="text-blue-400/70 text-xs leading-relaxed">
          RescueNet AI satisfies Google Cloud AI Hackathon requirements: Gemini via Vertex AI as primary AI engine (no AI Studio quota limits),
          Google Cloud Agent Builder integration point, MongoDB Atlas as partner track database,
          MongoDB MCP Server for agent tool access, and a human-in-the-loop approval workflow.
        </p>
      </div>

      {/* Integration Cards */}
      <div className="space-y-4">
        {integrations.map(({ key, label, icon: Icon, iconColor, iconBg, description }) => (
          <div key={key} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-lg border flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                <Icon className={`w-5 h-5 ${iconColor}`} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap mb-2">
                  <h3 className="text-white font-semibold">{label}</h3>
                  {loading ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold text-gray-500 bg-gray-800 border-gray-700">
                      Checking...
                    </span>
                  ) : (
                    <StatusBadge status={getStatus(key)} />
                  )}
                </div>

                <p className="text-gray-400 text-sm leading-relaxed mb-3">{description}</p>

                {!loading && getNote(key) && (
                  <p className="text-gray-500 text-xs italic mb-2">{getNote(key)}</p>
                )}

                {!loading && getExtra(key).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {getExtra(key).map((item) => (
                      <span key={item} className="text-[10px] text-gray-500 bg-gray-800 border border-gray-700 px-2 py-0.5 rounded font-mono">
                        {item}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Docs Links */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-3">Documentation</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { file: 'docs/google-cloud-agent-builder-setup.md', label: 'Google Cloud Agent Builder Setup' },
            { file: 'docs/mongodb-mcp-setup.md', label: 'MongoDB MCP Server Setup' },
            { file: 'docs/hackathon-compliance.md', label: 'Hackathon Compliance Checklist' },
            { file: 'docs/demo-script.md', label: 'Demo Script & Flow' },
          ].map(({ file, label }) => (
            <div key={file} className="flex items-center gap-2 text-sm">
              <span className="text-gray-600 text-xs">📄</span>
              <div>
                <p className="text-gray-300 font-medium">{label}</p>
                <p className="text-gray-600 text-xs font-mono">{file}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
