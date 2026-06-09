import clsx from 'clsx'

type BadgeVariant = 'critical' | 'high' | 'medium' | 'low' | 'active' | 'completed' | 'cancelled' |
  'pending' | 'assigned' | 'available' | 'busy' | 'offline' | 'depleted' | 'default' |
  'awaiting_volunteer' | 'resource_shortage'

const variantStyles: Record<BadgeVariant, string> = {
  critical: 'bg-red-500/15 text-red-400 border border-red-500/30 badge-critical',
  high: 'bg-orange-500/12 text-orange-400 border border-orange-500/25',
  medium: 'bg-yellow-500/12 text-yellow-400 border border-yellow-500/25',
  low: 'bg-green-500/12 text-green-400 border border-green-500/25',
  active: 'bg-blue-500/12 text-blue-400 border border-blue-500/25',
  completed: 'bg-emerald-500/12 text-emerald-400 border border-emerald-500/25',
  cancelled: 'bg-slate-500/12 text-slate-400 border border-slate-500/25',
  pending: 'bg-amber-500/12 text-amber-400 border border-amber-500/25',
  assigned: 'bg-blue-500/12 text-blue-400 border border-blue-500/25',
  available: 'bg-emerald-500/12 text-emerald-400 border border-emerald-500/25',
  busy: 'bg-orange-500/12 text-orange-400 border border-orange-500/25',
  offline: 'bg-slate-500/12 text-slate-400 border border-slate-500/25',
  depleted: 'bg-red-500/12 text-red-400 border border-red-500/25',
  awaiting_volunteer: 'bg-purple-500/12 text-purple-400 border border-purple-500/25',
  resource_shortage: 'bg-orange-500/12 text-orange-400 border border-orange-500/25',
  default: 'bg-slate-500/12 text-slate-400 border border-slate-500/25',
}

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

export default function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
