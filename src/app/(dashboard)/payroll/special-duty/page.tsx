import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { hasAction } from "@/lib/api/permissions"
import PayrollSpecialDutyManager from "@/components/payroll/PayrollSpecialDutyManager"
import { renderPayrollRegionGate } from "@/components/payroll/PayrollRegionGate"

export default async function PayrollSpecialDutyPage({
  searchParams,
}: {
  searchParams: Promise<{ regionId?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")
  const canCreate = hasAction(session, "PAYROLL", "CREATE")
  const canDelete = hasAction(session, "PAYROLL", "DELETE")

  const { node } = await renderPayrollRegionGate({
    searchParams,
    children: ({ effectiveRegionId, pickerRegions, locked }) => (
      <PayrollSpecialDutyManager
        canCreate={canCreate}
        canDelete={canDelete}
        effectiveRegionId={effectiveRegionId}
        regions={pickerRegions}
        locked={locked}
      />
    ),
  })

  return <div className="space-y-6">{node}</div>
}
