import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { hasAction } from "@/lib/api/permissions"
import PayrollSalaryV2Manager from "@/components/payroll/PayrollSalaryV2Manager"
import { renderPayrollRegionGate } from "@/components/payroll/PayrollRegionGate"

export default async function PayrollSalaryV2Page({
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
      <PayrollSalaryV2Manager
        canCreate={canCreate}
        effectiveRegionId={effectiveRegionId}
        regions={pickerRegions}
        locked={locked}
      />
    ),
  })

  return <div className="space-y-6">{node}</div>
}
