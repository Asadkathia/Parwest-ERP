import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { resolveDashboardRole } from "@/lib/dashboard/role"
import InsightsConfigManager from "./manager"

export default async function InsightsSettingsPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const role = resolveDashboardRole(session)
  if (role !== "SUPER_ADMIN") redirect("/dashboard")

  return <InsightsConfigManager />
}
