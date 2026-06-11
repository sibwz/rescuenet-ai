/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        rescue: {
          bg:      '#111827',
          sidebar: '#0B1220',
          card:    '#1A2332',
          card2:   '#202B3C',
          border:  '#2A3647',
          emerald: '#10B981',
          emeraldHover: '#059669',
          cyan:    '#22D3EE',
          amber:   '#F59E0B',
          red:     '#EF4444',
          green:   '#22C55E',
          pending: '#FBBF24',
        },
        emergency: {
          critical: '#EF4444',
          high:     '#F97316',
          medium:   '#F59E0B',
          low:      '#22C55E',
        },
      },
      boxShadow: {
        command:   '0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
        glowGreen: '0 0 24px rgba(16,185,129,0.28)',
        glowCyan:  '0 0 24px rgba(34,211,238,0.24)',
        glowRed:   '0 0 24px rgba(239,68,68,0.28)',
      },
    },
  },
  plugins: [],
}
