const TRUE_VALUES = new Set(["1", "true", "yes", "on"])

export function isRuntimeMockEnabled() {
  const raw = process.env.NEXT_PUBLIC_USE_MOCKS ?? process.env.USE_MOCKS
  const normalized = String(raw ?? "").trim().toLowerCase()
  return TRUE_VALUES.has(normalized)
}

