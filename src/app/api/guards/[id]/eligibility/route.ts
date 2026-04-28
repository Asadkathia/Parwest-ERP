import { NextRequest, NextResponse } from "next/server"
import { StoreInventoryAssignmentStatus } from "@prisma/client"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"

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
    if (!hasAction(session, "GUARDS", "VIEW")) return forbidden("Access denied.")

    const { id: guardId } = await params

    const ruleDelegate = prisma.guardDeploymentInventoryRule

    const [guard, docTypes, prereqs, pledgedDocs, deploymentInventoryRule, activeDeployments] = await Promise.all([
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
      prisma.deployment.findMany({
        where: { guardId, status: "ACTIVE" },
        select: {
          id: true,
          shiftType: true,
          deploymentDate: true,
          client: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
        },
      }),
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

    // ── Check 5: Existing Deployment ──────────────────────────────────────
    // Surfaces existing active deployments so the deploy form can prompt the
    // user to revoke before redeploying (or accept double-duty when allowed).
    const hasBoth = activeDeployments.some((d) => d.shiftType === "BOTH")
    const deploymentCheck: EligibilityCheck = {
      pass: activeDeployments.length === 0 || (!hasBoth && activeDeployments.length < 2),
      label: "Deployment Slot",
      message:
        activeDeployments.length === 0
          ? "No active deployment"
          : hasBoth
          ? `Already deployed on BOTH shifts at ${activeDeployments[0]?.client?.name ?? "—"} — revoke first`
          : `Already deployed at ${activeDeployments
              .map((d) => `${d.client?.name ?? "—"}${d.branch?.name ? " / " + d.branch.name : ""} (${d.shiftType})`)
              .join("; ")} — revoke or use double-duty`,
    }

    const checks = {
      status: statusCheck,
      verified: verificationCheck,
      inventory: inventoryCheck,
      pledgedDocs: pledgedCheck,
      deployment: deploymentCheck,
    }

    const eligible = Object.values(checks).every((c) => c.pass)

    return NextResponse.json({
      eligible,
      checks,
      activeDeployments: activeDeployments.map((d) => ({
        id: d.id,
        shiftType: d.shiftType,
        deploymentDate: d.deploymentDate?.toISOString() ?? null,
        clientId: d.client?.id ?? null,
        clientName: d.client?.name ?? null,
        branchId: d.branch?.id ?? null,
        branchName: d.branch?.name ?? null,
      })),
    })
  } catch (error) {
    console.error("Guard eligibility check failed:", error)
    return internalServerError("Failed to check guard eligibility")
  }
}
