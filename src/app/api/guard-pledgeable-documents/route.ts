import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import {
  badRequest,
  conflict,
  forbidden,
  internalServerError,
  ok,
  serviceUnavailable,
  unauthorized,
} from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"

const MOCK_ROWS = [
  {
    id: "mock-doc-1",
    name: "CNIC",
    description: "National ID document",
    createdAt: "2026-02-24T00:00:00.000Z",
  },
  {
    id: "mock-doc-2",
    name: "Matric Certificate",
    description: "Academic certificate",
    createdAt: "2026-02-24T00:00:00.000Z",
  },
]

export async function GET() {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (isRuntimeMockEnabled()) return ok(MOCK_ROWS)

    const rows = await prisma.guardPledgeableDocument.findMany({
      orderBy: { name: "asc" },
    })
    return ok(rows)
  } catch (error) {
    if (isPrismaMissingSchemaError(error)) return serviceUnavailable("Schema not migrated for guard pledgeable documents yet.")
    console.error("Error fetching guard pledgeable documents:", error)
    return internalServerError("Failed to fetch documents.")
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "SETTINGS", "CREATE")) return forbidden()
    const body = await request.json()
    const name = String(body?.name || "").trim()
    const description = body?.description ? String(body.description) : null
    if (!name) return badRequest("Name is required.")

    if (isRuntimeMockEnabled()) {
      return ok(
        { id: `mock-doc-${Date.now()}`, name, description, createdAt: new Date().toISOString() },
        201
      )
    }

    const created = await prisma.guardPledgeableDocument.create({
      data: { name, description },
    })
    return ok(created, 201)
  } catch (error: unknown) {
    if (isPrismaMissingSchemaError(error)) return serviceUnavailable("Schema not migrated for guard pledgeable documents yet.")
    if (String((error as { code?: string }).code) === "P2002") return conflict("Document type already exists.")
    console.error("Error creating guard pledgeable document:", error)
    return internalServerError("Failed to create document type.")
  }
}
