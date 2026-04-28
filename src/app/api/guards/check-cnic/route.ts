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

  // Existence-only check is intentionally unscoped: a CNIC enrolled in
  // another region must still block creation here, otherwise the unique
  // constraint on Guard.cnic surfaces as a 500 mid-form.
  const [guard, blacklisted] = await Promise.all([
    prisma.guard.findFirst({
      where: {
        cnic,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    }),
    prisma.blacklistedCnic.findUnique({ where: { cnic } }),
  ])

  return ok({
    exists: Boolean(guard),
    blacklisted: Boolean(blacklisted),
    message: blacklisted
      ? "This CNIC is blacklisted and cannot be enrolled"
      : guard
        ? "A guard with this CNIC already exists"
        : undefined,
  })
}
