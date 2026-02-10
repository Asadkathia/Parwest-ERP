import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { id } = await params
        const body = await request.json()

        // Update branch
        const branch = await prisma.branch.update({
            where: { id },
            data: {
                name: body.name,
                code: body.code || null,
                address: body.address || null,
                city: body.city || null,
                province: body.province || null,
                contactPerson: body.contactPerson || null,
                contactPhone: body.contactPhone || null,
                contactEmail: body.contactEmail || null,
                isHeadOffice: body.isHeadOffice || false,
            },
            include: {
                client: true,
            },
        })

        return NextResponse.json(branch, { status: 200 })
    } catch (error: any) {
        console.error("Error updating branch:", error)
        return NextResponse.json(
            { message: "Failed to update branch" },
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

        const { id } = await params

        // Check if branch has active deployments
        const branch = await prisma.branch.findUnique({
            where: { id },
            include: {
                deployments: {
                    where: { status: "ACTIVE" },
                },
            },
        })

        if (!branch) {
            return NextResponse.json({ message: "Branch not found" }, { status: 404 })
        }

        if (branch.deployments.length > 0) {
            return NextResponse.json(
                { message: "Cannot delete branch with active deployments" },
                { status: 400 }
            )
        }

        // Delete branch
        await prisma.branch.delete({
            where: { id },
        })

        return NextResponse.json({ message: "Branch deleted successfully" }, { status: 200 })
    } catch (error: any) {
        console.error("Error deleting branch:", error)
        return NextResponse.json(
            { message: "Failed to delete branch" },
            { status: 500 }
        )
    }
}
