import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"
import { mockGuardsList } from "@/lib/mockData/guards"
import { applyManagerScope, buildManagerScopeWhere, deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import { badRequest, forbidden, internalServerError, unauthorized } from "@/lib/api/response"
import type { Prisma } from "@prisma/client"

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }

        const managerScope = deriveManagerScope(session)

        const { searchParams } = new URL(request.url)
        const regionId = searchParams.get("regionId")
        const regionalOfficeId = searchParams.get("regionalOfficeId")
        const status = searchParams.get("status")

        const where: Prisma.GuardWhereInput = {}
        if (regionId) where.regionId = regionId
        if (regionalOfficeId) where.regionalOfficeId = regionalOfficeId
        if (status) where.status = status
        Object.assign(where, buildManagerScopeWhere(managerScope, { regionId: "regionId", regionalOfficeId: "regionalOfficeId" }))

        if (isRuntimeMockEnabled()) {
            const guards = mockGuardsList
                .filter((guard) => (where.status ? guard.status === where.status : true))
                .filter((guard) =>
                    applyManagerScope([guard], managerScope, {
                        regionId: (row) => (row as Record<string, unknown>).regionId as string | null | undefined,
                        regionalOfficeId: (row) => (row as Record<string, unknown>).regionalOfficeId as string | null | undefined,
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
    } catch (error: unknown) {
        console.error("Error fetching guards:", error)
        return internalServerError("Failed to fetch guards")
    }
}


export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }

        const managerScope = deriveManagerScope(session)

        const body = await request.json()
        const cnic = String(body?.cnic || "").trim()
        if (!cnic) {
            return badRequest("CNIC is required.")
        }
        if (!/^\d{5}-\d{7}-\d$/.test(cnic)) {
            return badRequest("CNIC format must be XXXXX-XXXXXXX-X.")
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
            return forbidden("Forbidden: cannot create guard outside your scope.")
        }

        try {
            const blocked = await prisma.blacklistedCnic.findUnique({
                where: { cnic },
                select: { id: true },
            })
            if (blocked) {
                return forbidden("This CNIC is blacklisted and cannot be enrolled.")
            }
        } catch (error) {
            if (!isPrismaMissingSchemaError(error)) throw error
        }

        if (isRuntimeMockEnabled()) {
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
            return badRequest("A guard with this CNIC already exists")
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

        // Parse bankAccounts JSON array if provided
        type BankAccountEntry = { bankName?: string; accountNumber?: string; accountType?: string; iban?: string; branchCode?: string; walletType?: string; isActive?: boolean }
        let parsedBankAccounts: BankAccountEntry[] = []
        if (body.bankAccounts) {
            try {
                parsedBankAccounts = JSON.parse(String(body.bankAccounts))
            } catch {
                // ignore parse errors — fall back to flat fields
            }
        }
        const activeAccount = parsedBankAccounts.find((a) => a.isActive) ?? parsedBankAccounts[0] ?? null

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
            bankName: activeAccount?.bankName || body.bankName || null,
            bankAccountNumber: activeAccount?.accountNumber || body.bankAccountNumber || null,
            bankAccountType: activeAccount?.accountType || body.bankAccountType || null,
            bankIban: activeAccount?.iban || body.bankIban || null,
            bankBranchCode: activeAccount?.branchCode || body.bankBranchCode || null,
            bankAccountsJson: parsedBankAccounts.length > 0 ? JSON.stringify(parsedBankAccounts) : null,
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
            } catch (error: unknown) {
                lastCreateError = error
                const errorLike = error as { message?: unknown; code?: unknown; meta?: { target?: unknown } }
                const message = String(errorLike.message || "").toLowerCase()
                const code = String(errorLike.code || "")
                const target = String(errorLike.meta?.target || "").toLowerCase()
                const parwestIdConflict =
                    (code === "P2002" && target.includes("parwestid")) ||
                    message.includes("parwestid")
                if (!parwestIdConflict) {
                    throw error
                }
            }
        }

        throw lastCreateError ?? new Error("Failed to generate unique Parwest ID")
    } catch (error: unknown) {
        console.error("Error creating guard:", error)
        const errorLike = error as { code?: unknown }

        if (String(errorLike.code || "") === "P2002") {
            return badRequest("A guard with this CNIC already exists")
        }

        return internalServerError("Failed to create guard")
    }
}
