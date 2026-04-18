import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { buildManagerScopeWhere, deriveManagerScope } from "@/lib/access/scope"
import { internalServerError, unauthorized } from "@/lib/api/response"

/**
 * Returns the cross-client pricing overview — one row per client with:
 *   - contract count
 *   - current-rate summary (guardType → rate)
 * Backs both the standalone /clients/pricing page and the client listing.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    const scope = deriveManagerScope(session)

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")?.trim() || undefined
    const status = searchParams.get("status") || undefined
    const guardType = searchParams.get("guardType") || undefined

    const scopeWhere = scope ? buildManagerScopeWhere(scope, { regionId: "regionId", regionalOfficeId: "regionalOfficeId" }) : {}
    const where: Prisma.ClientWhereInput = { ...scopeWhere }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
      ]
    }
    if (status) where.status = status

    const clients = await prisma.client.findMany({
      where,
      select: {
        id: true,
        name: true,
        type: true,
        city: true,
        status: true,
        region: { select: { name: true } },
        contracts: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            type: true,
            branchId: true,
            branch: { select: { id: true, name: true } },
            rates: {
              where: { isCurrentRate: true, ...(guardType ? { guardType } : {}) },
              select: {
                id: true,
                guardType: true,
                exService: true,
                rate: true,
                extraHourRate: true,
                rateStartDate: true,
                province: true,
                city: true,
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    })

    const rows = clients.map((c) => {
      const allCurrentRates = c.contracts.flatMap((ct) => ct.rates)
      // Deduplicate rates by guardType (prefer highest rate if multiple)
      const byGuardType = new Map<string, (typeof allCurrentRates)[number]>()
      for (const r of allCurrentRates) {
        const existing = byGuardType.get(r.guardType)
        if (!existing || Number(r.rate) > Number(existing.rate)) {
          byGuardType.set(r.guardType, r)
        }
      }
      return {
        id: c.id,
        name: c.name,
        type: c.type,
        city: c.city,
        status: c.status,
        regionName: c.region?.name ?? null,
        contractCount: c.contracts.length,
        branchContractCount: c.contracts.filter((ct) => ct.branchId).length,
        clientLevelContractCount: c.contracts.filter((ct) => !ct.branchId).length,
        currentRates: Array.from(byGuardType.values()).map((r) => ({
          guardType: r.guardType,
          exService: r.exService,
          rate: Number(r.rate),
          extraHourRate: r.extraHourRate != null ? Number(r.extraHourRate) : null,
        })),
      }
    })

    return NextResponse.json(rows)
  } catch (error) {
    console.error("Error building client pricing summary:", error)
    return internalServerError("Failed to fetch pricing summary.")
  }
}
