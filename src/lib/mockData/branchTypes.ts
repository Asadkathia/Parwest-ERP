export type BranchType = "ISLAMIC" | "CONVENTIONAL"

export const mockBranchTypeById: Record<string, BranchType> = {
  "branch-1": "CONVENTIONAL",
  "branch-2": "ISLAMIC",
}

export function getMockBranchType(branchId: string): BranchType {
  return mockBranchTypeById[branchId] || "CONVENTIONAL"
}
