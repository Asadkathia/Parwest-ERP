import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { badRequest, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { updateFingerprintDevices } from "@/lib/fingerprint/store"
import { hasAction } from "@/lib/api/permissions"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "GUARDS", "CREATE")) return Response.json({ success: false, message: "Forbidden", code: "FORBIDDEN" }, { status: 403 })

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const incrementRaw = body?.count ?? 1
    const increment = Number(incrementRaw)

    if (!Number.isFinite(increment) || increment <= 0) {
      return badRequest("count must be a positive number.")
    }

    let found = false
    const rows = await updateFingerprintDevices((current) =>
      current.map((row) => {
        if (row.id !== id) return row
        found = true
        return {
          ...row,
          pendingEnrollments: row.pendingEnrollments + Math.floor(increment),
          updatedAt: new Date().toISOString(),
        }
      })
    )

    if (!found) return notFound("Fingerprint device not found.")
    const updated = rows.find((row) => row.id === id)
    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error queueing fingerprint enrollment:", error)
    return internalServerError("Failed to queue enrollment")
  }
}
