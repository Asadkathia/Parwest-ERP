import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import SectionTitle from "@/components/ui/section-title"
import AdminCenterManager from "./manager"

export default async function AdminCenterPage() {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Admin Communication Center"
        subtitle="Broadcast messages and review recent system activity by all users"
      />
      <AdminCenterManager />
    </div>
  )
}
