import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { internalServerError, unauthorized } from "@/lib/api/response"

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }

        const { searchParams } = new URL(request.url)
        const regionId = searchParams.get("regionId") || undefined
        const clientId = searchParams.get("clientId") || undefined
        const branchId = searchParams.get("branchId") || undefined
        const deployAs = searchParams.get("deployAs") || undefined
        const guardType = searchParams.get("guardType") || undefined
        const shiftType = searchParams.get("shiftType") || undefined
        const latest = searchParams.get("latest") === "true"

        const rates = await prisma.deploymentRate.findMany({
            where: {
                ...(regionId ? { regionId } : {}),
                ...(clientId ? { clientId } : {}),
                ...(branchId ? { branchId } : {}),
                ...(deployAs ? { deployAs } : {}),
                ...(guardType ? { guardType } : {}),
                ...(shiftType ? { shiftType } : {}),
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
        if (!session) {
            return unauthorized()
        }

        const body = await request.json()

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

        return NextResponse.json(rate, { status: 201 })
    } catch (error: unknown) {
        console.error("Error creating deployment rate:", error)
        return internalServerError("Failed to create deployment rate")
    }
}
