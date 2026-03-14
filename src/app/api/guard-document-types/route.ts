import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, internalServerError, unauthorized } from "@/lib/api/response"

const DEFAULT_DOC_TYPES = [
  "NADRA Verification",
  "Health Certificate Verification",
  "Police Verification",
  "Eyesight Certificate",
  "Character Verification",
  "Mental Health Check",
  "3rd Guarantor Verification",
  "Company Card & CNIC",
]

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get("activeOnly") !== "false"

    let types = await prisma.guardDocumentType.findMany({
      where: activeOnly ? { isActive: true } : {},
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    })

    // Seed defaults if table is empty
    if (types.length === 0) {
      await prisma.guardDocumentType.createMany({
        data: DEFAULT_DOC_TYPES.map((name, idx) => ({ name, sortOrder: idx })),
        skipDuplicates: true,
      })
      types = await prisma.guardDocumentType.findMany({
        where: activeOnly ? { isActive: true } : {},
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      })
    }

    return NextResponse.json(types)
  } catch (error) {
    console.error("GET /api/guard-document-types:", error)
    return internalServerError("Failed to fetch document types")
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const body = await request.json()
    const name = String(body.name || "").trim()
    if (!name) return badRequest("Name is required")

    const existing = await prisma.guardDocumentType.findUnique({ where: { name } })
    if (existing) return badRequest("A document type with this name already exists")

    const maxOrder = await prisma.guardDocumentType.aggregate({ _max: { sortOrder: true } })
    const newOrder = (maxOrder._max.sortOrder ?? 0) + 1

    const docType = await prisma.guardDocumentType.create({
      data: { name, isActive: true, sortOrder: newOrder },
    })

    return NextResponse.json(docType, { status: 201 })
  } catch (error) {
    console.error("POST /api/guard-document-types:", error)
    return internalServerError("Failed to create document type")
  }
}
