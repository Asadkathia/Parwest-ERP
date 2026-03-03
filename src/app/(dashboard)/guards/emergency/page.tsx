import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import SectionTitle from "@/components/ui/section-title"
import EmergencyGuardTable from "@/components/guards/EmergencyGuardTable"
import InlineAlert from "@/components/ui/inline-alert"
import { isPrismaMissingSchemaError, toErrorMessage } from "@/lib/prisma-errors"
import { deriveEmergencyRowFromGuard } from "@/lib/guards/emergency"

const rules = [
  "CNIC expiry in next 30 days",
  "Missing verification/medical/police documents",
  "Incomplete profile fields required for deployment",
  "Missing pledged documents",
]

export default async function EmergencyGuardsPage() {
  const session = await auth()
  if (!session) redirect("/login")

  let dbWarning = ""
  let rows: ReturnType<typeof deriveEmergencyRowFromGuard>[] = []

  try {
    const guards = await prisma.guard.findMany({
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
