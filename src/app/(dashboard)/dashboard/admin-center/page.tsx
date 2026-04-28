import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import AdminCenterManager from "./manager"

export default async function AdminCenterPage() {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <div className="space-y-6">
      <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold tracking-tight">{"Admin Communication Center"}</h2><p className="mt-1 text-sm text-muted-foreground">{"Broadcast messages and review recent system activity by all users"}</p></div></div>
      <AdminCenterManager />
    </div>
  )
}
