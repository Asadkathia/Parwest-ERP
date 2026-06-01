import type { Prisma, PrismaClient, Province as PrismaProvince } from "@prisma/client"
import { PROVINCE_VALUES } from "./province-constants.ts"

type Db = Prisma.TransactionClient | PrismaClient

/** Back-compat alias — canonical literals live in `province-constants` (prisma-free). */
export const PROVINCES = PROVINCE_VALUES

export type Province = PrismaProvince

export function resolveProvinceFromRegion(
  region: { province: Province | string | null } | null,
): Province | null {
  const p = region?.province
  return p && (PROVINCES as readonly string[]).includes(p) ? (p as Province) : null
}

/**
 * Resolve a branch's province from its region, in precedence order:
 * its regional office's region → an explicit regionId → the owning client's region.
 */
export async function provinceForBranch(
  db: Db,
  args: { regionalOfficeId?: string | null; regionId?: string | null; clientId?: string | null },
): Promise<Province | null> {
  if (args.regionalOfficeId) {
    const o = await db.regionalOffice.findUnique({
      where: { id: args.regionalOfficeId },
      select: { region: { select: { province: true } } },
    })
    const p = resolveProvinceFromRegion(o?.region ?? null)
    if (p) return p
  }
  if (args.regionId) {
    const r = await db.region.findUnique({
      where: { id: args.regionId },
      select: { province: true },
    })
    const p = resolveProvinceFromRegion(r)
    if (p) return p
  }
  if (args.clientId) {
    const c = await db.client.findUnique({
      where: { id: args.clientId },
      select: { region: { select: { province: true } } },
    })
    return resolveProvinceFromRegion(c?.region ?? null)
  }
  return null
}
