import { NextRequest, NextResponse } from "next/server"
import { Prisma, StoreInventoryAssignmentStatus } from "@prisma/client"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"
import { mockDeploymentsList } from "@/lib/mockData/deployments"
import { applyManagerScope, buildManagerScopeWhere, deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, conflict, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { isWorkflowRuleEnabled } from "@/lib/workflows/policy"
import { syncLegacyStatus } from "@/lib/guards/lifecycle"

function parseOptionalNumber(value: unknown) {
    if (value === undefined) return undefined
    if (value === null || value === "") return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
}

function isValidShiftType(value: string) {
    return value === "DAY" || value === "NIGHT" || value === "BOTH"
}

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }
        if (!hasAction(session, "GUARDS", "VIEW")) return forbidden("Access denied.")
        const managerScope = deriveManagerScope(session)

        const { searchParams } = new URL(request.url)
        const guardIdParam = searchParams.get("guardId")?.trim() || null
        const regionIdParam = searchParams.get("regionId")?.trim() || null
        const regionalOfficeIdParam = searchParams.get("regionalOfficeId")?.trim() || null
        const statusParam = searchParams.get("status")?.trim().toUpperCase() || null
        const allowedStatuses = new Set(["ACTIVE", "INACTIVE", "PAUSED", "ENDED"])
        const statusFilter = statusParam && allowedStatuses.has(statusParam) ? statusParam : null

        // Reject cross-scope requests early so a regional user can't request
        // another region's data even with a crafted URL.
        if (managerScope && managerScopeDenied(managerScope, {
            regionId: regionIdParam,
            regionalOfficeId: regionalOfficeIdParam,
        })) {
            return forbidden("Forbidden: cannot query deployments outside your scope.")
        }

        if (isRuntimeMockEnabled()) {
            return NextResponse.json(
                applyManagerScope(mockDeploymentsList, managerScope, {
                    regionalOfficeId: (row) => {
                        const scoped = row as { regionalOfficeId?: string | null }
                        return scoped.regionalOfficeId ?? null
                    },
                })
                    .filter((row) => (guardIdParam ? row.guardId === guardIdParam : true))
                    .filter((row) => (statusFilter ? row.status === statusFilter : true))
                    .map((row) => ({
                        ...row,
                        deploymentDate: new Date(row.deploymentDate),
                    }))
            )
        }

        const deployments = await prisma.deployment.findMany({
            where: {
                ...buildManagerScopeWhere(managerScope, { regionalOfficeId: "regionalOfficeId" }),
                ...(guardIdParam ? { guardId: guardIdParam } : {}),
                ...(statusFilter ? { status: statusFilter } : {}),
                ...(regionalOfficeIdParam ? { regionalOfficeId: regionalOfficeIdParam } : {}),
                ...(regionIdParam ? { regionalOffice: { regionId: regionIdParam } } : {}),
            },
            orderBy: { createdAt: "desc" },
            take: 200,
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
        if (!hasAction(session, "GUARDS", "CREATE")) return forbidden("Access denied.")
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
        // Future-date block — compare against end-of-day in the server's TZ.
        {
            const endOfToday = new Date()
            endOfToday.setHours(23, 59, 59, 999)
            if (deploymentDate.getTime() > endOfToday.getTime()) {
                return badRequest("Deployment date cannot be in the future.")
            }
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
            prisma.guard.findUnique({ where: { id: guardId }, select: { id: true, status: true, lifecycleStatus: true, regionalOfficeId: true, joiningDate: true } }),
            prisma.client.findUnique({ where: { id: clientId }, select: { id: true, isBranchless: true, _count: { select: { branches: true } } } }),
            prisma.regionalOffice.findUnique({ where: { id: regionalOfficeId }, select: { id: true } }),
            branchId
                ? prisma.branch.findUnique({
                    where: { id: branchId },
                    select: {
                        id: true, clientId: true, address: true, city: true, contactPerson: true,
                        dayGuardCapacity: true, nightGuardCapacity: true,
                        daySupervisorCapacity: true, nightSupervisorCapacity: true,
                        dayCpoCapacity: true, nightCpoCapacity: true,
                        daySoCapacity: true, nightSoCapacity: true,
                        dayAsoCapacity: true, nightAsoCapacity: true,
                        dayLsoCapacity: true, nightLsoCapacity: true,
                        dayReceptionistCapacity: true, nightReceptionistCapacity: true,
                        dayCctvCapacity: true, nightCctvCapacity: true,
                    },
                })
                : Promise.resolve(null),
        ])

        if (!guard) return notFound("Guard not found.")
        if (guard.joiningDate) {
            const joinMs = new Date(guard.joiningDate).setHours(0, 0, 0, 0)
            const depMs  = new Date(deploymentDate).setHours(0, 0, 0, 0)
            if (depMs < joinMs) {
                const fmt = new Date(guard.joiningDate).toISOString().split("T")[0]
                return badRequest(`Deployment date cannot be before the guard's joining date (${fmt}).`)
            }
        }
        if (isWorkflowRuleEnabled("deployments.requireActiveGuardStatus") && guard.lifecycleStatus !== "ACTIVE") {
            return conflict(`Guard cannot be deployed — current lifecycle status is "${guard.lifecycleStatus}". Only ACTIVE guards are eligible for deployment.`)
        }
        if (isWorkflowRuleEnabled("deployments.requireVerifiedPrerequisites")) {
            const verificationDocTypes = await prisma.guardDocumentType.findMany({
                where: { isActive: true, docCategory: "VERIFICATION" },
                select: { name: true },
            })
            if (verificationDocTypes.length > 0) {
                const verificationNames = verificationDocTypes.map((dt) => dt.name)
                const guardVerifPrereqs = await prisma.guardPrerequisite.findMany({
                    where: { guardId, docTypeName: { in: verificationNames } },
                    select: { docTypeName: true, status: true },
                })
                const missingCount = verificationNames.filter(
                    (name) => !guardVerifPrereqs.find((p) => p.docTypeName === name)
                ).length
                const unverifiedCount = guardVerifPrereqs.filter((p) => p.status !== "VERIFIED").length
                if (missingCount > 0 || unverifiedCount > 0) {
                    const parts: string[] = []
                    if (missingCount > 0) parts.push(`${missingCount} not submitted`)
                    if (unverifiedCount > 0) parts.push(`${unverifiedCount} not yet verified`)
                    return conflict(
                        `Guard verification is incomplete (${parts.join(", ")}). All verification documents must be submitted and verified before deployment.`
                    )
                }
            }
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
        if (
            isWorkflowRuleEnabled("deployments.requireClientHasBranches") &&
            !client.isBranchless &&
            client._count.branches === 0
        ) {
            return conflict("Guards cannot be deployed to clients without any branches. Add a branch to this client first.")
        }
        if (branchId && !branch) return notFound("Branch not found.")
        if (branch && branch.clientId !== clientId) {
            return badRequest("Branch does not belong to the selected client.")
        }
        if (branch && !branch.address && !branch.city) {
            return badRequest(
                "Branch is incomplete — address or city is required before deploying. Please complete the branch details first."
            )
        }

        // ── Branch capacity enforcement ─────────────────────────────────────
        if (branch && (shiftType === "DAY" || shiftType === "NIGHT")) {
            const capacityFieldByDesignation: Record<string, { DAY: keyof typeof branch | null; NIGHT: keyof typeof branch | null }> = {
                "guard": { DAY: "dayGuardCapacity", NIGHT: "nightGuardCapacity" },
                "location supervisor": { DAY: "daySupervisorCapacity", NIGHT: "nightSupervisorCapacity" },
                "supervisor": { DAY: "daySupervisorCapacity", NIGHT: "nightSupervisorCapacity" },
                "cpo": { DAY: "dayCpoCapacity", NIGHT: "nightCpoCapacity" },
                "so": { DAY: "daySoCapacity", NIGHT: "nightSoCapacity" },
                "aso": { DAY: "dayAsoCapacity", NIGHT: "nightAsoCapacity" },
                "lso": { DAY: "dayLsoCapacity", NIGHT: "nightLsoCapacity" },
                "receptionist": { DAY: "dayReceptionistCapacity", NIGHT: "nightReceptionistCapacity" },
                "cctv operator": { DAY: "dayCctvCapacity", NIGHT: "nightCctvCapacity" },
            }
            const entry = capacityFieldByDesignation[designation.trim().toLowerCase()]
            const field = entry?.[shiftType as "DAY" | "NIGHT"] ?? null
            const limit = field ? (branch[field] as number | null) ?? null : null
            if (limit != null) {
                const used = await prisma.deployment.count({
                    where: {
                        branchId: branch.id,
                        status: "ACTIVE",
                        endDate: null,
                        designation: { equals: designation, mode: "insensitive" },
                        shiftType,
                    },
                })
                if (used >= limit) {
                    return conflict(
                        `Branch has reached its ${shiftType.toLowerCase()} ${designation} capacity (${used}/${limit}).`
                    )
                }
            }
        }

        if (isWorkflowRuleEnabled("deployments.requireBranchContract")) {
            const now = new Date()
            const activeContract = await prisma.clientContract.findFirst({
                where: {
                    clientId,
                    isActive: true,
                    OR: [
                        { branchId: null },
                        ...(branchId ? [{ branchId }] : []),
                    ],
                    AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
                },
                select: { id: true },
            })
            if (!activeContract) {
                const target = branchId ? "this branch or its client" : "this client"
                return conflict(
                    `No active contract found for ${target}. Please enter a client-level or branch-level contract before deploying.`
                )
            }
        }

        const ruleDelegate = (prisma as unknown as {
            guardDeploymentInventoryRule?: {
                findUnique: (args: unknown) => Promise<{
                    isActive: boolean
                    minimumAssignedItems: number
                    allowedCategoryIds: unknown
                } | null>
            }
        }).guardDeploymentInventoryRule

        const deploymentInventoryRule = ruleDelegate
            ? await ruleDelegate.findUnique({
                where: { ruleKey: "default" },
                select: { isActive: true, minimumAssignedItems: true, allowedCategoryIds: true },
            })
            : null

        if (deploymentInventoryRule?.isActive) {
            const requiredCount = Math.max(0, Number(deploymentInventoryRule.minimumAssignedItems ?? 0))
            const allowedCategoryIds = Array.isArray(deploymentInventoryRule.allowedCategoryIds)
                ? deploymentInventoryRule.allowedCategoryIds
                    .map((entry) => String(entry ?? "").trim())
                    .filter((entry) => entry.length > 0)
                : []

            // Region-scope guard: only count assignments where the source store
            // is in the same regional office as the guard. Prevents legacy/injected
            // cross-region rows from satisfying the deployment inventory rule.
            const guardForInventoryScope = await prisma.guard.findUnique({
                where: { id: guardId },
                select: { regionalOfficeId: true },
            })

            const assignedInventoryCount = await prisma.storeInventoryAssignment.count({
                where: {
                    assignedToGuardId: guardId,
                    status: StoreInventoryAssignmentStatus.ASSIGNED,
                    ...(guardForInventoryScope?.regionalOfficeId
                        ? { store: { regionalOfficeId: guardForInventoryScope.regionalOfficeId } }
                        : {}),
                    ...(allowedCategoryIds.length > 0
                        ? {
                            product: {
                                categoryId: { in: allowedCategoryIds },
                            },
                        }
                        : {}),
                },
            })

            if (assignedInventoryCount < requiredCount) {
                return conflict(
                    `Guard must have at least ${requiredCount} assigned inventory item(s) before deployment. ` +
                    `Currently assigned: ${assignedInventoryCount}.`
                )
            }
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

        // Parse deployment type early for validation
        const deploymentType = body.deploymentType ? String(body.deploymentType).toUpperCase() : "REGULAR"

        if (deploymentType === "OVERTIME") {
            const hasRegular = await prisma.deployment.findFirst({
                where: { guardId, status: "ACTIVE", deploymentType: "REGULAR" },
                select: { id: true },
            })
            if (!hasRegular) {
                return conflict(
                    "Overtime deployment requires an existing active regular deployment for this guard. Deploy the guard as a regular shift first."
                )
            }
        }

        const hasSupervisor = await prisma.guardSupervisorAssignment.findFirst({
            where: { guardId, status: "ACTIVE" },
            select: { id: true },
        })
        if (!hasSupervisor) {
            return conflict(
                "Guard must have an active supervisor assigned before deployment. Please assign a supervisor to this guard first."
            )
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

        const deployedByName = (session.user as { name?: string })?.name ?? null

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
            deploymentType: deploymentType,
            deploymentNature: body.deploymentNature ? String(body.deploymentNature) : "PERMANENT",
            isExtraGuard: body.isExtraGuard === "on" || body.isExtraGuard === true,
            comment: body.comment ? String(body.comment) : null,
            deployedByName,
        }

        const deployment = await prisma.deployment.create({
            data,
            include: {
                guard: { select: { id: true, name: true, cnic: true, parwestId: true, status: true } },
                client: { select: { id: true, name: true } },
                branch: true,
                regionalOffice: { select: { id: true, name: true } },
            },
        })

        // ── Recompute legacy status shadow after deployment creation ──
        if (deploymentStatus === "ACTIVE") {
            const prevStatus = deployment.guard.status
            await syncLegacyStatus(prisma, guardId)
            if (prevStatus !== "PRESENT") {
                // Record status history
                const { recordGuardStatusChange } = await import("@/lib/guards/status-history")
                void recordGuardStatusChange({
                    guardId,
                    cnic: deployment.guard.cnic,
                    parwestId: deployment.guard.parwestId,
                    guardName: deployment.guard.name,
                    fromStatus: prevStatus,
                    toStatus: "PRESENT",
                    reason: `Deployed to ${deployment.client.name}`,
                    changedByName: deployedByName,
                    changedByType: "SYSTEM",
                    officeName: deployment.regionalOffice?.name ?? null,
                })
            }
        }

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
                    // Re-link to the newest active deployment and refresh client
                    // metadata. A stale row may have pointed at an ended/deleted
                    // deployment; leaving it dangling breaks downstream joins.
                    attendanceType,
                    shiftType: existing?.shiftType ? "BOTH" : shiftType,
                    deploymentId: deployment.id,
                    clientId,
                    clientName: deployment.client.name,
                },
            })
        }

        return NextResponse.json(deployment, { status: 201 })
    } catch (error: unknown) {
        console.error("Error creating deployment:", error)
        return internalServerError("Failed to create deployment")
    }
}
