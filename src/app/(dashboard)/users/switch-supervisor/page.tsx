import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import SwitchSupervisorManager from "./manager"

export default async function UsersSwitchSupervisorPage() {
  const session = await auth()
  if (!session) redirect("/login")

  return <SwitchSupervisorManager />
}
