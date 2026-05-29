import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import { badRequest, conflict, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { resolveExServiceType } from "@/lib/guards/employmentType"
import { validateGuardPayload, normalizeGuardPhone } from "@/lib/guards/validate-payload"
import { cnicAvailability } from "@/lib/guards/cnic"
import { applyTransition, canTransition, ActiveDeploymentTransitionError, LIFECYCLE_STATUSES, type LifecycleStatus } from "@/lib/guards/lifecycle"

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }
        if (!hasAction(session, "GUARDS", "UPDATE")) return forbidden("Access denied.")
        const managerScope = deriveManagerScope(session)

        const { id } = await params
        const body = await request.json()
        const nextCnic = body?.cnic ? String(body.cnic).trim() : ""
        if (nextCnic && !/^\d{5}-\d{7}-\d$/.test(nextCnic)) {
            return badRequest("CNIC format must be XXXXX-XXXXXXX-X.")
        }
        // Phone fields are normalised toward the canonical +92-XXX-XXXXXXX form
        // BEFORE validation + storage so edits converge on one format with the
        // create + import paths.
        const normalizedPhone = normalizeGuardPhone(body?.phone)
        // Unified guard-field validation — UPDATE mode (format checks only; an
        // edit may legitimately touch a single field). Shares the same validator
        // (and date/age + education-year primitives) with POST /api/guards and
        // bulk import so the write paths cannot drift on what they enforce.
        const payloadError = validateGuardPayload(
            {
                cnic: nextCnic || null,
                phone: normalizedPhone || (body?.phone ? String(body.phone) : null),
                dateOfBirth: body?.dateOfBirth ? String(body.dateOfBirth) : null,
                cnicIssueDate: body?.cnicIssueDate ? String(body.cnicIssueDate) : null,
                cnicExpiryDate: body?.cnicExpiryDate ? String(body.cnicExpiryDate) : null,
                passingYear: body?.passingYear ?? null,
            },
            "update",
        )
        if (payloadError) {
            return badRequest(payloadError.message)
        }

        // Check if guard exists
        const existingGuard = await prisma.guard.findUnique({
            where: { id },
        })

        if (!existingGuard) {
            return notFound("Guard not found")
        }
        if (managerScope && managerScopeDenied(managerScope, { regionId: existingGuard.regionId, regionalOfficeId: existingGuard.regionalOfficeId })) {
            return forbidden("Forbidden: guard is outside your scope.")
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
            return forbidden("Forbidden: cannot move guard outside your scope.")
        }

        // Check CNIC availability (excluding current guard). Shares the
        // terminated-profile re-enrollment model with POST and check-cnic via
        // cnicAvailability: a non-terminated OTHER profile blocks, but a CNIC
        // belonging only to a terminated profile is available (PUT previously
        // over-rejected those by blocking on ANY other row regardless of
        // lifecycle).
        if (nextCnic && nextCnic !== existingGuard.cnic) {
            const availability = await cnicAvailability(prisma, nextCnic, { excludeGuardId: id })
            if (availability.blockedByActiveProfile) {
                return badRequest("A guard with this CNIC already exists")
            }

            try {
                const blocked = await prisma.blacklistedCnic.findUnique({
                    where: { cnic: nextCnic },
                    select: { id: true },
                })
                if (blocked) {
                    return forbidden("This CNIC is blacklisted and cannot be assigned to a guard profile.")
                }
            } catch (error) {
                if (!isPrismaMissingSchemaError(error)) throw error
            }
        }

        // Parse previousEmployments JSON array if provided
        type PreviousEmploymentEntry = { type?: string; isExService?: boolean; rank?: string; registrationNo?: string; unit?: string }
        let parsedPreviousEmployments: PreviousEmploymentEntry[] = []
        if (body.previousEmploymentsJson) {
            try {
                parsedPreviousEmployments = JSON.parse(String(body.previousEmploymentsJson))
            } catch { /* ignore */ }
        }

        // Guard Employment Type — derivation (explicit + fallback branches) is
        // shared with POST via resolveExServiceType so null-vs-"CIVILIAN" can no
        // longer diverge between create and edit. The fallback now ALWAYS lands
        // on a concrete string (never null), matching create.
        const exService = await resolveExServiceType({
            explicitType: body.exServiceType,
            rows: parsedPreviousEmployments,
            legacyIsExService: body.isExService,
        })
        if (!exService.ok) return badRequest(exService.message)
        const nextExServiceType: string = exService.exServiceType
        const nextIsExService: boolean = exService.isExService
        const primaryExService = parsedPreviousEmployments.find((e) => e.type === nextExServiceType) ?? parsedPreviousEmployments.find((e) => e.isExService === true)

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

        // Lifecycle transition guard — Bug #38.
        // The form now binds to canonical `lifecycleStatus`. Direct writes to
        // the legacy `status` shadow are rejected here; the transition (if any)
        // is applied through `applyTransition` which:
        //   - validates the transition against ALLOWED_TRANSITIONS,
        //   - dual-writes the legacy `status` shadow consistently,
        //   - revokes active deployments for INACTIVE/TERMINATED,
        //   - writes a GuardStatusHistory row,
        // all atomically. TERMINATED is rejected here because it requires a
        // `terminationReason` and goes through a dedicated termination flow.
        const requestedLifecycle = body?.lifecycleStatus
            ? String(body.lifecycleStatus).toUpperCase()
            : null
        let pendingTransition: LifecycleStatus | null = null
        if (requestedLifecycle) {
            if (!(LIFECYCLE_STATUSES as readonly string[]).includes(requestedLifecycle)) {
                return badRequest(`Invalid lifecycleStatus: ${requestedLifecycle}.`)
            }
            const next = requestedLifecycle as LifecycleStatus
            const current = existingGuard.lifecycleStatus as LifecycleStatus
            if (next === "TERMINATED" && current !== "TERMINATED") {
                return badRequest(
                    "Termination must go through the dedicated termination flow (requires a reason).",
                )
            }
            if (next !== current) {
                const check = canTransition(current, next)
                if (!check.ok) return badRequest(check.reason)
                pendingTransition = next
            }
        }

        // Update guard + (optional) lifecycle transition atomically.
        const guard = await prisma.$transaction(async (tx) => {
            const updated = await tx.guard.update({
            where: { id },
            data: {
                name: body.name,
                cnic: nextCnic || existingGuard.cnic,
                phone: normalizedPhone || body.phone || null,
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
                isExService: nextIsExService,
                exServiceType: nextExServiceType,
                exServiceRank: primaryExService?.rank || body.exServiceRank || null,
                exServiceRegistrationNo: primaryExService?.registrationNo || body.exServiceRegistrationNo || null,
                exServiceUnit: primaryExService?.unit || body.exServiceUnit || null,
                exServiceRegiment: body.exServiceRegiment || null,
                previousEmploymentsJson: parsedPreviousEmployments.length > 0 ? JSON.stringify(parsedPreviousEmployments) : (body.previousEmploymentsJson || null),
                bankName: activeAccount?.bankName || body.bankName || null,
                bankAccountNumber: activeAccount?.accountNumber || body.bankAccountNumber || null,
                bankAccountType: activeAccount?.accountType || body.bankAccountType || null,
                bankIban: activeAccount?.iban || body.bankIban || null,
                bankBranchCode: activeAccount?.branchCode || body.bankBranchCode || null,
                bankAccountsJson: parsedBankAccounts.length > 0 ? JSON.stringify(parsedBankAccounts) : undefined,
                motherName: body.motherName || null,
                nationality: body.nationality || null,
                nextOfKin: body.nextOfKin || null,
                profileIntroducer: body.profileIntroducer || null,
                additionalContactNumbers: body.additionalContactNumbers || null,
                nearestRelativesJson: body.nearestRelativesJson || null,
                familyMembersJson: (() => {
                    if (body.familyMembersJson === undefined || body.familyMembersJson === null) return undefined
                    const raw = String(body.familyMembersJson || "").trim()
                    if (!raw) return null
                    try {
                        const parsed = JSON.parse(raw)
                        if (!Array.isArray(parsed)) return null
                        const cleaned = parsed
                            .filter((m) => m && typeof m === "object")
                            .map((m: Record<string, unknown>) => {
                                const out: Record<string, string> = {}
                                for (const f of ["name", "relation", "age", "profession", "address", "childCnic", "childAge", "childDob"]) {
                                    const v = String(m[f] ?? "").trim()
                                    if (v) out[f] = v
                                }
                                return out
                            })
                            .filter((m) => Object.keys(m).length > 0)
                        return cleaned.length > 0 ? JSON.stringify(cleaned) : null
                    } catch {
                        return null
                    }
                })(),
            },
            })

            // Supervisor assignment change — kept inside the same transaction
            // so the swap is atomic with the field update.
            if (body.supervisorId !== undefined) {
                const newSupervisorId = body.supervisorId ? String(body.supervisorId) : null
                await tx.guardSupervisorAssignment.updateMany({
                    where: { guardId: id, status: "ACTIVE" },
                    data: { status: "ENDED", endedAt: new Date() },
                })
                if (newSupervisorId) {
                    await tx.guardSupervisorAssignment.create({
                        data: {
                            guardId: id,
                            supervisorId: newSupervisorId,
                            status: "ACTIVE",
                            assignedAt: new Date(),
                        },
                    })
                }
            }

            // Lifecycle transition (if requested). applyTransition writes the
            // canonical lifecycleStatus, the legacy `status` shadow, the
            // history row, and (when needed) revokes active deployments.
            if (pendingTransition) {
                await applyTransition(tx, {
                    guardId: id,
                    to: pendingTransition,
                    ctx: {
                        actorId: session.user?.id ?? null,
                        actorName: session.user?.name ?? null,
                        trigger: "MANUAL",
                    },
                })
                // Re-read so the response reflects the new status + shadow.
                const refreshed = await tx.guard.findUnique({ where: { id } })
                if (refreshed) return refreshed
            }

            return updated
        })

        return NextResponse.json(guard, { status: 200 })
    } catch (error: unknown) {
        // A lifecycle transition for a guard who still holds an active deployment
        // is a client error (409), not a server fault — the precondition is
        // centralized in applyTransition (lifecycle.ts). Mirror the /status route.
        if (error instanceof ActiveDeploymentTransitionError) {
            return conflict("Cannot change guard status while the guard has an active deployment. End the deployment first.")
        }
        console.error("Error updating guard:", error)
        return internalServerError("Failed to update guard")
    }
}
