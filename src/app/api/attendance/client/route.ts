import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { buildManagerScopeWhere, deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { forbidden, internalServerError, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }
        if (!hasAction(session, "GUARDS", "VIEW")) return forbidden("Access denied.")
        const managerScope = deriveManagerScope(session)

        const { searchParams } = new URL(request.url)
        const regionalOfficeId = searchParams.get("regionalOfficeId") || undefined
        const clientId = searchParams.get("clientId") || undefined
        const branchId = searchParams.get("branchId") || undefined
        const startDate = searchParams.get("startDate")
        const endDate = searchParams.get("endDate")

        if (managerScope && managerScopeDenied(managerScope, { regionalOfficeId: regionalOfficeId || null })) {
            return forbidden("Forbidden: cannot query attendance outside your scope.")
        }

        const scopedWhere = {
            ...(regionalOfficeId ? { regionalOfficeId } : {}),
            ...buildManagerScopeWhere(managerScope, { regionalOfficeId: "regionalOfficeId" }),
        }

        const deployments = await prisma.deployment.findMany({
            where: {
                status: "ACTIVE",
                ...scopedWhere,
                ...(clientId ? { clientId } : {}),
                ...(branchId ? { branchId } : {}),
            },
            include: {
                guard: {
                    select: {
                        id: true,
                        parwestId: true,
                        name: true,
                        attendances: {
                            where: {
                                ...(startDate || endDate
                                    ? {
                                        date: {
                                            ...(startDate ? { gte: new Date(startDate) } : {}),
                                            ...(endDate ? { lte: new Date(endDate) } : {}),
                                        },
                                    }
                                    : {}),
                            },
                            orderBy: { date: "desc" },
                            take: 120,
                        },
                    },
                },
                client: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                branch: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                regionalOffice: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            take: 500,
        })

        type ClientAttendanceRow = {
            deploymentId: string
            date: Date | null
            status: string
            shiftType: string | null
            guard: {
                id: string
                parwestId: string
                name: string
            }
            client: {
                id: string
                name: string
            }
            branch: {
                id: string
                name: string
            } | null
            regionalOffice: {
                id: string
                name: string
            }
        }

        const rows: ClientAttendanceRow[] = deployments.flatMap((deployment): ClientAttendanceRow[] => {
            const guard = deployment.guard
            const guardAttendances = Array.isArray(guard?.attendances) ? guard.attendances : []

            if (guardAttendances.length === 0) {
                return [
                    {
                        deploymentId: deployment.id,
                        date: null,
                        status: "NO_RECORD",
                        shiftType: null,
                        guard: {
                            id: guard?.id || "unknown-guard",
                            parwestId: guard?.parwestId || "—",
                            name: guard?.name || "Unknown Guard",
                        },
                        client: deployment.client,
                        branch: deployment.branch,
                        regionalOffice: deployment.regionalOffice,
                    },
                ]
            }

            return guardAttendances.map((attendance) => ({
                deploymentId: deployment.id,
                date: attendance.date,
                status: attendance.status,
                shiftType: attendance.shiftType,
                guard: {
                    id: guard?.id || "unknown-guard",
                    parwestId: guard?.parwestId || "—",
                    name: guard?.name || "Unknown Guard",
                },
                client: deployment.client,
                branch: deployment.branch,
                regionalOffice: deployment.regionalOffice,
            }))
        })

        return NextResponse.json(rows)
    } catch (error: unknown) {
        console.error("Error fetching client attendance:", error)
        return internalServerError("Failed to fetch client attendance")
    }
}
