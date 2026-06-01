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
