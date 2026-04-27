import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import SectionTitle from "@/components/ui/section-title"
import EmergencyGuardTable from "@/components/guards/EmergencyGuardTable"
import InlineAlert from "@/components/ui/inline-alert"
import { isPrismaMissingSchemaError, toErrorMessage } from "@/lib/prisma-errors"
import { deriveEmergencyRowFromGuard } from "@/lib/guards/emergency"
import { buildManagerScopeWhere, deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import RegionUrlPicker from "@/components/access/RegionUrlPicker"
import { Suspense } from "react"

const rules = [
  "CNIC expiry in next 30 days",
  "Missing verification/medical/police documents",
  "Incomplete profile fields required for deployment",
  "Missing pledged documents",
]

export default async function EmergencyGuardsPage({
  searchParams,
}: {
  searchParams: Promise<{ regionId?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const { regionId: regionIdParam = "" } = await searchParams
  const scope = deriveManagerScope(session)
  const paramDenied = managerScopeDenied(scope, { regionId: regionIdParam || undefined })
  const activeRegionId = paramDenied
    ? scope?.regionId ?? undefined
    : regionIdParam || scope?.regionId || undefined
  const scopeWhere = buildManagerScopeWhere(scope, {
    regionId: "regionId",
    regionalOfficeId: "regionalOfficeId",
  })

  let dbWarning = ""
  let rows: ReturnType<typeof deriveEmergencyRowFromGuard>[] = []
  const regions = await prisma.region
    .findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
    .catch(() => [] as { id: string; name: string }[])
  const pickerRegions = scope?.regionId
    ? regions.filter((r) => r.id === scope.regionId)
    : regions
  const regionLocked = Boolean(scope?.regionId)

  try {
    const guards = await prisma.guard.findMany({
      where: {
        ...(activeRegionId ? { regionId: activeRegionId } : {}),
        ...scopeWhere,
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
      select: {
        id: true,
        parwestId: true,
        name: true,
        cnic: true,
        phone: true,
        status: true,
        fatherName: true,
        dateOfBirth: true,
        addressCurrent: true,
        joiningDate: true,
      },
    })
    rows = guards.map((guard) => deriveEmergencyRowFromGuard(guard))
  } catch (error: unknown) {
    rows = []
    if (isPrismaMissingSchemaError(error)) {
      dbWarning = "Database schema is not fully migrated yet. Emergency guard pool is unavailable."
    } else {
      dbWarning = `Unable to load emergency guard pool (${toErrorMessage(error, "Unknown database error")}).`
    }
    console.error("EmergencyGuardsPage query failed:", error)
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Emergency Guard Pool"
        subtitle="Guards that can be temporarily assigned despite incomplete documentation"
      />
      {dbWarning ? <InlineAlert type="error" message={dbWarning} /> : null}

      <section className="ui-card p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Suspense>
            <RegionUrlPicker
              regions={pickerRegions}
              locked={regionLocked}
              includeGlobalOption={!regionLocked}
            />
          </Suspense>
        </div>
      </section>

      <section className="ui-card p-4">
        <h3 className="text-sm font-semibold text-[var(--text)]">Eligibility Rules</h3>
        <ul className="mt-2 space-y-1 text-sm text-[var(--text-muted)]">
          {rules.map((rule) => (
            <li key={rule}>• {rule}</li>
          ))}
        </ul>
      </section>

      <EmergencyGuardTable rows={rows} />
    </div>
  )
}
