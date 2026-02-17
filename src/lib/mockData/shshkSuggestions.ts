import { mockGuardsList, mockInactiveGuards, mockTrainings } from "@/lib/mockData/guards"
import { mockDeploymentsList } from "@/lib/mockData/deployments"

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

export function getMockShshkSuggestions(): ShshkSuggestion[] {
  const inactiveRatio = mockInactiveGuards.length / Math.max(mockGuardsList.length, 1)

  return [
    {
      id: "s-1",
      category: "Compliance",
      priority: "HIGH",
      title: "CNIC verification window approaching",
      rationale: `${Math.ceil(mockGuardsList.length * 0.35)} guard records are near document expiry windows.`,
      impactedEntities: Math.ceil(mockGuardsList.length * 0.35),
      recommendation: "Prioritize document refresh queue and schedule OCR-assisted verification checks.",
    },
    {
      id: "s-2",
      category: "Staffing",
      priority: inactiveRatio > 0.25 ? "HIGH" : "MEDIUM",
      title: "Inactive guard ratio above baseline",
      rationale: `Inactive ratio is ${(inactiveRatio * 100).toFixed(1)}% against recommended < 20%.`,
      impactedEntities: mockInactiveGuards.length,
      recommendation: "Trigger emergency guard pool and reallocation workflow for active branches.",
    },
    {
      id: "s-3",
      category: "Operations",
      priority: "MEDIUM",
      title: "OnJob training coverage can improve",
      rationale: `${mockTrainings.length} recent OJT records found; several branches have no fresh training entries.`,
      impactedEntities: Math.max(mockDeploymentsList.length - mockTrainings.length, 1),
      recommendation: "Run branch-wise training report and schedule overdue sessions.",
    },
    {
      id: "s-4",
      category: "Billing",
      priority: "LOW",
      title: "Invoice batching opportunity detected",
      rationale: "Branch-wise invoicing has small batches that can be consolidated by cycle.",
      impactedEntities: 2,
      recommendation: "Switch low-volume branches to client-wise monthly consolidated invoice.",
    },
  ]
}
