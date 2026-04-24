import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, forbidden, internalServerError, notFound, ok, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"

type Shift = "DAY" | "NIGHT"

const CAPACITY_FIELD_MAP: Record<string, { DAY: keyof CapacityFields | null; NIGHT: keyof CapacityFields | null }> = {
  "guard": { DAY: "dayGuardCapacity", NIGHT: "nightGuardCapacity" },
  "location supervisor": { DAY: "daySupervisorCapacity", NIGHT: "nightSupervisorCapacity" },
  "supervisor": { DAY: "daySupervisorCapacity", NIGHT: "nightSupervisorCapacity" },
  "cpo": { DAY: "dayCpoCapacity", NIGHT: "nightCpoCapacity" },
  "so": { DAY: "daySoCapacity", NIGHT: "nightSoCapacity" },
  "aso": { DAY: "dayAsoCapacity", NIGHT: "nightAsoCapacity" },
  "lso": { DAY: "dayLsoCapacity", NIGHT: "nightLsoCapacity" },
  "receptionist": { DAY: "dayReceptionistCapacity", NIGHT: "nightReceptionistCapacity" },
  "cctv operator": { DAY: "dayCctvCapacity", NIGHT: "nightCctvCapacity" },
  "complaint receiver": { DAY: null, NIGHT: null },
}

type CapacityFields = {
  dayGuardCapacity: number | null
  nightGuardCapacity: number | null
  daySupervisorCapacity: number | null
  nightSupervisorCapacity: number | null
  dayCpoCapacity: number | null
  nightCpoCapacity: number | null
  daySoCapacity: number | null
  nightSoCapacity: number | null
  dayAsoCapacity: number | null
  nightAsoCapacity: number | null
  dayLsoCapacity: number | null
  nightLsoCapacity: number | null
  dayReceptionistCapacity: number | null
  nightReceptionistCapacity: number | null
  dayCctvCapacity: number | null
  nightCctvCapacity: number | null
}

function resolveField(designation: string, shift: Shift): keyof CapacityFields | null {
  const key = designation.trim().toLowerCase()
  const entry = CAPACITY_FIELD_MAP[key]
  if (!entry) return null
  return entry[shift]
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "DEPLOYMENTS", "VIEW") && !hasAction(session, "DEPLOYMENTS", "CREATE")) {
      return forbidden("Access denied.")
    }

    const { id } = await params
    const designation = (req.nextUrl.searchParams.get("designation") || "").trim()
    const shiftRaw = (req.nextUrl.searchParams.get("shift") || "").trim().toUpperCase()
    if (!designation || !shiftRaw) {
      return badRequest("designation and shift query params are required.")
    }
    if (shiftRaw !== "DAY" && shiftRaw !== "NIGHT") {
      return badRequest("shift must be DAY or NIGHT.")
    }
    const shift: Shift = shiftRaw

    const branch = await prisma.branch.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        dayGuardCapacity: true,
        nightGuardCapacity: true,
        daySupervisorCapacity: true,
        nightSupervisorCapacity: true,
        dayCpoCapacity: true,
        nightCpoCapacity: true,
        daySoCapacity: true,
        nightSoCapacity: true,
        dayAsoCapacity: true,
        nightAsoCapacity: true,
        dayLsoCapacity: true,
        nightLsoCapacity: true,
        dayReceptionistCapacity: true,
        nightReceptionistCapacity: true,
        dayCctvCapacity: true,
        nightCctvCapacity: true,
      },
    })

    if (!branch) return notFound("Branch not found.")

    const field = resolveField(designation, shift)
    const limit = field ? (branch[field] as number | null) ?? null : null

    const used = await prisma.deployment.count({
      where: {
        branchId: id,
        status: "ACTIVE",
        endDate: null,
        designation: { equals: designation, mode: "insensitive" },
        shiftType: shift,
      },
    })

    const remaining = limit == null ? null : Math.max(0, limit - used)
    const atCapacity = limit == null ? false : used >= limit

    return ok({
      branchId: branch.id,
      branchName: branch.name,
      designation,
      shift,
      limit,
      used,
      remaining,
      atCapacity,
      uncapped: limit == null,
    })
  } catch (error) {
    console.error("Branch capacity check failed:", error)
    return internalServerError("Failed to check branch capacity")
  }
}
