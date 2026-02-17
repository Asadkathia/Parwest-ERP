import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import ClientInvoicingManager from "./manager"

export default async function ClientInvoicingPage() {
  const session = await auth()
  if (!session) redirect("/login")

  return <ClientInvoicingManager />
}
