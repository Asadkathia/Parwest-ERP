import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { hasAction } from "@/lib/api/permissions"
import PayrollHolidaysManager from "@/components/payroll/PayrollHolidaysManager"

export default async function PayrollHolidaysPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const canCreate = hasAction(session, "PAYROLL", "CREATE")
  const canUpdate = hasAction(session, "PAYROLL", "UPDATE")
  const canDelete = hasAction(session, "PAYROLL", "DELETE")
  return (
    <PayrollHolidaysManager
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
    />
  )
}
