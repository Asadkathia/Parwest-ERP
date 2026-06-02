import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import ClientSearchManager from "@/components/clients/ClientSearchManager"

export default async function ClientSearchV2Page() {
  const session = await auth()
  if (!session) redirect("/login")

  // Clients are region-less now (scoped by their branches server-side), so the
  // search page no longer needs a region picker.
  return (
    <div className="space-y-6">
      <ClientSearchManager
        title="Search Clients"
        subtitle="Search and filter clients, then view, edit, or update their status."
      />
    </div>
  )
}
