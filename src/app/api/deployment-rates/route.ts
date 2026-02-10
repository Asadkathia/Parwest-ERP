import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
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
    } catch (error: any) {
        console.error("Error fetching deployment rates:", error)
        return NextResponse.json({ message: "Failed to fetch deployment rates" }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
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
    } catch (error: any) {
        console.error("Error creating deployment rate:", error)
        return NextResponse.json({ message: "Failed to create deployment rate" }, { status: 500 })
    }
}
