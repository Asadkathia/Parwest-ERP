export type SuggestionCategory = "Compliance" | "Staffing" | "Billing" | "Operations"
export type SuggestionPriority = "HIGH" | "MEDIUM" | "LOW"

export type ShshkSuggestion = {
  id: string
  category: SuggestionCategory
  priority: SuggestionPriority
  title: string
  rationale: string
  impactedEntities: number
  recommendation: string
}
