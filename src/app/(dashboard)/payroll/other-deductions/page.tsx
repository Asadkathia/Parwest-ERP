import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { hasAction } from "@/lib/api/permissions"
import PayrollOtherDeductionsManager from "@/components/payroll/PayrollOtherDeductionsManager"

export default async function PayrollOtherDeductionsPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const canCreate = hasAction(session, "PAYROLL", "CREATE")
  return <PayrollOtherDeductionsManager canCreate={canCreate} />
}
