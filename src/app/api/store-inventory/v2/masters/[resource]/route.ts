import { NextRequest } from "next/server"
import { getPrismaCode } from "@/lib/prisma-errors"
import { badRequest, conflict, internalServerError, notFound, ok } from "@/lib/api/response"
import { emitInventoryV2Audit, requireInventorySession, requireV2WriteEnabled } from "@/lib/inventory/store-v2-api"
import { getMasterConfig, isValidMasterResource } from "@/lib/inventory/store-v2-masters"
import { prisma } from "@/lib/db"

function parseResource(request: NextRequest): string {
  const pathname = new URL(request.url).pathname
  const parts = pathname.split("/").filter(Boolean)
  return parts[parts.length - 1] ?? ""
}

export async function GET(request: NextRequest) {
  const session = await requireInventorySession()
  if (session instanceof Response) return session

  const resource = parseResource(request)
  if (!isValidMasterResource(resource)) return notFound("Master resource not found.")

  try {
    const config = getMasterConfig(resource)
    let rows: unknown
    try {
      rows = await config.delegate.findMany({
        include: config.include,
        orderBy: config.orderBy,
      })
    } catch (error) {
      const code = getPrismaCode(error)
      const message = error instanceof Error ? error.message : ""
      if (resource === "categories" && (code === "P2021" || code === "P2022")) {
        rows = await prisma.inventoryCategory.findMany({
          orderBy: { name: "asc" },
        })
      } else if (resource === "statuses" && (code === "P2021" || code === "P2022")) {
        rows = await prisma.storeInventoryStatus.findMany({
          select: { id: true, name: true, createdAt: true, updatedAt: true },
          orderBy: { name: "asc" },
        } as any)
      } else if (message.includes("Unknown field")) {
        rows = await config.delegate.findMany({
          orderBy: config.orderBy,
        })
      } else {
        throw error
      }
    }

    return ok(rows)
  } catch (error) {
    console.error(`store-inventory v2 masters GET (${resource}) failed`, error)
    return internalServerError("Failed to fetch master records.")
  }
}

export async function POST(request: NextRequest) {
  const session = await requireInventorySession()
  if (session instanceof Response) return session

  const writeBlocked = requireV2WriteEnabled()
  if (writeBlocked) return writeBlocked

  const resource = parseResource(request)
  if (!isValidMasterResource(resource)) return notFound("Master resource not found.")

  try {
    const body = (await request.json()) as Record<string, unknown>
    const config = getMasterConfig(resource)
    const data = config.buildCreateData(body)

    if (
      ("name" in data && typeof data.name === "string" && data.name.length === 0) ||
      (resource === "stores" && (typeof data.code !== "string" || data.code.length === 0)) ||
      (resource === "units" && (typeof data.shortCode !== "string" || data.shortCode.length === 0))
    ) {
      return badRequest("Required fields are missing.")
    }

    let created: unknown
    try {
      created = await config.delegate.create({
        data,
        include: config.include,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : ""
      if (!message.includes("Unknown field") && !message.includes("Unknown argument")) throw error
      created = await config.delegate.create({
        data,
      })
    }
    const createdId =
      created && typeof created === "object" && "id" in created
        ? String((created as { id: string | number }).id)
        : "unknown"

    await emitInventoryV2Audit({
      userId: session.userId,
      event: "MASTER_CREATED",
      description: `Created ${resource} record ${createdId}`,
      request,
    })

    return ok(created, 201)
  } catch (error) {
    const code = getPrismaCode(error)
    if (code === "P2002") return conflict("A record with the same unique value already exists.")
    if (code === "P2003") return badRequest("Related record does not exist.")

    console.error(`store-inventory v2 masters POST (${resource}) failed`, error)
    return internalServerError("Failed to create master record.")
  }
}
