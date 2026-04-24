import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { hasAction } from "@/lib/api/permissions"
import UserEnrollmentManager from "@/components/users/UserEnrollmentManager"

export default async function UsersNewPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (!hasAction(session, "USERS", "CREATE")) redirect("/users")
  return <UserEnrollmentManager />
}
