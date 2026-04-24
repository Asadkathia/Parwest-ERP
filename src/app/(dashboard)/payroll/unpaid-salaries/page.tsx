import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { hasAction } from "@/lib/api/permissions"
import PayrollUnpaidSalariesManager from "@/components/payroll/PayrollUnpaidSalariesManager"

export default async function PayrollUnpaidSalariesPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const canUpdate = hasAction(session, "PAYROLL", "UPDATE")
  return <PayrollUnpaidSalariesManager canUpdate={canUpdate} />
}
