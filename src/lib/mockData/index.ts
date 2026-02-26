const TRUE_VALUES = new Set(["1", "true", "yes", "on"])

export function isMockEnabled() {
  const raw = process.env.NEXT_PUBLIC_USE_MOCKS ?? process.env.USE_MOCKS
  const normalized = String(raw ?? "").trim().toLowerCase()

  // Mock mode is explicit opt-in only.
  return TRUE_VALUES.has(normalized)
}

export * from "./aiReports"
export * from "./emergencyGuards"
export * from "./ocr"
export * from "./broadcasts"
export * from "./adminLogs"
export * from "./invoices"
export * from "./branchTypes"
export * from "./shshkSuggestions"
export * from "./guards"
export * from "./clients"
export * from "./deployments"
export * from "./fingerprint"
export * from "./loansBulk"
export * from "./meetingAdditions"
