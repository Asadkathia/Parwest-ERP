export function getPrismaCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null
  const code = (error as { code?: unknown }).code
  return typeof code === "string" ? code : null
}

export function isPrismaMissingSchemaError(error: unknown): boolean {
  const code = getPrismaCode(error)
  return code === "P2021" || code === "P2022"
}

export function toErrorMessage(error: unknown, fallback = "Unexpected error"): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === "string" && error.trim()) return error
  return fallback
}
