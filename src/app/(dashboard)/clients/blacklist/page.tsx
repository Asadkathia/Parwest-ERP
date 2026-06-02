import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import ClientBlacklistManager from "@/components/clients/ClientBlacklistManager"

export default async function ClientBlacklistPage() {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <div className="space-y-6">
      <ClientBlacklistManager />
    </div>
  )
}
