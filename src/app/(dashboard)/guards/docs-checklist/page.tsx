import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import DocsChecklistManager from "@/components/guards/DocsChecklistManager"

export default async function GuardsDocsChecklistPage() {
  const session = await auth()
  if (!session) redirect("/login")

  return <DocsChecklistManager />
}
