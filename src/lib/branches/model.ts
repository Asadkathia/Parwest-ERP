export type BranchModel = "ISLAMIC" | "CONVENTIONAL"

export function deriveBranchModel(clientType?: string | null): BranchModel {
  const normalized = String(clientType || "").toUpperCase()
  return normalized.includes("ISLAMIC") ? "ISLAMIC" : "CONVENTIONAL"
}
