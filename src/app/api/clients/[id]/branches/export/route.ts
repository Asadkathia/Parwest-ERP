import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { checkClientScope } from "@/lib/clients/access"
import { csvEscape } from "@/lib/csv"

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
        // Same params the Branches tab reads.
        const search = searchParams.get("search")?.trim().toLowerCase() || ""
        const selectDate = searchParams.get("selectDate")?.trim() || ""
        // Optional status filter (tab has no control yet, but honored if passed).
        const status = searchParams.get("status")?.trim().toUpperCase() || ""

        // Push search/status/selectDate into the SQL `where` so `take` caps the
        // FINAL filtered set, not a pre-filter superset (W1). Mirrors the Branches
        // tab: search is a contains-OR on name/city/address/contactPerson;
        // selectDate is an exact day match on updatedAt.
        const where: Record<string, unknown> = { clientId }
        if (status === "ACTIVE" || status === "INACTIVE") where.status = status

        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { city: { contains: search, mode: "insensitive" } },
                { address: { contains: search, mode: "insensitive" } },
                { contactPerson: { contains: search, mode: "insensitive" } },
            ]
        }

        if (selectDate) {
            const day = new Date(`${selectDate}T00:00:00.000Z`)
            const nextDay = new Date(day.getTime() + 24 * 60 * 60 * 1000)
            where.updatedAt = { gte: day, lt: nextDay }
        }

        const filtered = await prisma.branch.findMany({
            where,
            orderBy: { name: "asc" },
            take: 5000,
            select: {
                code: true,
                name: true,
                city: true,
                province: true,
                status: true,
                address: true,
                contactPerson: true,
                contactPhone: true,
                dayGuardCapacity: true,
                nightGuardCapacity: true,
                updatedAt: true,
            },
        })

        const headers = [
            "Branch Code", "Branch Name", "City", "Province", "Status", "Address",
            "Contact Person", "Contact Phone", "Day Guard Cap", "Night Guard Cap",
        ]
        const csvRows = [headers.map(csvEscape).join(",")]
        for (const b of filtered) {
            const cells = [
                b.code || "",
                b.name || "",
                b.city || "",
                b.province || "",
                b.status,
                b.address || "",
                b.contactPerson || "",
                b.contactPhone || "",
                b.dayGuardCapacity != null ? String(b.dayGuardCapacity) : "",
                b.nightGuardCapacity != null ? String(b.nightGuardCapacity) : "",
            ]
            csvRows.push(cells.map(csvEscape).join(","))
        }

        const csv = csvRows.join("\n")
        const responseHeaders: Record<string, string> = {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="client-${clientId}-branches-${new Date().toISOString().slice(0, 10)}.csv"`,
        }
        // If the filtered set hit the safety cap, the export may be truncated.
        if (filtered.length === 5000) responseHeaders["X-Export-Truncated"] = "true"
        return new NextResponse(csv, { status: 200, headers: responseHeaders })
    } catch (error) {
        console.error("Error exporting branches:", error)
        return internalServerError("Failed to export branches.")
    }
}
