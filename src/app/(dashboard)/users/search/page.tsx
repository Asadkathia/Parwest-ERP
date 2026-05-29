import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { hasAction } from "@/lib/api/permissions"
import UserSearchManager from "@/components/users/UserSearchManager"

export default async function UsersSearchPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (!hasAction(session, "USERS", "VIEW")) redirect("/")

  return <UserSearchManager />
}
