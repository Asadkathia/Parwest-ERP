import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"
import { mockGuardsList } from "@/lib/mockData/guards"
import { applyManagerScope, buildManagerScopeWhere, deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import { badRequest, forbidden, internalServerError, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { recordGuardServiceEvent } from "@/lib/guards/service-history"
import { resolveExServiceType } from "@/lib/guards/employmentType"
import { validateGuardPayload, normalizeGuardPhone } from "@/lib/guards/validate-payload"
import { cnicAvailability, CNIC_ACTIVE_PROFILE_MESSAGE } from "@/lib/guards/cnic"
import { buildGuardCreatePayload } from "@/lib/guards/build-payload"
import { generateNextParwestId } from "@/lib/guards/parwest-id"
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
        // Phone fields are normalised toward the canonical +92-XXX-XXXXXXX form
        // BEFORE validation + storage so every write path persists one format.
        const normalizedPhone = normalizeGuardPhone(body?.phone)
        const normalizedPermanentContact = normalizeGuardPhone(body?.permanentAddressContact)
        const normalizedCurrentContact = normalizeGuardPhone(body?.currentAddressContact)
        const normalizedIntroducerContact = normalizeGuardPhone(body?.introducerContact)
        // Unified guard-field validation (phone format, required core,
        // education-year > DOB, and the shared date/age rules) — the SAME
        // validator the edit API and bulk import delegate to, so the three
        // write paths cannot drift on what they enforce.
        const payloadError = validateGuardPayload(
            {
                name: body?.name ? String(body.name) : null,
                cnic,
                phone: normalizedPhone || (body?.phone ? String(body.phone) : null),
                permanentAddressContact: normalizedPermanentContact || (body?.permanentAddressContact ? String(body.permanentAddressContact) : null),
                currentAddressContact: normalizedCurrentContact || (body?.currentAddressContact ? String(body.currentAddressContact) : null),
                introducerContact: normalizedIntroducerContact || (body?.introducerContact ? String(body.introducerContact) : null),
                introducerCnic: body?.introducerCnic ? String(body.introducerCnic) : null,
                dateOfBirth: body?.dateOfBirth ? String(body.dateOfBirth) : null,
                cnicIssueDate: body?.cnicIssueDate ? String(body.cnicIssueDate) : null,
                cnicExpiryDate: body?.cnicExpiryDate ? String(body.cnicExpiryDate) : null,
                passingYear: body?.passingYear ?? null,
            },
            "create",
        )
        if (payloadError) {
            return badRequest(payloadError.message)
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

        // CNIC re-enrollment gate (new-profile model) — shared with PUT and
        // check-cnic via cnicAvailability so the partial-unique / terminated-
        // profile rule lives in one place. A non-terminated most-recent profile
        // blocks; a terminated one (or none) falls through to a BRAND-NEW row.
        const availability = await cnicAvailability(prisma, cnic)
        if (availability.blockedByActiveProfile) {
            return badRequest(CNIC_ACTIVE_PROFILE_MESSAGE)
        }

        // parwest id generation is shared with the bulk-import path via
        // src/lib/guards/parwest-id.ts — see that module for the bug-fix
        // history (lexical interference between RO-prefixed and bare PW-).

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

        // Parse previousEmploymentsJson if provided (new multi-entry format)
        type PrevEmpEntry = { type?: string; isExService?: boolean; rank?: string; registrationNo?: string; unit?: string; years?: string; months?: string; dateOfEnrollment?: string; dateOfDischarge?: string; remarks?: string }
        let parsedPrevEmployments: PrevEmpEntry[] = []
        if (body.previousEmploymentsJson) {
            try { parsedPrevEmployments = JSON.parse(String(body.previousEmploymentsJson)) } catch { /* ignore */ }
        }

        // Guard Employment Type — derivation (explicit + fallback branches) is
        // shared with PUT via resolveExServiceType so null-vs-"CIVILIAN" can no
        // longer diverge between create and edit.
        const exService = await resolveExServiceType({
            explicitType: body.exServiceType,
            rows: parsedPrevEmployments,
            legacyIsExService: body.isExService,
        })
        if (!exService.ok) return badRequest(exService.message)
        const exServiceType = exService.exServiceType
        const isExService = exService.isExService

        // Overlay the canonical phone forms so the persisted columns match what
        // was validated (build-payload reads these keys off `flat`).
        const flatPayload: Record<string, unknown> = { ...(body as Record<string, unknown>) }
        if (normalizedPhone) flatPayload.phone = normalizedPhone
        if (normalizedPermanentContact) flatPayload.permanentAddressContact = normalizedPermanentContact
        if (normalizedCurrentContact) flatPayload.currentAddressContact = normalizedCurrentContact
        if (normalizedIntroducerContact) flatPayload.introducerContact = normalizedIntroducerContact

        const createGuardPayload = (parwestId: string) =>
            buildGuardCreatePayload({
                parwestId,
                name: String(body.name ?? ""),
                cnic,
                bodyRegionId,
                bodyRegionalOfficeId,
                flat: flatPayload,
                nearestRelatives,
                familyMembers,
                previousEmployments: parsedPrevEmployments,
                bankAccounts: parsedBankAccounts,
                exServiceType,
                isExService,
            })

        // Check age against configured limits
        const ageParsed = parseInt(String(body.age || ""), 10)
        const guardAge = Number.isFinite(ageParsed) ? ageParsed : null
        const str = (v: unknown) => (v ? String(v).trim() || null : null)
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

        const supervisorId = str(body.supervisorId)

        let lastCreateError: unknown = null
        for (let attempt = 0; attempt < 3; attempt++) {
            const parwestId = await generateNextParwestId(prisma, officeSeriesCode)
            try {
                const payload = {
                    ...createGuardPayload(parwestId),
                    ageApprovalRequired,
                    ageApprovalStatus: ageApprovalRequired ? "PENDING" : null,
                }

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

                    // Seed the initial status-history row INSIDE the create
                    // transaction (atomic, same durability guarantee as the
                    // lifecycle-transition writes in applyTransition). This
                    // replaces the previous fire-and-forget recordGuardStatusChange
                    // for the initial enrollment row, which could silently lose
                    // the audit row on failure.
                    await tx.guardStatusHistory.create({
                        data: {
                            guardId: newGuard.id,
                            cnic: newGuard.cnic,
                            parwestId: newGuard.parwestId,
                            guardName: newGuard.name,
                            fromStatus: null,
                            toStatus: newGuard.status,
                            reason: "Guard enrolled in the system",
                            changedByName: session.user?.name ?? session.user?.email ?? null,
                            changedByType: "ENROLLMENT",
                            regionName,
                            officeName,
                        },
                    })

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

                // (Initial status-history row is now written atomically inside
                // the create transaction above.)

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
