import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const regionalOfficeId = searchParams.get("regionalOfficeId") || undefined
        const clientId = searchParams.get("clientId") || undefined
        const branchId = searchParams.get("branchId") || undefined
        const startDate = searchParams.get("startDate")
        const endDate = searchParams.get("endDate")

        const deployments = await prisma.deployment.findMany({
            where: {
                status: "ACTIVE",
                ...(regionalOfficeId ? { regionalOfficeId } : {}),
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
            if (deployment.guard.attendances.length === 0) {
                return [
                    {
                        deploymentId: deployment.id,
                        date: null,
                        status: "NO_RECORD",
                        shiftType: null,
                        guard: {
                            id: deployment.guard.id,
                            parwestId: deployment.guard.parwestId,
                            name: deployment.guard.name,
                        },
                        client: deployment.client,
                        branch: deployment.branch,
                        regionalOffice: deployment.regionalOffice,
                    },
                ]
            }

            return deployment.guard.attendances.map((attendance) => ({
                deploymentId: deployment.id,
                date: attendance.date,
                status: attendance.status,
                shiftType: attendance.shiftType,
                guard: {
                    id: deployment.guard.id,
                    parwestId: deployment.guard.parwestId,
                    name: deployment.guard.name,
                },
                client: deployment.client,
                branch: deployment.branch,
                regionalOffice: deployment.regionalOffice,
            }))
        })

        return NextResponse.json(rows)
    } catch (error: any) {
        console.error("Error fetching client attendance:", error)
        return NextResponse.json({ message: "Failed to fetch client attendance" }, { status: 500 })
    }
}
