import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { isMockEnabled } from "@/lib/mockData"
import { mockDeploymentsList } from "@/lib/mockData/deployments"
import { applyManagerScope, buildManagerScopeWhere, deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, conflict, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { isWorkflowRuleEnabled } from "@/lib/workflows/policy"

function parseOptionalNumber(value: unknown) {
    if (value === undefined) return undefined
    if (value === null || value === "") return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
}

function isValidShiftType(value: string) {
    return value === "DAY" || value === "NIGHT" || value === "BOTH"
}

export async function GET() {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }
        const managerScope = deriveManagerScope(session)

        if (isMockEnabled()) {
            return NextResponse.json(
                applyManagerScope(mockDeploymentsList, managerScope, {
                    regionalOfficeId: (row) => {
                        const scoped = row as { regionalOfficeId?: string | null }
                        return scoped.regionalOfficeId ?? null
                    },
                }).map((row) => ({
                    ...row,
                    deploymentDate: new Date(row.deploymentDate),
                }))
            )
        }

        const deployments = await prisma.deployment.findMany({
            where: buildManagerScopeWhere(managerScope, { regionalOfficeId: "regionalOfficeId" }),
            orderBy: { createdAt: "desc" },
            include: {
                guard: true,
                client: true,
                branch: true,
                regionalOffice: true,
            },
        })

        return NextResponse.json(deployments)
    } catch (error: unknown) {
        console.error("Error fetching deployments:", error)
        return internalServerError("Failed to fetch deployments")
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
        const guardId = String(body?.guardId || "").trim()
        const clientId = String(body?.clientId || "").trim()
        const branchId = body?.branchId ? String(body.branchId).trim() : null
        const regionalOfficeId = String(body?.regionalOfficeId || "").trim()
        const deploymentDateRaw = String(body?.deploymentDate || "").trim()
        const deploymentDate = new Date(deploymentDateRaw)
        const designation = body?.designation ? String(body.designation).trim() : "Security Guard"
        const shiftType = body?.shiftType ? String(body.shiftType).trim().toUpperCase() : "DAY"
        const bodyRegionalOfficeId = regionalOfficeId || null

        if (!guardId || !clientId || !regionalOfficeId || !deploymentDateRaw) {
            return badRequest("guardId, clientId, regionalOfficeId, and deploymentDate are required.")
        }
        if (Number.isNaN(deploymentDate.getTime())) {
            return badRequest("Invalid deploymentDate value.")
        }
        if (!isValidShiftType(shiftType)) {
            return badRequest("shiftType must be DAY, NIGHT, or BOTH.")
        }

        if (managerScope && managerScopeDenied(managerScope, { regionalOfficeId: bodyRegionalOfficeId })) {
            return forbidden("Forbidden: cannot create deployment outside your scope.")
        }

        if (isMockEnabled()) {
            const mockDeployment = {
                id: `mock-deploy-${Date.now()}`,
                guardId,
                clientId,
                branchId,
                regionalOfficeId,
                deploymentDate,
                designation,
                shiftType,
                rate: parseOptionalNumber(body?.rate) ?? null,
                status: "ACTIVE",
                notes: body.notes || null,
                guardType: body.guardType || null,
                salary: parseOptionalNumber(body?.salary) ?? null,
                overtime: parseOptionalNumber(body?.overtime) ?? null,
                extraHours: parseOptionalNumber(body?.extraHours) ?? null,
                postAllowance: parseOptionalNumber(body?.postAllowance) ?? null,
                dayShiftStart: body.dayShiftStart || null,
                dayShiftEnd: body.dayShiftEnd || null,
                nightShiftStart: body.nightShiftStart || null,
                nightShiftEnd: body.nightShiftEnd || null,
                deploymentType: body.deploymentType || "REGULAR",
                isExtraGuard: body.isExtraGuard === "on" || body.isExtraGuard === true,
                comment: body.comment || null,
            }
            return NextResponse.json(mockDeployment, { status: 201 })
        }

        const [guard, client, office, branch] = await Promise.all([
            prisma.guard.findUnique({ where: { id: guardId }, select: { id: true, status: true, regionalOfficeId: true } }),
            prisma.client.findUnique({ where: { id: clientId }, select: { id: true } }),
            prisma.regionalOffice.findUnique({ where: { id: regionalOfficeId }, select: { id: true } }),
            branchId
                ? prisma.branch.findUnique({
                    where: { id: branchId },
                    select: { id: true, clientId: true },
                })
                : Promise.resolve(null),
        ])

        if (!guard) return notFound("Guard not found.")
        if (isWorkflowRuleEnabled("deployments.requireActiveGuardStatus") && String(guard.status) !== "ACTIVE") {
            return conflict("Only ACTIVE guards can be deployed.")
        }
        if (
            isWorkflowRuleEnabled("deployments.requireGuardOfficeConsistency") &&
            guard.regionalOfficeId &&
            guard.regionalOfficeId !== regionalOfficeId
        ) {
            return badRequest("Guard regional office does not match deployment regional office.")
        }
        if (!client) return notFound("Client not found.")
        if (!office) return notFound("Regional office not found.")
        if (branchId && !branch) return notFound("Branch not found.")
        if (branch && branch.clientId !== clientId) {
            return badRequest("Branch does not belong to the selected client.")
        }

        if (isWorkflowRuleEnabled("deployments.singleActivePerGuard")) {
            // Guard can only have one active deployment at a time.
            const existingDeployment = await prisma.deployment.findFirst({
                where: {
                    guardId,
                    status: "ACTIVE",
                },
                select: { id: true },
            })

            if (existingDeployment) {
                return conflict("This guard already has an active deployment.")
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

        const data: Prisma.DeploymentUncheckedCreateInput = {
            guardId,
            clientId,
            branchId,
            regionalOfficeId,
            deploymentDate,
            designation,
            shiftType,
            rate: numericRate ?? null,
            status: "ACTIVE",
            notes: body.notes ? String(body.notes) : null,
            guardType: body.guardType ? String(body.guardType) : null,
            salary: numericSalary ?? null,
            overtime: numericOvertime ?? null,
            extraHours: numericExtraHours ?? null,
            postAllowance: numericPostAllowance ?? null,
            dayShiftStart: body.dayShiftStart ? String(body.dayShiftStart) : null,
            dayShiftEnd: body.dayShiftEnd ? String(body.dayShiftEnd) : null,
            nightShiftStart: body.nightShiftStart ? String(body.nightShiftStart) : null,
            nightShiftEnd: body.nightShiftEnd ? String(body.nightShiftEnd) : null,
            deploymentType: body.deploymentType ? String(body.deploymentType) : "REGULAR",
            isExtraGuard: body.isExtraGuard === "on" || body.isExtraGuard === true,
            comment: body.comment ? String(body.comment) : null,
        }

        const deployment = await prisma.deployment.create({
            data,
            include: {
                guard: true,
                client: true,
                branch: true,
                regionalOffice: true,
            },
        })

        return NextResponse.json(deployment, { status: 201 })
    } catch (error: unknown) {
        console.error("Error creating deployment:", error)
        return internalServerError("Failed to create deployment")
    }
}
