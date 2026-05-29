import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { CNIC_REGEX } from "@/lib/validation/formats"
import { ok, badRequest, unauthorized } from "@/lib/api/response"
import { cnicAvailability, CNIC_ACTIVE_PROFILE_MESSAGE } from "@/lib/guards/cnic"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) {
    return unauthorized()
  }

  const cnic = (req.nextUrl.searchParams.get("cnic") || "").trim()
  const excludeId = req.nextUrl.searchParams.get("excludeId") || undefined
  if (!cnic) return badRequest("cnic query param is required.")
  if (!CNIC_REGEX.test(cnic)) {
    return badRequest("CNIC format must be XXXXX-XXXXXXX-X.")
  }

  // Availability check is intentionally unscoped (a CNIC enrolled in another
  // region must still surface here) and shares the terminated-profile
  // re-enrollment model with POST /api/guards and PUT /api/guards/[id] via
  // cnicAvailability — the partial-unique / most-recent-profile rule lives in
  // one place.
  const [availability, blacklisted] = await Promise.all([
    cnicAvailability(prisma, cnic, { excludeGuardId: excludeId ?? null }),
    prisma.blacklistedCnic.findUnique({ where: { cnic } }),
  ])

  // New-profile model: a non-terminated most-recent profile BLOCKS. If the most
  // recent profile is TERMINATED (resigned/terminated) — or no profile exists —
  // the CNIC is available for a brand-new profile (reEnrollable). `exists`
  // remains true whenever any profile is found so existing callers keep
  // working; new callers branch on `reEnrollable` to allow the submit.
  const isTerminated = availability.status === "TERMINATED"
  const blocked = availability.blockedByActiveProfile && !blacklisted
  const reEnrollable = !blacklisted && availability.available

  return ok({
    exists: availability.exists,
    blacklisted: Boolean(blacklisted),
    status: availability.status,
    reEnrollable,
    message: blacklisted
      ? "This CNIC is blacklisted and cannot be enrolled"
      : blocked
        ? CNIC_ACTIVE_PROFILE_MESSAGE
        : isTerminated
          ? "This CNIC belongs to a terminated guard and is available for a new profile"
          : undefined,
  })
}
