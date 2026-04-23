import { NextRequest, NextResponse } from "next/server"
import { StoreInventoryAssignmentStatus } from "@prisma/client"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasModuleAccess } from "@/lib/api/permissions"

type EligibilityCheck = {
  pass: boolean
  label: string
  message: string
}

function parseAllowedCategoryIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => String(entry ?? "").trim())
    .filter((entry) => entry.length > 0)
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasModuleAccess(session, "GUARDS")) return forbidden("Access denied.")

    const { id: guardId } = await params

    const ruleDelegate = prisma.guardDeploymentInventoryRule

    const [guard, docTypes, prereqs, pledgedDocs, deploymentInventoryRule] = await Promise.all([
      prisma.guard.findUnique({
        where: { id: guardId },
        select: { id: true, lifecycleStatus: true },
      }),
      prisma.guardDocumentType.findMany({
        where: { isActive: true, docCategory: "VERIFICATION" },
        select: { name: true },
      }),
      prisma.guardPrerequisite.findMany({
        where: { guardId },
        select: { docTypeName: true, status: true },
      }),
      prisma.guardPledgedDocumentRecord.findMany({
        where: { guardId, status: "HELD" },
        select: { id: true },
      }),
      ruleDelegate
        ? ruleDelegate.findUnique({
            where: { ruleKey: "default" },
            select: { isActive: true, minimumAssignedItems: true, allowedCategoryIds: true },
          })
        : Promise.resolve(null),
    ])

    if (!guard) return notFound("Guard not found")

    // ── Check 1: Guard Status ─────────────────────────────────────────────
    // Authoritative field is lifecycleStatus; the legacy `status` shadow flips
    // to PRESENT when ACTIVE+deployed, which is precisely the double-duty case.
    const statusCheck: EligibilityCheck = {
      pass: guard.lifecycleStatus === "ACTIVE",
      label: "Guard Status",
      message: guard.lifecycleStatus === "ACTIVE"
        ? "Guard is Active"
        : `Guard lifecycle status is ${guard.lifecycleStatus} — only Active guards can be deployed`,
    }

    // ── Check 2: Verification ─────────────────────────────────────────────
    const prereqMap = new Map(prereqs.map((p) => [p.docTypeName, p]))

    // Police Verification is always mandatory
    const policeDocType = docTypes.find(
      (dt) => dt.name.toLowerCase().includes("police")
    )
    const policePrereq = policeDocType ? prereqMap.get(policeDocType.name) : null
    const policeVerified = !policeDocType || policePrereq?.status === "VERIFIED"

    // All verification doc types the guard has submitted must be verified
    const submittedVerDocs = docTypes.filter((dt) => prereqMap.has(dt.name))
    const allSubmittedVerified = submittedVerDocs.every(
      (dt) => prereqMap.get(dt.name)?.status === "VERIFIED"
    )

    const verificationCheck: EligibilityCheck = {
      pass: policeVerified && allSubmittedVerified,
      label: "Verification",
      message: !policeDocType
        ? "No Police Verification document type configured"
        : !policeVerified
        ? "Police Verification is mandatory — must be attached and verified"
        : !allSubmittedVerified
        ? `${submittedVerDocs.filter((dt) => prereqMap.get(dt.name)?.status !== "VERIFIED").length} submitted verification document(s) not yet verified`
        : `Police Verification verified${submittedVerDocs.length > 1 ? ` + ${submittedVerDocs.length - 1} other verified` : ""}`,
    }

    // ── Check 3: Inventory Assigned ───────────────────────────────────────
    const inventoryRuleActive = deploymentInventoryRule?.isActive === true
    const requiredInventoryCount = Math.max(0, Number(deploymentInventoryRule?.minimumAssignedItems ?? 0))
    const allowedCategoryIds = parseAllowedCategoryIds(deploymentInventoryRule?.allowedCategoryIds)

    const inventoryCount = inventoryRuleActive
      ? await prisma.storeInventoryAssignment.count({
          where: {
            assignedToGuardId: guardId,
            status: StoreInventoryAssignmentStatus.ASSIGNED,
            ...(allowedCategoryIds.length > 0
              ? {
                  product: {
                    categoryId: { in: allowedCategoryIds },
                  },
                }
              : {}),
          },
        })
      : 0

    const inventoryCheck: EligibilityCheck = {
      pass: inventoryRuleActive ? inventoryCount >= requiredInventoryCount : true,
      label: "Inventory",
      message: inventoryRuleActive
        ? `${inventoryCount}/${requiredInventoryCount} required assigned item(s)` +
          (allowedCategoryIds.length > 0 ? " in configured categories" : "")
        : "Inventory prerequisite is disabled by admin",
    }

    // ── Check 4: Pledged Documents ────────────────────────────────────────
    const pledgedCount = pledgedDocs.length
    const pledgedCheck: EligibilityCheck = {
      pass: pledgedCount > 0,
      label: "Pledged Documents",
      message:
        pledgedCount > 0
          ? `${pledgedCount} pledged document${pledgedCount > 1 ? "s" : ""} on file`
          : "No pledged documents submitted",
    }

    const checks = {
      status: statusCheck,
      verified: verificationCheck,
      inventory: inventoryCheck,
      pledgedDocs: pledgedCheck,
    }

    const eligible = Object.values(checks).every((c) => c.pass)

    return NextResponse.json({ eligible, checks })
  } catch (error) {
    console.error("Guard eligibility check failed:", error)
    return internalServerError("Failed to check guard eligibility")
  }
}
