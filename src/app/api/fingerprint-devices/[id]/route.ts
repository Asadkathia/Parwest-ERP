import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { badRequest, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { updateFingerprintDevices, type FingerprintDeviceStatus } from "@/lib/fingerprint/store"
import { hasModuleAccess } from "@/lib/api/permissions"

const VALID_STATUS: FingerprintDeviceStatus[] = ["ONLINE", "OFFLINE", "WARNING"]

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasModuleAccess(session, "GUARDS")) return Response.json({ success: false, message: "Forbidden", code: "FORBIDDEN" }, { status: 403 })

    const { id } = await params
    const body = await request.json()

    const name = body?.name !== undefined ? String(body.name || "").trim() : undefined
    const statusInput = body?.status !== undefined ? String(body.status || "").trim().toUpperCase() : undefined

    if (name !== undefined && !name) {
      return badRequest("name cannot be empty.")
    }
    if (statusInput !== undefined && !VALID_STATUS.includes(statusInput as FingerprintDeviceStatus)) {
      return badRequest("status must be ONLINE, OFFLINE, or WARNING.")
    }

    let found = false
    const rows = await updateFingerprintDevices((current) =>
      current.map((row) => {
        if (row.id !== id) return row
        found = true
        return {
          ...row,
          name: name ?? row.name,
          status: (statusInput as FingerprintDeviceStatus | undefined) ?? row.status,
          updatedAt: new Date().toISOString(),
        }
      })
    )

    if (!found) return notFound("Fingerprint device not found.")
    const updated = rows.find((row) => row.id === id)
    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating fingerprint device:", error)
    return internalServerError("Failed to update fingerprint device")
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasModuleAccess(session, "GUARDS")) return Response.json({ success: false, message: "Forbidden", code: "FORBIDDEN" }, { status: 403 })

    const { id } = await params
    let removed = false

    await updateFingerprintDevices((current) => {
      const next = current.filter((row) => row.id !== id)
      removed = next.length !== current.length
      return next
    })

    if (!removed) return notFound("Fingerprint device not found.")
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting fingerprint device:", error)
    return internalServerError("Failed to delete fingerprint device")
  }
}
