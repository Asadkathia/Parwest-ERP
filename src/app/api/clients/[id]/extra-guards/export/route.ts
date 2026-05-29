import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { checkClientScope } from "@/lib/clients/access"
import { csvEscape } from "@/lib/csv"

function formatDate(date: Date | null | undefined): string {
    if (!date) return ""
    return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

function normalizeShift(shift: string | null | undefined): string {
    const value = (shift || "").toUpperCase()
    if (value === "DAY" || value === "NIGHT" || value === "BOTH") return value
    return "—"
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) return unauthorized()
        if (!hasAction(session, "CLIENTS", "VIEW")) return forbidden("Access denied.")
        const { id: clientId } = await params

        const scope = await checkClientScope(clientId, session)
        if (scope === "not_found") return notFound("Client not found.")
        if (scope === "forbidden") return forbidden("Access denied.")

        const { searchParams } = new URL(request.url)
        // Same params the Extra Guards tab reads.
        const branch = searchParams.get("branch")?.trim().toLowerCase() || ""
        const search = searchParams.get("search")?.trim().toLowerCase() || ""
        const startDate = searchParams.get("startDate")?.trim() || ""
        const endDate = searchParams.get("endDate")?.trim() || ""
        const selectDate = searchParams.get("selectDate")?.trim() || ""

        // Row SOURCE must match the Extra Guards tab exactly. The tab builds its
        // rows from the client's BRANCHES' deployments (client.branches.flatMap →
        // branch.deployments), so the export is scoped via `branch: { clientId }`.
        // Branchless-client extras (deployments with no branch) are INTENTIONALLY
        // excluded here to mirror the tab, which only renders branch-linked rows.
        //
        // Extra guards = ACTIVE deployments where deploymentType="EXTRA" OR
        // isExtraGuard=true. All filter predicates are pushed into the SQL `where`
        // so `take` caps the FINAL filtered set, not a pre-filter superset (W1).
        const where: Record<string, unknown> = {
            branch: { clientId },
            status: "ACTIVE",
            AND: [{ OR: [{ deploymentType: "EXTRA" }, { isExtraGuard: true }] }],
        }
        const and = where.AND as Array<Record<string, unknown>>

        // Search matches guard name OR branch name (mirrors the tab).
        if (search) {
            and.push({
                OR: [
                    { guard: { name: { contains: search, mode: "insensitive" } } },
                    { branch: { name: { contains: search, mode: "insensitive" } } },
                ],
            })
        }
        // Branch* filter is a case-insensitive substring match on branch name.
        if (branch) {
            and.push({ branch: { name: { contains: branch, mode: "insensitive" } } })
        }

        // Inclusive date-range on deploymentDate (startDate ≤ date ≤ endDate, each
        // bound optional). MUST match the tab's range semantics exactly (C2).
        const dateFilter: Record<string, Date> = {}
        if (startDate) dateFilter.gte = new Date(`${startDate}T00:00:00.000Z`)
        if (endDate) dateFilter.lte = new Date(`${endDate}T23:59:59.999Z`)
        if (Object.keys(dateFilter).length > 0) where.deploymentDate = dateFilter
        if (selectDate) {
            const day = new Date(`${selectDate}T00:00:00.000Z`)
            const nextDay = new Date(day.getTime() + 24 * 60 * 60 * 1000)
            where.deploymentDate = { gte: day, lt: nextDay }
        }

        const filtered = await prisma.deployment.findMany({
            where,
            orderBy: { deploymentDate: "desc" },
            take: 5000,
            select: {
                designation: true,
                shiftType: true,
                deploymentDate: true,
                guard: { select: { parwestId: true, name: true } },
                branch: { select: { name: true } },
            },
        })

        const headers = ["Guard ID", "Guard Name", "Branch", "Shift", "Designation", "Deployment Date"]
        const csvRows = [headers.map(csvEscape).join(",")]
        for (const d of filtered) {
            const cells = [
                d.guard?.parwestId || "",
                d.guard?.name || "",
                d.branch?.name || "",
                normalizeShift(d.shiftType),
                d.designation || "",
                formatDate(d.deploymentDate),
            ]
            csvRows.push(cells.map(csvEscape).join(","))
        }

        const csv = csvRows.join("\n")
        const responseHeaders: Record<string, string> = {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="client-${clientId}-extra-guards-${new Date().toISOString().slice(0, 10)}.csv"`,
        }
        // If the filtered set hit the safety cap, the export may be truncated.
        if (filtered.length === 5000) responseHeaders["X-Export-Truncated"] = "true"
        return new NextResponse(csv, { status: 200, headers: responseHeaders })
    } catch (error) {
        console.error("Error exporting extra guards:", error)
        return internalServerError("Failed to export extra guards.")
    }
}
