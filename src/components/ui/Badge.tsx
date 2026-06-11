import clsx from 'clsx'

type BadgeVariant =
  | 'critical' | 'high' | 'medium' | 'low'
  | 'active' | 'completed' | 'cancelled'
  | 'pending' | 'assigned'
  | 'available' | 'busy' | 'offline'
  | 'depleted' | 'default'
  | 'awaiting_volunteer' | 'resource_shortage'
  | 'awaiting_coordinator_review'
  | 'location_review_required'
  | 'waiting_for_volunteer'

interface VariantConfig {
  bg: string
  color: string
  border: string
  shadow?: string
  extraClass?: string
}

const VARIANTS: Record<BadgeVariant, VariantConfig> = {
  /* Urgency */
  critical: {
    bg: 'linear-gradient(135deg, rgba(239,68,68,0.22), rgba(220,38,38,0.12))',
    color: '#FCA5A5',
    border: 'rgba(239,68,68,0.55)',
    shadow: '0 0 14px rgba(239,68,68,0.22)',
    extraClass: 'badge-critical',
  },
  high: {
    bg: 'rgba(249,115,22,0.18)',
    color: '#FDBA74',
    border: 'rgba(249,115,22,0.45)',
    shadow: '0 0 12px rgba(249,115,22,0.16)',
  },
  medium: {
    bg: 'rgba(245,158,11,0.18)',
    color: '#FDE68A',
    border: 'rgba(245,158,11,0.42)',
    shadow: '0 0 12px rgba(245,158,11,0.14)',
  },
  low: {
    bg: 'rgba(34,197,94,0.16)',
    color: '#BBF7D0',
    border: 'rgba(34,197,94,0.42)',
    shadow: '0 0 12px rgba(34,197,94,0.14)',
  },
  /* Mission status */
  active: {
    bg: 'rgba(34,211,238,0.14)',
    color: '#A5F3FC',
    border: 'rgba(34,211,238,0.42)',
    shadow: '0 0 12px rgba(34,211,238,0.14)',
  },
  completed: {
    bg: 'rgba(34,197,94,0.16)',
    color: '#BBF7D0',
    border: 'rgba(34,197,94,0.42)',
    shadow: '0 0 12px rgba(34,197,94,0.14)',
  },
  cancelled: {
    bg: 'rgba(100,116,139,0.14)',
    color: '#CBD5E1',
    border: 'rgba(100,116,139,0.28)',
  },
  /* Emergency status */
  pending: {
    bg: 'rgba(251,191,36,0.16)',
    color: '#FDE68A',
    border: 'rgba(251,191,36,0.42)',
    shadow: '0 0 12px rgba(251,191,36,0.14)',
  },
  assigned: {
    bg: 'rgba(16,185,129,0.16)',
    color: '#A7F3D0',
    border: 'rgba(16,185,129,0.42)',
    shadow: '0 0 12px rgba(16,185,129,0.14)',
  },
  /* Volunteer status */
  available: {
    bg: 'rgba(16,185,129,0.16)',
    color: '#A7F3D0',
    border: 'rgba(16,185,129,0.42)',
    shadow: '0 0 12px rgba(16,185,129,0.14)',
  },
  busy: {
    bg: 'rgba(245,158,11,0.16)',
    color: '#FDE68A',
    border: 'rgba(245,158,11,0.42)',
    shadow: '0 0 12px rgba(245,158,11,0.14)',
  },
  offline: {
    bg: 'rgba(71,85,105,0.16)',
    color: '#94A3B8',
    border: 'rgba(71,85,105,0.32)',
  },
  /* Resource */
  depleted: {
    bg: 'rgba(239,68,68,0.16)',
    color: '#FCA5A5',
    border: 'rgba(239,68,68,0.42)',
    shadow: '0 0 12px rgba(239,68,68,0.14)',
  },
  /* Dispatch statuses */
  awaiting_volunteer: {
    bg: 'rgba(167,139,250,0.16)',
    color: '#DDD6FE',
    border: 'rgba(167,139,250,0.42)',
    shadow: '0 0 12px rgba(167,139,250,0.14)',
  },
  resource_shortage: {
    bg: 'rgba(249,115,22,0.16)',
    color: '#FDBA74',
    border: 'rgba(249,115,22,0.42)',
    shadow: '0 0 12px rgba(249,115,22,0.14)',
  },
  awaiting_coordinator_review: {
    bg: 'rgba(239,68,68,0.16)',
    color: '#FCA5A5',
    border: 'rgba(239,68,68,0.50)',
    shadow: '0 0 14px rgba(239,68,68,0.20)',
    extraClass: 'badge-critical',
  },
  location_review_required: {
    bg: 'rgba(251,191,36,0.16)',
    color: '#FDE68A',
    border: 'rgba(251,191,36,0.50)',
    shadow: '0 0 12px rgba(251,191,36,0.16)',
  },
  waiting_for_volunteer: {
    bg: 'rgba(139,92,246,0.16)',
    color: '#DDD6FE',
    border: 'rgba(139,92,246,0.42)',
    shadow: '0 0 12px rgba(139,92,246,0.14)',
  },
  default: {
    bg: 'rgba(71,85,105,0.14)',
    color: '#94A3B8',
    border: 'rgba(71,85,105,0.28)',
  },
}

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

export default function Badge({ variant = 'default', children, className }: BadgeProps) {
  const cfg = VARIANTS[variant] ?? VARIANTS.default
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider',
        cfg.extraClass,
        className
      )}
      style={{
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
        boxShadow: cfg.shadow,
      }}
    >
      {children}
    </span>
  )
}
