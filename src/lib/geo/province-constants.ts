/**
 * Canonical province values, prisma-free so it is safe to import from client
 * components. The server-only `@/lib/geo/province` module re-exports these as
 * `PROVINCES` and adds prisma-typed helpers; do not duplicate the literals.
 */
export const PROVINCE_VALUES = [
  "PUNJAB",
  "SINDH",
  "KPK",
  "BALOCHISTAN",
  "ICT",
  "AJK",
  "GILGIT_BALTISTAN",
] as const

export type ProvinceValue = (typeof PROVINCE_VALUES)[number]

/**
 * Dropdown options for province pickers. Values are the canonical `Province`
 * enum strings (so they match `Region.province` for filtering and pass the
 * server-side province↔region guard); labels are human-readable. Use this
 * everywhere instead of hand-rolling Title-case option lists. (#47)
 */
export const PROVINCE_OPTIONS: { value: ProvinceValue; label: string }[] = [
  { value: "PUNJAB", label: "Punjab" },
  { value: "SINDH", label: "Sindh" },
  { value: "KPK", label: "Khyber Pakhtunkhwa (KPK)" },
  { value: "BALOCHISTAN", label: "Balochistan" },
  { value: "ICT", label: "Islamabad (ICT)" },
  { value: "AJK", label: "Azad Jammu & Kashmir (AJK)" },
  { value: "GILGIT_BALTISTAN", label: "Gilgit-Baltistan" },
]

const PROVINCE_LABELS: Record<string, string> = Object.fromEntries(
  PROVINCE_OPTIONS.map((o) => [o.value, o.label]),
)

/** Human-readable label for a stored province enum value (falls back to the raw value). */
export function provinceLabel(value: string | null | undefined): string {
  if (!value) return "—"
  return PROVINCE_LABELS[value] ?? value
}
