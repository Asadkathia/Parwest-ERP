import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { hasAction } from "@/lib/api/permissions"
import PayrollExtraHoursManager from "@/components/payroll/PayrollExtraHoursManager"

export default async function PayrollExtraHoursPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const canCreate = hasAction(session, "PAYROLL", "CREATE")
  return <PayrollExtraHoursManager canCreate={canCreate} />
}
