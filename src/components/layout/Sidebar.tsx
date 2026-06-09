'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  AlertTriangle,
  Users,
  Package,
  Cpu,
  Target,
  ScrollText,
  GitBranch,
  Rocket,
  Map,
  MessageSquare,
  BarChart2,
  PlusCircle,
  Radio,
  Zap,
  Activity,
} from 'lucide-react'
import clsx from 'clsx'

type NavItem = {
  href: string
  label: string
  icon: React.ElementType
  badge?: { label: string; cls: string }
}

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Operations',
    items: [
      { href: '/', label: 'Command Center', icon: LayoutDashboard },
      { href: '/emergency', label: 'Emergency Requests', icon: AlertTriangle },
      { href: '/volunteers', label: 'Volunteers', icon: Users },
      { href: '/resources', label: 'Resources', icon: Package },
      { href: '/map', label: 'Disaster Map', icon: Map },
      { href: '/report', label: 'Report Emergency', icon: PlusCircle, badge: { label: 'PUBLIC', cls: 'bg-red-500/15 text-red-400 border-red-500/25' } },
    ],
  },
  {
    title: 'AI System',
    items: [
      { href: '/agent', label: 'AI Agent', icon: Cpu, badge: { label: 'LIVE', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/25' } },
      { href: '/missions', label: 'Missions', icon: Target },
      { href: '/coordinator-chat', label: 'AI Coordinator', icon: MessageSquare },
    ],
  },
  {
    title: 'Monitoring',
    items: [
      { href: '/reasoning-trace', label: 'Reasoning Trace', icon: GitBranch },
      { href: '/agent-logs', label: 'Agent Logs', icon: ScrollText },
    ],
  },
  {
    title: 'Reporting',
    items: [
      { href: '/analytics', label: 'Analytics', icon: BarChart2 },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      className="fixed left-0 top-0 h-full w-[260px] flex flex-col z-50"
      style={{
        background: 'linear-gradient(180deg, #0d1425 0%, #0a1020 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* ── Brand ────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 glow-red"
            style={{ background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' }}
          >
            <Radio className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
          </div>
          <div>
            <h1 className="text-white font-bold text-base leading-none tracking-tight">RescueNet AI</h1>
            <p className="text-xs mt-0.5 font-medium" style={{ color: '#f87171' }}>Emergency Operations</p>
          </div>
        </div>

        {/* Status row */}
        <div className="flex items-center justify-between mt-3.5">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 dot-live" />
            <span className="text-[11px] font-medium" style={{ color: '#94a3b8' }}>All Systems Operational</span>
          </div>
          <div className="flex items-center gap-1">
            <Activity className="w-3 h-3" style={{ color: '#60a5fa' }} />
            <span className="text-[10px] font-medium" style={{ color: '#60a5fa' }}>Gemini</span>
          </div>
        </div>
      </div>

      {/* ── Demo Quick-Launch ─────────────────────────────── */}
      <div className="px-3 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <Link
          href="/agent"
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all group"
          style={{
            background: 'linear-gradient(135deg, rgba(220,38,38,0.12) 0%, rgba(239,68,68,0.07) 100%)',
            border: '1px solid rgba(220,38,38,0.2)',
          }}
        >
          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(220,38,38,0.2)' }}>
            <Rocket className="w-3.5 h-3.5 text-red-400" />
          </div>
          <span className="text-red-300 text-xs font-semibold flex-1">Run Disaster Scenario</span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(220,38,38,0.25)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.3)' }}>
            DEMO
          </span>
        </Link>
      </div>

      {/* ── Navigation ───────────────────────────────────── */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-5">
        {SECTIONS.map(({ title, items }) => (
          <div key={title}>
            <p
              className="text-[10px] font-semibold uppercase tracking-widest px-3 mb-1.5"
              style={{ color: '#334155' }}
            >
              {title}
            </p>
            <div className="space-y-0.5">
              {items.map(({ href, label, icon: Icon, badge }) => {
                const active = pathname === href
                return (
                  <Link
                    key={href}
                    href={href}
                    className={clsx(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group relative',
                      active
                        ? 'text-white'
                        : 'hover:text-slate-200'
                    )}
                    style={
                      active
                        ? {
                            background: 'linear-gradient(135deg, rgba(220,38,38,0.15) 0%, rgba(220,38,38,0.08) 100%)',
                            border: '1px solid rgba(220,38,38,0.2)',
                            color: '#f1f5f9',
                          }
                        : {
                            color: '#64748b',
                            border: '1px solid transparent',
                          }
                    }
                  >
                    {active && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                        style={{ background: '#ef4444' }}
                      />
                    )}
                    <Icon
                      className="flex-shrink-0 transition-colors"
                      style={{ width: 15, height: 15, color: active ? '#f87171' : 'inherit' }}
                    />
                    <span className="flex-1 truncate">{label}</span>
                    {badge && (
                      <span
                        className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded border tracking-wider', badge.cls)}
                      >
                        {badge.label}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Footer ───────────────────────────────────────── */}
      <div className="px-5 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-3 h-3" style={{ color: '#facc15' }} />
          <span className="text-[11px] font-semibold" style={{ color: '#475569' }}>Google Cloud Hackathon</span>
        </div>
        <p className="text-[10px]" style={{ color: '#334155' }}>
          Gemini 2.5 Flash · MongoDB Atlas · Multi-Agent
        </p>
      </div>
    </aside>
  )
}