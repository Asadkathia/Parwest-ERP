import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { forbidden, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { getCurrentGuardContext } from "@/lib/guards/currentContext"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!hasAction(session, "GUARDS", "VIEW") && !hasAction(session, "PAYROLL", "VIEW")) {
    return forbidden("Access denied.")
  }

  const { id } = await params
  const month = new URL(request.url).searchParams.get("month") ?? undefined

  const context = await getCurrentGuardContext(id, month)
  if (!context) return notFound("Guard not found.")

  // Success path returns the raw GuardCurrentContext object (not the standard
  // envelope) — this is the established contract every payroll consumer reads
  // via `(await res.json()) as GuardCurrentContext`. The payload now also
  // exposes canonical `lifecycleStatus` + derived `isDeployed` additively,
  // alongside the retained legacy `status` shadow. Error responses use the
  // shared envelope helpers above.
  return NextResponse.json(context)
}
