import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { internalServerError, notFound, unauthorized } from "@/lib/api/response"

type EligibilityCheck = {
  pass: boolean
  label: string
  message: string
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const { id: guardId } = await params

    const [guard, docTypes, prereqs, pledgedDocs, inventoryAssignments] = await Promise.all([
      prisma.guard.findUnique({
        where: { id: guardId },
        select: { id: true, status: true },
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
      prisma.storeInventoryAssignment.findMany({
        where: { assignedToGuardId: guardId, status: "ASSIGNED" },
        select: { id: true },
      }),
    ])

    if (!guard) return notFound("Guard not found")

    // ── Check 1: Guard Status ─────────────────────────────────────────────
    const statusCheck: EligibilityCheck = {
      pass: guard.status === "ACTIVE",
      label: "Guard Status",
      message: guard.status === "ACTIVE"
        ? "Guard is Active"
        : `Guard status is ${guard.status} — only Active guards can be deployed`,
    }

    // ── Check 2: Verification ─────────────────────────────────────────────
    const totalVerifications = docTypes.length
    const prereqMap = new Map(prereqs.map((p) => [p.docTypeName, p.status]))
    const verifiedCount = docTypes.filter(
      (dt) => prereqMap.get(dt.name) === "VERIFIED"
    ).length
    const verificationCheck: EligibilityCheck = {
      pass: totalVerifications > 0 && verifiedCount === totalVerifications,
      label: "Verification",
      message:
        totalVerifications === 0
          ? "No verification documents configured"
          : verifiedCount === totalVerifications
          ? `All ${totalVerifications} verification documents verified`
          : `${verifiedCount} of ${totalVerifications} verification documents verified`,
    }

    // ── Check 3: Inventory Assigned ───────────────────────────────────────
    const inventoryCount = inventoryAssignments.length
    const inventoryCheck: EligibilityCheck = {
      pass: inventoryCount > 0,
      label: "Inventory",
      message:
        inventoryCount > 0
          ? `${inventoryCount} inventory item${inventoryCount > 1 ? "s" : ""} assigned`
          : "No inventory assigned to this guard",
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