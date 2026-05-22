import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { CNIC_REGEX } from "@/lib/validation/formats"
import { ok, badRequest, unauthorized } from "@/lib/api/response"

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

  // Existence check is intentionally unscoped: a CNIC enrolled in another
  // region must still surface here. We inspect the MOST RECENT profile for the
  // CNIC (Guard.cnic is no longer @unique — a DB partial-unique index allows
  // multiple rows per CNIC as long as at most one is non-terminated, so the
  // most-recent row determines availability).
  const [guard, blacklisted] = await Promise.all([
    prisma.guard.findFirst({
      where: {
        cnic,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, lifecycleStatus: true },
    }),
    prisma.blacklistedCnic.findUnique({ where: { cnic } }),
  ])

  // New-profile model: a non-terminated most-recent profile BLOCKS. If the most
  // recent profile is TERMINATED (resigned/terminated) — or no profile exists —
  // the CNIC is available for a brand-new profile (reEnrollable). `exists`
  // remains true whenever any profile is found so existing callers keep
  // working; new callers branch on `reEnrollable` to allow the submit.
  const isTerminated = guard?.lifecycleStatus === "TERMINATED"
  const blocked = Boolean(guard) && !isTerminated && !blacklisted
  const reEnrollable = !blacklisted && (!guard || isTerminated)

  return ok({
    exists: Boolean(guard),
    blacklisted: Boolean(blacklisted),
    status: guard?.lifecycleStatus ?? null,
    reEnrollable,
    message: blacklisted
      ? "This CNIC is blacklisted and cannot be enrolled"
      : blocked
        ? "This guard is already enrolled and active. You cannot enroll the same CNIC again unless the previous profile is marked as Resigned or Terminated."
        : guard
          ? "This CNIC belongs to a terminated guard and is available for a new profile"
          : undefined,
  })
}
