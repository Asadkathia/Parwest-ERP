import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { hasAction, isSuperAdmin } from "@/lib/api/permissions"
import PayrollStateClient from "./PayrollStateClient"
import { renderPayrollRegionGate } from "@/components/payroll/PayrollRegionGate"

export default async function PayrollStatePage({
  searchParams,
}: {
  searchParams: Promise<{ regionId?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")
  // State mutations (lock-region, global-finalize, mark-paid, hold, etc.) are
  // all POST endpoints under /api/payroll/state/*, so they gate on
  // PAYROLL:CREATE per the action-mapping convention.
  const canCreate = hasAction(session, "PAYROLL", "CREATE")

  const { node } = await renderPayrollRegionGate({
    searchParams,
    children: ({ effectiveRegionId, pickerRegions, locked }) => (
      <PayrollStateClient
        isSuperAdmin={isSuperAdmin(session)}
        canCreate={canCreate}
        effectiveRegionId={effectiveRegionId}
        regions={pickerRegions}
        locked={locked}
      />
    ),
  })

  return <div className="space-y-6">{node}</div>
}
