import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { deriveManagerScope } from "@/lib/access/scope"
import ClientSearchManager from "@/components/clients/ClientSearchManager"

export default async function ClientSearchLegacyPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const scope = deriveManagerScope(session)
  const regions = await prisma.region
    .findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
    .catch(() => [] as { id: string; name: string }[])
  const pickerRegions = scope?.regionId
    ? regions.filter((r) => r.id === scope.regionId)
    : regions

  return (
    <div className="space-y-6">
      <ClientSearchManager
        title="Client Search Results"
        subtitle="Legacy search filters and result workflow."
        variant="legacy"
        regions={pickerRegions}
        locked={Boolean(scope?.regionId)}
      />
    </div>
  )
}
