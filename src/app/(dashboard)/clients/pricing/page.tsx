import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import PricingClient from "./PricingClient"

export default async function ClientsPricingPage() {
  const session = await auth()
  if (!session) redirect("/login")

  // Clients are region-less (scoped by their branches server-side via
  // clientScopeWhere), so the pricing overview no longer needs a region picker.
  return (
    <div className="space-y-6">
      <PricingClient />
    </div>
  )
}
