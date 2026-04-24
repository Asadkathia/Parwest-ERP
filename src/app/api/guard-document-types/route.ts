import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, internalServerError, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"

// System-generated document placeholders (always present for every guard)
const SYSTEM_GENERATED_TYPES = [
  "Form A (Without Sign)",
  "Form B (Without Sign and Thumb Impressions)",
  "Employee Card",
  "Personal Verification Guard Guarantors",
  "Training Certificate",
  "Character Certificate",
  "Guard Documents Checklist",
  "Medical Certificate",
  "Guard Antecedents Verification",
  "Iqrar Nama",
]

// Admin-configured attachment documents (defaults)
const DEFAULT_ATTACHMENT_TYPES = [
  "NADRA Verification",
  "Health Certificate Verification",
  "Police Verification",
  "Eyesight Certificate",
  "Character Verification",
  "Mental Health Check",
  "3rd Guarantor Verification",
  "Company Card & CNIC",
]

// System verification types (always seeded, VERIFICATION category)
const SYSTEM_VERIFICATION_TYPES = ["Mental Health Verification Form"]

async function ensureSystemVerificationDocs() {
  for (const name of SYSTEM_VERIFICATION_TYPES) {
    await prisma.guardDocumentType.upsert({
      where: { name },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: { name, sortOrder: 50, docCategory: "VERIFICATION", isSystemGenerated: false } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update: { docCategory: "VERIFICATION" } as any,
    })
  }
}

async function ensureSystemGeneratedDocs() {
  const existing = await prisma.guardDocumentType.findMany({
    where: { isSystemGenerated: true },
    select: { name: true },
  })
  const existingNames = new Set(existing.map((t) => t.name))
  const missing = SYSTEM_GENERATED_TYPES.filter((name) => !existingNames.has(name))
  if (missing.length > 0) {
    const maxOrder = await prisma.guardDocumentType.aggregate({ _max: { sortOrder: true } })
    let baseOrder = (maxOrder._max.sortOrder ?? -1) + 1
    for (const name of missing) {
      await prisma.guardDocumentType.upsert({
        where: { name },
        create: { name, sortOrder: baseOrder++, docCategory: "ATTACHMENT", isSystemGenerated: true },
        update: { isSystemGenerated: true, docCategory: "ATTACHMENT" },
      })
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "GUARDS", "VIEW")) return Response.json({ success: false, message: "Forbidden", code: "FORBIDDEN" }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get("activeOnly") !== "false"
    const category = searchParams.get("category") // VERIFICATION | ATTACHMENT | null (all)

    const where: Record<string, unknown> = {}
    if (activeOnly) where.isActive = true
    if (category) where.docCategory = category

    let types = await prisma.guardDocumentType.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    })

    // Seed attachment defaults if table has no non-system records
    const nonSystemTypes = types.filter((t) => !(t as Record<string, unknown>).isSystemGenerated)
    if (nonSystemTypes.length === 0 && !category) {
      let baseOrder = 100
      for (const name of DEFAULT_ATTACHMENT_TYPES) {
        await prisma.guardDocumentType.upsert({
          where: { name },
          create: { name, sortOrder: baseOrder++, docCategory: "ATTACHMENT", isSystemGenerated: false },
          update: {},
        })
      }
      types = await prisma.guardDocumentType.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      })
    } else {
      // One-time migration: convert old VERIFICATION defaults to ATTACHMENT
      const needsMigration = types.filter(
        (t) =>
          (t as Record<string, unknown>).docCategory === "VERIFICATION" &&
          !(t as Record<string, unknown>).isSystemGenerated &&
          DEFAULT_ATTACHMENT_TYPES.includes(t.name)
      )
      if (needsMigration.length > 0) {
        await prisma.guardDocumentType.updateMany({
          where: { id: { in: needsMigration.map((t) => t.id) } },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: { docCategory: "ATTACHMENT" } as any,
        })
        types = await prisma.guardDocumentType.findMany({
          where,
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        })
      }
    }

    // Ensure system-generated docs and verification types always exist
    await ensureSystemGeneratedDocs()
    await ensureSystemVerificationDocs()
    // Re-fetch if we didn't filter by category (to include newly added system docs)
    if (!category) {
      types = await prisma.guardDocumentType.findMany({
        where,
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
    if (!hasAction(session, "GUARDS", "CREATE")) return Response.json({ success: false, message: "Forbidden", code: "FORBIDDEN" }, { status: 403 })

    const body = await request.json()
    const name = String(body.name || "").trim()
    if (!name) return badRequest("Name is required")

    const docCategory = ["VERIFICATION", "ATTACHMENT"].includes(body.docCategory)
      ? String(body.docCategory)
      : "ATTACHMENT"

    const existing = await prisma.guardDocumentType.findUnique({ where: { name } })
    if (existing) return badRequest("A document type with this name already exists")

    const maxOrder = await prisma.guardDocumentType.aggregate({ _max: { sortOrder: true } })
    const newOrder = (maxOrder._max.sortOrder ?? 0) + 1

    const docType = await prisma.guardDocumentType.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { name, isActive: true, sortOrder: newOrder, docCategory } as any,
    })

    return NextResponse.json(docType, { status: 201 })
  } catch (error) {
    console.error("POST /api/guard-document-types:", error)
    return internalServerError("Failed to create document type")
  }
}
