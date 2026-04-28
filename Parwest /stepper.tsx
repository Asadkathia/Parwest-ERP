/**
 * Parwest ERP — Stepper Component Spec
 * ─────────────────────────────────────────────────────────────────────────
 * shadcn/ui does not ship a Stepper. This file specifies the component
 * used in the Guard Create wizard (6-step) and any future multi-step forms.
 *
 * Copy into: components/ui/stepper.tsx
 * Peer deps: lucide-react, class-variance-authority, cn (shadcn util)
 */

'use client'

import * as React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

export type StepStatus = 'upcoming' | 'current' | 'complete' | 'error'

export interface StepConfig {
  id:       string
  label:    string
  /** Optional sub-label shown below step label in the sidebar nav variant */
  meta?:    string
  /** Shown in the step circle instead of the index number when upcoming */
  icon?:    React.ReactNode
}

export interface StepperProps {
  steps:         StepConfig[]
  currentStep:   number           // 0-indexed
  /** Called when a completed step node is clicked (allows back-navigation) */
  onStepClick?:  (index: number) => void
  /** 'horizontal' renders inline progress bar; 'sidebar' renders left nav list */
  variant?:      'horizontal' | 'sidebar'
  className?:    string
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function getStatus(index: number, current: number): StepStatus {
  if (index < current)  return 'complete'
  if (index === current) return 'current'
  return 'upcoming'
}

// ─── Horizontal Stepper ───────────────────────────────────────────────────────
// Used inline at the top of the Guard Create Form canvas.

export function HorizontalStepper({
  steps, currentStep, onStepClick, className,
}: StepperProps) {
  return (
    <nav
      aria-label="Form progress"
      className={cn('flex items-start', className)}
    >
      {steps.map((step, index) => {
        const status    = getStatus(index, currentStep)
        const isLast    = index === steps.length - 1
        const clickable = status === 'complete' && onStepClick != null

        return (
          <div
            key={step.id}
            className="flex items-start flex-1"
            role="listitem"
          >
            {/* Step node */}
            <div className="flex flex-col items-center flex-1">
              <button
                type="button"
                onClick={() => clickable && onStepClick?.(index)}
                disabled={!clickable}
                aria-current={status === 'current' ? 'step' : undefined}
                aria-label={`Step ${index + 1}: ${step.label} — ${status}`}
                className={cn(
                  'h-[30px] w-[30px] rounded-full border-2 flex items-center justify-center',
                  'text-xs font-bold transition-colors duration-fast',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  {
                    // complete
                    'bg-primary border-primary text-primary-foreground cursor-pointer':
                      status === 'complete',
                    // current
                    'bg-primary border-primary text-primary-foreground shadow-[0_0_0_4px_var(--brand-100)]':
                      status === 'current',
                    // upcoming
                    'bg-card border-border text-muted-foreground cursor-default':
                      status === 'upcoming',
                    // error (future)
                    'bg-destructive border-destructive text-destructive-foreground':
                      status === 'error',
                  }
                )}
              >
                {status === 'complete'
                  ? <Check className="h-3 w-3" strokeWidth={2.5} />
                  : <span>{index + 1}</span>
                }
              </button>

              {/* Label */}
              <span
                className={cn(
                  'mt-1.5 text-center text-[10px] font-semibold whitespace-nowrap',
                  {
                    'text-primary':          status === 'current',
                    'text-foreground':       status === 'complete',
                    'text-muted-foreground': status === 'upcoming',
                  }
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div
                aria-hidden
                className={cn(
                  'h-0.5 flex-1 mt-[15px]',
                  status === 'complete' ? 'bg-primary' : 'bg-border'
                )}
              />
            )}
          </div>
        )
      })}
    </nav>
  )
}

// ─── Sidebar Stepper ──────────────────────────────────────────────────────────
// Used in the left sidebar panel of the Guard Create Form.

export function SidebarStepper({
  steps, currentStep, onStepClick, className,
}: StepperProps) {
  return (
    <nav
      aria-label="Form steps"
      className={cn('flex flex-col gap-0', className)}
    >
      {steps.map((step, index) => {
        const status    = getStatus(index, currentStep)
        const isLast    = index === steps.length - 1
        const clickable = status === 'complete' && onStepClick != null

        return (
          <div key={step.id}>
            {/* Row */}
            <button
              type="button"
              onClick={() => clickable && onStepClick?.(index)}
              disabled={!clickable}
              aria-current={status === 'current' ? 'step' : undefined}
              className={cn(
                'w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left',
                'transition-colors duration-fast',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                {
                  'bg-sidebar-accent':          status === 'current',
                  'cursor-pointer hover:bg-sidebar-hover': clickable,
                  'cursor-default':             !clickable,
                }
              )}
            >
              {/* Circle */}
              <div
                className={cn(
                  'mt-0.5 h-6 w-6 rounded-full border flex items-center justify-center',
                  'text-[11px] font-bold flex-shrink-0 transition-all duration-fast',
                  {
                    'bg-primary border-primary text-white':
                      status === 'complete' || status === 'current',
                    'shadow-[0_0_0_3px_rgba(47,91,255,0.25)]':
                      status === 'current',
                    'border-sidebar-border text-sidebar-foreground/40 bg-transparent':
                      status === 'upcoming',
                  }
                )}
              >
                {status === 'complete'
                  ? <Check className="h-3 w-3" strokeWidth={2.5} />
                  : <span>{index + 1}</span>
                }
              </div>

              {/* Labels */}
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    'text-sm font-semibold transition-colors',
                    {
                      'text-sidebar-foreground':        status === 'current' || status === 'complete',
                      'text-sidebar-foreground/40':     status === 'upcoming',
                    }
                  )}
                >
                  {step.label}
                </div>
                {step.meta && (
                  <div className="text-[11px] text-sidebar-foreground/40 mt-0.5">
                    {step.meta}
                  </div>
                )}
              </div>
            </button>

            {/* Connector */}
            {!isLast && (
              <div
                aria-hidden
                className={cn(
                  'w-px h-4 ms-[22px]',   /* ms- = margin-inline-start (RTL-safe) */
                  status === 'complete'
                    ? 'bg-primary'
                    : 'bg-sidebar-border/40'
                )}
              />
            )}
          </div>
        )
      })}
    </nav>
  )
}

