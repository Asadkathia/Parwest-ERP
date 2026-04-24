import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { hasAction } from "@/lib/api/permissions"
import PayrollSettingsClient from "./PayrollSettingsClient"

export default async function PayrollSettingsPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const canCreate = hasAction(session, "PAYROLL", "CREATE")
  const canUpdate = hasAction(session, "PAYROLL", "UPDATE")
  const canDelete = hasAction(session, "PAYROLL", "DELETE")
  return (
    <PayrollSettingsClient
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
    />
  )
}
