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
        // Same params the Assigned Guards tab reads.
        const guardStatus = (searchParams.get("guardStatus")?.trim() || "All").toLowerCase()
        const search = searchParams.get("search")?.trim().toLowerCase() || ""
        const selectDate = searchParams.get("selectDate")?.trim() || ""

        // Build the full predicate in SQL so `take` caps the FINAL filtered set,
        // not a pre-filter superset (W1). Mirrors the Assigned Guards tab exactly:
        //   • Status: Active → ACTIVE, Previous → not ACTIVE, All → no filter.
        //   • selectDate: exact day match on deploymentDate ([day, nextDay) range).
        //   • search: OR of contains (case-insensitive) on guard.name, guard.parwestId,
        //     branch.name.
        const where: Record<string, unknown> = { clientId }
        if (guardStatus === "active") where.status = "ACTIVE"
        else if (guardStatus === "previous") where.status = { not: "ACTIVE" }

        if (selectDate) {
            const day = new Date(`${selectDate}T00:00:00.000Z`)
            const nextDay = new Date(day.getTime() + 24 * 60 * 60 * 1000)
            where.deploymentDate = { gte: day, lt: nextDay }
        }

        if (search) {
            where.OR = [
                { guard: { name: { contains: search, mode: "insensitive" } } },
                { guard: { parwestId: { contains: search, mode: "insensitive" } } },
                { branch: { name: { contains: search, mode: "insensitive" } } },
            ]
        }

        const filtered = await prisma.deployment.findMany({
            where,
            orderBy: { deploymentDate: "desc" },
            take: 5000,
            select: {
                designation: true,
                shiftType: true,
                deploymentDate: true,
                endDate: true,
                status: true,
                guard: { select: { parwestId: true, name: true, phone: true } },
                branch: { select: { name: true, code: true } },
            },
        })

        const headers = [
            "Guard ID", "Guard Name", "Branch", "Branch Code", "Designation",
            "Shift", "Contact", "Deployed On", "End Date", "Status",
        ]
        const csvRows = [headers.map(csvEscape).join(",")]
        for (const d of filtered) {
            const cells = [
                d.guard?.parwestId || "",
                d.guard?.name || "",
                d.branch?.name || "",
                d.branch?.code || "",
                d.designation || "",
                normalizeShift(d.shiftType),
                d.guard?.phone || "",
                formatDate(d.deploymentDate),
                formatDate(d.endDate),
                d.status,
            ]
            csvRows.push(cells.map(csvEscape).join(","))
        }

        const csv = csvRows.join("\n")
        const responseHeaders: Record<string, string> = {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="client-${clientId}-assigned-guards-${new Date().toISOString().slice(0, 10)}.csv"`,
        }
        // If the filtered set hit the safety cap, the export may be truncated.
        if (filtered.length === 5000) responseHeaders["X-Export-Truncated"] = "true"
        return new NextResponse(csv, { status: 200, headers: responseHeaders })
    } catch (error) {
        console.error("Error exporting assigned guards:", error)
        return internalServerError("Failed to export assigned guards.")
    }
}
