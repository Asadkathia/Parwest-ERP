import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"

export async function POST(
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

        // Validate deployment exists and is active
        const existingDeployment = await prisma.deployment.findUnique({
            where: { id },
        })

        if (!existingDeployment) {
            return NextResponse.json(
                { message: "Deployment not found" },
                { status: 404 }
            )
        }
        if (managerScope && managerScopeDenied(managerScope, { regionalOfficeId: existingDeployment.regionalOfficeId })) {
            return NextResponse.json({ message: "Forbidden: deployment is outside your scope." }, { status: 403 })
        }

        if (existingDeployment.status === "INACTIVE") {
            return NextResponse.json(
                { message: "Deployment is already ended" },
                { status: 400 }
            )
        }

        // Validate end date
        const endDate = new Date(body.endDate)
        const deploymentDate = new Date(existingDeployment.deploymentDate)
        const today = new Date()

        // Normalize dates to compare only the date part (ignore time)
        const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())
        const deploymentDateOnly = new Date(deploymentDate.getFullYear(), deploymentDate.getMonth(), deploymentDate.getDate())
        const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())

        if (endDateOnly < deploymentDateOnly) {
            return NextResponse.json(
                { message: "End date cannot be before deployment date" },
                { status: 400 }
            )
        }

        if (endDateOnly > todayOnly) {
            return NextResponse.json(
                { message: "End date cannot be in the future" },
                { status: 400 }
            )
        }

        // End the deployment
        const deployment = await prisma.deployment.update({
            where: { id },
            data: {
                status: "INACTIVE",
                endDate: endDate,
                endReason: body.reason || null,
            },
            include: {
                guard: true,
                client: true,
                branch: true,
                regionalOffice: true,
            },
        })

        return NextResponse.json(
            { message: "Deployment ended successfully", deployment },
            { status: 200 }
        )
    } catch (error: any) {
        console.error("Error ending deployment:", error)
        return NextResponse.json(
            {
                message: "Failed to end deployment",
                error: error.message,
                details: error.toString()
            },
            { status: 500 }
        )
    }
}
