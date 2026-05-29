import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import {
    badRequest,
    conflict,
    forbidden,
    internalServerError,
    notFound,
    ok,
    unauthorized,
} from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { safeAuditLog } from "@/lib/audit/safeAuditLog"
import { isWorkflowRuleEnabled } from "@/lib/workflows/policy"
import { BRANCH_CAPACITY_FIELDS } from "@/lib/schemas/branch"
import { CAPACITY_USAGE_RULES } from "@/lib/branches/capacity"
import { cityForBranch } from "@/lib/geo/regionCity"

// ── Zod schema for PATCH body ───────────────────────────────────────────────
// Stays tolerant on identity/contact fields (legacy callers pass partials)
// but strictly validates `status` and capacity numerics.
const capacityField = z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((v) => {
        if (v === null || v === undefined || v === "") return null
        const n = typeof v === "number" ? v : Number(v)
        return Number.isFinite(n) ? n : NaN
    })
    .refine((n) => n === null || (Number.isInteger(n) && n >= 0), {
        message: "Capacity must be a non-negative whole number.",
    })

const capacityShape = BRANCH_CAPACITY_FIELDS.reduce<Record<string, typeof capacityField>>(
    (acc, key) => {
        acc[key] = capacityField
        return acc
    },
    {},
)

const branchPatchSchema = z
    .object({
        clientId: z.string().trim().min(1).optional(),
        name: z.string().trim().min(1, "name is required.").optional(),
        code: z.string().trim().nullable().optional(),
        address: z.string().nullable().optional(),
        city: z.string().nullable().optional(),
        province: z.string().nullable().optional(),
        contactPerson: z.string().nullable().optional(),
        contactPhone: z.string().nullable().optional(),
        contactEmail: z.string().nullable().optional(),
        isHeadOffice: z.boolean().optional(),
        branchType: z.enum(["CONVENTIONAL", "ISLAMIC"]).optional(),
        status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
        assignedManagerId: z.string().nullable().optional(),
        operationsManagerId: z.string().nullable().optional(),
        assignedSupervisorId: z.string().nullable().optional(),
        // Free-text branch manager fields sent by the edit form.
        branchManagerName: z.string().nullable().optional(),
        branchManagerContact: z.string().nullable().optional(),
        branchManagerEmail: z.string().nullable().optional(),
        ...capacityShape,
    })
    // No .passthrough(): unknown keys are stripped. Every field with a real
    // Branch column is mapped explicitly below; anything else is harmless to drop.
    // (Not .strict() — the form may still send extra keys we don't persist.)

