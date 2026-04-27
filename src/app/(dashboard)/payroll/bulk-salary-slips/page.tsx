import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { hasAction } from "@/lib/api/permissions"
import PayrollBulkSalarySlipsManager from "@/components/payroll/PayrollBulkSalarySlipsManager"
import { renderPayrollRegionGate } from "@/components/payroll/PayrollRegionGate"

export default async function PayrollBulkSalarySlipsPage({
  searchParams,
}: {
  searchParams: Promise<{ regionId?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")
  const canCreate = hasAction(session, "PAYROLL", "CREATE")

  const { node } = await renderPayrollRegionGate({
    searchParams,
    children: ({ effectiveRegionId, pickerRegions, locked }) => (
      <PayrollBulkSalarySlipsManager
        canCreate={canCreate}
        effectiveRegionId={effectiveRegionId}
        regions={pickerRegions}
        locked={locked}
      />
    ),
  })

  return <div className="space-y-6">{node}</div>
}
