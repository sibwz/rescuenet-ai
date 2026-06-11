import clsx from 'clsx'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'ghost' | 'outline' | 'success' | 'warning'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: React.ReactNode
}

const variantStyles: Record<string, string> = {
  primary: 'text-white font-semibold hover:brightness-110 active:scale-[0.98]',
  danger:  'text-white font-semibold hover:brightness-110 active:scale-[0.98]',
  ghost:   'font-medium active:scale-[0.98]',
  outline: 'font-medium active:scale-[0.98]',
  success: 'text-white font-semibold hover:brightness-110 active:scale-[0.98]',
  warning: 'text-white font-semibold hover:brightness-110 active:scale-[0.98]',
}

const variantInlineStyles: Record<string, React.CSSProperties> = {
  primary: {
    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    border: '1px solid rgba(16,185,129,0.5)',
    boxShadow: '0 2px 12px rgba(16,185,129,0.28), inset 0 1px 0 rgba(255,255,255,0.1)',
    color: '#fff',
  },
  danger: {
    background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
    border: '1px solid rgba(239,68,68,0.5)',
    boxShadow: '0 2px 12px rgba(239,68,68,0.22), inset 0 1px 0 rgba(255,255,255,0.08)',
    color: '#fff',
  },
  ghost: {
    background: 'rgba(42,54,71,0.5)',
    border: '1px solid rgba(42,54,71,0.8)',
    color: '#94A3B8',
  },
  outline: {
    background: 'rgba(42,54,71,0.3)',
    border: '1px solid #2A3647',
    color: '#CBD5E1',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
  },
  success: {
    background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
    border: '1px solid rgba(34,197,94,0.5)',
    boxShadow: '0 2px 12px rgba(34,197,94,0.22), inset 0 1px 0 rgba(255,255,255,0.08)',
    color: '#fff',
  },
  warning: {
    background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
    border: '1px solid rgba(245,158,11,0.5)',
    boxShadow: '0 2px 12px rgba(245,158,11,0.22), inset 0 1px 0 rgba(255,255,255,0.08)',
    color: '#fff',
  },
}

const sizeStyles = {
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-4 py-2   text-sm rounded-xl gap-2',
  lg: 'px-5 py-2.5 text-sm rounded-xl gap-2',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center font-medium transition-all duration-150 cursor-pointer',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      style={variantInlineStyles[variant]}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="w-4 h-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  )
}
