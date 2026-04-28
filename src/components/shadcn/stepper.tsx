/**
 * Parwest ERP — Stepper
 * ─────────────────────────────────────────────────────────────────────────
 * shadcn/ui does not ship a Stepper. Used by the Guard Create wizard
 * (6-step) and any future multi-step forms.
 *
 * Variants: 'horizontal' (default) and 'sidebar'.
 * RTL: connector lines use `ms-` (margin-inline-start) so they stay
 *      correctly placed in both LTR and RTL. Chevron-style indicators
 *      mirror via `rtl:rotate-180`.
 */

"use client"

import * as React from "react"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

// ─── Types ───────────────────────────────────────────────────────────────────

export type StepStatus = "upcoming" | "current" | "complete" | "error"

export interface StepConfig {
  id: string
  label: string
  /** Optional sub-label shown below step label in the sidebar nav variant */
  meta?: string
  /** Shown in the step circle instead of the index number when upcoming */
  icon?: React.ReactNode
}

export interface StepperProps {
  steps: StepConfig[]
  /** 0-indexed current step */
  currentStep: number
  /** Called when a completed step node is clicked (allows back-navigation) */
  onStepClick?: (index: number) => void
  /** 'horizontal' renders inline progress bar; 'sidebar' renders left nav list */
  variant?: "horizontal" | "sidebar"
  className?: string
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function getStatus(index: number, current: number): StepStatus {
  if (index < current) return "complete"
  if (index === current) return "current"
  return "upcoming"
}

// ─── Horizontal Stepper ───────────────────────────────────────────────────────

function HorizontalStepper({
  steps,
  currentStep,
  onStepClick,
  className,
}: StepperProps) {
  return (
    <nav
      aria-label="Form progress"
      className={cn("flex items-start", className)}
    >
      {steps.map((step, index) => {
        const status = getStatus(index, currentStep)
        const isLast = index === steps.length - 1
        const clickable = status === "complete" && onStepClick != null

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
                tabIndex={clickable ? 0 : -1}
                onClick={() => clickable && onStepClick?.(index)}
                onKeyDown={(e) => {
                  if (!clickable) return
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    onStepClick?.(index)
                  }
                }}
                disabled={!clickable}
                aria-current={status === "current" ? "step" : undefined}
                aria-label={`Step ${index + 1}: ${step.label} — ${status}`}
                className={cn(
                  "h-[30px] w-[30px] rounded-full border-2 flex items-center justify-center",
                  "text-xs font-bold transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  {
                    // complete
                    "bg-primary border-primary text-primary-foreground cursor-pointer":
                      status === "complete",
                    // current
                    "bg-primary border-primary text-primary-foreground shadow-[0_0_0_4px_rgba(47,91,255,0.25)]":
                      status === "current",
                    // upcoming
                    "bg-card border-border text-muted-foreground cursor-default":
                      status === "upcoming",
                    // error (future)
                    "bg-destructive border-destructive text-destructive-foreground":
                      status === "error",
                  }
                )}
              >
                {status === "complete" ? (
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                ) : (
                  <span>{index + 1}</span>
                )}
              </button>

              {/* Label */}
              <span
                className={cn(
                  "mt-1.5 text-center text-[10px] font-semibold whitespace-nowrap",
                  {
                    "text-primary": status === "current",
                    "text-foreground": status === "complete",
                    "text-muted-foreground": status === "upcoming",
                  }
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line — uses logical placement so RTL is automatic */}
            {!isLast && (
              <div
                aria-hidden
                className={cn(
                  "h-0.5 flex-1 mt-[15px] rtl:rotate-180",
                  status === "complete" ? "bg-primary" : "bg-border"
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

function SidebarStepper({
  steps,
  currentStep,
  onStepClick,
  className,
}: StepperProps) {
  return (
    <nav
      aria-label="Form steps"
      className={cn("flex flex-col gap-0", className)}
    >
      {steps.map((step, index) => {
        const status = getStatus(index, currentStep)
        const isLast = index === steps.length - 1
        const clickable = status === "complete" && onStepClick != null

        return (
          <div key={step.id}>
            {/* Row */}
            <button
              type="button"
              tabIndex={clickable ? 0 : -1}
              onClick={() => clickable && onStepClick?.(index)}
              onKeyDown={(e) => {
                if (!clickable) return
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  onStepClick?.(index)
                }
              }}
              disabled={!clickable}
              aria-current={status === "current" ? "step" : undefined}
              aria-label={`Step ${index + 1}: ${step.label} — ${status}`}
              className={cn(
                "w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-start",
                "transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                {
                  "bg-accent": status === "current",
                  "cursor-pointer hover:bg-accent/60": clickable,
                  "cursor-default": !clickable,
                }
              )}
            >
              {/* Circle */}
              <div
                className={cn(
                  "mt-0.5 h-6 w-6 rounded-full border flex items-center justify-center",
                  "text-[11px] font-bold flex-shrink-0 transition-all",
                  {
                    "bg-primary border-primary text-primary-foreground":
                      status === "complete" || status === "current",
                    "shadow-[0_0_0_3px_rgba(47,91,255,0.25)]":
                      status === "current",
                    "border-border text-muted-foreground bg-transparent":
                      status === "upcoming",
                    "bg-destructive border-destructive text-destructive-foreground":
                      status === "error",
                  }
                )}
              >
                {status === "complete" ? (
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>

              {/* Labels */}
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    "text-sm font-semibold transition-colors",
                    {
                      "text-foreground":
                        status === "current" || status === "complete",
                      "text-muted-foreground": status === "upcoming",
                    }
                  )}
                >
                  {step.label}
                </div>
                {step.meta && (
                  <div className="text-[11px] text-muted-foreground mt-0.5">
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
                  "w-px h-4 ms-[22px]",
                  status === "complete" ? "bg-primary" : "bg-border/60"
                )}
              />
            )}
          </div>
        )
      })}
    </nav>
  )
}

// ─── Stepper (unified entry) ──────────────────────────────────────────────────

export function Stepper({ variant = "horizontal", ...props }: StepperProps) {
  if (variant === "sidebar") return <SidebarStepper {...props} />
  return <HorizontalStepper {...props} />
}

// ─── Stepper Container ────────────────────────────────────────────────────────
// Optional helper — manages current step state and keyboard navigation.

export interface StepperContainerProps {
  steps: StepConfig[]
  children: (props: {
    currentStep: number
    goTo: (index: number) => void
    next: () => void
    prev: () => void
    isFirst: boolean
    isLast: boolean
    progress: number // 0–100
  }) => React.ReactNode
  initialStep?: number
  onComplete?: () => void
}

export function StepperContainer({
  steps,
  children,
  initialStep = 0,
  onComplete,
}: StepperContainerProps) {
  const [currentStep, setCurrentStep] = React.useState(initialStep)

  const goTo = (index: number) => {
    if (index >= 0 && index < steps.length) setCurrentStep(index)
  }
  const next = () => {
    if (currentStep === steps.length - 1) {
      onComplete?.()
      return
    }
    setCurrentStep((s) => Math.min(s + 1, steps.length - 1))
  }
  const prev = () => setCurrentStep((s) => Math.max(s - 1, 0))

  return (
    <>
      {children({
        currentStep,
        goTo,
        next,
        prev,
        isFirst: currentStep === 0,
        isLast: currentStep === steps.length - 1,
        progress: Math.round(((currentStep + 1) / steps.length) * 100),
      })}
    </>
  )
}

export { HorizontalStepper, SidebarStepper }
