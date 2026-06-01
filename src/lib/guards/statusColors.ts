// Allowed badge colors for the admin-managed Guard Status catalog (ticket #58).
// Single source of truth shared by the API route (server-side validation) and
// the Prerequisites manager UI (color picker). Plain string constants only — safe
// to import into client components (no Prisma/server deps).
export const GUARD_STATUS_COLORS = [
  "gray",
  "green",
  "yellow",
  "red",
  "blue",
  "brown",
  "orange",
  "teal",
  "purple",
  "pink",
] as const

export type GuardStatusColor = (typeof GUARD_STATUS_COLORS)[number]

/** Normalize an arbitrary input to a known color, falling back to "gray". */
export function normalizeStatusColor(value: unknown): GuardStatusColor {
  const s = String(value ?? "").trim()
  return (GUARD_STATUS_COLORS as readonly string[]).includes(s) ? (s as GuardStatusColor) : "gray"
}
