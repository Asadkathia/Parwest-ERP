import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { isMockEnabled } from "@/lib/mockData"
import { mockGuardsList } from "@/lib/mockData/guards"

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const regionId = searchParams.get("regionId")
        const regionalOfficeId = searchParams.get("regionalOfficeId")
        const status = searchParams.get("status")

        const where: any = {}
        if (regionId) where.regionId = regionId
        if (regionalOfficeId) where.regionalOfficeId = regionalOfficeId
        if (status) where.status = status

        if (isMockEnabled()) {
            const guards = mockGuardsList
                .filter((guard) => (where.status ? guard.status === where.status : true))
                .map((guard) => ({
                    id: guard.id,
                    parwestId: guard.parwestId,
                    name: guard.name,
                    cnic: guard.cnic,
                    phone: guard.phone || null,
                    email: guard.email || null,
                    status: guard.status,
                    regionId: null,
                    regionalOfficeId: null,
                    region: null,
                    regionalOffice: null,
                }))
            return NextResponse.json(guards)
        }

        const guards = await prisma.guard.findMany({
            where,
            orderBy: { name: "asc" },
            include: {
                region: true,
                regionalOffice: true,
            },
        })

        return NextResponse.json(guards)
    } catch (error: any) {
        console.error("Error fetching guards:", error)
        return NextResponse.json(
            { message: "Failed to fetch guards" },
            { status: 500 }
        )
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
            const mock = {
                id: `mock-guard-${Date.now()}`,
                parwestId: `PW-${String(Date.now()).slice(-5)}`,
                name: String(body.name || "Mock Guard"),
                cnic: String(body.cnic || "00000-0000000-0"),
                phone: body.phone || null,
                email: body.email || null,
                status: body.status || "PENDING",
                regionId: body.regionId || null,
                regionalOfficeId: body.regionalOfficeId || null,
            }
            return NextResponse.json(mock, { status: 201 })
        }

        // Generate Parwest ID
        const lastGuard = await prisma.guard.findFirst({
            orderBy: { createdAt: "desc" },
            select: { parwestId: true },
        })

        let nextNumber = 1
        if (lastGuard?.parwestId) {
            const match = lastGuard.parwestId.match(/PW-(\d+)/)
            if (match) {
                nextNumber = parseInt(match[1]) + 1
            }
        }
        const parwestId = `PW-${nextNumber.toString().padStart(5, "0")}`

        // Create guard
        const guard = await prisma.guard.create({
            data: {
                parwestId,
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
                status: body.status || "PENDING",
                isExService: body.isExService === "true",
                exServiceRank: body.exServiceRank || null,
                exServiceRegiment: body.exServiceRegiment || null,
                bankName: body.bankName || null,
                bankAccountNumber: body.bankAccountNumber || null,
                bankAccountType: body.bankAccountType || null,
                joiningDate: body.joiningDate ? new Date(body.joiningDate) : null,
                regionId: body.regionId || null,
                regionalOfficeId: body.regionalOfficeId || null,
            },
        })

        return NextResponse.json(guard, { status: 201 })
    } catch (error: any) {
        console.error("Error creating guard:", error)

        if (error.code === "P2002") {
            return NextResponse.json(
                { message: "A guard with this CNIC already exists" },
                { status: 400 }
            )
        }

        return NextResponse.json(
            { message: "Failed to create guard" },
            { status: 500 }
        )
    }
}
