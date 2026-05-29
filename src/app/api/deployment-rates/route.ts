import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { forbidden, internalServerError, ok, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { buildManagerScopeWhere, deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) return unauthorized()
        if (!hasAction(session, "GUARDS", "VIEW")) return forbidden("Access denied.")
        const managerScope = deriveManagerScope(session)

        const { searchParams } = new URL(request.url)
        const regionId = searchParams.get("regionId") || undefined
        const clientId = searchParams.get("clientId") || undefined
        const branchId = searchParams.get("branchId") || undefined
        const deployAs = searchParams.get("deployAs") || undefined
        const guardType = searchParams.get("guardType") || undefined
        const shiftType = searchParams.get("shiftType") || undefined
        const latest = searchParams.get("latest") === "true"

        // Regional users cannot read rate rows outside their region.
        if (managerScopeDenied(managerScope, { regionId })) {
            return forbidden("Forbidden: region is outside your scope.")
        }

        const rates = await prisma.deploymentRate.findMany({
            where: {
                ...(regionId ? { regionId } : {}),
                ...(clientId ? { clientId } : {}),
                ...(branchId ? { branchId } : {}),
                ...(deployAs ? { deployAs } : {}),
                ...(guardType ? { guardType } : {}),
                ...(shiftType ? { shiftType } : {}),
                ...buildManagerScopeWhere(managerScope, { regionId: "regionId" }),
            },
            orderBy: { createdAt: "desc" },
            include: {
                region: { select: { id: true, name: true } },
                client: { select: { id: true, name: true } },
                branch: { select: { id: true, name: true } },
            },
            take: latest ? 1 : 200,
        })

        return NextResponse.json(latest ? rates[0] || null : rates)
    } catch (error: unknown) {
        console.error("Error fetching deployment rates:", error)
        return internalServerError("Failed to fetch deployment rates")
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) return unauthorized()
        if (!hasAction(session, "GUARDS", "CREATE")) return forbidden("Access denied.")
        const managerScope = deriveManagerScope(session)

        const body = await request.json()

        if (managerScopeDenied(managerScope, { regionId: body.regionId || undefined })) {
            return forbidden("Forbidden: region is outside your scope.")
        }

        const rate = await prisma.deploymentRate.create({
            data: {
                regionId: body.regionId || null,
                clientId: body.clientId || null,
                branchId: body.branchId || null,
                deployAs: body.deployAs || null,
                guardType: body.guardType || null,
                shiftType: body.shiftType || null,
                salary: body.salary ? Number(body.salary) : null,
                overtime: body.overtime ? Number(body.overtime) : null,
                extraHours: body.extraHours ? Number(body.extraHours) : null,
                postAllowance: body.postAllowance ? Number(body.postAllowance) : null,
            },
            include: {
                region: { select: { id: true, name: true } },
                client: { select: { id: true, name: true } },
                branch: { select: { id: true, name: true } },
            },
        })

        return ok(rate, 201)
    } catch (error: unknown) {
        console.error("Error creating deployment rate:", error)
        return internalServerError("Failed to create deployment rate")
    }
}
