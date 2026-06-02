import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import ClientInsuranceSettingsClient from "./ClientInsuranceSettingsClient"

export default async function ClientInsuranceSettingsPage() {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <div className="space-y-6">
      <ClientInsuranceSettingsClient />
    </div>
  )
}
