import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { hasAction } from "@/lib/api/permissions"
import CsRelationshipManager from "@/components/users/CsRelationshipManager"

export default async function UsersCsRelationshipPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (!hasAction(session, "USERS", "VIEW")) redirect("/")

  return <CsRelationshipManager />
}
