import { prisma } from "@/lib/db"

export type GuardCurrentContext = {
  guardId: string
  parwestId: string
  name: string
  fatherName: string | null
  phone: string | null
  cnic: string | null
  /**
   * Legacy `status` shadow (PENDING | ACTIVE | PRESENT | DEFAULT | INACTIVE |
   * TERMINATED). Kept as a transitional display value for backward
   * compatibility. Prefer `lifecycleStatus` for status labels/badges and
   * `isDeployed` for deployment state — see src/lib/guards/lifecycle.ts.
   */
  status: string
  /** Canonical lifecycle state: PENDING | ACTIVE | INACTIVE | TERMINATED. */
  lifecycleStatus: string
  /** Derived: true when the guard holds an ACTIVE deployment. */
  isDeployed: boolean
  guardType: string | null
  photoUrl: string | null
  guardSalary: number | null
  client: { id: string; name: string } | null
  branch: { id: string; name: string; city: string | null } | null
  currentSupervisor: { id: string; name: string; email: string | null } | null
  currentManager: { id: string; name: string; email: string | null } | null
  deploymentDays: number
  doubleDutyDays: number
  salaryRate: number | null
  overtimeRate: number | null
  currentUnpaidLoan: number
  deployment: {
    id: string
    deploymentDate: string
    shiftType: string
    designation: string
  } | null
}

function monthRange(monthInput?: string) {
  const now = new Date()
  const input = monthInput
    ? (/^\d{4}-\d{2}$/.test(monthInput) ? `${monthInput}-01` : monthInput)
    : null
  const date = input ? new Date(input) : now
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
  return { start, end, year: start.getUTCFullYear() }
}

export async function getCurrentGuardContext(
  guardIdOrParwestId: string,
  monthInput?: string
): Promise<GuardCurrentContext | null> {
  const guard = await prisma.guard.findFirst({
    where: {
      OR: [{ id: guardIdOrParwestId }, { parwestId: guardIdOrParwestId }],
    },
    select: {
      id: true,
      parwestId: true,
      name: true,
      fatherName: true,
      phone: true,
      cnic: true,
      status: true,
      lifecycleStatus: true,
      photoUrl: true,
      salary: true,
    },
  })

  if (!guard) return null

  const { start, end } = monthRange(monthInput)

  const [activeDeployment, supervisorAssignment, monthDeployments, monthAttendance, unpaidLoansAgg] = await Promise.all([
    prisma.deployment.findFirst({
      where: { guardId: guard.id, status: "ACTIVE" },
      orderBy: { deploymentDate: "desc" },
      include: {
        client: { select: { id: true, name: true, assignedManagerId: true } },
        branch: { select: { id: true, name: true, city: true, assignedManagerId: true } },
      },
    }),
    prisma.guardSupervisorAssignment.findFirst({
      where: { guardId: guard.id, status: "ACTIVE" },
      orderBy: { assignedAt: "desc" },
      include: { supervisor: { select: { id: true, name: true, email: true } } },
    }),
    prisma.deployment.findMany({
      where: {
        guardId: guard.id,
        deploymentDate: { gte: start, lt: end },
      },
      select: { deploymentDate: true, salary: true, rate: true, overtime: true, guardType: true },
    }),
    prisma.attendance.findMany({
      where: {
        guardId: guard.id,
        date: { gte: start, lt: end },
      },
      select: { attendanceType: true, date: true },
    }),
    prisma.loan.aggregate({
      where: { guardId: guard.id, status: "PENDING" },
      _sum: { amount: true },
    }),
  ])

  // Resolve supervisor: direct assignment takes precedence; fall back to client-supervisor
  let supervisor: { id: string; name: string; email: string | null } | null = null
  if (supervisorAssignment?.supervisor) {
    supervisor = supervisorAssignment.supervisor
  } else if (activeDeployment?.clientId) {
    const clientSup = await prisma.clientSupervisorAssignment.findFirst({
      where: {
        clientId: activeDeployment.clientId,
        branchId: activeDeployment.branchId ?? null,
        status: "ACTIVE",
      },
      orderBy: { createdAt: "desc" },
      include: { supervisor: { select: { id: true, name: true, email: true } } },
    })
    if (clientSup?.supervisor) supervisor = clientSup.supervisor
  }

  // Resolve manager: prefer branch.assignedManagerId, fall back to client.assignedManagerId
  let manager: { id: string; name: string; email: string | null } | null = null
  const managerId = activeDeployment?.branch?.assignedManagerId ?? activeDeployment?.client?.assignedManagerId ?? null
  if (managerId) {
    const managerUser = await prisma.user.findUnique({
      where: { id: managerId },
      select: { id: true, name: true, email: true },
    })
    if (managerUser) manager = managerUser
  }

  const uniqueDays = new Set<string>()
  for (const d of monthDeployments) uniqueDays.add(d.deploymentDate.toISOString().slice(0, 10))

  const doubleDutyDays = monthAttendance.filter(
    (a) => a.attendanceType === "DOUBLE_DUTY_DAY" || a.attendanceType === "DOUBLE_DUTY_NIGHT"
  ).length

  return {
    guardId: guard.id,
    parwestId: guard.parwestId,
    name: guard.name,
    fatherName: guard.fatherName,
    phone: guard.phone,
    cnic: guard.cnic,
    status: guard.status,
    // Generated Prisma type is `string | null`; the column is non-null with a
    // default, but fall back to the legacy shadow to satisfy the `string`
    // contract and stay safe if a row is somehow null.
    lifecycleStatus: guard.lifecycleStatus ?? guard.status,
    isDeployed: Boolean(activeDeployment),
    guardType: activeDeployment?.guardType ?? null,
    photoUrl: guard.photoUrl,
    guardSalary: guard.salary,
    client: activeDeployment?.client
      ? { id: activeDeployment.client.id, name: activeDeployment.client.name }
      : null,
    branch: activeDeployment?.branch
      ? {
          id: activeDeployment.branch.id,
          name: activeDeployment.branch.name,
          city: activeDeployment.branch.city,
        }
      : null,
    currentSupervisor: supervisor,
    currentManager: manager,
    deploymentDays: uniqueDays.size,
    doubleDutyDays,
    salaryRate: activeDeployment?.salary ?? activeDeployment?.rate ?? null,
    overtimeRate: activeDeployment?.overtime ?? null,
    currentUnpaidLoan: Number(unpaidLoansAgg._sum.amount ?? 0),
    deployment: activeDeployment
      ? {
          id: activeDeployment.id,
          deploymentDate: activeDeployment.deploymentDate.toISOString(),
          shiftType: activeDeployment.shiftType,
          designation: activeDeployment.designation,
        }
      : null,
  }
}
