import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { updateFingerprintDevices } from "@/lib/fingerprint/store"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const { id } = await params
    const now = new Date().toISOString()
    let found = false

    const rows = await updateFingerprintDevices((current) =>
      current.map((row) => {
        if (row.id !== id) return row
        found = true
        return {
          ...row,
          status: "ONLINE",
          lastSyncAt: now,
          updatedAt: now,
        }
      })
    )

    if (!found) return notFound("Fingerprint device not found.")
    const updated = rows.find((row) => row.id === id)
    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error testing fingerprint device:", error)
    return internalServerError("Failed to test fingerprint device")
  }
}
