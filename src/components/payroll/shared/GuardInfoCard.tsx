"use client"

import type { GuardCurrentContext } from "@/lib/guards/currentContext"

type Props = {
  context: GuardCurrentContext | null
}

export default function GuardInfoCard({ context }: Props) {
  if (!context) {
    return (
      <div className="ui-card p-6 text-center text-sm text-[var(--text-muted)]">
        Select a guard to see details.
      </div>
    )
  }

  const fullSubtitle = context.fatherName ? `S/O ${context.fatherName}` : null
  const cnicPhone = [context.cnic, context.phone].filter(Boolean).join(" | ")

  return (
    <div className="ui-card p-4 space-y-3">
      <div className="flex flex-col items-center gap-2 pb-3 border-b border-[var(--border)]">
        {context.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={context.photoUrl}
            alt={context.name}
            className="w-20 h-20 rounded-full object-cover border border-[var(--border)]"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-[var(--surface-muted)] flex items-center justify-center text-2xl text-[var(--text-muted)]">
            {context.name.charAt(0)}
          </div>
        )}
        <div className="text-center">
          <div className="font-mono text-xs text-[var(--text-muted)]">{context.parwestId}</div>
          <div className="text-lg font-semibold">{context.name}</div>
          {fullSubtitle && <div className="text-sm text-[var(--text-muted)]">{fullSubtitle}</div>}
        </div>
      </div>

      <div className="space-y-1 text-sm">
        <div className="text-[var(--text-muted)]">{context.status.toLowerCase()}</div>
        {cnicPhone && <div className="text-xs text-[var(--text-muted)]">{cnicPhone}</div>}
        {context.currentSupervisor && (
          <div className="text-xs">
            <span className="text-[var(--text-muted)]">Sup. </span>
            <span>{context.currentSupervisor.name}</span>
          </div>
        )}
      </div>

      {context.deployment && context.client && (
        <div className="rounded bg-green-50 border border-green-200 px-3 py-2 text-xs space-y-0.5">
          <div className="font-semibold text-green-800">Regular Duty</div>
          <div>
            {context.client.name}
            {context.branch && ` | ${context.branch.name}`}
          </div>
          <div className="text-green-700">
            {new Date(context.deployment.deploymentDate).toLocaleDateString()} —{" "}
            <span className="font-semibold">Currently Deployed</span>
          </div>
        </div>
      )}

      {context.doubleDutyDays > 0 && (
        <div className="rounded bg-pink-50 border border-pink-200 px-3 py-2 text-xs">
          <div className="font-semibold text-pink-800">Double Duty</div>
          <div className="text-pink-700">{context.doubleDutyDays} day(s) this month</div>
        </div>
      )}
    </div>
  )
}
