/**
 * Parwest ERP — Tailwind CSS Preset v1.1
 *
 * Maps every v1.0 design token to Tailwind theme keys AND to the
 * shadcn/ui CSS-variable contract. Drop into tailwind.config.ts:
 *
 *   import parwestPreset from './tailwind.preset'
 *   export default { presets: [parwestPreset], content: [...], plugins: [...] }
 *
 * Requires: tailwindcss-animate (shadcn dep), @tailwindcss/typography (optional)
 */

import type { Config } from 'tailwindcss'

const preset: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      // ── Fonts ────────────────────────────────────────────────────────────
      fontFamily: {
        ui:   ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'Fira Code', 'monospace'],
        urdu: ['Noto Nastaliq Urdu', 'Noto Serif Urdu', 'serif'],
      },

      // ── Font sizes (mirrors v1.0 scale) ──────────────────────────────────
      fontSize: {
        '11': ['0.6875rem', { lineHeight: '1.25' }],
        '12': ['0.75rem',   { lineHeight: '1.375' }],
        '13': ['0.8125rem', { lineHeight: '1.5' }],
        '14': ['0.875rem',  { lineHeight: '1.5' }],
        '16': ['1rem',      { lineHeight: '1.5' }],
        '18': ['1.125rem',  { lineHeight: '1.375' }],
        '20': ['1.25rem',   { lineHeight: '1.25' }],
        '24': ['1.5rem',    { lineHeight: '1.25' }],
        '28': ['1.75rem',   { lineHeight: '1.2' }],
        '32': ['2rem',      { lineHeight: '1.15' }],
      },

      // ── Colors ───────────────────────────────────────────────────────────
      // shadcn reads CSS variables at runtime; these class-level mappings
      // let you use bg-primary, text-muted, etc. in JSX.
      colors: {
        // Brand — Cobalt Blue
        brand: {
          50:  'var(--brand-50)',
          100: 'var(--brand-100)',
          200: 'var(--brand-200)',
          300: 'var(--brand-300)',
          400: 'var(--brand-400)',
          500: 'var(--brand-500)',
          600: 'var(--brand-600)',
          700: 'var(--brand-700)',
          800: 'var(--brand-800)',
          900: 'var(--brand-900)',
          DEFAULT: 'var(--brand-600)',
        },

        // shadcn semantic aliases (hsl() not needed — we use oklch/hex via vars)
        background:  'var(--background)',
        foreground:  'var(--foreground)',

        primary: {
          DEFAULT:    'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT:    'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT:    'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT:    'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        destructive: {
          DEFAULT:    'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        card: {
          DEFAULT:    'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT:    'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        border:  'var(--border)',
        input:   'var(--input)',
        ring:    'var(--ring)',

        // Sidebar (always dark — do not use with dark: modifier)
        sidebar: {
          DEFAULT:             'var(--sidebar-background)',
          foreground:          'var(--sidebar-foreground)',
          primary:             'var(--sidebar-primary)',
          'primary-foreground':'var(--sidebar-primary-foreground)',
          accent:              'var(--sidebar-accent)',
          'accent-foreground': 'var(--sidebar-accent-foreground)',
          border:              'var(--sidebar-border)',
          ring:                'var(--sidebar-ring)',
        },

        // Semantic
        success: {
          50:  'var(--success-50)',
          100: 'var(--success-100)',
          500: 'var(--success-500)',
          600: 'var(--success-600)',
          700: 'var(--success-700)',
          DEFAULT: 'var(--success-600)',
        },
        warning: {
          50:  'var(--warning-50)',
          100: 'var(--warning-100)',
          500: 'var(--warning-500)',
          600: 'var(--warning-600)',
          700: 'var(--warning-700)',
          DEFAULT: 'var(--warning-600)',
        },
        danger: {
          50:  'var(--danger-50)',
          100: 'var(--danger-100)',
          500: 'var(--danger-500)',
          600: 'var(--danger-600)',
          700: 'var(--danger-700)',
          DEFAULT: 'var(--danger-600)',
        },
        info: {
          50:  'var(--info-50)',
          100: 'var(--info-100)',
          500: 'var(--info-500)',
          600: 'var(--info-600)',
          DEFAULT: 'var(--info-600)',
        },

        // Data-viz (Recharts)
        viz: {
          1: 'var(--viz-1)',
          2: 'var(--viz-2)',
          3: 'var(--viz-3)',
          4: 'var(--viz-4)',
          5: 'var(--viz-5)',
          6: 'var(--viz-6)',
          7: 'var(--viz-7)',
          8: 'var(--viz-8)',
        },
      },

      // ── Spacing (4px base) ───────────────────────────────────────────────
      spacing: {
        '0.5': '0.125rem',   //  2px
        '1':   '0.25rem',    //  4px  --space-1
        '2':   '0.5rem',     //  8px  --space-2
        '3':   '0.75rem',    // 12px  --space-3
        '4':   '1rem',       // 16px  --space-4
        '5':   '1.25rem',    // 20px  --space-5
        '6':   '1.5rem',     // 24px  --space-6
        '8':   '2rem',       // 32px  --space-8
        '10':  '2.5rem',     // 40px  --space-10
        '12':  '3rem',       // 48px  --space-12
        '16':  '4rem',       // 64px  --space-16
        '20':  '5rem',       // 80px  --space-20
      },

      // ── Border radius ────────────────────────────────────────────────────
      borderRadius: {
        none: '0',
        sm:   'var(--radius-sm)',    // 10px — buttons, inputs, chips
        md:   'var(--radius-md)',    // 14px — cards, panels
        lg:   'var(--radius-lg)',    // 18px — drawers, sheets
        xl:   'var(--radius-xl)',    // 24px — hero, cover
        full: '9999px',             // badges, avatars, toggles
        DEFAULT: 'var(--radius)',   // shadcn default (= --radius-sm)
      },

      // ── Box shadows ──────────────────────────────────────────────────────
      boxShadow: {
        xs:   'var(--shadow-xs)',
        sm:   'var(--shadow-sm)',
        md:   'var(--shadow-md)',
        focus: 'var(--focus-ring)',
        none: 'none',
      },

      // ── Transitions ──────────────────────────────────────────────────────
      transitionDuration: {
        instant: '0ms',
        fast:    '100ms',
        normal:  '150ms',
        slow:    '250ms',
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },

      // ── z-index ──────────────────────────────────────────────────────────
      zIndex: {
        base:     '1',
        dropdown: '100',
        sticky:   '200',
        overlay:  '300',
        modal:    '400',
        toast:    '500',
      },

      // ── Animation (shadcn/tailwindcss-animate) ───────────────────────────
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to:   { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to:   { height: '0' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 150ms cubic-bezier(0.4,0,0.2,1)',
        'accordion-up':   'accordion-up 150ms cubic-bezier(0.4,0,0.2,1)',
        shimmer:          'shimmer 1.5s infinite',
      },

      // ── Row heights ──────────────────────────────────────────────────────
      height: {
        'row-comfortable': 'var(--row-comfortable)',  // 48px
        'row-compact':     'var(--row-compact)',       // 32px
        topbar:            '56px',
      },

      // ── RTL support (logical properties) ────────────────────────────────
      // tailwindcss-rtl maps ps-/pe- to padding-inline-start/end
      // Add plugin: require('tailwindcss-rtl') in tailwind.config.ts
    },
  },
  plugins: [
    // npm i tailwindcss-animate        — Radix enter/exit animations
    // npm i tailwindcss-rtl            — RTL logical property utilities
    // npm i @tailwindcss/typography    — prose for MD content
    require('tailwindcss-animate'),
  ],
}

export default preset