// ─── Stepper Container ────────────────────────────────────────────────────────
// Root component — manages current step state and keyboard navigation.

export interface StepperContainerProps {
  steps:          StepConfig[]
  children:       (props: {
    currentStep:  number
    goTo:         (index: number) => void
    next:         () => void
    prev:         () => void
    isFirst:      boolean
    isLast:       boolean
    progress:     number  // 0–100
  }) => React.ReactNode
  initialStep?:   number
  onComplete?:    () => void
}

export function StepperContainer({
  steps, children, initialStep = 0, onComplete,
}: StepperContainerProps) {
  const [currentStep, setCurrentStep] = React.useState(initialStep)

  const goTo = (index: number) => {
    if (index >= 0 && index < steps.length) setCurrentStep(index)
  }
  const next = () => {
    if (currentStep === steps.length - 1) { onComplete?.(); return }
    setCurrentStep(s => Math.min(s + 1, steps.length - 1))
  }
  const prev = () => setCurrentStep(s => Math.max(s - 1, 0))

  // Keyboard: Enter = next, Shift+Enter = prev
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const active = document.activeElement
      const inTextarea = active?.tagName === 'TEXTAREA'
      const inInput    = active?.tagName === 'INPUT' && (active as HTMLInputElement).type !== 'submit'

      if (inTextarea || inInput) return  // let the field handle it

      if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); prev() }
      else if (e.key === 'Enter' && !e.shiftKey) { /* form submits handle their own Enter */ }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [currentStep])

  return (
    <>
      {children({
        currentStep,
        goTo,
        next,
        prev,
        isFirst:  currentStep === 0,
        isLast:   currentStep === steps.length - 1,
        progress: Math.round(((currentStep + 1) / steps.length) * 100),
      })}
    </>
  )
}

// ─── RTL notes ────────────────────────────────────────────────────────────────
/*
  RTL behavior:
  - HorizontalStepper: connector lines and node order stay left-to-right
    (progress is inherently directional, not mirrored in RTL per WCAG).
  - SidebarStepper: the sidebar moves to the right of the screen (CSS,
    not JS). The step circle + connector stay visually the same.
  - Chevron icons in the footer (Back / Continue) flip via `rtl-flip` class.
  - `ms-` (margin-inline-start) is used instead of `ml-` for connector
    positioning — this is automatically correct in both LTR and RTL.

  Implementation:
  - In [dir="rtl"], the Guard Create Form sidebar is positioned via
    `order-2` (Flexbox) or `right-0` (absolute/sticky) rather than CSS left.
  - The progress strip at top of the form fills from right to left in RTL —
    set `direction: rtl` on the progress container.
*/

// ─── Usage example ────────────────────────────────────────────────────────────
/*
import { StepperContainer, SidebarStepper, HorizontalStepper } from '@/components/ui/stepper'

const GUARD_STEPS = [
  { id: 'personal',  label: 'Personal Information', meta: 'Name, CNIC, DOB, ex-service' },
  { id: 'service',   label: 'Service Details',       meta: 'Designation, shift, office' },
  { id: 'address',   label: 'Address & Contact',     meta: 'Permanent, current, emergency' },
  { id: 'bank',      label: 'Bank & Finance',         meta: 'Account details, salary' },
  { id: 'documents', label: 'Documents',              meta: 'CNIC copy, photo, certs' },
  { id: 'review',    label: 'Review & Submit',        meta: 'Confirm before saving' },
]

export default function GuardCreatePage() {
  return (
    <StepperContainer steps={GUARD_STEPS} onComplete={() => router.push('/guards')}>
      {({ currentStep, goTo, next, prev, isFirst, isLast, progress }) => (
        <div className="flex h-screen">
          <aside className="w-64 bg-sidebar">
            <SidebarStepper
              steps={GUARD_STEPS}
              currentStep={currentStep}
              onStepClick={goTo}
            />
          </aside>
          <main className="flex-1 flex flex-col">
            <div className="h-1 bg-border">
              <div className="h-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex-1 overflow-y-auto p-8">
              {currentStep === 0 && <Step1Personal />}
              {currentStep === 1 && <Step2Service />}
              {/* ... */}
            </div>
            <footer className="h-16 border-t flex items-center px-8 gap-3">
              <span className="text-xs font-mono text-muted-foreground">
                Step {currentStep + 1} / {GUARD_STEPS.length}
              </span>
              <div className="ms-auto flex gap-2">
                {!isFirst && <Button variant="secondary" onClick={prev}>Back</Button>}
                {isLast
                  ? <Button onClick={next}>Submit Guard Profile</Button>
                  : <Button onClick={next}>Continue</Button>
                }
              </div>
            </footer>
          </main>
        </div>
      )}
    </StepperContainer>
  )
}
*/
