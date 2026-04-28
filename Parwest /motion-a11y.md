# Parwest ERP — Motion & Accessibility Guide

## prefers-reduced-motion

### Rule
Every animation and transition in Parwest must respect `prefers-reduced-motion: reduce`.
When active: **all durations collapse to 0ms**, **transforms become opacity-only** (no movement).

### globals.css snippet — paste verbatim

```css
/* ── Parwest reduced-motion overrides ──────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  /* 1. Zero all v1.0 duration tokens */
  :root {
    --duration-fast:   0ms;
    --duration-normal: 0ms;
    --duration-slow:   0ms;
  }

  /* 2. Kill all CSS transitions and animations universally */
  *, *::before, *::after {
    animation-duration:        0.01ms !important;
    animation-iteration-count: 1      !important;
    transition-duration:       0.01ms !important;
    scroll-behavior:           auto   !important;
  }

  /* 3. Radix data-state animation tokens */
  [data-state],
  [data-side] {
    --tw-enter-opacity:     1   !important;
    --tw-enter-scale:       1   !important;
    --tw-enter-translate-x: 0   !important;
    --tw-enter-translate-y: 0   !important;
    --tw-exit-opacity:      1   !important;
    --tw-exit-scale:        1   !important;
    --tw-exit-translate-x:  0   !important;
    --tw-exit-translate-y:  0   !important;
    animation-duration:     0ms !important;
  }

  /* 4. Radix Dialog / Sheet / DropdownMenu */
  [data-radix-popper-content-wrapper],
  [role="dialog"],
  [role="alertdialog"],
  [data-radix-select-content] {
    animation: none !important;
    transition: none !important;
  }

  /* 5. Sonner toasts */
  [data-sonner-toast],
  [data-sonner-toaster] {
    animation: none !important;
    transition: opacity 0ms !important;
  }

  /* 6. Skeleton shimmer → static */
  .skeleton,
  [data-skeleton] {
    animation: none !important;
    background: hsl(var(--muted)) !important;
  }

  /* 7. Accordion / Collapsible (Radix) */
  [data-radix-collapsible-content] {
    animation: none !important;
    transition: none !important;
  }

  /* 8. Progress bar fill (no sliding) */
  .progress-fill,
  [role="progressbar"] > * {
    transition: none !important;
  }

  /* 9. Sidebar collapse */
  .sidebar,
  [data-sidebar] {
    transition: none !important;
  }
}
```

---

## Radix animation tokens reference

Radix UI uses `data-[state=open]:animate-in` and `data-[state=closed]:animate-out`
via Tailwind classes from `tailwindcss-animate`. The tokens these classes set:

| Token | Default value | Reduced-motion override |
|---|---|---|
| `--tw-enter-opacity` | `0` (fade in) | `1` (no fade) |
| `--tw-enter-scale` | `0.95` (scale up) | `1` (no scale) |
| `--tw-enter-translate-y` | `-2px` (slide) | `0` (no slide) |
| `--tw-exit-opacity` | `0` | `1` |
| `--tw-exit-scale` | `0.95` | `1` |
| `--tw-exit-translate-y` | `-2px` | `0` |

When overriding to `1`/`0`, the component still mounts/unmounts — it just does so
instantly without visual motion. This preserves ARIA state changes.

### Component-by-component guide

| Component | Default motion | Reduced-motion |
|---|---|---|
| `Dialog` | Fade + scale from center | Instant appear/disappear |
| `Sheet` | Slide from right/left/top/bottom | Instant appear/disappear |
| `DropdownMenu` | Fade + slight vertical shift | Instant appear |
| `Tooltip` | Fade in (150ms) | Instant appear |
| `Popover` | Fade + scale | Instant appear |
| `Command` | Fade in | Instant appear |
| `Accordion` | Height expand | Instant expand |
| `Tabs` | Content crossfade | Instant switch |
| `Toast (sonner)` | Slide in from right | Instant appear |
| `Progress` | Width transition | Instant value |
| `Skeleton` | Shimmer gradient | Static grey |
| Sidebar collapse | Width transition 150ms | Instant collapse |
| Nav item hover | Background fade 100ms | Instant background |
| Button hover | Background fade 100ms | Instant background |

---

## Motion timing reference

All motion in Parwest uses a single easing curve:

```css
--ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
```

| Token | Value | Use |
|---|---|---|
| `--duration-instant` | `0ms` | Focus rings, checkbox checks, toggle state |
| `--duration-fast` | `100ms` | Button/nav hover fills, micro-interactions |
| `--duration-normal` | `150ms` | Sidebar collapse, toast, dropdown open |
| `--duration-slow` | `250ms` | Modal entrance, drawer slide — use sparingly |

**Rule:** Never animate a data table row. Never use spring or bounce easing.
Motion in a professional ERP communicates state — it does not entertain.

---

## ARIA and keyboard requirements

### Focus ring
Every interactive element **must** show the focus ring on keyboard focus:
```css
:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring); /* 0 0 0 3px rgba(47,91,255,.35) */
}
```
Radix components automatically forward `focus-visible` to the correct element.
Do not suppress `:focus-visible` with `outline: none` without an alternative.

### Keyboard model

| Screen | Key | Action |
|---|---|---|
| Guards table | `J` / `↓` | Next row |
| Guards table | `K` / `↑` | Previous row |
| Guards table | `/` | Focus search |
| Guards table | `Space` | Select row |
| Guards table | `Enter` | Open profile |
| Command palette | `⌘K` | Open |
| Command palette | `↑↓` | Navigate |
| Command palette | `Enter` | Execute |
| Command palette | `Esc` | Close |
| Stepper | `Enter` | Next step |
| Stepper | `Shift+Enter` | Previous step |
| Dialog/Sheet | `Esc` | Close |
| DropdownMenu | `↑↓` | Navigate items |
| DropdownMenu | `Enter` | Select |
| DropdownMenu | `Esc` | Close |
| Tabs | `→` / `←` | Switch tabs |
| Tabs | `Home` / `End` | First/last tab |

All of the above are provided automatically by Radix UI primitives when
using the shadcn components. Do not reimplement keyboard logic.

---

## Contrast requirements (WCAG 2.2)

| Pairing | Ratio | Grade |
|---|---|---|
| `--text-primary` on `--bg-card` (light) | 19.1:1 | AAA |
| `--text-secondary` on `--bg-card` (light) | 10.7:1 | AAA |
| `--text-muted` on `--bg-card` (light) | 4.61:1 | AA |
| `--brand-600` on white | 8.59:1 | AAA |
| `--success-600` on `--success-50` | 4.54:1 | AA |
| `--danger-600` on `--danger-50` | 4.49:1 | AA |
| `--sidebar-active-text` on `--sidebar-bg` | 4.82:1 | AA |
| `--text-primary` on `--bg-card` (dark) | 14.3:1 | AAA |

**Minimum:** AA for all body text. Never use `--text-muted` for body copy.
Status chips always include both a dot **and** text label — color is never
the sole status signal.
