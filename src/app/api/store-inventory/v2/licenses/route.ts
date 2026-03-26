import { NextRequest } from "next/server"
import { badRequest, conflict, internalServerError, ok } from "@/lib/api/response"
import { getPrismaCode } from "@/lib/prisma-errors"
import { prisma } from "@/lib/db"
import { asText, emitInventoryV2Audit, requireInventorySession, requireV2WriteEnabled } from "@/lib/inventory/store-v2-api"

function parseDate(value: unknown): Date | null {
  if (value == null || value === "") return null
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return null
  return date
}

export async function GET() {
  const session = await requireInventorySession()
  if (session instanceof Response) return session

  try {
    const rows = await prisma.storeInventoryLicense.findMany({
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

    const created = await prisma.storeInventoryLicense.create({
      data: {
        validity,
        licenseNumber,
        clientId: asText(body.clientId),
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
