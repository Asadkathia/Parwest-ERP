import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { hasAction } from "@/lib/api/permissions"
import MsRelationshipManager from "@/components/users/MsRelationshipManager"

export default async function UsersMsRelationshipPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (!hasAction(session, "USERS", "VIEW")) redirect("/")

  return <MsRelationshipManager />
}
