import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { isMockEnabled } from "@/lib/mockData"
import { mockGuardsList } from "@/lib/mockData/guards"
import { applyManagerScope, buildManagerScopeWhere, deriveManagerScope } from "@/lib/access/scope"

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const managerScope = deriveManagerScope(session)

        const { searchParams } = new URL(request.url)
        const q = searchParams.get("q")?.trim()
        const status = searchParams.get("status")
        const education = searchParams.get("education")
        const regionId = searchParams.get("regionId")
        const paymentMode = searchParams.get("paymentMode")
        const guardCategory = searchParams.get("guardCategory")

        if (isMockEnabled()) {
            const rows = mockGuardsList.filter((guard) => {
                if (status && guard.status !== status) return false
                if (education && (guard.education || "").toLowerCase() !== education.toLowerCase()) return false
                if (paymentMode && (String((guard as any).paymentMode || "").toUpperCase() !== paymentMode.toUpperCase())) return false
                if (guardCategory && (String((guard as any).guardCategory || "").toUpperCase() !== guardCategory.toUpperCase())) return false
                if (q) {
                    const text = `${guard.name} ${guard.parwestId} ${guard.cnic} ${guard.phone || ""}`.toLowerCase()
                    if (!text.includes(q.toLowerCase())) return false
                }
                return true
            })
            const scopedRows = applyManagerScope(rows, managerScope, {
                regionId: (row) => (row as any).regionId,
                regionalOfficeId: (row) => (row as any).regionalOfficeId,
            })
            return NextResponse.json(
                scopedRows.map((guard) => ({
                    id: guard.id,
                    parwestId: guard.parwestId,
                    name: guard.name,
                    cnic: guard.cnic,
                    phone: guard.phone || null,
                    status: guard.status,
                    education: guard.education || null,
                    paymentMode: (guard as any).paymentMode || "BANK",
                    guardCategory: (guard as any).guardCategory || "REGULAR",
                    region: null,
                    regionalOffice: null,
                }))
            )
        }

        const guards = await prisma.guard.findMany({
            where: {
                ...(status ? { status } : {}),
                ...(education ? { education } : {}),
                ...(regionId ? { regionId } : {}),
                ...buildManagerScopeWhere(managerScope, { regionId: "regionId", regionalOfficeId: "regionalOfficeId" }),
                ...(q
                    ? {
                        OR: [
                            { name: { contains: q, mode: "insensitive" } },
                            { parwestId: { contains: q, mode: "insensitive" } },
                            { cnic: { contains: q, mode: "insensitive" } },
                            { phone: { contains: q, mode: "insensitive" } },
                        ],
                    }
                    : {}),
            },
            orderBy: { name: "asc" },
            include: {
                region: true,
                regionalOffice: true,
            },
            take: 200,
        })

        return NextResponse.json(guards)
    } catch (error: any) {
        console.error("Error searching guards:", error)
        return NextResponse.json({ message: "Failed to search guards" }, { status: 500 })
    }
}
