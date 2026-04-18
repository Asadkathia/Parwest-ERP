import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { forbidden, internalServerError, unauthorized } from "@/lib/api/response"
import { hasModuleAccess } from "@/lib/api/permissions"
import { buildManagerScopeWhere, deriveManagerScope } from "@/lib/access/scope"

function csvEscape(val: string | null | undefined): string {
    const s = val ?? ""
    return `"${s.replace(/"/g, '""')}"`
}

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) return unauthorized()
        if (!hasModuleAccess(session, "GUARDS")) return forbidden("Access denied.")

        const { searchParams } = new URL(request.url)
        const parwestId = searchParams.get("parwestId")?.trim() || undefined
        const name = searchParams.get("name")?.trim() || undefined
        const cnic = searchParams.get("cnic")?.trim() || undefined
        const status = searchParams.get("status")?.trim() || undefined
        const exService = searchParams.get("exService")?.trim() || undefined
        const supervisorId = searchParams.get("supervisorId")?.trim() || undefined
        const verificationStatus = searchParams.get("verificationStatus")?.trim() || undefined
        const dateFrom = searchParams.get("dateFrom")?.trim() || undefined
        const dateTo = searchParams.get("dateTo")?.trim() || undefined
        const regionalOfficeId = searchParams.get("regionalOfficeId")?.trim() || undefined

        const managerScope = deriveManagerScope(session)
        const scopeWhere = managerScope ? buildManagerScopeWhere(managerScope) : {}

        const where: Record<string, unknown> = { ...scopeWhere }
        if (parwestId) where.parwestId = { contains: parwestId, mode: "insensitive" }
        if (name) where.name = { contains: name, mode: "insensitive" }
        if (cnic) where.cnic = { contains: cnic, mode: "insensitive" }
        if (status) where.status = status
        if (exService) where.exServiceType = { equals: exService, mode: "insensitive" }
        if (regionalOfficeId) where.regionalOfficeId = regionalOfficeId
        if (dateFrom || dateTo) {
            where.createdAt = {
                ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
                ...(dateTo ? { lte: new Date(dateTo + "T23:59:59.999Z") } : {}),
            }
        }
        if (supervisorId) {
            where.supervisorAssignments = {
                some: { supervisorId, status: "ACTIVE" },
            }
        }
        if (verificationStatus) {
            where.verification = { status: verificationStatus }
        }

        const guards = await prisma.guard.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: 5000,
            select: {
                parwestId: true,
                name: true,
                cnic: true,
                status: true,
                exServiceType: true,
                phone: true,
                dateOfBirth: true,
                createdAt: true,
                regionalOffice: { select: { name: true } },
                region: { select: { name: true } },
                supervisorAssignments: {
                    where: { status: "ACTIVE" },
                    take: 1,
                    select: { supervisor: { select: { name: true } } },
                },
                verification: { select: { status: true } },
            },
        })

        const headers = [
            "Parwest ID", "Name", "CNIC", "Status", "Ex Service", "Phone",
            "Date of Birth", "Regional Office", "Region", "Supervisor",
            "Verification Status", "Enrolled On",
        ]
        const csvRows = [headers.map(csvEscape).join(",")]
        for (const g of guards) {
            const cells = [
                g.parwestId,
                g.name,
                g.cnic,
                g.status,
                g.exServiceType || "",
                g.phone || "",
                g.dateOfBirth ? new Date(g.dateOfBirth).toLocaleDateString("en-US") : "",
                g.regionalOffice?.name || "",
                g.region?.name || "",
                g.supervisorAssignments[0]?.supervisor?.name || "",
                g.verification?.status || "",
                new Date(g.createdAt).toLocaleDateString("en-US"),
            ]
            csvRows.push(cells.map(csvEscape).join(","))
        }

        const csv = csvRows.join("\n")
        return new NextResponse(csv, {
            status: 200,
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="guards-export-${new Date().toISOString().slice(0, 10)}.csv"`,
            },
        })
    } catch (error) {
        console.error("Error exporting guards:", error)
        return internalServerError("Failed to export guards.")
    }
}
