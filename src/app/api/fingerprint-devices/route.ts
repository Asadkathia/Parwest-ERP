import { randomUUID } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { badRequest, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"
import { readFingerprintDevices, updateFingerprintDevices, type FingerprintDeviceStatus } from "@/lib/fingerprint/store"
import { hasModuleAccess } from "@/lib/api/permissions"

const VALID_STATUS: FingerprintDeviceStatus[] = ["ONLINE", "OFFLINE", "WARNING"]
const MOCK_OFFICE_NAMES: Record<string, string> = {
  "mock-office-lhr": "Lahore Head Office",
  "mock-office-khi": "Karachi Office",
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasModuleAccess(session, "GUARDS")) return Response.json({ success: false, message: "Forbidden", code: "FORBIDDEN" }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const officeId = searchParams.get("officeId")?.trim() || undefined
    const status = searchParams.get("status")?.trim().toUpperCase() || undefined

    if (status && !VALID_STATUS.includes(status as FingerprintDeviceStatus)) {
      return badRequest("status must be ONLINE, OFFLINE, or WARNING.")
    }

    const rows = await readFingerprintDevices()
    const filtered = rows.filter((row) => {
      if (officeId && row.officeId !== officeId) return false
      if (status && row.status !== status) return false
      return true
    })

    return NextResponse.json(filtered)
  } catch (error) {
    console.error("Error listing fingerprint devices:", error)
    return internalServerError("Failed to fetch fingerprint devices")
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasModuleAccess(session, "GUARDS")) return Response.json({ success: false, message: "Forbidden", code: "FORBIDDEN" }, { status: 403 })

    const body = await request.json()
    const name = String(body?.name || "").trim()
    const officeId = String(body?.officeId || "").trim()
    const statusInput = String(body?.status || "OFFLINE").trim().toUpperCase()

    if (!name || !officeId) {
      return badRequest("name and officeId are required.")
    }
    if (!VALID_STATUS.includes(statusInput as FingerprintDeviceStatus)) {
      return badRequest("status must be ONLINE, OFFLINE, or WARNING.")
    }

    const office = isRuntimeMockEnabled()
      ? (() => {
          const officeName = MOCK_OFFICE_NAMES[officeId]
          return officeName ? { id: officeId, name: officeName } : null
        })()
      : await prisma.regionalOffice.findUnique({
          where: { id: officeId },
          select: { id: true, name: true },
        })
    if (!office) {
      return notFound("Regional office not found.")
    }

    const now = new Date().toISOString()
    const newDevice = {
      id: randomUUID(),
      name,
      officeId: office.id,
      officeName: office.name,
      status: statusInput as FingerprintDeviceStatus,
      lastSyncAt: now,
      pendingEnrollments: 0,
      createdAt: now,
      updatedAt: now,
    }

    const rows = await updateFingerprintDevices((current) => {
      if (current.some((row) => row.name.toLowerCase() === name.toLowerCase())) {
        throw new Error("DUPLICATE_NAME")
      }
      return [newDevice, ...current]
    })

    const created = rows.find((row) => row.id === newDevice.id)
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === "DUPLICATE_NAME") {
      return badRequest("Device name must be unique.")
    }
    console.error("Error creating fingerprint device:", error)
    return internalServerError("Failed to create fingerprint device")
  }
}
