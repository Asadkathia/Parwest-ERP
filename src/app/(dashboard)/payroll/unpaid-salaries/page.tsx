import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { hasAction } from "@/lib/api/permissions"
import PayrollUnpaidSalariesManager from "@/components/payroll/PayrollUnpaidSalariesManager"
import { renderPayrollRegionGate } from "@/components/payroll/PayrollRegionGate"

export default async function PayrollUnpaidSalariesPage({
  searchParams,
}: {
  searchParams: Promise<{ regionId?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")
  const canUpdate = hasAction(session, "PAYROLL", "UPDATE")

  const { node } = await renderPayrollRegionGate({
    searchParams,
    children: ({ effectiveRegionId, pickerRegions, locked }) => (
      <PayrollUnpaidSalariesManager
        canUpdate={canUpdate}
        effectiveRegionId={effectiveRegionId}
        regions={pickerRegions}
        locked={locked}
      />
    ),
  })

  return <div className="space-y-6">{node}</div>
}
