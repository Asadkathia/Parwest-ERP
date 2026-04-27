import { Suspense } from "react"
import type { Session } from "next-auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope } from "@/lib/access/scope"
import RegionUrlPicker from "./RegionUrlPicker"

export default async function RegionFilterCard({
  session,
  includeGlobalOption = false,
  paramName = "regionId",
  label = "Region",
}: {
  session: Session | null
  includeGlobalOption?: boolean
  paramName?: string
  label?: string
}) {
  const regions = await prisma.region
    .findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
    .catch(() => [] as { id: string; name: string }[])
  const scope = deriveManagerScope(session)
  const pickerRegions = scope?.regionId
    ? regions.filter((r) => r.id === scope.regionId)
    : regions

  // SuperAdmin (no scope) gets the "Global" option and uses it as the default
  // active state. Caller can also opt into Global explicitly via prop.
  const showGlobalOption = (includeGlobalOption || !scope) && !scope?.regionId

  return (
    <section className="ui-card p-5">
      <Suspense>
        <RegionUrlPicker
          regions={pickerRegions}
          locked={Boolean(scope?.regionId)}
          paramName={paramName}
          label={label}
          includeGlobalOption={showGlobalOption}
          defaultToGlobal={showGlobalOption}
        />
      </Suspense>
    </section>
  )
}
