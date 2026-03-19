import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"
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

        if (isRuntimeMockEnabled()) {
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

        if (isRuntimeMockEnabled()) {
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

        // ── Shift-conflict check (replaces singleActivePerGuard with smarter logic) ──
        // Rules:
        //   • A guard with BOTH shift cannot be deployed anywhere else.
        //   • A guard cannot be deployed in the same shift type at two different places.
        //   • A guard with DAY can get a NIGHT double-duty (and vice versa).
        //   • A guard cannot be given BOTH shift if they already have any active deployment.
        //   • Max 2 concurrent active deployments (one DAY + one NIGHT).
        {
            const activeDeployments = await prisma.deployment.findMany({
                where: { guardId, status: "ACTIVE" },
                select: { id: true, shiftType: true, clientId: true, branchId: true },
            })

            if (activeDeployments.length > 0) {
                const activeShifts = activeDeployments.map((d) => d.shiftType) // DAY | NIGHT | BOTH

                // If trying to deploy as BOTH — not allowed when already deployed anywhere
                if (shiftType === "BOTH") {
                    return conflict(
                        "Cannot assign a BOTH-shift deployment when the guard already has an active deployment. " +
                        "End the existing deployment first."
                    )
                }

                // If existing deployment is BOTH — blocks everything
                if (activeShifts.includes("BOTH")) {
                    return conflict(
                        "Guard is already deployed on a BOTH-shift and cannot take on any additional deployment."
                    )
                }

                // If new shift conflicts with any existing shift
                if (activeShifts.includes(shiftType)) {
                    const label = shiftType === "DAY" ? "day" : "night"
                    return conflict(
                        `Guard already has an active ${label}-shift deployment. ` +
                        `A guard can only be double-deployed if the shifts (DAY/NIGHT) do not overlap.`
                    )
                }

                // At this point: existing is DAY and new is NIGHT (or vice versa) — double duty allowed
                // Enforce cap of 2 active deployments
                if (activeDeployments.length >= 2) {
                    return conflict("Guard already has 2 active deployments (maximum allowed).")
                }
            } else if (isWorkflowRuleEnabled("deployments.singleActivePerGuard") && shiftType === "BOTH") {
                // legacy rule still respected for BOTH shift when no existing deployments
                // (no-op: BOTH with no existing is fine — handled above)
            }
        }

        // ── Numeric field parsing — treat missing/empty as null (not an error) ──
        const numericRate         = body?.rate         != null && body.rate         !== "" ? parseOptionalNumber(body.rate)         : null
        const numericSalary       = body?.salary       != null && body.salary       !== "" ? parseOptionalNumber(body.salary)       : null
        const numericOvertime     = body?.overtime     != null && body.overtime     !== "" ? parseOptionalNumber(body.overtime)     : null
        const numericExtraHours   = body?.extraHours   != null && body.extraHours   !== "" ? parseOptionalNumber(body.extraHours)   : null
        const numericPostAllowance= body?.postAllowance!= null && body.postAllowance!== "" ? parseOptionalNumber(body.postAllowance): null

        if (
            numericRate === undefined ||
            numericSalary === undefined ||
            numericOvertime === undefined ||
            numericExtraHours === undefined ||
            numericPostAllowance === undefined
        ) {
            return badRequest("Numeric fields contain invalid values.")
        }

        const deploymentStatus = body.status && ["ACTIVE","PENDING","INACTIVE"].includes(String(body.status))
            ? String(body.status)
            : "ACTIVE"

        const data: Prisma.DeploymentUncheckedCreateInput = {
            guardId,
            clientId,
            branchId,
            regionalOfficeId,
            deploymentDate,
            designation,
            shiftType,
            rate: numericRate ?? null,
            status: deploymentStatus,
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
            deploymentNature: body.deploymentNature ? String(body.deploymentNature) : "PERMANENT",
            isExtraGuard: body.isExtraGuard === "on" || body.isExtraGuard === true,
            comment: body.comment ? String(body.comment) : null,
        }

        const deployment = await prisma.deployment.create({
            data,
            include: {
                guard: true,
                client: { select: { id: true, name: true } },
                branch: true,
                regionalOffice: true,
            },
        })

        // ── Business logic: auto-mark attendance for today if deployment is ACTIVE ──
        // Determine attendance type based on whether a record already exists (double duty)
        if (deploymentStatus === "ACTIVE") {
            const today = new Date()
            today.setHours(0, 0, 0, 0)

            // Check if an attendance record already exists today (prior deployment = double duty)
            const existing = await prisma.attendance.findUnique({
                where: { guardId_date: { guardId, date: today } },
                select: { id: true, shiftType: true },
            })

            const attendanceType = existing
                ? (shiftType === "DAY" ? "DOUBLE_DUTY_DAY" : "DOUBLE_DUTY_NIGHT")
                : "PRESENT"

            await prisma.attendance.upsert({
                where: { guardId_date: { guardId, date: today } },
                create: {
                    guardId,
                    date: today,
                    status: "PRESENT",
                    shiftType,
                    attendanceType,
                    deploymentId: deployment.id,
                    clientId,
                    clientName: deployment.client.name,
                    isAutoGenerated: true,
                },
                update: {
                    // Upgrade to double-duty type — keep manual overrides untouched (isAutoGenerated=false)
                    attendanceType,
                    shiftType: existing?.shiftType ? "BOTH" : shiftType,
                },
            })
        }

        return NextResponse.json(deployment, { status: 201 })
    } catch (error: unknown) {
        console.error("Error creating deployment:", error)
        return internalServerError("Failed to create deployment")
    }
}
