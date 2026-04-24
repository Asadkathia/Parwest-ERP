import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { validateGuardEmploymentType } from "@/lib/guards/employmentType"

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

        // Check CNIC uniqueness (excluding current guard)
        if (nextCnic && nextCnic !== existingGuard.cnic) {
            const cnicExists = await prisma.guard.findFirst({
                where: {
                    cnic: nextCnic,
                    id: { not: id },
                },
            })

            if (cnicExists) {
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

        // Guard Employment Type — explicit body value is authoritative; fall back
        // to row-derivation for legacy clients that don't send the new field.
        const explicitExServiceType = body.exServiceType ? String(body.exServiceType).trim() : ""
        let nextIsExService: boolean
        let nextExServiceType: string | null
        if (explicitExServiceType) {
            const v = await validateGuardEmploymentType(explicitExServiceType, parsedPreviousEmployments)
            if (!v.ok) return badRequest(v.message)
            nextExServiceType = v.exServiceType
            nextIsExService = v.isExService
        } else {
            const derivedIsExService = parsedPreviousEmployments.some((e) => e.isExService === true)
            const primary = parsedPreviousEmployments.find((e) => e.isExService === true)
            nextExServiceType = primary?.type ?? (derivedIsExService ? null : "CIVILIAN")
            nextIsExService = parsedPreviousEmployments.length > 0
                ? derivedIsExService
                : (body.isExService === "true" || body.isExService === true)
        }
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
            },
        })

        // Handle supervisor assignment change
        if (body.supervisorId !== undefined) {
            const newSupervisorId = body.supervisorId ? String(body.supervisorId) : null

            // End all current active assignments for this guard
            await prisma.guardSupervisorAssignment.updateMany({
                where: { guardId: id, status: "ACTIVE" },
                data: { status: "ENDED", endedAt: new Date() },
            })

            // Create new assignment if a supervisor was selected
            if (newSupervisorId) {
                await prisma.guardSupervisorAssignment.create({
                    data: {
                        guardId: id,
                        supervisorId: newSupervisorId,
                        status: "ACTIVE",
                        assignedAt: new Date(),
                    },
                })
            }
        }

        return NextResponse.json(guard, { status: 200 })
    } catch (error: unknown) {
        console.error("Error updating guard:", error)
        return internalServerError("Failed to update guard")
    }
}
