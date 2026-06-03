import { NextRequest } from "next/server"
import { badRequest, conflict, internalServerError, ok } from "@/lib/api/response"
import { getPrismaCode } from "@/lib/prisma-errors"
import { prisma } from "@/lib/db"
import { asText, emitInventoryV2Audit, ensureClientInScope, readScopedRegionParams, requireInventorySession, requireV2WriteEnabled } from "@/lib/inventory/store-v2-api"
import { clientScopeWhere } from "@/lib/clients/access"
import type { Prisma } from "@prisma/client"

function parseDate(value: unknown): Date | null {
  if (value == null || value === "") return null
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return null
  return date
}

export async function GET(request: NextRequest) {
  const session = await requireInventorySession()
  if (session instanceof Response) return session

  const scopeParams = readScopedRegionParams(request, session.scope)
  if (scopeParams instanceof Response) return scopeParams

  // Licenses scope through Client (the model has clientId only with no relation),
  // so resolve scoped client IDs first then filter via clientId in (...).
  // Clients are region-less (B1): scope branch-aware via clientScopeWhere
  // (branchful → by their branches' office region; branchless → own region).
  // Layer URL-supplied filters on top of session scope (branch-aware too) so a
  // regional-office user sees only their office's clients, and SuperAdmin can
  // narrow via the picker. Compose under AND so the OR clauses don't clobber.
  const scopeWhere = clientScopeWhere(session.scope)
  const andClauses: Prisma.ClientWhereInput[] = []
  if (Object.keys(scopeWhere).length > 0) andClauses.push(scopeWhere)
  if (scopeParams.regionalOfficeId) {
    andClauses.push({
      OR: [
        { branches: { some: { regionalOfficeId: scopeParams.regionalOfficeId } } },
        { isBranchless: true, regionalOfficeId: scopeParams.regionalOfficeId },
      ],
    })
  } else if (scopeParams.regionId) {
    andClauses.push({
      OR: [
        { branches: { some: { regionalOffice: { regionId: scopeParams.regionId } } } },
        { isBranchless: true, regionId: scopeParams.regionId },
      ],
    })
  }
  const clientWhere: Prisma.ClientWhereInput = andClauses.length > 0 ? { AND: andClauses } : {}

  let clientIdFilter: { clientId: { in: string[] } } | Record<string, never> = {}
  if (andClauses.length > 0) {
    const scopedClients = await prisma.client.findMany({
      where: clientWhere,
      select: { id: true },
    })
    clientIdFilter = { clientId: { in: scopedClients.map((c) => c.id) } }
  }

  try {
    const rows = await prisma.storeInventoryLicense.findMany({
      where: clientIdFilter,
      orderBy: { createdAt: "desc" },
      take: 500,
    })

    const [clients, weaponTypes, calibres, users] = await Promise.all([
      prisma.client.findMany({
        where: { id: { in: rows.map((row) => row.clientId).filter(Boolean) as string[] } },
        select: { id: true, name: true },
      }),
      prisma.storeInventoryWeaponType.findMany({
        where: { id: { in: rows.map((row) => row.weaponTypeId).filter(Boolean) as string[] } },
        select: { id: true, name: true },
      }),
      prisma.storeInventoryCalibre.findMany({
        where: { id: { in: rows.map((row) => row.calibreId).filter(Boolean) as string[] } },
        select: { id: true, name: true },
      }),
      prisma.user.findMany({
        where: { id: { in: rows.map((row) => row.createdById).filter(Boolean) as string[] } },
        select: { id: true, name: true },
      }),
    ])

    const clientMap = new Map(clients.map((row) => [row.id, row]))
    const weaponTypeMap = new Map(weaponTypes.map((row) => [row.id, row]))
    const calibreMap = new Map(calibres.map((row) => [row.id, row]))
    const userMap = new Map(users.map((row) => [row.id, row]))

    return ok(
      rows.map((row) => ({
        ...row,
        client: row.clientId ? clientMap.get(row.clientId) ?? null : null,
        weaponType: row.weaponTypeId ? weaponTypeMap.get(row.weaponTypeId) ?? null : null,
        calibre: row.calibreId ? calibreMap.get(row.calibreId) ?? null : null,
        createdBy: row.createdById ? userMap.get(row.createdById) ?? null : null,
      })),
    )
  } catch (error) {
    console.error("store-inventory v2 licenses GET failed", error)
    return internalServerError("Failed to fetch licenses.")
  }
}

export async function POST(request: NextRequest) {
  const session = await requireInventorySession()
  if (session instanceof Response) return session

  const writeBlocked = requireV2WriteEnabled()
  if (writeBlocked) return writeBlocked

  try {
    const body = (await request.json()) as Record<string, unknown>
    const validity = asText(body.validity)
    const licenseNumber = asText(body.licenseNumber)

    if (!validity || !licenseNumber) {
      return badRequest("validity and licenseNumber are required.")
    }

    const clientId = asText(body.clientId)
    if (clientId) {
      const clientDenied = await ensureClientInScope(clientId, session.scope)
      if (clientDenied) return clientDenied
    } else if (session.scope?.regionId) {
      // Regional users must always associate a license with a client they can
      // see — refuse to create unattached licenses they wouldn't otherwise list.
      return badRequest("clientId is required for regionally-scoped users.")
    }

    const created = await prisma.storeInventoryLicense.create({
      data: {
        validity,
        licenseNumber,
        clientId,
        weaponNumber: asText(body.weaponNumber),
        weaponTypeId: asText(body.weaponTypeId),
        calibreId: asText(body.calibreId),
        issueDate: parseDate(body.issueDate),
        expiryDate: parseDate(body.expiryDate),
        attachmentName: asText(body.attachmentName),
        createdById: session.userId,
      },
    })

    await emitInventoryV2Audit({
      userId: session.userId,
      event: "LICENSE_CREATED",
      description: `Created inventory license ${created.id} (${created.licenseNumber})`,
      request,
    })

    return ok(created, 201)
  } catch (error) {
    const code = getPrismaCode(error)
    if (code === "P2002") return conflict("License number already exists.")
    if (code === "P2003") return badRequest("Related reference does not exist.")

    console.error("store-inventory v2 licenses POST failed", error)
    return internalServerError("Failed to create license.")
  }
}
