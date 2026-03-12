import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }
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
                isExService: body.isExService === "true" || body.isExService === true,
                exServiceRank: body.exServiceRank || null,
                exServiceRegiment: body.exServiceRegiment || null,
                bankName: activeAccount?.bankName || body.bankName || null,
                bankAccountNumber: activeAccount?.accountNumber || body.bankAccountNumber || null,
                bankAccountType: activeAccount?.accountType || body.bankAccountType || null,
                bankIban: activeAccount?.iban || body.bankIban || null,
                bankBranchCode: activeAccount?.branchCode || body.bankBranchCode || null,
                bankAccountsJson: parsedBankAccounts.length > 0 ? JSON.stringify(parsedBankAccounts) : undefined,
            },
        })

        return NextResponse.json(guard, { status: 200 })
    } catch (error: unknown) {
        console.error("Error updating guard:", error)
        return internalServerError("Failed to update guard")
    }
}
