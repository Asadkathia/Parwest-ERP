import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { hasAction } from "@/lib/api/permissions"
import PayrollClearanceManager from "@/components/payroll/PayrollClearanceManager"

export default async function PayrollClearancePage() {
  const session = await auth()
  if (!session) redirect("/login")
  const canCreate = hasAction(session, "PAYROLL", "CREATE")
  return <PayrollClearanceManager canCreate={canCreate} />
}
