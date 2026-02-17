import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import SectionTitle from "@/components/ui/section-title"
import SuggestionCard from "@/components/ai/SuggestionCard"
import { getMockShshkSuggestions } from "@/lib/mockData"

export default async function ShshkPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const suggestions = getMockShshkSuggestions()

  return (
    <div className="space-y-6">
      <SectionTitle
        title="SHSHK System Health Insights"
        subtitle="AI-based admin recommendations for compliance, staffing, billing, and operations"
      />

      <div className="grid gap-4 md:grid-cols-2">
        {suggestions.map((suggestion) => (
          <SuggestionCard key={suggestion.id} suggestion={suggestion} />
        ))}
      </div>
    </div>
  )
}
