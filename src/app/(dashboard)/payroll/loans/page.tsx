import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { hasAction } from "@/lib/api/permissions"
import PayrollLoansClient from "./PayrollLoansClient"

export default async function PayrollLoansPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const canCreate = hasAction(session, "PAYROLL", "CREATE")
  const canUpdate = hasAction(session, "PAYROLL", "UPDATE")
  const canView = hasAction(session, "PAYROLL", "VIEW")
  return (
    <PayrollLoansClient
      canCreate={canCreate}
      canUpdate={canUpdate}
      canView={canView}
    />
  )
}
