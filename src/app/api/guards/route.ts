import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { isMockEnabled } from "@/lib/mockData"
import { mockGuardsList } from "@/lib/mockData/guards"
import { applyManagerScope, buildManagerScopeWhere, deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const managerScope = deriveManagerScope(session)

        const { searchParams } = new URL(request.url)
        const regionId = searchParams.get("regionId")
        const regionalOfficeId = searchParams.get("regionalOfficeId")
        const status = searchParams.get("status")

        const where: any = {}
        if (regionId) where.regionId = regionId
        if (regionalOfficeId) where.regionalOfficeId = regionalOfficeId
        if (status) where.status = status
        Object.assign(where, buildManagerScopeWhere(managerScope, { regionId: "regionId", regionalOfficeId: "regionalOfficeId" }))

        if (isMockEnabled()) {
            const guards = mockGuardsList
                .filter((guard) => (where.status ? guard.status === where.status : true))
                .filter((guard) =>
                    applyManagerScope([guard], managerScope, {
                        regionId: (row) => (row as any).regionId,
                        regionalOfficeId: (row) => (row as any).regionalOfficeId,
                    }).length > 0
                )
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

        const managerScope = deriveManagerScope(session)

        const body = await request.json()
        const cnic = String(body?.cnic || "").trim()
        if (!cnic) {
            return NextResponse.json({ message: "CNIC is required." }, { status: 400 })
        }
        if (!/^\d{5}-\d{7}-\d$/.test(cnic)) {
            return NextResponse.json({ message: "CNIC format must be XXXXX-XXXXXXX-X." }, { status: 400 })
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
            return NextResponse.json({ message: "Forbidden: cannot create guard outside your scope." }, { status: 403 })
        }

        try {
            const blocked = await prisma.blacklistedCnic.findUnique({
                where: { cnic },
                select: { id: true },
            })
            if (blocked) {
                return NextResponse.json({ message: "This CNIC is blacklisted and cannot be enrolled." }, { status: 403 })
            }
        } catch (error) {
            if (!isPrismaMissingSchemaError(error)) throw error
        }

        if (isMockEnabled()) {
            const mock = {
                id: `mock-guard-${Date.now()}`,
                parwestId: `PW-${String(Date.now()).slice(-5)}`,
                name: String(body.name || "Mock Guard"),
                cnic,
                phone: body.phone || null,
                email: body.email || null,
                status: body.status || "PENDING",
                regionId: bodyRegionId,
                regionalOfficeId: body.regionalOfficeId || null,
            }
            return NextResponse.json(mock, { status: 201 })
        }

        const existingCnic = await prisma.guard.findUnique({
            where: { cnic },
            select: { id: true },
        })
        if (existingCnic) {
            return NextResponse.json(
                { message: "A guard with this CNIC already exists" },
                { status: 400 }
            )
        }

        const generateNextParwestId = async () => {
            const candidates = await prisma.guard.findMany({
                where: { parwestId: { startsWith: "PW-" } },
                select: { parwestId: true },
                orderBy: { createdAt: "desc" },
                take: 1000,
            })
            let maxNumber = 0
            for (const row of candidates) {
                const match = row.parwestId.match(/^PW-(\d+)$/)
                if (!match) continue
                const numeric = Number(match[1])
                if (Number.isFinite(numeric) && numeric > maxNumber) maxNumber = numeric
            }
            return `PW-${String(maxNumber + 1).padStart(5, "0")}`
        }

        const createGuardPayload = (parwestId: string) => ({
            parwestId,
            name: body.name,
            cnic,
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
            regionId: bodyRegionId,
            regionalOfficeId: body.regionalOfficeId || null,
        })

        let lastCreateError: unknown = null
        for (let attempt = 0; attempt < 3; attempt++) {
            const parwestId = await generateNextParwestId()
            try {
                const guard = await prisma.guard.create({
                    data: createGuardPayload(parwestId),
                })
                return NextResponse.json(guard, { status: 201 })
            } catch (error: any) {
                lastCreateError = error
                const message = String(error?.message || "").toLowerCase()
                const code = String(error?.code || "")
                const target = String(error?.meta?.target || "").toLowerCase()
                const parwestIdConflict =
                    (code === "P2002" && target.includes("parwestid")) ||
                    message.includes("parwestid")
                if (!parwestIdConflict) {
                    throw error
                }
            }
        }

        throw lastCreateError ?? new Error("Failed to generate unique Parwest ID")
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
