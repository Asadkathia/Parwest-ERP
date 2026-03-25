import { NextRequest } from "next/server"
import { getPrismaCode } from "@/lib/prisma-errors"
import { badRequest, conflict, internalServerError, notFound, ok } from "@/lib/api/response"
import { emitInventoryV2Audit, requireInventorySession, requireV2WriteEnabled } from "@/lib/inventory/store-v2-api"
import { getMasterConfig, isValidMasterResource } from "@/lib/inventory/store-v2-masters"
import { prisma } from "@/lib/db"

const REGION_PREFIX_MAP: Record<string, string> = {
  lahore: "LHR",
  karachi: "KHI",
  islamabad: "ISB",
  peshawar: "PEW",
  quetta: "UET",
  multan: "MUX",
  faisalabad: "LYP",
  gujranwala: "GJW",
  sialkot: "SKT",
  sahiwal: "SWL",
  rawalpindi: "RWP",
}

function parseResource(request: NextRequest): string {
  const pathname = new URL(request.url).pathname
  const parts = pathname.split("/").filter(Boolean)
  return parts[parts.length - 1] ?? ""
}

function normalizeStoreType(value: unknown): "STORE" | "WAREHOUSE" {
  return String(value ?? "").trim().toUpperCase() === "WAREHOUSE" ? "WAREHOUSE" : "STORE"
}

function deriveRegionPrefix(name: string | null | undefined): string {
  const raw = String(name ?? "").trim()
  if (!raw) return "GEN"

  const mapped = REGION_PREFIX_MAP[raw.toLowerCase()]
  if (mapped) return mapped

  const normalized = raw.replace(/[^A-Za-z]/g, "").toUpperCase()
  if (normalized.length >= 3) return normalized.slice(0, 3)
  if (normalized.length > 0) return normalized.padEnd(3, "X")
  return "GEN"
}

async function buildRegionBasedStoreCode(body: Record<string, unknown>): Promise<string> {
  const type = normalizeStoreType(body.type)
  const typePrefix = type === "WAREHOUSE" ? "WH" : "ST"
  const regionalOfficeId = String(body.regionalOfficeId ?? "").trim()

  let regionPrefix = "GEN"
  if (regionalOfficeId) {
    const office = await prisma.regionalOffice.findUnique({
      where: { id: regionalOfficeId },
      select: {
        name: true,
        seriesCode: true,
        region: { select: { name: true } },
      },
    })

    if (office?.region?.name) {
      regionPrefix = deriveRegionPrefix(office.region.name)
    } else if (office?.name) {
      regionPrefix = deriveRegionPrefix(office.name)
    } else if (office?.seriesCode) {
      regionPrefix = deriveRegionPrefix(office.seriesCode)
    }
  }

  const stamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${regionPrefix}-${typePrefix}-${stamp}-${random}`
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
        })
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
    const payloadBody: Record<string, unknown> = { ...body }
    if (resource === "stores" && !String(payloadBody.code ?? "").trim()) {
      payloadBody.code = await buildRegionBasedStoreCode(payloadBody)
    }

    const config = getMasterConfig(resource)
    const data = config.buildCreateData(payloadBody)

    if (
      ("name" in data && typeof data.name === "string" && data.name.length === 0) ||
      (resource === "stores" &&
        (!("type" in data) || (data.type !== "STORE" && data.type !== "WAREHOUSE"))) ||
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
