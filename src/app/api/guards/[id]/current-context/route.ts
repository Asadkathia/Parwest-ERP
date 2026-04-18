import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { forbidden, notFound, unauthorized } from "@/lib/api/response"
import { hasModuleAccess } from "@/lib/api/permissions"
import { getCurrentGuardContext } from "@/lib/guards/currentContext"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!hasModuleAccess(session, "GUARDS") && !hasModuleAccess(session, "PAYROLL")) {
    return forbidden("Access denied.")
  }

  const { id } = await params
  const month = new URL(request.url).searchParams.get("month") ?? undefined

  const context = await getCurrentGuardContext(id, month)
  if (!context) return notFound("Guard not found.")

  return NextResponse.json(context)
}
