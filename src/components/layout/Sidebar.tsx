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
  Radio,
  Network,
  ScrollText,
} from 'lucide-react'
import clsx from 'clsx'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/emergency', label: 'Emergency Requests', icon: AlertTriangle },
  { href: '/volunteers', label: 'Volunteers', icon: Users },
  { href: '/resources', label: 'Resources', icon: Package },
  { href: '/agent', label: 'AI Agent', icon: Cpu },
  { href: '/missions', label: 'Missions', icon: Target },
  { href: '/agent-logs', label: 'Agent Logs', icon: ScrollText },
  { href: '/integrations', label: 'Integrations', icon: Network },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 h-full w-[260px] bg-gray-900 border-r border-gray-800 flex flex-col z-50">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-red-600 rounded-lg flex items-center justify-center">
            <Radio className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-none">RescueNet</h1>
            <p className="text-red-400 text-xs font-medium mt-0.5">AI Coordinator</p>
          </div>
        </div>
      </div>

      {/* Status indicator */}
      <div className="px-6 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-gray-400 text-xs">System Operational</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-red-600/20 text-red-400 border border-red-600/30'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'
              )}
            >
              <Icon className={clsx('w-4 h-4 flex-shrink-0', active ? 'text-red-400' : '')} />
              {label}
              {href === '/agent' && (
                <span className="ml-auto text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded">
                  AI
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-800">
        <p className="text-gray-600 text-xs">Google Cloud Hackathon 2024</p>
        <p className="text-gray-700 text-xs mt-0.5">Powered by Gemini AI + MongoDB</p>
      </div>
    </aside>
  )
}
