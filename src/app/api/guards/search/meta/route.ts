import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { forbidden, unauthorized } from "@/lib/api/response"
import { hasModuleAccess } from "@/lib/api/permissions"

// Static options derived from schema definitions
const GUARD_STATUSES = ["PENDING", "ACTIVE", "PRESENT", "DEFAULT", "INACTIVE", "TERMINATED"]
const EX_SERVICE_TYPES = ["ARMY", "POLICE", "RANGERS", "MUJAHID", "OTHER", "CIVILIAN"]
const VERIFICATION_STATUSES = [
    "REQUEST_SUBMITTED",
    "REQUEST_NOT_SUBMITTED",
    "VERIFIED",
    "NON_VERIFIED",
    "LETTER_ISSUED",
    "LETTER_NOT_ISSUED",
    "FEEDBACK_RECEIVED",
    "FEEDBACK_PENDING",
]
const PREREQUISITE_STATUSES = ["PENDING", "VERIFIED", "REJECTED"]

export async function GET() {
    try {
        const session = await auth()
        if (!session) return unauthorized()
        if (!hasModuleAccess(session, "GUARDS")) return forbidden("Access denied.")

        const [docTypes, clients, offices, educations, religions] = await Promise.all([
            // Verification types — only VERIFICATION category doc types
            prisma.guardDocumentType
                .findMany({
                    where: { isActive: true, docCategory: "VERIFICATION" },
                    select: { name: true },
                    orderBy: { sortOrder: "asc" },
                })
                .then((rows) => rows.map((r) => r.name)),

            // Clients for filter
            prisma.client
                .findMany({
                    select: { id: true, name: true },
                    orderBy: { name: "asc" },
                    take: 200,
                })
                .catch(() => [] as { id: string; name: string }[]),

            // Regional offices
            prisma.regionalOffice
                .findMany({
                    select: { id: true, name: true },
                    orderBy: { name: "asc" },
                })
                .catch(() => [] as { id: string; name: string }[]),

            // Distinct education values from guards
            prisma.guard
                .findMany({
                    where: { education: { not: null } },
                    select: { education: true },
                    distinct: ["education"],
                    orderBy: { education: "asc" },
                })
                .then((rows) => rows.map((r) => r.education).filter(Boolean) as string[])
                .catch(() => [] as string[]),

            // Distinct religion values from guards
            prisma.guard
                .findMany({
                    where: { religion: { not: null } },
                    select: { religion: true },
                    distinct: ["religion"],
                    orderBy: { religion: "asc" },
                })
                .then((rows) => rows.map((r) => r.religion).filter(Boolean) as string[])
                .catch(() => [] as string[]),
        ])

        return NextResponse.json({
            statuses: GUARD_STATUSES,
            exServiceTypes: EX_SERVICE_TYPES,
            verificationTypes: docTypes,
            verificationStatuses: VERIFICATION_STATUSES,
            prerequisiteStatuses: PREREQUISITE_STATUSES,
            clients,
            offices,
            educations,
            religions,
        })
    } catch (error) {
        console.error("Error fetching search meta:", error)
        return NextResponse.json({
            statuses: GUARD_STATUSES,
            exServiceTypes: EX_SERVICE_TYPES,
            verificationTypes: [],
            verificationStatuses: VERIFICATION_STATUSES,
            prerequisiteStatuses: PREREQUISITE_STATUSES,
            clients: [],
            offices: [],
            educations: [],
            religions: [],
        })
    }
}