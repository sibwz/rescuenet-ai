import clsx from 'clsx'

type BadgeVariant = 'critical' | 'high' | 'medium' | 'low' | 'active' | 'completed' | 'cancelled' |
  'pending' | 'assigned' | 'available' | 'busy' | 'offline' | 'depleted' | 'default'

const variantStyles: Record<BadgeVariant, string> = {
  critical: 'bg-red-500/20 text-red-400 border border-red-500/40 badge-critical',
  high: 'bg-orange-500/20 text-orange-400 border border-orange-500/40',
  medium: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40',
  low: 'bg-green-500/20 text-green-400 border border-green-500/40',
  active: 'bg-blue-500/20 text-blue-400 border border-blue-500/40',
  completed: 'bg-green-500/20 text-green-400 border border-green-500/40',
  cancelled: 'bg-gray-500/20 text-gray-400 border border-gray-500/40',
  pending: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40',
  assigned: 'bg-blue-500/20 text-blue-400 border border-blue-500/40',
  available: 'bg-green-500/20 text-green-400 border border-green-500/40',
  busy: 'bg-orange-500/20 text-orange-400 border border-orange-500/40',
  offline: 'bg-gray-500/20 text-gray-400 border border-gray-500/40',
  depleted: 'bg-red-500/20 text-red-400 border border-red-500/40',
  default: 'bg-gray-500/20 text-gray-400 border border-gray-500/40',
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
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  )
}