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
        if (bodyRegionalOfficeId) {
            const office = await prisma.regionalOffice.findUnique({
                where: { id: bodyRegionalOfficeId },
                select: { id: true, regionId: true },
            })
            if (!office) {
                return badRequest("Selected regional office does not exist.")
            }
            if (!bodyRegionId) {
                bodyRegionId = office.regionId || null
            }
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
                regionalOfficeId: bodyRegionalOfficeId,
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

        // Build nearest relatives JSON from nearest_X_* fields
        const nearestRelatives: Record<string, string>[] = []
        const nearestIndexes = new Set<string>()
        for (const key of Object.keys(body)) {
            const m = key.match(/^nearest_(\d+)_/)
            if (m) nearestIndexes.add(m[1])
        }
        for (const idx of Array.from(nearestIndexes).sort()) {
            const rel: Record<string, string> = {}
            for (const field of ["name","fatherName","relation","profession","cnic","cnicIssueDate","contact","address"]) {
                const v = String(body[`nearest_${idx}_${field}`] || "").trim()
                if (v) rel[field] = v
            }
            if (Object.keys(rel).length > 0) nearestRelatives.push(rel)
        }

        // Build family members JSON from family_X_* fields
        const familyMembers: Record<string, string>[] = []
        const familyIndexes = new Set<string>()
        for (const key of Object.keys(body)) {
            const m = key.match(/^family_(\d+)_/)
            if (m) familyIndexes.add(m[1])
        }
        for (const idx of Array.from(familyIndexes).sort()) {
            const member: Record<string, string> = {}
            for (const field of ["name","relation","age","profession","address","childCnic","childAge","childDob"]) {
                const v = String(body[`family_${idx}_${field}`] || "").trim()
                if (v) member[field] = v
            }
            if (Object.keys(member).length > 0) familyMembers.push(member)
        }

        const str = (v: unknown) => (v ? String(v).trim() || null : null)
        const num = (v: unknown) => { const n = parseInt(String(v || "")); return Number.isFinite(n) ? n : null }
        const flt = (v: unknown) => { const n = parseFloat(String(v || "")); return Number.isFinite(n) ? n : null }
        const dt  = (v: unknown) => { if (!v || !String(v).trim()) return null; const d = new Date(String(v)); return Number.isNaN(d.getTime()) ? null : d }

        // Parse previousEmploymentsJson if provided (new multi-entry format)
        type PrevEmpEntry = { type?: string; isExService?: boolean; rank?: string; registrationNo?: string; unit?: string; years?: string; months?: string; dateOfEnrollment?: string; dateOfDischarge?: string; remarks?: string }
        let parsedPrevEmployments: PrevEmpEntry[] = []
        if (body.previousEmploymentsJson) {
            try { parsedPrevEmployments = JSON.parse(String(body.previousEmploymentsJson)) } catch { /* ignore */ }
        }

        // Derive exServiceType + isExService
        const derivedExService = parsedPrevEmployments.find((e) => e.isExService === true)
        const exServiceType = derivedExService
            ? (derivedExService.type ?? "CIVILIAN")
            : (str(body.exServiceType) ?? "CIVILIAN")
        const isExService = parsedPrevEmployments.length > 0
            ? parsedPrevEmployments.some((e) => e.isExService === true)
            : ["ARMY","POLICE","RANGERS","MUJAHID","OTHER"].includes(exServiceType)

        const createGuardPayload = (parwestId: string) => ({
            parwestId,
            name: body.name,
            cnic,
            phone: str(body.phone),
            email: str(body.email),
            dateOfBirth: dt(body.dateOfBirth),
            age: num(body.age),
            fatherName: str(body.fatherName),
            motherName: str(body.motherName),
            nationality: str(body.nationality),
            nextOfKin: str(body.nextOfKin),
            religion: str(body.religion),
            maritalStatus: str(body.maritalStatus),
            education: str(body.education),
            addressPermanent: str(body.addressPermanent),
            addressCurrent: str(body.addressCurrent),
            emergencyContact: str(body.emergencyContact),
            additionalContactNumbers: str(body.additionalContactNumbers),
            profileIntroducer: str(body.profileIntroducer),
            nearestRelativesJson: nearestRelatives.length > 0 ? JSON.stringify(nearestRelatives) : null,
            status: str(body.status) || "PENDING",
            // General extras
            sect: str(body.sect),
            cast: str(body.cast),
            bloodGroup: str(body.bloodGroup),
            policeStation: str(body.policeStation),
            cnicIssueDate: dt(body.cnicIssueDate),
            cnicExpiryDate: dt(body.cnicExpiryDate),
            salary: flt(body.salary),
            designation: str(body.designation),
            joiningDate: dt(body.joiningDate),
            joiningAge: num(body.joiningAge),
            enrolledBy: str(body.enrolledBy),
            // Previous employment
            isExService,
            exServiceType,
            exServiceRank: str(body.exServiceRank),
            exServiceRegiment: str(body.exServiceRegiment),
            exServiceRegistrationNo: str(body.exServiceRegistrationNo),
            exServiceUnit: str(body.exServiceUnit),
            exServicePeriod: str(body.exServicePeriod),
            exServiceYears: num(body.exServiceYears),
            exServiceMonths: num(body.exServiceMonths),
            exServiceOtherLabel: str(body.exServiceOtherLabel),
            dateOfEnrollment: dt(body.dateOfEnrollment),
            dateOfDischarge: dt(body.dateOfDischarge),
            exServiceRemarks: str(body.exServiceRemarks),
            // Address contacts
            currentAddressContact: str(body.currentAddressContact),
            permanentAddressContact: str(body.permanentAddressContact),
            // Education extras
            passingYear: str(body.passingYear),
            educationInstitute: str(body.educationInstitute),
            // Introducer
            introducerName: str(body.introducerName),
            introducerCnic: str(body.introducerCnic),
            introducerAddress: str(body.introducerAddress),
            introducerContact: str(body.introducerContact),
            // Physical
            height: str(body.height),
            weight: str(body.weight),
            eyeColor: str(body.eyeColor),
            hairColor: str(body.hairColor),
            disability: str(body.disability),
            identificationMark: str(body.identificationMark),
            // Family
            familyMembersJson: familyMembers.length > 0 ? JSON.stringify(familyMembers) : null,
            // Previous employments (multi-entry)
            previousEmploymentsJson: parsedPrevEmployments.length > 0 ? JSON.stringify(parsedPrevEmployments) : null,
            // Bank
            bankName: activeAccount?.bankName || str(body.bankName),
            bankAccountNumber: activeAccount?.accountNumber || str(body.bankAccountNumber),
            bankAccountType: activeAccount?.accountType || str(body.bankAccountType),
            bankIban: activeAccount?.iban || str(body.bankIban),
            bankBranchCode: activeAccount?.branchCode || str(body.bankBranchCode),
            bankAccountsJson: parsedBankAccounts.length > 0 ? JSON.stringify(parsedBankAccounts) : null,
            regionId: bodyRegionId,
            regionalOfficeId: bodyRegionalOfficeId,
        })

        // Check age against configured limits
        const guardAge = num(body.age)
        let ageApprovalRequired = false
        let ageApprovalReason: "OVERAGE" | "UNDERAGE" | null = null

        if (guardAge !== null) {
            try {
                const ageConfig = await prisma.guardAgeConfig.findFirst()
                if (ageConfig) {
                    if (guardAge < ageConfig.minAge) {
                        ageApprovalRequired = true
                        ageApprovalReason = "UNDERAGE"
                    } else if (guardAge > ageConfig.maxAge) {
                        ageApprovalRequired = true
                        ageApprovalReason = "OVERAGE"
                    }
                }
            } catch {
                // Non-critical — proceed without age check if config unavailable
            }
        }

        let lastCreateError: unknown = null
        for (let attempt = 0; attempt < 3; attempt++) {
            const parwestId = await generateNextParwestId()
            try {
                const payload = {
                    ...createGuardPayload(parwestId),
                    ageApprovalRequired,
                    ageApprovalStatus: ageApprovalRequired ? "PENDING" : null,
                }
                const guard = await prisma.guard.create({ data: payload })

                // Create approval request if age is outside limits
                if (ageApprovalRequired && ageApprovalReason && guardAge !== null) {
                    try {
                        await prisma.guardAgeApproval.create({
                            data: {
                                guardId: guard.id,
                                guardAge,
                                reason: ageApprovalReason,
                                status: "PENDING",
                                requestedBy: session.user?.name ?? session.user?.email ?? "System",
                            },
                        })
                    } catch {
                        // Non-critical — guard is already created
                    }
                }

                return NextResponse.json(
                    { ...guard, ageApprovalRequired, ageApprovalReason },
                    { status: 201 }
                )
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
