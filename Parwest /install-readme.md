# Parwest ERP — v1.1 Install Guide

## Prerequisites

```bash
node >= 18.17   # Next.js 14 requirement
npm >= 9
```

## 1. Create Next.js 14 app

```bash
npx create-next-app@14 parwest \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --import-alias "@/*"
cd parwest
```

## 2. Install shadcn/ui

```bash
npx shadcn@latest init
```

During init, select:
- Style: **Default**
- Base color: **Slate** (we override everything via CSS vars)
- CSS variables: **Yes**

## 3. Replace shadcn globals.css variables

Open `src/app/globals.css`. **Delete** the `:root` and `.dark` blocks that shadcn generated, and replace with:

```css
/* Import Parwest token files */
@import '../../../tokens.css';       /* v1.0 — all base tokens */
@import '../../../tokens-v1.1.css';  /* v1.1 — shadcn contract + RTL + print */
```

> `tokens-v1.1.css` maps every `--background`, `--primary`, `--ring`, etc.
> to v1.0 tokens, so shadcn components inherit the Parwest palette.

Keep the `@layer base` block that sets `* { border-color: ... }` — shadcn needs it.

## 4. Install the Tailwind preset

Copy `tailwind.preset.ts` to the project root, then update `tailwind.config.ts`:

```ts
import type { Config } from 'tailwindcss'
import parwestPreset from './tailwind.preset'

const config: Config = {
  presets: [parwestPreset],
  content: [
    './src/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  plugins: [
    require('tailwindcss-animate'),   // Radix animations
    require('tailwindcss-rtl'),        // RTL logical property utils
  ],
}

export default config
```

## 5. Install required dependencies

```bash
# shadcn components (run after init)
npx shadcn@latest add button input select checkbox radio-group switch \
  badge avatar tooltip popover tabs progress skeleton table card dialog \
  sheet alert-dialog toast dropdown-menu breadcrumb command form calendar \
  date-picker separator scroll-area collapsible

# Headless libraries
npm i @radix-ui/react-icons        # fallback icons (lucide-react preferred)
npm i lucide-react                  # primary icon set

# Table
npm i @tanstack/react-table

# Forms
npm i react-hook-form zod @hookform/resolvers

# Charts
npm i recharts

# Toast
npm i sonner

# Date utilities
npm i date-fns

# RTL
npm i tailwindcss-rtl

# Tailwind plugins
npm i tailwindcss-animate
npm i -D @tailwindcss/typography

# Urdu font (or load via Google Fonts in layout.tsx)
# If self-hosting: npm i @fontsource/noto-nastaliq-urdu
```

## 6. Configure dark mode + RTL in layout.tsx

```tsx
// src/app/layout.tsx
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ui',
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
})

export default function RootLayout({ children, params }) {
  const locale = params?.locale ?? 'en'
  const dir    = locale === 'ur' ? 'rtl' : 'ltr'
  const lang   = locale === 'ur' ? 'ur'  : 'en'

  return (
    <html
      lang={lang}
      dir={dir}
      data-theme=""        // set to "dark" via ThemeProvider
      className={`${ibmPlexSans.variable} ${ibmPlexMono.variable}`}
    >
      <head>
        {locale === 'ur' && (
          <link
            href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;500;600;700&display=swap"
            rel="stylesheet"
          />
        )}
      </head>
      <body className="font-ui bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  )
}
```

## 7. Dark mode provider

```tsx
// src/components/ThemeProvider.tsx
'use client'
import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({
  theme: 'light', toggle: () => {}
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    const saved = localStorage.getItem('pw-theme') as Theme | null
    if (saved) setTheme(saved)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : '')
    localStorage.setItem('pw-theme', theme)
  }, [theme])

  return (
    <ThemeCtx.Provider value={{ theme, toggle: () => setTheme(t => t === 'dark' ? 'light' : 'dark') }}>
      {children}
    </ThemeCtx.Provider>
  )
}

export const useTheme = () => useContext(ThemeCtx)
```

## 8. sonner toast setup

```tsx
// src/app/layout.tsx — add inside <body>
import { Toaster } from 'sonner'

// Inside <body>:
<Toaster
  position="top-right"
  toastOptions={{
    style: {
      fontFamily: 'var(--font-ui)',
      fontSize:   'var(--text-13)',
      background: 'var(--bg-card)',
      border:     '1px solid var(--border-default)',
      color:      'var(--text-primary)',
    },
  }}
/>
```

## 9. Workflow rules runtime flag

```ts
// src/lib/workflow.ts
const RULES_KEY = 'pw-workflow-rules'

const DEFAULTS: Record<string, boolean> = {
  singleActivePerGuard:              true,
  blockInactiveUpdate:               true,
  requireActiveGuardStatus:          true,
  requireGuardOfficeConsistency:     false,
  requireEndDate:                    true,
  disallowEndDateBeforeDeployment:   true,
  requireBranchContract:             false,
  requireClientHasBranches:          true,
  requirePendingInitialStatus:       true,
  enforceTransitionMap:              true,
  blockCoreEditsAfterTerminal:       true,
}

export function isWorkflowRuleEnabled(rule: string): boolean {
  if (typeof window === 'undefined') return DEFAULTS[rule] ?? true
  try {
    const stored = JSON.parse(localStorage.getItem(RULES_KEY) ?? '{}')
    return stored[rule] ?? DEFAULTS[rule] ?? true
  } catch {
    return DEFAULTS[rule] ?? true
  }
}

export function setWorkflowRule(rule: string, enabled: boolean): void {
  const stored = JSON.parse(localStorage.getItem(RULES_KEY) ?? '{}')
  stored[rule] = enabled
  localStorage.setItem(RULES_KEY, JSON.stringify(stored))
}
```

## 10. API error envelope handler

```ts
// src/lib/api.ts
export interface ApiError {
  success: false
  message: string
  code: string
}

export async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  const data = await res.json()

  if (!res.ok || data.success === false) {
    throw new ApiError(data.message ?? 'An unexpected error occurred.', data.code ?? 'UNKNOWN')
  }

  return data as T
}

export class ApiError extends Error {
  constructor(public message: string, public code: string) {
    super(message)
    this.name = 'ApiError'
  }
}
```

## 11. Regional access scoping

```ts
// src/lib/auth.ts
export type AccessScope = 'GLOBAL' | 'REGIONAL'

export interface CurrentUser {
  id:        string
  name:      string
  role:      string
  scope:     AccessScope
  regionId?: string      // set when scope === 'REGIONAL'
  regionName?: string
}

// Super User and Admin-with-no-permissions → GLOBAL
// Admin-with-permissions → REGIONAL (scoped to regionId)
export function getUserScope(user: CurrentUser): AccessScope {
  return user.scope
}

export function canAccessRegion(user: CurrentUser, regionId: string): boolean {
  if (user.scope === 'GLOBAL') return true
  return user.regionId === regionId
}
```

## 12. Verify setup

```bash
npm run dev
# Open http://localhost:3000
# Sidebar should be #0b1224 (always dark)
# Content area respects data-theme="dark"
# All shadcn components use Parwest tokens
```
