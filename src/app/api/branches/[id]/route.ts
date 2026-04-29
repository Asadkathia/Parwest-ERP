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
        ...capacityShape,
    })
    .passthrough()

type BranchPatchPayload = z.infer<typeof branchPatchSchema>

// Mirrors the designation→capacity mapping in
// `src/app/api/deployments/route.ts`. Used to reject a capacity decrease below
// the count of currently active deployments for that designation/shift.
const CAPACITY_USAGE_RULES: Array<{
    field: (typeof BRANCH_CAPACITY_FIELDS)[number]
    designations: string[] // case-insensitive match
    shiftTypes: Array<"DAY" | "NIGHT" | "BOTH"> // null = any
    label: string
}> = [
    { field: "dayGuardCapacity", designations: ["guard", "security guard"], shiftTypes: ["DAY"], label: "day guards" },
    { field: "nightGuardCapacity", designations: ["guard", "security guard"], shiftTypes: ["NIGHT"], label: "night guards" },
    { field: "daySupervisorCapacity", designations: ["supervisor", "location supervisor"], shiftTypes: ["DAY"], label: "day supervisors" },
    { field: "nightSupervisorCapacity", designations: ["supervisor", "location supervisor"], shiftTypes: ["NIGHT"], label: "night supervisors" },
    { field: "cpoCapacity", designations: ["cpo"], shiftTypes: ["DAY", "NIGHT", "BOTH"], label: "CPOs" },
    { field: "dayCpoCapacity", designations: ["cpo"], shiftTypes: ["DAY"], label: "day CPOs" },
    { field: "nightCpoCapacity", designations: ["cpo"], shiftTypes: ["NIGHT"], label: "night CPOs" },
    { field: "daySoCapacity", designations: ["so"], shiftTypes: ["DAY"], label: "day SOs" },
    { field: "nightSoCapacity", designations: ["so"], shiftTypes: ["NIGHT"], label: "night SOs" },
    { field: "dayAsoCapacity", designations: ["aso"], shiftTypes: ["DAY"], label: "day ASOs" },
    { field: "nightAsoCapacity", designations: ["aso"], shiftTypes: ["NIGHT"], label: "night ASOs" },
    { field: "dayLsoCapacity", designations: ["lso"], shiftTypes: ["DAY"], label: "day LSOs" },
    { field: "nightLsoCapacity", designations: ["lso"], shiftTypes: ["NIGHT"], label: "night LSOs" },
    { field: "dayCctvCapacity", designations: ["cctv operator"], shiftTypes: ["DAY"], label: "day CCTV operators" },
    { field: "nightCctvCapacity", designations: ["cctv operator"], shiftTypes: ["NIGHT"], label: "night CCTV operators" },
    { field: "dayReceptionistCapacity", designations: ["receptionist"], shiftTypes: ["DAY"], label: "day receptionists" },
    { field: "nightReceptionistCapacity", designations: ["receptionist"], shiftTypes: ["NIGHT"], label: "night receptionists" },
]

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
            const proposed = body[rule.field]
            if (proposed === undefined || proposed === null) continue
            // proposed is a parsed integer at this point
            const nextValue = proposed as number
            const currentValue = (existing as Record<string, unknown>)[rule.field] as number | null
            // Only enforce on decreases (or any time the new cap is lower than usage).
            if (currentValue !== null && nextValue >= currentValue) continue
            capacityChanges.push({ rule, nextValue })
        }

        if (capacityChanges.length > 0) {
            // Aggregate per-bucket usage in a single query.
            const usageByBucket = await prisma.deployment.groupBy({
                by: ["designation", "shiftType"],
                where: { branchId: id, status: "ACTIVE" },
                _count: { _all: true },
            })

            for (const { rule, nextValue } of capacityChanges) {
                const used = usageByBucket
                    .filter((row) => {
                        const desig = (row.designation || "").trim().toLowerCase()
                        if (!rule.designations.includes(desig)) return false
                        const shift = (row.shiftType || "").toUpperCase() as "DAY" | "NIGHT" | "BOTH"
                        return rule.shiftTypes.includes(shift)
                    })
                    .reduce((sum, row) => sum + row._count._all, 0)
                if (nextValue < used) {
                    return conflict(
                        `Cannot lower ${rule.label} capacity to ${nextValue} — there are currently ${used} active deployment(s) at this branch in that bucket.`
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
        if (body.city !== undefined) updateData.city = body.city ? String(body.city) : null
        if (body.province !== undefined) updateData.province = body.province ? String(body.province) : null
        if (body.contactPerson !== undefined) updateData.contactPerson = body.contactPerson ? String(body.contactPerson) : null
        if (body.contactPhone !== undefined) updateData.contactPhone = body.contactPhone ? String(body.contactPhone) : null
        if (body.contactEmail !== undefined) updateData.contactEmail = body.contactEmail ? String(body.contactEmail) : null
        if (body.isHeadOffice !== undefined) updateData.isHeadOffice = body.isHeadOffice === true
        if (body.status !== undefined) updateData.status = body.status

        for (const key of BRANCH_CAPACITY_FIELDS) {
            const v = body[key]
            if (v !== undefined) updateData[key] = v
        }

        const branch = await prisma.branch.update({
            where: { id },
            data: updateData,
            include: { client: true },
        })

        await safeAuditLog({
            userId: actorId,
            event: "BRANCH_UPDATED",
            module: "CLIENTS",
            description: `Updated branch ${id}`,
        })

        return NextResponse.json(branch, { status: 200 })
    } catch (error: unknown) {
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
