import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"

export async function PUT(
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

        // Check if guard exists
        const existingGuard = await prisma.guard.findUnique({
            where: { id },
        })

        if (!existingGuard) {
            return NextResponse.json({ message: "Guard not found" }, { status: 404 })
        }

        // Check CNIC uniqueness (excluding current guard)
        if (body.cnic && body.cnic !== existingGuard.cnic) {
            const cnicExists = await prisma.guard.findFirst({
                where: {
                    cnic: body.cnic,
                    id: { not: id },
                },
            })

            if (cnicExists) {
                return NextResponse.json(
                    { message: "A guard with this CNIC already exists" },
                    { status: 400 }
                )
            }
        }

        // Update guard
        const guard = await prisma.guard.update({
            where: { id },
            data: {
                name: body.name,
                cnic: body.cnic,
                phone: body.phone || null,
                email: body.email || null,
                dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
                age: body.age ? parseInt(body.age) : null,
                fatherName: body.fatherName || null,
                religion: body.religion || null,
                maritalStatus: body.maritalStatus || null,
                education: body.education || null,
                addressPermanent: body.addressPermanent || null,
                addressCurrent: body.addressCurrent || null,
                emergencyContact: body.emergencyContact || null,
                regionId: body.regionId || null,
                regionalOfficeId: body.regionalOfficeId || null,
                joiningDate: body.joiningDate ? new Date(body.joiningDate) : null,
                status: body.status || "PENDING",
                isExService: body.isExService === "true" || body.isExService === true,
                exServiceRank: body.exServiceRank || null,
                exServiceRegiment: body.exServiceRegiment || null,
                bankName: body.bankName || null,
                bankAccountNumber: body.bankAccountNumber || null,
                bankAccountType: body.bankAccountType || null,
            },
        })

        return NextResponse.json(guard, { status: 200 })
    } catch (error: any) {
        console.error("Error updating guard:", error)
        return NextResponse.json(
            { message: "Failed to update guard" },
            { status: 500 }
        )
    }
}
