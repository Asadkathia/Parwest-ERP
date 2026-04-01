import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { badRequest, internalServerError, serviceUnavailable, unauthorized } from "@/lib/api/response"
import { getPrismaCode, toErrorMessage } from "@/lib/prisma-errors"

function parseAllowedCategoryIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => String(entry || "").trim())
    .filter((entry) => entry.length > 0)
}

export async function GET() {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const ruleDelegate = (prisma as unknown as {
      guardDeploymentInventoryRule?: {
        upsert: (args: unknown) => Promise<{
          id: string
          ruleKey: string
          isActive: boolean
          minimumAssignedItems: number
          allowedCategoryIds: unknown
          updatedAt: Date
        }>
      }
    }).guardDeploymentInventoryRule

    if (!ruleDelegate) {
      return NextResponse.json({
        id: "default",
        ruleKey: "default",
        isActive: false,
        minimumAssignedItems: 1,
        allowedCategoryIds: [],
        migrationRequired: true,
        clientRegenerationRequired: true,
      })
    }

    const rule = await ruleDelegate.upsert({
      where: { ruleKey: "default" },
      create: {
        ruleKey: "default",
        isActive: false,
        minimumAssignedItems: 1,
      },
      update: {},
    })

    return NextResponse.json({
      id: rule.id,
      ruleKey: rule.ruleKey,
      isActive: rule.isActive,
      minimumAssignedItems: rule.minimumAssignedItems,
      allowedCategoryIds: parseAllowedCategoryIds(rule.allowedCategoryIds),
      updatedAt: rule.updatedAt,
    })
  } catch (error) {
    const prismaCode = getPrismaCode(error)
    if (prismaCode === "P2021" || prismaCode === "P2022") {
      // Table/column missing: return a safe default so prerequisites page still loads.
      return NextResponse.json({
        id: "default",
        ruleKey: "default",
        isActive: false,
        minimumAssignedItems: 1,
        allowedCategoryIds: [],
        migrationRequired: true,
      })
    }
    console.error("GET /api/guard-deployment-inventory-rule failed:", error)
    return internalServerError("Failed to load deployment inventory rule")
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const body = await request.json()
    const minimumAssignedItems = Number(body?.minimumAssignedItems ?? 1)
    const isActive = body?.isActive === true
    const allowedCategoryIds = parseAllowedCategoryIds(body?.allowedCategoryIds)

    if (!Number.isFinite(minimumAssignedItems) || minimumAssignedItems < 0) {
      return badRequest("minimumAssignedItems must be a non-negative number.")
    }

    const ruleDelegate = (prisma as unknown as {
      guardDeploymentInventoryRule?: {
        upsert: (args: unknown) => Promise<{
          id: string
          ruleKey: string
          isActive: boolean
          minimumAssignedItems: number
          allowedCategoryIds: unknown
          updatedAt: Date
        }>
      }
    }).guardDeploymentInventoryRule

    if (!ruleDelegate) {
      return serviceUnavailable(
        "Deployment inventory rule model is not available in runtime Prisma client. Run prisma generate and restart dev server."
      )
    }

    const rule = await ruleDelegate.upsert({
      where: { ruleKey: "default" },
      create: {
        ruleKey: "default",
        isActive,
        minimumAssignedItems: Math.floor(minimumAssignedItems),
        allowedCategoryIds,
      },
      update: {
        isActive,
        minimumAssignedItems: Math.floor(minimumAssignedItems),
        allowedCategoryIds,
      },
    })

    return NextResponse.json({
      id: rule.id,
      ruleKey: rule.ruleKey,
      isActive: rule.isActive,
      minimumAssignedItems: rule.minimumAssignedItems,
      allowedCategoryIds: parseAllowedCategoryIds(rule.allowedCategoryIds),
      updatedAt: rule.updatedAt,
    })
  } catch (error) {
    const prismaCode = getPrismaCode(error)
    if (prismaCode === "P2021" || prismaCode === "P2022") {
      return serviceUnavailable(
        "Deployment inventory prerequisite table is missing. Run Prisma migration first."
      )
    }
    console.error("PUT /api/guard-deployment-inventory-rule failed:", error)
    return internalServerError(toErrorMessage(error, "Failed to update deployment inventory rule"))
  }
}
