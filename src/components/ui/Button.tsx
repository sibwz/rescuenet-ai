import clsx from 'clsx'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'ghost' | 'outline' | 'success'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: React.ReactNode
}

const variantStyles: Record<string, string> = {
  primary: 'text-white font-semibold',
  danger: 'text-white font-semibold',
  ghost: 'font-medium',
  outline: 'font-medium',
  success: 'text-white font-semibold',
}

const variantInlineStyles: Record<string, React.CSSProperties> = {
  primary: {
    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    border: '1px solid rgba(59,130,246,0.4)',
    boxShadow: '0 2px 12px rgba(59,130,246,0.2)',
  },
  danger: {
    background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
    border: '1px solid rgba(220,38,38,0.4)',
    boxShadow: '0 2px 12px rgba(220,38,38,0.15)',
  },
  ghost: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#94a3b8',
  },
  outline: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#cbd5e1',
  },
  success: {
    background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
    border: '1px solid rgba(22,163,74,0.4)',
    boxShadow: '0 2px 12px rgba(22,163,74,0.2)',
  },
}

const sizeStyles = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-4 py-2 text-sm rounded-xl',
  lg: 'px-5 py-2.5 text-sm rounded-xl',
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
        'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      style={variantInlineStyles[variant]}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  )
}
