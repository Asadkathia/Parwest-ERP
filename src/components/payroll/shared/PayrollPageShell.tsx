"use client"

import { ReactNode } from "react"
import SectionTitle from "@/components/ui/section-title"

type Tab = {
  id: string
  label: string
}

type Props = {
  title: string
  subtitle?: string
  tabs?: Tab[]
  activeTab?: string
  onTabChange?: (tabId: string) => void
  actions?: ReactNode
  children: ReactNode
}

export default function PayrollPageShell({
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  actions,
  children,
}: Props) {
  return (
    <div className="space-y-6">
      <SectionTitle title={title} subtitle={subtitle} action={actions} />

      {tabs && tabs.length > 0 && (
        <div className="flex flex-wrap gap-2 border-b border-[var(--border)]">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange?.(tab.id)}
                className={`px-4 py-2 text-sm font-medium uppercase tracking-wide transition-colors rounded-t ${
                  isActive
                    ? "bg-[var(--brand)] text-white"
                    : "bg-[var(--surface-muted)] text-[var(--text-muted)] hover:bg-[var(--surface)]"
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      )}

      <div>{children}</div>
    </div>
  )
}
