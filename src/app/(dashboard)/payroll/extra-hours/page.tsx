import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { hasAction } from "@/lib/api/permissions"
import PayrollExtraHoursManager from "@/components/payroll/PayrollExtraHoursManager"
import { renderPayrollRegionGate } from "@/components/payroll/PayrollRegionGate"

export default async function PayrollExtraHoursPage({
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
      <PayrollExtraHoursManager
        canCreate={canCreate}
        effectiveRegionId={effectiveRegionId}
        regions={pickerRegions}
        locked={locked}
      />
    ),
  })

  return <div className="space-y-6">{node}</div>
}
