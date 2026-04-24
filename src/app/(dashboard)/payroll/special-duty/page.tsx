import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { hasAction } from "@/lib/api/permissions"
import PayrollSpecialDutyManager from "@/components/payroll/PayrollSpecialDutyManager"

export default async function PayrollSpecialDutyPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const canCreate = hasAction(session, "PAYROLL", "CREATE")
  const canDelete = hasAction(session, "PAYROLL", "DELETE")
  return (
    <PayrollSpecialDutyManager canCreate={canCreate} canDelete={canDelete} />
  )
}
