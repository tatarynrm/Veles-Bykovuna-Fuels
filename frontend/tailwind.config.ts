import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        /* ── Semantic surfaces ── */
        page: 'var(--bg-page)',
        surface: 'var(--surface)',
        'surface-hover': 'var(--surface-hover)',
        'surface-inset': 'var(--surface-inset)',
        card: 'var(--surface)',
        'card-hover': 'var(--surface-hover)',
        glass: 'var(--glass-bg)',
        input: 'var(--surface-inset)',

        /* ── Text ── */
        'txt-primary': 'var(--text-primary)',
        'txt-secondary': 'var(--text-secondary)',
        'txt-muted': 'var(--text-muted)',

        /* ── Borders ── */
        'bdr-subtle': 'var(--border-subtle)',
        'bdr-strong': 'var(--border-strong)',
        'bdr-highlight': 'var(--border-accent)',

        /* ── Brand accents (alpha-capable: bg-accent/10 works) ── */
        accent: {
          DEFAULT: 'rgb(var(--accent-rgb) / <alpha-value>)',
          hover: 'var(--accent-hover)',
          soft: 'var(--accent-soft)',
        },
        warn: 'rgb(var(--warn-rgb) / <alpha-value>)',
        danger: 'rgb(var(--danger-rgb) / <alpha-value>)',
        info: 'rgb(var(--info-rgb) / <alpha-value>)',

        /* Legacy aliases kept so older markup keeps compiling */
        okko: {
          green: 'rgb(var(--accent-rgb) / <alpha-value>)',
          emerald: 'rgb(var(--accent-rgb) / <alpha-value>)',
          lightGreen: 'rgb(var(--accent-rgb) / <alpha-value>)',
          darkBg: 'var(--bg-page)',
          glassBg: 'var(--glass-bg)',
          glassBorder: 'var(--glass-border)',
          accent: 'rgb(var(--warn-rgb) / <alpha-value>)',
          red: 'rgb(var(--danger-rgb) / <alpha-value>)',
        },
      },

      borderRadius: {
        control: '10px',
        field: '14px',
        card: '20px',
        panel: '28px',
      },

      boxShadow: {
        'apple-sm': 'var(--shadow-sm)',
        'apple-md': 'var(--shadow-md)',
        'apple-floating': 'var(--shadow-float)',
        glass: 'var(--shadow-glass)',
        'glass-lg': 'var(--shadow-float)',
        'accent-glow': '0 8px 24px -8px var(--accent-glow)',
      },

      backdropBlur: {
        panel: '24px',
        chrome: '32px',
      },

      fontFamily: {
        sans: ['Inter var', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'JetBrains Mono', 'Menlo', 'monospace'],
      },

      fontSize: {
        micro: ['10px', { lineHeight: '14px', letterSpacing: '0.08em' }],
        '2xs': ['11px', { lineHeight: '16px' }],
      },

      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'accent-sheen': 'linear-gradient(135deg, var(--accent-hover) 0%, var(--accent) 100%)',
        'glass-sheen':
          'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 42%)',
        'okko-glow': 'radial-gradient(circle at 50% 0%, var(--accent-soft), transparent 70%)',
      },

      transitionTimingFunction: {
        enter: 'cubic-bezier(0.22, 1, 0.36, 1)',
        state: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },

      keyframes: {
        rise: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fade: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        pop: {
          from: { opacity: '0', transform: 'translateY(-4px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        drift: {
          '0%, 100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '50%': { transform: 'translate3d(3%, -4%, 0) scale(1.08)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },

      animation: {
        rise: 'rise 0.35s cubic-bezier(0.22, 1, 0.36, 1) both',
        fade: 'fade 0.25s ease-out both',
        pop: 'pop 0.16s cubic-bezier(0.22, 1, 0.36, 1) both',
        drift: 'drift 24s ease-in-out infinite',
        shimmer: 'shimmer 1.8s infinite',
      },
    },
  },
  plugins: [],
}
export default config
