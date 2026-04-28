import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { buildManagerScopeWhere, deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { forbidden, internalServerError, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import type { Prisma } from "@prisma/client"

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) return unauthorized()
        if (!hasAction(session, "GUARDS", "VIEW")) return forbidden("Access denied.")

        const managerScope = deriveManagerScope(session)
        const { searchParams } = new URL(request.url)

        const q             = searchParams.get("q")?.trim()
        const status        = searchParams.get("status")
        const education     = searchParams.get("education")
        const religion      = searchParams.get("religion")
        const exServiceType = searchParams.get("exServiceType")
        const officeId      = searchParams.get("officeId")
        const regionId      = searchParams.get("regionId")
        const regionalOfficeId = searchParams.get("regionalOfficeId")
        const clientId      = searchParams.get("clientId")
        const createdFrom   = searchParams.get("createdFrom")
        const createdTo     = searchParams.get("createdTo")
        const policeVerified = searchParams.get("policeVerified") === "true"

        if (managerScopeDenied(managerScope, { regionId, regionalOfficeId: regionalOfficeId ?? officeId })) {
            return forbidden("Forbidden: requested scope is outside your assigned region.")
        }

        const where: Prisma.GuardWhereInput = {
            ...(status        ? { status } : {}),
            ...(education     ? { education } : {}),
            ...(religion      ? { religion } : {}),
            ...(exServiceType ? { exServiceType } : {}),
            ...(officeId      ? { regionalOfficeId: officeId } : {}),
            ...(regionalOfficeId && !officeId ? { regionalOfficeId } : {}),
            ...(regionId      ? { regionId } : {}),
            ...(createdFrom || createdTo
                ? {
                      createdAt: {
                          ...(createdFrom ? { gte: new Date(createdFrom) } : {}),
                          ...(createdTo   ? { lte: new Date(`${createdTo}T23:59:59.999Z`) } : {}),
                      },
                  }
                : {}),
            ...(clientId
                ? {
                      deployments: {
                          some: { clientId, status: "ACTIVE" },
                      },
                  }
                : {}),
            ...(policeVerified
                ? {
                      prerequisites: {
                          some: {
                              docTypeName: { contains: "police", mode: "insensitive" },
                              status: "VERIFIED",
                          },
                      },
                  }
                : {}),
            ...buildManagerScopeWhere(managerScope, { regionId: "regionId", regionalOfficeId: "regionalOfficeId" }),
            ...(q
                ? {
                      OR: [
                          { name:      { contains: q, mode: "insensitive" } },
                          { parwestId: { contains: q, mode: "insensitive" } },
                          { cnic:      { contains: q, mode: "insensitive" } },
                          { phone:     { contains: q, mode: "insensitive" } },
                      ],
                  }
                : {}),
        }

        const guards = await prisma.guard.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: 500,
            select: {
                id:             true,
                parwestId:      true,
                name:           true,
                cnic:           true,
                phone:          true,
                photoUrl:       true,
                status:         true,
                education:      true,
                religion:       true,
                exServiceType:  true,
                createdAt:      true,
                regionalOffice: { select: { id: true, name: true } },
                supervisorAssignments: {
                    where: { status: "ACTIVE" },
                    take: 1,
                    select: { supervisor: { select: { name: true } } },
                },
                deployments: {
                    where: { status: "ACTIVE" },
                    take: 1,
                    orderBy: { deploymentDate: "desc" },
                    select: { client: { select: { id: true, name: true } } },
                },
                prerequisites: {
                    select: { docTypeName: true, status: true, verificationStatus: true },
                },
            },
        })

        return NextResponse.json(
            guards.map((g) => ({
                id:             g.id,
                parwestId:      g.parwestId,
                name:           g.name,
                cnic:           g.cnic,
                phone:          g.phone ?? null,
                photoUrl:       g.photoUrl ?? null,
                status:         g.status,
                education:      g.education ?? null,
                religion:       g.religion ?? null,
                exServiceType:  g.exServiceType ?? null,
                createdAt:      g.createdAt?.toISOString() ?? null,
                officeName:     g.regionalOffice?.name ?? null,
                supervisorName: g.supervisorAssignments?.[0]?.supervisor?.name ?? null,
                clientName:     g.deployments?.[0]?.client?.name ?? null,
                prerequisites:  g.prerequisites ?? [],
            }))
        )
    } catch (error: unknown) {
        console.error("Error searching guards:", error)
        return internalServerError("Failed to search guards")
    }
}