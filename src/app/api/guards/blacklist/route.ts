import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import { badRequest, conflict, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasModuleAccess } from "@/lib/api/permissions"
import { recordGuardServiceEvent } from "@/lib/guards/service-history"
import { recordGuardStatusChange } from "@/lib/guards/status-history"

function sanitizeCnic(value: string) {
    return value.trim()
}

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }
        if (!hasModuleAccess(session, "GUARDS")) return forbidden("Access denied.")

        const { searchParams } = new URL(request.url)
        const cnicQuery = sanitizeCnic(searchParams.get("cnic") || "")

        const blacklistRows = await prisma.blacklistedCnic.findMany({
            where: cnicQuery ? { cnic: { contains: cnicQuery, mode: "insensitive" } } : undefined,
            orderBy: { updatedAt: "desc" },
            take: 200,
        })

        const cnicList = blacklistRows.map((row) => row.cnic)
        const guards = cnicList.length
            ? await prisma.guard.findMany({
                  where: { cnic: { in: cnicList } },
                  select: { id: true, name: true, cnic: true, updatedAt: true },
              })
            : []
        const guardByCnic = new Map(guards.map((guard) => [guard.cnic, guard]))

        const rows = blacklistRows.map((row) => {
            const match = guardByCnic.get(row.cnic)
            return {
                id: row.id,
                cnic: row.cnic,
                name: match?.name || "CNIC Blocked",
                updatedAt: row.updatedAt,
                reason: row.reason || null,
                blacklistedBy: row.createdByName || "System",
            }
        })

        return NextResponse.json(rows)
    } catch (error: unknown) {
        if (isPrismaMissingSchemaError(error)) {
            const guards = await prisma.guard.findMany({
                where: { status: "BLACKLISTED" },
                orderBy: { updatedAt: "desc" },
                select: { id: true, name: true, cnic: true, updatedAt: true },
                take: 200,
            })
            return NextResponse.json(guards)
        }
        console.error("Error fetching blacklisted guards:", error)
        return internalServerError("Failed to fetch blacklisted guards")
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }
        if (!hasModuleAccess(session, "GUARDS")) return forbidden("Access denied.")

        const body = await request.json()
        const cnic = sanitizeCnic(typeof body.cnic === "string" ? body.cnic : "")
        const reason = typeof body.reason === "string" ? body.reason.trim() : null
        const absconded = body.absconded === true
        if (!cnic) {
            return badRequest("cnic is required")
        }

        if (!/^\d{5}-\d{7}-\d$/.test(cnic)) {
            return badRequest("CNIC format must be XXXXX-XXXXXXX-X.")
        }

        // Block blacklist if any matching guard holds kit or pledged docs,
        // unless the caller explicitly flags the guard as absconded.
        const guardsForCnic = await prisma.guard.findMany({
            where: { cnic },
            select: { id: true, name: true },
        })
        if (guardsForCnic.length > 0) {
            if (absconded && !reason) {
                return badRequest("Reason is required when blacklisting an absconded guard.")
            }
            if (!absconded) {
                const guardIds = guardsForCnic.map((g) => g.id)
                const [heldInventory, heldDocs, activeDeployments] = await Promise.all([
                    prisma.storeInventoryAssignment.count({
                        where: { assignedToGuardId: { in: guardIds }, status: "ASSIGNED" },
                    }),
                    prisma.guardPledgedDocumentRecord.count({
                        where: { guardId: { in: guardIds }, status: "HELD" },
                    }),
                    prisma.deployment.count({
                        where: { guardId: { in: guardIds }, status: "ACTIVE" },
                    }),
                ])
                const blockers: string[] = []
                if (activeDeployments > 0) blockers.push(`${activeDeployments} active deployment(s)`)
                if (heldInventory > 0) blockers.push(`${heldInventory} inventory item(s) still assigned`)
                if (heldDocs > 0) blockers.push(`${heldDocs} pledged document(s) still held`)
                if (blockers.length > 0) {
                    return conflict(
                        `Cannot blacklist: ${blockers.join(", ")}. Run clearance first, or set absconded=true with a reason.`
                    )
                }
            }
        }

        const blacklistEntry = await prisma.blacklistedCnic.upsert({
            where: { cnic },
            update: {
                reason,
                createdByUserId: session.user.id || null,
                createdByName: session.user.name || session.user.email || "System",
            },
            create: {
                cnic,
                reason,
                createdByUserId: session.user.id || null,
                createdByName: session.user.name || session.user.email || "System",
            },
        })

        // Fetch guard snapshot before updating
        const guardSnap = await prisma.guard.findUnique({
            where: { cnic },
            select: {
                id: true, parwestId: true, name: true, status: true,
                region: { select: { name: true } },
                regionalOffice: { select: { name: true } },
            },
        })

        // Blacklisted guards are set to TERMINATED. If flagged absconded, forfeit
        // outstanding inventory (mark LOST) and end any active deployments.
        await prisma.$transaction(async (tx) => {
            if (absconded && guardsForCnic.length > 0) {
                const guardIds = guardsForCnic.map((g) => g.id)
                const now = new Date()
                await tx.storeInventoryAssignment.updateMany({
                    where: { assignedToGuardId: { in: guardIds }, status: "ASSIGNED" },
                    data: {
                        status: "LOST",
                        returnedAt: now,
                        returnedByUserId: session.user?.id ?? null,
                    },
                })
                await tx.deployment.updateMany({
                    where: { guardId: { in: guardIds }, status: "ACTIVE" },
                    data: {
                        status: "INACTIVE",
                        endDate: now,
                        endReason: "ABSCONDED",
                        revokedByName: session.user?.name ?? session.user?.email ?? null,
                    },
                })
            }
            await tx.guard.updateMany({
                where: { cnic },
                data: { status: "TERMINATED" },
            })
        })

        void recordGuardServiceEvent({
            cnic,
            guardId: guardSnap?.id ?? null,
            parwestId: guardSnap?.parwestId ?? null,
            guardName: guardSnap?.name ?? null,
            event: "BLACKLISTED",
            fromStatus: guardSnap?.status ?? null,
            toStatus: "TERMINATED",
            description: [
                absconded ? "Blacklisted (Absconded — inventory forfeited as LOST)" : "Blacklisted (Terminated)",
                reason ? `Reason: ${reason}` : null,
            ].filter(Boolean).join(". "),
            changedByName: session.user?.name ?? session.user?.email ?? null,
            regionName: guardSnap?.region?.name ?? null,
            officeName: guardSnap?.regionalOffice?.name ?? null,
        })

        if (guardSnap?.id) {
            void recordGuardStatusChange({
                guardId: guardSnap.id,
                cnic,
                parwestId: guardSnap.parwestId,
                guardName: guardSnap.name,
                fromStatus: guardSnap.status,
                toStatus: "TERMINATED",
                reason: reason ?? null,
                changedByName: session.user?.name ?? session.user?.email ?? null,
                changedByType: "BLACKLIST",
                regionName: guardSnap.region?.name ?? null,
                officeName: guardSnap.regionalOffice?.name ?? null,
            })
        }

        return NextResponse.json(
            {
                id: blacklistEntry.id,
                cnic: blacklistEntry.cnic,
                status: "TERMINATED",
                reason: blacklistEntry.reason || null,
            },
            { status: 200 }
        )
    } catch (error: unknown) {
        console.error("Error blacklisting CNIC:", error)
        return internalServerError("Failed to blacklist CNIC")
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }
        if (!hasModuleAccess(session, "GUARDS")) return forbidden("Access denied.")

        const body = await request.json().catch(() => ({}))
        const id = typeof body.id === "string" ? body.id.trim() : ""
        const cnic = sanitizeCnic(typeof body.cnic === "string" ? body.cnic : "")

        if (!id && !cnic) {
            return badRequest("id or cnic is required")
        }

        const record = id
            ? await prisma.blacklistedCnic.findUnique({ where: { id } })
            : await prisma.blacklistedCnic.findUnique({ where: { cnic } })

        if (!record) {
            return notFound("Blacklist record not found.")
        }

        // Fetch guard snapshot before updating
        const guardSnapDel = await prisma.guard.findUnique({
            where: { cnic: record.cnic },
            select: {
                id: true, parwestId: true, name: true,
                region: { select: { name: true } },
                regionalOffice: { select: { name: true } },
            },
        })

        // Look up the pre-blacklist status from status history
        let restoreStatus = "PENDING"
        if (guardSnapDel?.id) {
            const blacklistHistory = await prisma.guardStatusHistory.findFirst({
                where: { guardId: guardSnapDel.id, changedByType: "BLACKLIST" },
                orderBy: { createdAt: "desc" },
                select: { fromStatus: true },
            })
            if (blacklistHistory?.fromStatus) {
                restoreStatus = blacklistHistory.fromStatus
            }
        }

        await prisma.blacklistedCnic.delete({ where: { id: record.id } })
        await prisma.guard.updateMany({
            where: { cnic: record.cnic, status: "TERMINATED" },
            data: { status: restoreStatus },
        })

        void recordGuardServiceEvent({
            cnic: record.cnic,
            guardId: guardSnapDel?.id ?? null,
            parwestId: guardSnapDel?.parwestId ?? null,
            guardName: guardSnapDel?.name ?? null,
            event: "UNBLACKLISTED",
            fromStatus: "TERMINATED",
            toStatus: restoreStatus,
            description: `Removed from blacklist — restored to ${restoreStatus}`,
            changedByName: session.user?.name ?? session.user?.email ?? null,
            regionName: guardSnapDel?.region?.name ?? null,
            officeName: guardSnapDel?.regionalOffice?.name ?? null,
        })

        if (guardSnapDel?.id) {
            void recordGuardStatusChange({
                guardId: guardSnapDel.id,
                cnic: record.cnic,
                parwestId: guardSnapDel.parwestId,
                guardName: guardSnapDel.name,
                fromStatus: "TERMINATED",
                toStatus: restoreStatus,
                reason: "Removed from blacklist",
                changedByName: session.user?.name ?? session.user?.email ?? null,
                changedByType: "BLACKLIST",
                regionName: guardSnapDel.region?.name ?? null,
                officeName: guardSnapDel.regionalOffice?.name ?? null,
            })
        }

        return NextResponse.json({ success: true, cnic: record.cnic })
    } catch (error: unknown) {
        console.error("Error removing blacklisted CNIC:", error)
        return internalServerError("Failed to remove blacklisted CNIC")
    }
}
