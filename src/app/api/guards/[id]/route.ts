import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"

export async function PUT(
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
        const nextCnic = body?.cnic ? String(body.cnic).trim() : ""
        if (nextCnic && !/^\d{5}-\d{7}-\d$/.test(nextCnic)) {
            return NextResponse.json({ message: "CNIC format must be XXXXX-XXXXXXX-X." }, { status: 400 })
        }

        // Check if guard exists
        const existingGuard = await prisma.guard.findUnique({
            where: { id },
        })

        if (!existingGuard) {
            return NextResponse.json({ message: "Guard not found" }, { status: 404 })
        }
        if (managerScope && managerScopeDenied(managerScope, { regionId: existingGuard.regionId, regionalOfficeId: existingGuard.regionalOfficeId })) {
            return NextResponse.json({ message: "Forbidden: guard is outside your scope." }, { status: 403 })
        }

        const bodyRegionalOfficeId = body?.regionalOfficeId ? String(body.regionalOfficeId) : null
        let bodyRegionId = body?.regionId ? String(body.regionId) : null
        if (!bodyRegionId && bodyRegionalOfficeId) {
            const office = await prisma.regionalOffice.findUnique({
                where: { id: bodyRegionalOfficeId },
                select: { regionId: true },
            })
            bodyRegionId = office?.regionId || null
        }
        if (managerScope && managerScopeDenied(managerScope, { regionId: bodyRegionId, regionalOfficeId: bodyRegionalOfficeId })) {
            return NextResponse.json({ message: "Forbidden: cannot move guard outside your scope." }, { status: 403 })
        }

        // Check CNIC uniqueness (excluding current guard)
        if (nextCnic && nextCnic !== existingGuard.cnic) {
            const cnicExists = await prisma.guard.findFirst({
                where: {
                    cnic: nextCnic,
                    id: { not: id },
                },
            })

            if (cnicExists) {
                return NextResponse.json(
                    { message: "A guard with this CNIC already exists" },
                    { status: 400 }
                )
            }

            try {
                const blocked = await prisma.blacklistedCnic.findUnique({
                    where: { cnic: nextCnic },
                    select: { id: true },
                })
                if (blocked) {
                    return NextResponse.json(
                        { message: "This CNIC is blacklisted and cannot be assigned to a guard profile." },
                        { status: 403 }
                    )
                }
            } catch (error) {
                if (!isPrismaMissingSchemaError(error)) throw error
            }
        }

        // Update guard
        const guard = await prisma.guard.update({
            where: { id },
            data: {
                name: body.name,
                cnic: nextCnic || existingGuard.cnic,
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
                regionId: bodyRegionId,
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
