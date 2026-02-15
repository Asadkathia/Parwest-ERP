import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { isMockEnabled } from "@/lib/mockData"
import { mockDeploymentsList } from "@/lib/mockData/deployments"

export async function GET() {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        if (isMockEnabled()) {
            return NextResponse.json(
                mockDeploymentsList.map((row) => ({
                    ...row,
                    deploymentDate: new Date(row.deploymentDate),
                }))
            )
        }

        const deployments = await prisma.deployment.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                guard: true,
                client: true,
                branch: true,
                regionalOffice: true,
            },
        })

        return NextResponse.json(deployments)
    } catch (error: any) {
        console.error("Error fetching deployments:", error)
        return NextResponse.json({ message: "Failed to fetch deployments" }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const body = await request.json()

        if (isMockEnabled()) {
            const mockDeployment = {
                id: `mock-deploy-${Date.now()}`,
                guardId: body.guardId || "PW-00000",
                clientId: body.clientId || "mock-client",
                branchId: body.branchId || "mock-branch",
                regionalOfficeId: body.regionalOfficeId || null,
                deploymentDate: body.deploymentDate ? new Date(body.deploymentDate) : new Date(),
                designation: body.designation || "Security Guard",
                shiftType: body.shiftType || "DAY",
                rate: body.rate || null,
                status: body.status || "ACTIVE",
                notes: body.notes || null,
                guardType: body.guardType || null,
                salary: body.salary || null,
                overtime: body.overtime || null,
                extraHours: body.extraHours || null,
                postAllowance: body.postAllowance || null,
                dayShiftStart: body.dayShiftStart || null,
                dayShiftEnd: body.dayShiftEnd || null,
                nightShiftStart: body.nightShiftStart || null,
                nightShiftEnd: body.nightShiftEnd || null,
                deploymentType: body.deploymentType || "REGULAR",
                isExtraGuard: body.isExtraGuard || false,
                comment: body.comment || null,
            }
            return NextResponse.json(mockDeployment, { status: 201 })
        }

        // Verify guard is not already deployed to this branch
        const existingDeployment = await prisma.deployment.findFirst({
            where: {
                guardId: body.guardId,
                branchId: body.branchId,
                status: "ACTIVE",
            },
        })

        if (existingDeployment) {
            return NextResponse.json(
                { message: "This guard is already deployed to this branch" },
                { status: 400 }
            )
        }

        // Create deployment
        const deployment = await prisma.deployment.create({
            data: {
                guardId: body.guardId,
                clientId: body.clientId,
                branchId: body.branchId,
                regionalOfficeId: body.regionalOfficeId,
                deploymentDate: new Date(body.deploymentDate),
                designation: body.designation || "Security Guard",
                shiftType: body.shiftType || "DAY",
                rate: body.rate || null,
                status: body.status || "ACTIVE",
                notes: body.notes || null,
                // Extended fields
                guardType: body.guardType || null,
                salary: body.salary || null,
                overtime: body.overtime || null,
                extraHours: body.extraHours || null,
                postAllowance: body.postAllowance || null,
                dayShiftStart: body.dayShiftStart || null,
                dayShiftEnd: body.dayShiftEnd || null,
                nightShiftStart: body.nightShiftStart || null,
                nightShiftEnd: body.nightShiftEnd || null,
                deploymentType: body.deploymentType || "REGULAR",
                isExtraGuard: body.isExtraGuard || false,
                comment: body.comment || null,
            },
            include: {
                guard: true,
                client: true,
                branch: true,
                regionalOffice: true,
            },
        })

        return NextResponse.json(deployment, { status: 201 })
    } catch (error: any) {
        console.error("Error creating deployment:", error)
        return NextResponse.json(
            {
                message: "Failed to create deployment",
                error: error.message,
                details: error.toString()
            },
            { status: 500 }
        )
    }
}
