import { forbidden, ok, unauthorized } from "@/lib/api/response"
import { auth } from "@/lib/auth"
import { hasAction } from "@/lib/api/permissions"
import { prisma } from "@/lib/db"

/**
 * GET /api/imports/jobs?module=&subModule=&status=&take=50
 *
 * Lists recent BulkImportJob rows. Default scope: jobs created by the
 * current user. Super Admins see every user's jobs. Filters:
 *   - module / subModule — exact match
 *   - status — comma-separated list
 *   - take (1..200) — page size
 */
export async function GET(request: Request) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!hasAction(session, "IMPORTS", "VIEW")) return forbidden()

  const url = new URL(request.url)
  const moduleFilter = url.searchParams.get("module") || undefined
  const subModuleFilter = url.searchParams.get("subModule") || undefined
  const statusFilter = url.searchParams.get("status") || undefined
  const takeRaw = parseInt(url.searchParams.get("take") || "50", 10)
  const take = Math.min(Math.max(Number.isFinite(takeRaw) ? takeRaw : 50, 1), 200)

  // Super Admin sees every job; everyone else only their own.
  const role = (session.user as { role?: string } | undefined)?.role
  const isSuperAdmin = role === "Super User" || (role === "Admin" && (session.user as { permissions?: string[] }).permissions?.length === 0)

  const jobs = await prisma.bulkImportJob.findMany({
    where: {
      ...(isSuperAdmin ? {} : { createdById: session.user?.id }),
      ...(moduleFilter ? { module: moduleFilter } : {}),
      ...(subModuleFilter ? { subModule: subModuleFilter } : {}),
      ...(statusFilter
        ? {
            status: {
              in: statusFilter.split(",").map((s) => s.trim()).filter(Boolean) as never,
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      module: true,
      subModule: true,
      status: true,
      totalRows: true,
      successRows: true,
      failedRows: true,
      fileName: true,
      createdAt: true,
      finishedAt: true,
      createdBy: { select: { id: true, name: true, email: true } },
    },
  })

  return ok(jobs)
}
