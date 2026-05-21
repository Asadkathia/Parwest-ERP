import type { Prisma, PrismaClient } from "@prisma/client"

type Db = Prisma.TransactionClient | PrismaClient

/** Region.name IS the operating city. Returns the city for a regionId, or null. */
export async function cityForRegionId(db: Db, regionId: string | null | undefined): Promise<string | null> {
  if (!regionId) return null
  const region = await db.region.findUnique({ where: { id: regionId }, select: { name: true } })
  return region?.name ?? null
}

/**
 * Resolve a branch's operating city from its region, in precedence order:
 * its regional office's region → an explicit regionId → the owning client's region.
 */
export async function cityForBranch(
  db: Db,
  args: { regionalOfficeId?: string | null; regionId?: string | null; clientId?: string | null },
): Promise<string | null> {
  if (args.regionalOfficeId) {
    const office = await db.regionalOffice.findUnique({
      where: { id: args.regionalOfficeId },
      select: { region: { select: { name: true } } },
    })
    if (office?.region?.name) return office.region.name
  }
  if (args.regionId) {
    const c = await cityForRegionId(db, args.regionId)
    if (c) return c
  }
  if (args.clientId) {
    const client = await db.client.findUnique({
      where: { id: args.clientId },
      select: { region: { select: { name: true } } },
    })
    return client?.region?.name ?? null
  }
  return null
}
