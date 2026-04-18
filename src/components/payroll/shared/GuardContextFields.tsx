"use client"

import type { GuardCurrentContext } from "@/lib/guards/currentContext"

type Props = {
  context: GuardCurrentContext | null
  showRows?: Array<
    | "name"
    | "status"
    | "type"
    | "phone"
    | "client"
    | "branch"
    | "days"
    | "doubleDuty"
    | "supervisor"
    | "manager"
    | "loan"
    | "location"
  >
}

const LABELS: Record<NonNullable<Props["showRows"]>[number], string> = {
  name: "Guard Name",
  status: "Status",
  type: "Type",
  phone: "Phone Number",
  client: "Client",
  branch: "Branch Name",
  days: "Days",
  doubleDuty: "Double Duty Days",
  supervisor: "Current Supervisor",
  manager: "Current Manager",
  loan: "Loan",
  location: "Current Location",
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
        {label}
      </label>
      <input
        className="ui-input bg-[var(--surface-muted)]"
        value={value == null || value === "" ? "" : String(value)}
        readOnly
        disabled
      />
    </div>
  )
}

export default function GuardContextFields({
  context,
  showRows = ["name", "status", "phone", "client", "branch", "days", "doubleDuty", "supervisor", "manager"],
}: Props) {
  const values: Record<string, string | number | null> = {
    name: context?.name ?? "",
    status: context?.status ?? "",
    type: context?.guardType ?? "",
    phone: context?.phone ?? "",
    client: context?.client?.name ?? "",
    branch: context?.branch?.name ?? "",
    days: context?.deploymentDays ?? 0,
    doubleDuty: context?.doubleDutyDays ?? 0,
    supervisor: context?.currentSupervisor?.name ?? "",
    manager: context?.currentManager?.name ?? "",
    loan: context?.currentUnpaidLoan ?? 0,
    location: context?.branch ? `${context.branch.name}${context.branch.city ? `, ${context.branch.city}` : ""}` : "",
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {showRows.map((key) => (
        <Field key={key} label={LABELS[key]} value={values[key]} />
      ))}
    </div>
  )
}
