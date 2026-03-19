import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, internalServerError, notFound, unauthorized } from "@/lib/api/response"

// GET /api/guards/[id]/prerequisites
// Returns all doc types with the guard's prerequisite record (if any) merged in
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const { id: guardId } = await params

    const guard = await prisma.guard.findUnique({ where: { id: guardId }, select: { id: true } })
    if (!guard) return notFound("Guard not found")

    const [docTypes, prereqs] = await Promise.all([
      prisma.guardDocumentType.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.guardPrerequisite.findMany({ where: { guardId } }),
    ])

    const prereqMap = new Map(prereqs.map((p) => [p.docTypeName, p]))

    const result = docTypes.map((dt) => {
      const prereq = prereqMap.get(dt.name)
      return {
        docTypeId: dt.id,
        docTypeName: dt.name,
        isActive: dt.isActive,
        docCategory: (dt as Record<string, unknown>).docCategory ?? "VERIFICATION",
        isSystemGenerated: (dt as Record<string, unknown>).isSystemGenerated ?? false,
        prereqId: prereq?.id ?? null,
        status: prereq?.status ?? "PENDING",
        verificationStatus: prereq?.verificationStatus ?? null,
        attachmentData: prereq?.attachmentData ?? null,
        attachmentName: prereq?.attachmentName ?? null,
        documentUrl: prereq?.documentUrl ?? null,
        verifiedAt: prereq?.verifiedAt?.toISOString() ?? null,
        verifiedBy: prereq?.verifiedBy ?? null,
        expiryDate: prereq?.expiryDate?.toISOString() ?? null,
        comments: prereq?.comments ?? null,
        notes: prereq?.notes ?? null,
        updatedAt: prereq?.updatedAt?.toISOString() ?? null,
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("GET /api/guards/[id]/prerequisites:", error)
    return internalServerError("Failed to fetch prerequisites")
  }
}

// POST /api/guards/[id]/prerequisites
// Upload a document (attachment) for a specific doc type
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const { id: guardId } = await params
    const body = await request.json()

    const docTypeName = String(body.docTypeName || "").trim()
    if (!docTypeName) return badRequest("docTypeName is required")

    const guard = await prisma.guard.findUnique({ where: { id: guardId }, select: { id: true } })
    if (!guard) return notFound("Guard not found")

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessionUser = (session as any)?.user as { name?: string; email?: string } | undefined
    const uploaderName = sessionUser?.name ?? sessionUser?.email ?? null

    // If a previous record with a file exists, archive it to history before replacing
    const existing = await prisma.guardPrerequisite.findUnique({
      where: { guardId_docTypeName: { guardId, docTypeName } },
      select: { id: true, attachmentData: true, attachmentName: true, documentUrl: true, verifiedBy: true, updatedAt: true },
    })

    if (existing && (existing.attachmentData || existing.documentUrl)) {
      await (prisma.guardPrerequisiteHistory as unknown as {
        create: (args: { data: Record<string, unknown> }) => Promise<unknown>
      }).create({
        data: {
          prereqId: existing.id,
          attachmentData: existing.attachmentData,
          attachmentName: existing.attachmentName,
          documentUrl: existing.documentUrl,
          uploadedBy: existing.verifiedBy,
          uploadedAt: existing.updatedAt,
        },
      })
    }

    // Upsert: create or update the prerequisite record for this doc type
    const prereq = await prisma.guardPrerequisite.upsert({
      where: { guardId_docTypeName: { guardId, docTypeName } },
      create: {
        guardId,
        docTypeName,
        status: "PENDING",
        attachmentData: body.attachmentData ?? null,
        attachmentName: body.attachmentName ?? null,
        documentUrl: body.documentUrl ?? null,
        notes: body.notes ?? null,
        verifiedBy: uploaderName, // used as uploadedBy for attachments
      },
      update: {
        attachmentData: body.attachmentData ?? undefined,
        attachmentName: body.attachmentName ?? undefined,
        documentUrl: body.documentUrl ?? undefined,
        notes: body.notes ?? undefined,
        verifiedBy: uploaderName,
        // Reset verification when doc is re-uploaded
        status: "PENDING",
        verificationStatus: null,
        verifiedAt: null,
      },
    })

    return NextResponse.json(prereq, { status: 201 })
  } catch (error) {
    console.error("POST /api/guards/[id]/prerequisites:", error)
    return internalServerError("Failed to upload document")
  }
}
