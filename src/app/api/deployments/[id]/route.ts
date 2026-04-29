import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, conflict, forbidden, internalServerError, notFound, ok, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { isWorkflowRuleEnabled } from "@/lib/workflows/policy"
import { syncLegacyStatus } from "@/lib/guards/lifecycle"

// See `src/app/api/deployments/route.ts` — `Deployment.deploymentType` is a
// free string in Prisma; constrain it via zod here too.
const deploymentTypeSchema = z.enum(["REGULAR", "OVERTIME", "EXTRA"])

function parseOptionalNumber(value: unknown) {
    if (value === undefined) return undefined
    if (value === null || value === "") return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
}

function isValidShiftType(value: string) {
    return value === "DAY" || value === "NIGHT" || value === "BOTH"
}

export async function PATCH(
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

        const existing = await prisma.deployment.findUnique({
            where: { id },
            select: { id: true, status: true, guardId: true, regionalOfficeId: true, clientId: true, endDate: true },
        })
        if (!existing) {
            return notFound("Deployment not found")
        }

        if (isWorkflowRuleEnabled("deployments.lockAfterEnd") && existing.endDate) {
            return conflict("Deployment is ended and cannot be modified.")
        }

        if (isWorkflowRuleEnabled("deployments.blockInactiveUpdate") && existing.status !== "ACTIVE") {
            return conflict("Cannot update an inactive deployment.")
        }

        if (managerScope && managerScopeDenied(managerScope, { regionalOfficeId: existing.regionalOfficeId })) {
            return forbidden("Forbidden: deployment is outside your scope.")
        }

        if (body?.status != null && String(body.status) !== "ACTIVE") {
            return badRequest("Use /api/deployments/[id]/end to end a deployment.")
        }

        const bodyRegionalOfficeId = body?.regionalOfficeId ? String(body.regionalOfficeId).trim() : null
        if (managerScope && managerScopeDenied(managerScope, { regionalOfficeId: bodyRegionalOfficeId })) {
            return forbidden("Forbidden: cannot move deployment outside your scope.")
        }

        // If guardId is being changed, validate the new guard is in the requester's scope
        if (body.guardId && body.guardId !== existing.guardId) {
            const newGuard = await prisma.guard.findUnique({
                where: { id: String(body.guardId) },
                select: { id: true, regionId: true, regionalOfficeId: true },
            })
            if (!newGuard) return notFound("Target guard not found.")
            if (managerScope && managerScopeDenied(managerScope, {
                regionId: newGuard.regionId,
                regionalOfficeId: newGuard.regionalOfficeId,
            })) {
                return forbidden("Cannot assign deployment to a guard outside your scope.")
            }
        }

        const patchGuardId = body?.guardId ? String(body.guardId).trim() : undefined
        const patchClientId = body?.clientId ? String(body.clientId).trim() : undefined
        const patchBranchId = body?.branchId === null ? null : (body?.branchId ? String(body.branchId).trim() : undefined)
        const patchRegionalOfficeId = body?.regionalOfficeId ? String(body.regionalOfficeId).trim() : undefined
        const patchDeploymentDateRaw = body?.deploymentDate ? String(body.deploymentDate).trim() : undefined
        const patchShiftType = body?.shiftType ? String(body.shiftType).trim().toUpperCase() : undefined

        if (patchShiftType && !isValidShiftType(patchShiftType)) {
            return badRequest("shiftType must be DAY, NIGHT, or BOTH.")
        }

        let parsedDeploymentDate: Date | undefined
        if (patchDeploymentDateRaw) {
            parsedDeploymentDate = new Date(patchDeploymentDateRaw)
            if (Number.isNaN(parsedDeploymentDate.getTime())) {
                return badRequest("Invalid deploymentDate value.")
            }
            const endOfToday = new Date()
            endOfToday.setHours(23, 59, 59, 999)
            if (parsedDeploymentDate.getTime() > endOfToday.getTime()) {
                return badRequest("Deployment date cannot be in the future.")
            }
            if (existing.endDate && parsedDeploymentDate > existing.endDate) {
                return badRequest("deploymentDate cannot be after endDate.")
            }
        }

        if (patchGuardId) {
            const guard = await prisma.guard.findUnique({
                where: { id: patchGuardId },
                select: { id: true, lifecycleStatus: true, regionalOfficeId: true },
            })
            if (!guard) return notFound("Guard not found.")
            if (isWorkflowRuleEnabled("deployments.requireActiveGuardStatus") && guard.lifecycleStatus !== "ACTIVE") {
                return conflict("Only ACTIVE lifecycle guards can be deployed.")
            }

            if (isWorkflowRuleEnabled("deployments.singleActivePerGuard")) {
                const existingDeployment = await prisma.deployment.findFirst({
                    where: {
                        guardId: patchGuardId,
                        status: "ACTIVE",
                        id: { not: id }, // Exclude current deployment
                    },
                    select: { id: true },
                })

                if (existingDeployment) {
                    return conflict("This guard already has an active deployment.")
                }
            }
        }

        if (isWorkflowRuleEnabled("deployments.requireGuardOfficeConsistency")) {
            const effectiveGuardId = patchGuardId ?? existing.guardId
            const effectiveRegionalOfficeId = patchRegionalOfficeId ?? existing.regionalOfficeId
            const effectiveGuard = await prisma.guard.findUnique({
                where: { id: effectiveGuardId },
                select: { id: true, regionalOfficeId: true },
            })
            if (!effectiveGuard) return notFound("Guard not found.")
            if (effectiveGuard.regionalOfficeId && effectiveGuard.regionalOfficeId !== effectiveRegionalOfficeId) {
                return badRequest("Guard regional office does not match deployment regional office.")
            }
        }

        const finalClientId = patchClientId ?? existing.clientId
        if (patchClientId) {
            const client = await prisma.client.findUnique({ where: { id: patchClientId }, select: { id: true } })
            if (!client) return notFound("Client not found.")
        }

        if (patchRegionalOfficeId) {
            const office = await prisma.regionalOffice.findUnique({ where: { id: patchRegionalOfficeId }, select: { id: true } })
            if (!office) return notFound("Regional office not found.")
        }

        if (patchBranchId !== undefined && patchBranchId !== null) {
            const branch = await prisma.branch.findUnique({
                where: { id: patchBranchId },
                select: { id: true, clientId: true },
            })
            if (!branch) return notFound("Branch not found.")
            if (branch.clientId !== finalClientId) {
                return badRequest("Branch does not belong to the selected client.")
            }
        }

        const numericRate = parseOptionalNumber(body?.rate)
        const numericSalary = parseOptionalNumber(body?.salary)
        const numericOvertime = parseOptionalNumber(body?.overtime)
        const numericExtraHours = parseOptionalNumber(body?.extraHours)
        const numericPostAllowance = parseOptionalNumber(body?.postAllowance)
        if (
            numericRate === undefined ||
            numericSalary === undefined ||
            numericOvertime === undefined ||
            numericExtraHours === undefined ||
            numericPostAllowance === undefined
        ) {
            return badRequest("Numeric fields contain invalid values.")
        }

        const data: Prisma.DeploymentUncheckedUpdateInput = {}
        if (patchGuardId !== undefined) data.guardId = patchGuardId
        if (patchClientId !== undefined) data.clientId = patchClientId
        if (patchBranchId !== undefined) data.branchId = patchBranchId
        if (patchRegionalOfficeId !== undefined) data.regionalOfficeId = patchRegionalOfficeId
        if (parsedDeploymentDate !== undefined) data.deploymentDate = parsedDeploymentDate
        if (body?.designation !== undefined) {
            const designation = String(body.designation || "").trim()
            if (!designation) {
                return badRequest("designation cannot be empty.")
            }
            data.designation = designation
        }
        if (patchShiftType !== undefined) data.shiftType = patchShiftType
        if (numericRate !== undefined) data.rate = numericRate
        if (body?.notes !== undefined) data.notes = body.notes ? String(body.notes) : null
        if (body?.guardType !== undefined) data.guardType = body.guardType ? String(body.guardType) : null
        if (numericSalary !== undefined) data.salary = numericSalary
        if (numericOvertime !== undefined) data.overtime = numericOvertime
        if (numericExtraHours !== undefined) data.extraHours = numericExtraHours
        if (numericPostAllowance !== undefined) data.postAllowance = numericPostAllowance
        if (body?.dayShiftStart !== undefined) data.dayShiftStart = body.dayShiftStart ? String(body.dayShiftStart) : null
        if (body?.dayShiftEnd !== undefined) data.dayShiftEnd = body.dayShiftEnd ? String(body.dayShiftEnd) : null
        if (body?.nightShiftStart !== undefined) data.nightShiftStart = body.nightShiftStart ? String(body.nightShiftStart) : null
        if (body?.nightShiftEnd !== undefined) data.nightShiftEnd = body.nightShiftEnd ? String(body.nightShiftEnd) : null
        if (body?.deploymentType !== undefined) {
            // Validate against the allowed enum + workflow gate the EXTRA value.
            if (body.deploymentType === null || body.deploymentType === "") {
                data.deploymentType = null
            } else {
                const parsed = deploymentTypeSchema.safeParse(String(body.deploymentType).toUpperCase())
                if (!parsed.success) {
                    return badRequest("deploymentType must be one of REGULAR, OVERTIME, EXTRA.")
                }
                if (parsed.data === "EXTRA" && !isWorkflowRuleEnabled("deployments.allowExtraType")) {
                    return forbidden("Extra deployments are disabled by workflow policy.")
                }
                data.deploymentType = parsed.data
                // Defensive sync: when type becomes EXTRA, force the legacy
                // `isExtraGuard` boolean to true and the nature to TEMPORARY.
                // The boolean is deprecated; the type is the source of truth.
                if (parsed.data === "EXTRA") {
                    data.isExtraGuard = true
                    data.deploymentNature = "TEMPORARY"
                }
            }
        }
        if (body?.isExtraGuard !== undefined && data.isExtraGuard === undefined) {
            data.isExtraGuard = body.isExtraGuard === "on" || body.isExtraGuard === true
        }
        if (body?.comment !== undefined) data.comment = body.comment ? String(body.comment) : null

        if (Object.keys(data).length === 0) {
            return badRequest("No valid fields provided for update.")
        }

        const deployment = await prisma.deployment.update({
            where: { id },
            data,
            include: {
                guard: true,
                client: true,
                branch: true,
                regionalOffice: true,
            },
        })

        // Recompute legacy status shadow for affected guard(s)
        await syncLegacyStatus(prisma, deployment.guardId)
        if (patchGuardId && patchGuardId !== existing.guardId) {
            await syncLegacyStatus(prisma, existing.guardId)
        }

        return NextResponse.json(deployment, { status: 200 })
    } catch (error: unknown) {
        console.error("Error updating deployment:", error)
        return internalServerError("Failed to update deployment")
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }
        if (!hasAction(session, "GUARDS", "DELETE")) return forbidden("Access denied.")
        const managerScope = deriveManagerScope(session)

        const { id } = await params

        const existing = await prisma.deployment.findUnique({
            where: { id },
            select: { id: true, status: true, regionalOfficeId: true, guardId: true },
        })
        if (!existing) {
            return notFound("Deployment not found")
        }
        if (managerScope && managerScopeDenied(managerScope, { regionalOfficeId: existing.regionalOfficeId })) {
            return forbidden("Forbidden: deployment is outside your scope.")
        }
        if (
            isWorkflowRuleEnabled("deployments.blockInactiveUpdate") &&
            existing.status !== "ACTIVE"
        ) {
            return conflict("Deployment is already ended.")
        }

        // Soft delete - set status to INACTIVE and add end date
        const deployment = await prisma.deployment.update({
            where: { id },
            data: {
                status: "INACTIVE",
                endDate: new Date(),
            },
        })

        await syncLegacyStatus(prisma, existing.guardId)

        return ok({ message: "Deployment ended successfully", deployment })
    } catch (error: unknown) {
        console.error("Error ending deployment:", error)
        return internalServerError("Failed to end deployment")
    }
}
