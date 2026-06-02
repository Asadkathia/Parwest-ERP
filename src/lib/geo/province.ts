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
 * Enforce that a client's home Region lies within its selected operational
 * province — each province only contains its own cities (e.g. KPK cannot host
 * the Lahore region). Returns `{ ok: false, message }` to reject, `{ ok: true }`
 * to allow. Lenient when either side is unset or the region has no province.
 */
export async function checkRegionWithinProvince(
  db: Db,
  args: { regionId: string | null | undefined; operationalProvince: string | null | undefined },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const op = (args.operationalProvince ?? "").trim()
  if (!op) return { ok: true }
  if (!(PROVINCES as readonly string[]).includes(op)) {
    return { ok: false, message: `Invalid operational province "${op}".` }
  }
  if (!args.regionId) return { ok: true }
  const region = await db.region.findUnique({
    where: { id: args.regionId },
    select: { name: true, province: true },
  })
  const regionProvince = resolveProvinceFromRegion(region)
  if (regionProvince && regionProvince !== op) {
    return {
      ok: false,
      message: `Region "${region?.name}" is in ${regionProvince}, which is outside the selected operational province ${op}. Each province only lists its own cities.`,
    }
  }
  return { ok: true }
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
