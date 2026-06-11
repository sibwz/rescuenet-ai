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
  badge?: { label: string; cls: string; style?: React.CSSProperties }
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
      {
        href: '/report',
        label: 'Report Emergency',
        icon: PlusCircle,
        badge: {
          label: 'PUBLIC',
          cls: '',
          style: { background: 'rgba(239,68,68,0.14)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.28)' },
        },
      },
    ],
  },
  {
    title: 'AI System',
    items: [
      {
        href: '/agent',
        label: 'AI Decision Center',
        icon: Cpu,
        badge: {
          label: 'LIVE',
          cls: '',
          style: { background: 'rgba(34,211,238,0.12)', color: '#67E8F9', border: '1px solid rgba(34,211,238,0.28)' },
        },
      },
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
        background: 'linear-gradient(180deg, #0B1220 0%, #0d1628 60%, #0B1220 100%)',
        borderRight: '1px solid rgba(42,54,71,0.7)',
        boxShadow: '4px 0 24px rgba(0,0,0,0.4), inset -1px 0 0 rgba(255,255,255,0.03)',
      }}
    >
      {/* ── Brand ── */}
      <div
        className="px-5 pt-5 pb-4"
        style={{ borderBottom: '1px solid rgba(42,54,71,0.5)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 glow-red"
            style={{
              background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 60%, #991B1B 100%)',
              boxShadow: '0 0 20px rgba(239,68,68,0.30), inset 0 1px 0 rgba(255,255,255,0.18)',
            }}
          >
            <Radio style={{ width: 17, height: 17, color: '#fff' }} />
          </div>
          <div>
            <h1 className="text-white font-bold text-base leading-none tracking-tight">
              RescueNet AI
            </h1>
            <p className="text-xs mt-0.5 font-semibold" style={{ color: '#FCA5A5' }}>
              Emergency Operations
            </p>
          </div>
        </div>

        {/* Status row */}
        <div className="flex items-center justify-between mt-3.5">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 dot-live" />
            <span className="text-[11px] font-medium" style={{ color: '#94A3B8' }}>
              All Systems Operational
            </span>
          </div>
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded-full"
            style={{
              background: 'rgba(34,211,238,0.10)',
              border: '1px solid rgba(34,211,238,0.25)',
              boxShadow: '0 0 10px rgba(34,211,238,0.08)',
            }}
          >
            <Activity style={{ width: 10, height: 10, color: '#22D3EE' }} />
            <span className="text-[10px] font-bold" style={{ color: '#22D3EE' }}>Gemini</span>
          </div>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-4">
        {SECTIONS.map(({ title, items }) => (
          <div key={title}>
            <p
              className="text-[10px] font-bold uppercase tracking-widest px-3 mb-1.5"
              style={{ color: '#475569', letterSpacing: '0.14em' }}
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
                      'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 relative',
                      active ? 'text-white' : 'text-slate-400 hover:text-white'
                    )}
                    style={
                      active
                        ? {
                            background: 'linear-gradient(135deg, rgba(16,185,129,0.16) 0%, rgba(16,185,129,0.06) 100%)',
                            border: '1px solid rgba(16,185,129,0.35)',
                            boxShadow: '0 0 16px rgba(16,185,129,0.10)',
                          }
                        : {
                            border: '1px solid transparent',
                          }
                    }
                    onMouseEnter={(e) => {
                      if (!active) {
                        const el = e.currentTarget as HTMLElement
                        el.style.background = 'rgba(42,54,71,0.6)'
                        el.style.borderColor = 'rgba(42,54,71,0.9)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        const el = e.currentTarget as HTMLElement
                        el.style.background = ''
                        el.style.borderColor = 'transparent'
                      }
                    }}
                  >
                    {/* Active left indicator */}
                    {active && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                        style={{
                          background: 'linear-gradient(180deg, #10B981 0%, #22D3EE 100%)',
                          boxShadow: '0 0 10px rgba(16,185,129,0.55)',
                        }}
                      />
                    )}
                    <Icon
                      className="flex-shrink-0 transition-colors"
                      style={{
                        width: 15,
                        height: 15,
                        color: active ? '#10B981' : 'inherit',
                      }}
                    />
                    <span className="flex-1 truncate">{label}</span>
                    {badge && (
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider"
                        style={badge.style}
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

      {/* ── Footer ── */}
      <div
        className="px-5 py-3.5"
        style={{ borderTop: '1px solid rgba(42,54,71,0.5)' }}
      >
        <div className="flex items-center gap-2 mb-0.5">
          <Zap style={{ width: 11, height: 11, color: '#FBBF24' }} />
          <span className="text-[11px] font-semibold" style={{ color: '#64748B' }}>
            Google Cloud Hackathon
          </span>
        </div>
        <p className="text-[10px]" style={{ color: '#374151' }}>
          Gemini 2.5 Flash · MongoDB Atlas · Multi-Agent
        </p>
      </div>
    </aside>
  )
}
