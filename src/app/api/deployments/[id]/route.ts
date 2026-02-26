import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }
        const managerScope = deriveManagerScope(session)

        const { id } = await params
        const body = await request.json()

        const existing = await prisma.deployment.findUnique({
            where: { id },
            select: { id: true, regionalOfficeId: true },
        })
        if (!existing) {
            return NextResponse.json({ message: "Deployment not found" }, { status: 404 })
        }

        if (managerScope && managerScopeDenied(managerScope, { regionalOfficeId: existing.regionalOfficeId })) {
            return NextResponse.json({ message: "Forbidden: deployment is outside your scope." }, { status: 403 })
        }

        const bodyRegionalOfficeId = body?.regionalOfficeId ? String(body.regionalOfficeId) : null
        if (managerScope && managerScopeDenied(managerScope, { regionalOfficeId: bodyRegionalOfficeId })) {
            return NextResponse.json({ message: "Forbidden: cannot move deployment outside your scope." }, { status: 403 })
        }

        // Check if guard is being changed and if new guard has active deployments
        if (body.guardId) {
            const existingDeployment = await prisma.deployment.findFirst({
                where: {
                    guardId: body.guardId,
                    status: "ACTIVE",
                    id: { not: id }, // Exclude current deployment
                },
            })

            if (existingDeployment) {
                return NextResponse.json(
                    { message: "This guard already has an active deployment" },
                    { status: 400 }
                )
            }
        }

        // Update deployment
        const deployment = await prisma.deployment.update({
            where: { id },
            data: {
                guardId: body.guardId,
                clientId: body.clientId,
                branchId: body.branchId || null,
                regionalOfficeId: body.regionalOfficeId,
                deploymentDate: new Date(body.deploymentDate),
                designation: body.designation || null,
                shiftType: body.shiftType,
                rate: body.rate ? parseFloat(body.rate) : null,
                status: body.status || "ACTIVE",
                notes: body.notes || null,
                // Extended fields
                guardType: body.guardType || null,
                salary: body.salary ? parseFloat(body.salary) : null,
                overtime: body.overtime ? parseFloat(body.overtime) : null,
                extraHours: body.extraHours ? parseFloat(body.extraHours) : null,
                postAllowance: body.postAllowance ? parseFloat(body.postAllowance) : null,
                dayShiftStart: body.dayShiftStart || null,
                dayShiftEnd: body.dayShiftEnd || null,
                nightShiftStart: body.nightShiftStart || null,
                nightShiftEnd: body.nightShiftEnd || null,
                deploymentType: body.deploymentType || "REGULAR",
                isExtraGuard: body.isExtraGuard === "on" || body.isExtraGuard === true,
                comment: body.comment || null,
            },
            include: {
                guard: true,
                client: true,
                branch: true,
                regionalOffice: true,
            },
        })

        return NextResponse.json(deployment, { status: 200 })
    } catch (error: any) {
        console.error("Error updating deployment:", error)
        return NextResponse.json(
            {
                message: "Failed to update deployment",
                error: error.message,
                details: error.toString()
            },
            { status: 500 }
        )
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }
        const managerScope = deriveManagerScope(session)

        const { id } = await params

        const existing = await prisma.deployment.findUnique({
            where: { id },
            select: { id: true, regionalOfficeId: true },
        })
        if (!existing) {
            return NextResponse.json({ message: "Deployment not found" }, { status: 404 })
        }
        if (managerScope && managerScopeDenied(managerScope, { regionalOfficeId: existing.regionalOfficeId })) {
            return NextResponse.json({ message: "Forbidden: deployment is outside your scope." }, { status: 403 })
        }

        // Soft delete - set status to INACTIVE and add end date
        const deployment = await prisma.deployment.update({
            where: { id },
            data: {
                status: "INACTIVE",
                // Note: endDate field doesn't exist in schema, just changing status
            },
        })

        return NextResponse.json(
            { message: "Deployment ended successfully", deployment },
            { status: 200 }
        )
    } catch (error: any) {
        console.error("Error ending deployment:", error)
        return NextResponse.json(
            { message: "Failed to end deployment" },
            { status: 500 }
        )
    }
}
