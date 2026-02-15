const TRUE_VALUES = new Set(["1", "true", "yes", "on"])
const FALSE_VALUES = new Set(["0", "false", "no", "off"])

export function isMockEnabled() {
  const raw = process.env.NEXT_PUBLIC_USE_MOCKS ?? process.env.USE_MOCKS
  const normalized = String(raw ?? "").trim().toLowerCase()

  // Explicit override always wins.
  if (TRUE_VALUES.has(normalized)) return true
  if (FALSE_VALUES.has(normalized)) return false

  // Automatic fallback mode:
  // 1) Vercel preview deployments
  // 2) Non-production local/dev environments
  // 3) Any environment missing DATABASE_URL
  const isVercelPreview = process.env.VERCEL === "1" && process.env.VERCEL_ENV === "preview"
  const isNonProd = process.env.NODE_ENV !== "production"
  const missingDb = !process.env.DATABASE_URL

  return isVercelPreview || isNonProd || missingDb
}