type BranchPatchPayload = z.infer<typeof branchPatchSchema>

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }
        if (!hasAction(session, "CLIENTS", "UPDATE")) return forbidden()
        const managerScope = deriveManagerScope(session)
        const actorId = session.user?.id || null

        const { id } = await params
        const rawBody = await request.json().catch(() => ({}))

        const parsed = branchPatchSchema.safeParse(rawBody)
        if (!parsed.success) {
            const first = parsed.error.issues[0]
            return badRequest(first?.message || "Invalid branch payload.")
        }
        const body: BranchPatchPayload = parsed.data

        // Partial PATCH: name only required when explicitly provided.
        if (body.name !== undefined && !body.name.trim()) {
            return badRequest("name is required.")
        }

        const existing = await prisma.branch.findUnique({
            where: { id },
            include: { client: { select: { regionId: true } } },
        })
        if (!existing) {
            return notFound("Branch not found")
        }
        if (managerScope && managerScopeDenied(managerScope, { regionId: existing.client?.regionId || null })) {
            return forbidden("Forbidden: branch is outside your scope.")
        }

        if (body.clientId) {
            const targetClient = await prisma.client.findUnique({
                where: { id: body.clientId },
                select: { regionId: true },
            })
            if (!targetClient) {
                return notFound("Target client not found")
            }
            if (managerScope && managerScopeDenied(managerScope, { regionId: targetClient.regionId })) {
                return forbidden("Forbidden: cannot move branch outside your scope.")
            }
        }

        // ── Branch deactivation guard (Ticket 32) ────────────────────────────
        // Only blocks when the workflow rule is enabled AND the branch is
        // transitioning to INACTIVE. "Active deployment" matches the canonical
        // filter used elsewhere: `Deployment.status === "ACTIVE"`.
        if (
            body.status === "INACTIVE" &&
            existing.status !== "INACTIVE" &&
            isWorkflowRuleEnabled("branches.blockInactiveWithActiveDeployment")
        ) {
            const activeDeployments = await prisma.deployment.count({
                where: { branchId: id, status: "ACTIVE" },
            })
            if (activeDeployments > 0) {
                return conflict(
                    "Cannot deactivate branch with active deployments. End all deployments first."
                )
            }
        }

        // ── Capacity decrease guard (Ticket 35) ──────────────────────────────
        // For every capacity field present in the payload, verify the new
        // value is not below the count of currently-active deployments that
        // match this capacity bucket (designation + shift). Setting `null`
        // (no limit) is always allowed.
        const capacityChanges: Array<{ rule: (typeof CAPACITY_USAGE_RULES)[number]; nextValue: number }> = []
        for (const rule of CAPACITY_USAGE_RULES) {
            const proposed = (body as Record<string, unknown>)[rule.field]
            if (proposed === undefined || proposed === null) continue
            // proposed is a parsed integer at this point
            const nextValue = proposed as number
            const currentValue = (existing as Record<string, unknown>)[rule.field] as number | null
            // Only enforce on decreases (or any time the new cap is lower than usage).
            if (currentValue !== null && nextValue >= currentValue) continue
            capacityChanges.push({ rule, nextValue })
        }

        if (capacityChanges.length > 0) {
            // Aggregate per-bucket usage in a single query. Mirrors the canonical
            // count in src/lib/branches/capacity.ts (countDeploymentsForRule):
            // only ACTIVE, non-ended deployments count, and EXTRA deployments are
            // excluded (they exist *because* the cap was full).
            const usageByBucket = await prisma.deployment.groupBy({
                by: ["designation", "shiftType", "deploymentType"],
                where: { branchId: id, status: "ACTIVE", endDate: null },
                _count: { _all: true },
            })

            for (const { rule, nextValue } of capacityChanges) {
                const used = usageByBucket
                    .filter((row) => {
                        if (row.deploymentType === "EXTRA") return false
                        const desig = (row.designation || "").trim().toLowerCase()
                        if (!rule.designations.includes(desig)) return false
                        const shift = (row.shiftType || "").toUpperCase() as "DAY" | "NIGHT" | "BOTH"
                        return rule.shiftTypes.includes(shift)
                    })
                    .reduce((sum, row) => sum + row._count._all, 0)
                if (nextValue < used) {
                    return conflict(
                        `Cannot lower ${rule.label.toLowerCase()} capacity to ${nextValue} — there are currently ${used} active deployment(s) at this branch in that bucket.`
                    )
                }
            }
        }

        // ── Build the update payload ─────────────────────────────────────────
        const updateData: Record<string, unknown> = {}

        if (body.clientId !== undefined) updateData.clientId = body.clientId
        if (body.name !== undefined) updateData.name = body.name.trim()
        if (body.code !== undefined) updateData.code = body.code ? String(body.code).trim() : null
        if (body.address !== undefined) updateData.address = body.address ? String(body.address) : null
        // city is always derived from the branch's region — never taken from body.city.
        if (body.province !== undefined) updateData.province = body.province ? String(body.province) : null
        if (body.contactPerson !== undefined) updateData.contactPerson = body.contactPerson ? String(body.contactPerson) : null
        if (body.contactPhone !== undefined) updateData.contactPhone = body.contactPhone ? String(body.contactPhone) : null
        if (body.contactEmail !== undefined) updateData.contactEmail = body.contactEmail ? String(body.contactEmail) : null
        if (body.isHeadOffice !== undefined) updateData.isHeadOffice = body.isHeadOffice === true
        if (body.status !== undefined) updateData.status = body.status
        if (body.assignedManagerId !== undefined) {
            const v = body.assignedManagerId ? String(body.assignedManagerId).trim() : ""
            updateData.assignedManagerId = v || null
        }
        if (body.operationsManagerId !== undefined) {
            const v = body.operationsManagerId ? String(body.operationsManagerId).trim() : ""
            updateData.operationsManagerId = v || null
        }
        if (body.branchManagerName !== undefined) {
            updateData.branchManagerName = body.branchManagerName ? String(body.branchManagerName).trim() : null
        }
        if (body.branchManagerContact !== undefined) {
            updateData.branchManagerContact = body.branchManagerContact ? String(body.branchManagerContact).trim() : null
        }
        if (body.branchManagerEmail !== undefined) {
            updateData.branchManagerEmail = body.branchManagerEmail ? String(body.branchManagerEmail).trim() : null
        }

        for (const key of BRANCH_CAPACITY_FIELDS) {
            const v = (body as Record<string, unknown>)[key]
            if (v !== undefined) updateData[key] = v
        }

        // Branch update + supervisor assignment delta in a single transaction so
        // a stale ACTIVE row never coexists with a new one (single source of
        // truth: at most one ACTIVE ClientSupervisorAssignment per branch).
        const branch = await prisma.$transaction(async (tx) => {
            // Derive city strictly from the branch's EXISTING, persisted region.
            // regionalOfficeId and regionId are intentionally NOT editable via this
            // endpoint — body.regionalOfficeId / body.regionId are ignored here to
            // prevent region/city drift where city would reflect a new office while
            // the stored region stays old.
            // NOTE: if branch-region editing is ever added to this endpoint, the
            // caller must also persist regionalOfficeId into updateData AND then
            // re-derive city here using the new persisted value — not body directly.
            const resolvedClientId = body.clientId ? body.clientId : existing.clientId
            const derivedCity = await cityForBranch(tx, {
                regionalOfficeId: existing.regionalOfficeId,
                regionId: null,
                clientId: resolvedClientId,
            })
            updateData.city = derivedCity

            const updated = await tx.branch.update({
                where: { id },
                data: updateData,
                include: { client: true },
            })

            if (body.assignedSupervisorId !== undefined) {
                const nextSupervisorId = body.assignedSupervisorId
                    ? String(body.assignedSupervisorId).trim()
                    : ""
                const current = await tx.clientSupervisorAssignment.findFirst({
                    where: { branchId: id, status: "ACTIVE" },
                    orderBy: { effectiveDate: "desc" },
                })

                if (current && current.supervisorId !== nextSupervisorId) {
                    await tx.clientSupervisorAssignment.update({
                        where: { id: current.id },
                        data: { status: "INACTIVE" },
                    })
                }

                if (nextSupervisorId && (!current || current.supervisorId !== nextSupervisorId)) {
                    const supervisor = await tx.user.findUnique({
                        where: { id: nextSupervisorId },
                        select: { id: true },
                    })
                    if (!supervisor) {
                        throw new Error("Selected supervisor was not found.")
                    }
                    await tx.clientSupervisorAssignment.create({
                        data: {
                            clientId: updated.clientId,
                            branchId: id,
                            supervisorId: nextSupervisorId,
                        },
                    })
                }
            }

            return updated
        })

        await safeAuditLog({
            userId: actorId,
            event: "BRANCH_UPDATED",
            module: "CLIENTS",
            description: `Updated branch ${id}`,
        })

        return NextResponse.json(branch, { status: 200 })
    } catch (error: unknown) {
        if (error instanceof Error && error.message === "Selected supervisor was not found.") {
            return badRequest(error.message)
        }
        console.error("Error updating branch:", error)
        return internalServerError("Failed to update branch")
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
        if (!hasAction(session, "CLIENTS", "DELETE")) return forbidden()
        const managerScope = deriveManagerScope(session)
        const actorId = session.user?.id || null

        const { id } = await params

        // Check if branch has active deployments
        const branch = await prisma.branch.findUnique({
            where: { id },
            include: {
                client: {
                    select: { regionId: true },
                },
                deployments: {
                    where: { status: "ACTIVE" },
                },
            },
        })

        if (!branch) {
            return notFound("Branch not found")
        }
        if (managerScope && managerScopeDenied(managerScope, { regionId: branch.client?.regionId || null })) {
            return forbidden("Forbidden: branch is outside your scope.")
        }

        if (branch.deployments.length > 0) {
            return badRequest("Cannot delete branch with active deployments")
        }

        await prisma.branch.delete({ where: { id } })
        await safeAuditLog({
            userId: actorId,
            event: "BRANCH_DELETED",
            module: "CLIENTS",
            description: `Deleted branch ${id}`,
        })

        return ok({ message: "Branch deleted successfully" })
    } catch (error: unknown) {
        console.error("Error deleting branch:", error)
        return internalServerError("Failed to delete branch")
    }
}
