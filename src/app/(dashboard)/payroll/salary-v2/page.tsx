import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { hasAction } from "@/lib/api/permissions"
import PayrollSalaryV2Manager from "@/components/payroll/PayrollSalaryV2Manager"

export default async function PayrollSalaryV2Page() {
  const session = await auth()
  if (!session) redirect("/login")
  const canCreate = hasAction(session, "PAYROLL", "CREATE")
  return <PayrollSalaryV2Manager canCreate={canCreate} />
}
