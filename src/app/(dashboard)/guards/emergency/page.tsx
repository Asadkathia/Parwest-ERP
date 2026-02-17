import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import SectionTitle from "@/components/ui/section-title"
import EmergencyGuardTable from "@/components/guards/EmergencyGuardTable"
import { getMockEmergencyGuardPool } from "@/lib/mockData"

const rules = [
  "CNIC expiry in next 30 days",
  "Missing verification/medical/police documents",
  "Incomplete profile fields required for deployment",
  "Missing pledged documents",
]

export default async function EmergencyGuardsPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const rows = getMockEmergencyGuardPool()

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Emergency Guard Pool"
        subtitle="Guards that can be temporarily assigned despite incomplete documentation"
      />

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
