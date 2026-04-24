import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { forbidden, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!hasAction(session, "GUARDS", "VIEW")) return forbidden("Access denied.")

  const { id } = await params

  try {
    const deployments = await prisma.deployment.findMany({
      where: { guardId: id },
      orderBy: { deploymentDate: "desc" },
      include: {
        client: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true, city: true } },
        regionalOffice: { select: { id: true, name: true } },
      },
    })

    const rows = deployments.map((d) => ({
      id: d.id,
      status: d.status,
      shiftType: d.shiftType,
      designation: d.designation,
      deploymentType: d.deploymentType ?? null,
      deploymentNature: d.deploymentNature ?? null,
      deploymentDate: d.deploymentDate.toISOString(),
      endDate: d.endDate ? d.endDate.toISOString() : null,
      dayShiftStart: d.dayShiftStart ?? null,
      dayShiftEnd: d.dayShiftEnd ?? null,
      nightShiftStart: d.nightShiftStart ?? null,
      nightShiftEnd: d.nightShiftEnd ?? null,
      salary: d.salary ?? null,
      rate: d.rate ?? null,
      client: d.client,
      branch: d.branch,
      regionalOffice: d.regionalOffice,
    }))

    return NextResponse.json(rows)
  } catch (error) {
    console.error(`[GET /api/guards/${id}/deployments] failed:`, error)
    return NextResponse.json([], { status: 200 })
  }
}