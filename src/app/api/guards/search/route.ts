import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { isMockEnabled } from "@/lib/mockData"
import { mockGuardsList } from "@/lib/mockData/guards"
import { applyManagerScope, buildManagerScopeWhere, deriveManagerScope } from "@/lib/access/scope"
import { internalServerError, unauthorized } from "@/lib/api/response"
import type { Prisma } from "@prisma/client"

function readStringField(row: unknown, key: string) {
    const value = (row as Record<string, unknown>)[key]
    return typeof value === "string" ? value : ""
}

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
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
                if (paymentMode && (readStringField(guard, "paymentMode").toUpperCase() !== paymentMode.toUpperCase())) return false
                if (guardCategory && (readStringField(guard, "guardCategory").toUpperCase() !== guardCategory.toUpperCase())) return false
                if (q) {
                    const text = `${guard.name} ${guard.parwestId} ${guard.cnic} ${guard.phone || ""}`.toLowerCase()
                    if (!text.includes(q.toLowerCase())) return false
                }
                return true
            })
            const scopedRows = applyManagerScope(rows, managerScope, {
                regionId: (row) => (row as Record<string, unknown>).regionId as string | null | undefined,
                regionalOfficeId: (row) => (row as Record<string, unknown>).regionalOfficeId as string | null | undefined,
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
                    paymentMode: readStringField(guard, "paymentMode") || "BANK",
                    guardCategory: readStringField(guard, "guardCategory") || "REGULAR",
                    region: null,
                    regionalOffice: null,
                }))
            )
        }

        const where: Prisma.GuardWhereInput = {
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
        }

        const guards = await prisma.guard.findMany({
            where,
            orderBy: { name: "asc" },
            include: {
                region: true,
                regionalOffice: true,
            },
            take: 200,
        })

        return NextResponse.json(guards)
    } catch (error: unknown) {
        console.error("Error searching guards:", error)
        return internalServerError("Failed to search guards")
    }
}
