import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import SuggestionCard from "@/components/ai/SuggestionCard"
import InlineAlert from "@/components/ui/inline-alert"
import { isPrismaMissingSchemaError, toErrorMessage } from "@/lib/prisma-errors"
import type { ShshkSuggestion } from "@/lib/shshk/types"

export default async function ShshkPage() {
  const session = await auth()
  if (!session) redirect("/login")

  let dbWarning = ""
  let suggestions: ShshkSuggestion[] = []

  try {
    const [totalGuards, inactiveGuards, trainingsCount, deploymentsCount] = await Promise.all([
      prisma.guard.count(),
      prisma.guard.count({ where: { status: "INACTIVE" } }),
      prisma.training.count(),
      prisma.deployment.count(),
    ])

    const inactiveRatio = inactiveGuards / Math.max(totalGuards, 1)
    const complianceImpact = Math.max(Math.ceil(totalGuards * 0.2), 1)
    const trainingGap = Math.max(deploymentsCount - trainingsCount, 0)

    suggestions = [
      {
        id: "s-db-1",
        category: "Compliance",
        priority: complianceImpact > 10 ? "HIGH" : "MEDIUM",
        title: "Guard record compliance follow-up",
        rationale: `${complianceImpact} guard records likely need compliance follow-up based on current roster size.`,
        impactedEntities: complianceImpact,
        recommendation: "Run compliance checklist review and prioritize records missing core verification fields.",
      },
      {
        id: "s-db-2",
        category: "Staffing",
        priority: inactiveRatio > 0.25 ? "HIGH" : inactiveRatio > 0.15 ? "MEDIUM" : "LOW",
        title: "Inactive guard ratio review",
        rationale: `Inactive ratio is ${(inactiveRatio * 100).toFixed(1)}% of total active roster.`,
        impactedEntities: inactiveGuards,
        recommendation: "Audit inactive guards for reactivation, replacement, or removal from active planning pools.",
      },
      {
        id: "s-db-3",
        category: "Operations",
        priority: trainingGap > 10 ? "HIGH" : trainingGap > 0 ? "MEDIUM" : "LOW",
        title: "Training coverage opportunity",
        rationale: `${trainingsCount} training records vs ${deploymentsCount} deployments indicates a training coverage gap of ${trainingGap}.`,
        impactedEntities: trainingGap,
        recommendation: "Schedule training refresh for branches with the highest deployment volume first.",
      },
    ]
  } catch (error: unknown) {
    suggestions = []
    if (isPrismaMissingSchemaError(error)) {
      dbWarning = "Database schema is not fully migrated yet. SHSHK insights are unavailable."
    } else {
      dbWarning = `Unable to load SHSHK insights (${toErrorMessage(error, "Unknown database error")}).`
    }
    console.error("ShshkPage query failed:", error)
  }

  return (
    <div className="space-y-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">SHSHK System Health Insights</h2>
          <p className="mt-1 text-sm text-muted-foreground">AI-based admin recommendations for compliance, staffing, billing, and operations</p>
        </div>
      </div>
      {dbWarning ? <InlineAlert type="error" message={dbWarning} /> : null}

      {suggestions.length === 0 ? (
        <section className="ui-card p-4">
          <p className="text-sm text-[var(--text-muted)]">No SHSHK insights available right now.</p>
        </section>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {suggestions.map((suggestion) => (
            <SuggestionCard key={suggestion.id} suggestion={suggestion} />
          ))}
        </div>
      )}
    </div>
  )
}
