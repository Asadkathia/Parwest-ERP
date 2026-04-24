import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { hasAction } from "@/lib/api/permissions"
import PayrollBulkSalarySlipsManager from "@/components/payroll/PayrollBulkSalarySlipsManager"

export default async function PayrollBulkSalarySlipsPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const canCreate = hasAction(session, "PAYROLL", "CREATE")
  return <PayrollBulkSalarySlipsManager canCreate={canCreate} />
}
