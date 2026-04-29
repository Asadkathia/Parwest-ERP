import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"
import { mockGuardsList } from "@/lib/mockData/guards"
import { applyManagerScope, buildManagerScopeWhere, deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import { badRequest, forbidden, internalServerError, unauthorized } from "@/lib/api/response"
import { calculateAgeYears, MIN_GUARD_AGE, MAX_GUARD_AGE } from "@/lib/validation/formats"
import { hasAction } from "@/lib/api/permissions"
import { recordGuardServiceEvent } from "@/lib/guards/service-history"
import { recordGuardStatusChange } from "@/lib/guards/status-history"
import { validateGuardEmploymentType } from "@/lib/guards/employmentType"
import type { Prisma } from "@prisma/client"

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }
        if (!hasAction(session, "GUARDS", "VIEW")) return forbidden("Access denied.")

        const managerScope = deriveManagerScope(session)

        const { searchParams } = new URL(request.url)
        const regionId = searchParams.get("regionId")
        const regionalOfficeId = searchParams.get("regionalOfficeId")
        const status = searchParams.get("status")
        const take = Math.min(parseInt(searchParams.get("take") || "200", 10) || 200, 200)
        const skip = Math.max(parseInt(searchParams.get("skip") || "0", 10) || 0, 0)

        if (managerScopeDenied(managerScope, { regionId, regionalOfficeId })) {
            return forbidden("Forbidden: requested scope is outside your assigned region.")
        }

        const where: Prisma.GuardWhereInput = {}
        if (regionId) where.regionId = regionId
        if (regionalOfficeId) where.regionalOfficeId = regionalOfficeId
        if (status) {
            const statuses = status.split(",").map((s) => s.trim()).filter(Boolean)
            if (statuses.length === 1) where.status = statuses[0]
            else if (statuses.length > 1) where.status = { in: statuses }
        }
        Object.assign(where, buildManagerScopeWhere(managerScope, { regionId: "regionId", regionalOfficeId: "regionalOfficeId" }))

        if (isRuntimeMockEnabled()) {
            const statusFilter = status ? status.split(",").map((s) => s.trim()) : null
            const guards = mockGuardsList
                .filter((guard) => (statusFilter ? statusFilter.includes(guard.status) : true))
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
            take,
            skip,
            select: {
                id: true,
                parwestId: true,
                name: true,
                cnic: true,
                phone: true,
                email: true,
                status: true,
                joiningDate: true,
                regionId: true,
                regionalOfficeId: true,
                createdAt: true,
                updatedAt: true,
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
        if (!hasAction(session, "GUARDS", "CREATE")) return forbidden("Access denied.")

        const managerScope = deriveManagerScope(session)

        const body = await request.json()
        const cnic = String(body?.cnic || "").trim()
        if (!cnic) {
            return badRequest("CNIC is required.")
        }
        if (!/^\d{5}-\d{7}-\d$/.test(cnic)) {
            return badRequest("CNIC format must be XXXXX-XXXXXXX-X.")
        }
        const dobStr = body?.dateOfBirth ? String(body.dateOfBirth) : ""
        if (dobStr) {
            const computedAge = calculateAgeYears(dobStr)
            if (computedAge == null || computedAge < MIN_GUARD_AGE || computedAge > MAX_GUARD_AGE) {
                return badRequest("Guard age must be between 18 and 65.")
            }
        }
        const cnicIssueStr = body?.cnicIssueDate ? String(body.cnicIssueDate).trim() : ""
        const cnicExpiryStr = body?.cnicExpiryDate ? String(body.cnicExpiryDate).trim() : ""
        if (cnicIssueStr) {
            const issue = new Date(cnicIssueStr)
            if (Number.isNaN(issue.getTime())) {
                return badRequest("CNIC issue date is invalid.")
            }
            if (issue.getTime() > Date.now()) {
                return badRequest("CNIC issue date cannot be in the future.")
            }
        }
        if (cnicExpiryStr) {
            const expiry = new Date(cnicExpiryStr)
            if (Number.isNaN(expiry.getTime())) {
                return badRequest("CNIC expiry date is invalid.")
            }
            if (cnicIssueStr) {
                const issue = new Date(cnicIssueStr)
                if (!Number.isNaN(issue.getTime()) && expiry.getTime() <= issue.getTime()) {
                    return badRequest("CNIC expiry date must be after the issue date.")
                }
            }
        }
        const bodyRegionalOfficeId = body?.regionalOfficeId ? String(body.regionalOfficeId) : null
        let bodyRegionId = body?.regionId ? String(body.regionId) : null
        let officeSeriesCode: string | null = null
        let officeName: string | null = null
        let regionName: string | null = null
        if (bodyRegionalOfficeId) {
            const office = await prisma.regionalOffice.findUnique({
                where: { id: bodyRegionalOfficeId },
                select: { id: true, regionId: true, seriesCode: true, name: true, region: { select: { name: true } } },
            })
            officeName = office?.name ?? null
            regionName = office?.region?.name ?? null
            if (!office) {
                return badRequest("Selected regional office does not exist.")
            }
            if (!bodyRegionId) {
                bodyRegionId = office.regionId || null
            }
            officeSeriesCode = office.seriesCode || null
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
            const prefix = officeSeriesCode ? `PW-${officeSeriesCode}` : "PW"
            const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
            const pattern = new RegExp(`^${escapedPrefix}-(\\d+)$`)
            const latest = await prisma.guard.findFirst({
                where: { parwestId: { startsWith: `${prefix}-` } },
                select: { parwestId: true },
                orderBy: { parwestId: "desc" },
            })
            let maxNumber = 0
            if (latest) {
                const match = latest.parwestId.match(pattern)
                if (match) {
                    const numeric = Number(match[1])
                    if (Number.isFinite(numeric)) maxNumber = numeric
                }
            }
            return `${prefix}-${String(maxNumber + 1).padStart(5, "0")}`
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

        // Guard Employment Type — explicit body value is authoritative; row-derivation
        // is a fallback for legacy clients that don't send the new field.
        const explicitExServiceType = str(body.exServiceType)
        let exServiceType: string
        let isExService: boolean
        if (explicitExServiceType) {
            const v = await validateGuardEmploymentType(explicitExServiceType, parsedPrevEmployments)
            if (!v.ok) return badRequest(v.message)
            exServiceType = v.exServiceType
            isExService = v.isExService
        } else {
            const derivedExService = parsedPrevEmployments.find((e) => e.isExService === true) ?? parsedPrevEmployments[0] ?? null
            exServiceType = derivedExService?.type ?? "CIVILIAN"
            isExService = parsedPrevEmployments.length > 0
                ? parsedPrevEmployments.some((e) => e.isExService === true)
                : ["ARMY", "POLICE", "RANGERS", "MUJAHID", "OTHER"].includes(exServiceType)
        }

        // For the flat legacy fields, fall back to first multi-entry's values when body fields are absent
        const fe = parsedPrevEmployments.find((e) => e.type === exServiceType) ?? parsedPrevEmployments[0] ?? null

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
            lifecycleStatus: "PENDING",
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
            // Previous employment — flat fields fall back to first multi-entry record
            isExService,
            exServiceType,
            exServiceRank: str(body.exServiceRank) ?? str(fe?.rank),
            exServiceRegiment: str(body.exServiceRegiment) ?? str(fe?.unit),
            exServiceRegistrationNo: str(body.exServiceRegistrationNo) ?? str(fe?.registrationNo),
            exServiceUnit: str(body.exServiceUnit) ?? str(fe?.unit),
            exServicePeriod: str(body.exServicePeriod),
            exServiceYears: num(body.exServiceYears) ?? num(fe?.years),
            exServiceMonths: num(body.exServiceMonths) ?? num(fe?.months),
            exServiceOtherLabel: str(body.exServiceOtherLabel),
            dateOfEnrollment: dt(body.dateOfEnrollment) ?? dt(fe?.dateOfEnrollment),
            dateOfDischarge: dt(body.dateOfDischarge) ?? dt(fe?.dateOfDischarge),
            exServiceRemarks: str(body.exServiceRemarks) ?? str(fe?.remarks),
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
                const supervisorId = str(body.supervisorId)

                const guard = await prisma.$transaction(async (tx) => {
                    const newGuard = await tx.guard.create({ data: payload })

                    if (ageApprovalRequired && ageApprovalReason && guardAge !== null) {
                        await tx.guardAgeApproval.create({
                            data: {
                                guardId: newGuard.id,
                                guardAge,
                                reason: ageApprovalReason,
                                status: "PENDING",
                                requestedBy: session.user?.name ?? session.user?.email ?? "System",
                            },
                        })
                    }

                    if (supervisorId) {
                        await tx.guardSupervisorAssignment.create({
                            data: {
                                guardId: newGuard.id,
                                supervisorId,
                                status: "ACTIVE",
                            },
                        })
                    }

                    return newGuard
                })

                // Record service history event
                void recordGuardServiceEvent({
                    cnic: guard.cnic,
                    guardId: guard.id,
                    parwestId: guard.parwestId,
                    guardName: guard.name,
                    event: "ENROLLED",
                    toStatus: guard.status,
                    description: `Guard enrolled with Parwest ID ${guard.parwestId}`,
                    changedByName: session.user?.name ?? session.user?.email ?? null,
                    regionName,
                    officeName,
                })

                // Record initial status in status history
                void recordGuardStatusChange({
                    guardId: guard.id,
                    cnic: guard.cnic,
                    parwestId: guard.parwestId,
                    guardName: guard.name,
                    fromStatus: null,
                    toStatus: guard.status,
                    reason: "Guard enrolled in the system",
                    changedByName: session.user?.name ?? session.user?.email ?? null,
                    changedByType: "ENROLLMENT",
                    regionName,
                    officeName,
                })

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
