import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { hasAction, isSuperAdmin } from "@/lib/api/permissions"
import PayrollStateClient from "./PayrollStateClient"

export default async function PayrollStatePage() {
  const session = await auth()
  if (!session) redirect("/login")
  // State mutations (lock-region, global-finalize, mark-paid, hold, etc.) are
  // all POST endpoints under /api/payroll/state/*, so they gate on
  // PAYROLL:CREATE per the action-mapping convention.
  const canCreate = hasAction(session, "PAYROLL", "CREATE")
  return <PayrollStateClient isSuperAdmin={isSuperAdmin(session)} canCreate={canCreate} />
}
