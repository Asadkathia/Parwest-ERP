import { prisma } from "@/lib/db"

export type RateLookup = {
  dailyRate: number
  overtimeHourly: number
  source: "DEPLOYMENT" | "CONTRACT" | "NONE"
  note?: string
}

type DeploymentRateInput = {
  salary?: number | null
  overtime?: number | null
}

const NONE: RateLookup = { dailyRate: 0, overtimeHourly: 0, source: "NONE" }

export function fromDeployment(d: DeploymentRateInput): RateLookup | null {
  const dailyRate = Number(d.salary ?? 0)
  const overtimeHourly = Number(d.overtime ?? 0)
  if (dailyRate <= 0 && overtimeHourly <= 0) return null
  return { dailyRate, overtimeHourly, source: "DEPLOYMENT" }
}

/**
 * Look up the active ClientContractRate for a (clientId, branchId, guardType) tuple
 * as of `asOf`. Prefers branch-specific contract, then falls back to client-level.
 */
export async function fromContract(args: {
  clientId: string
  branchId: string | null
  guardType: string | null
  asOf: Date
}): Promise<RateLookup> {
  if (!args.guardType) return NONE

  const contracts = await prisma.clientContract.findMany({
    where: { clientId: args.clientId, isActive: true },
    select: { id: true, branchId: true },
  })
  if (!contracts.length) return NONE

  const ranked = [...contracts].sort((a, b) => {
    const aMatch = a.branchId === args.branchId ? 0 : a.branchId === null ? 1 : 2
    const bMatch = b.branchId === args.branchId ? 0 : b.branchId === null ? 1 : 2
    return aMatch - bMatch
  })
  const candidateIds = ranked.map((c) => c.id)

  const rate = await prisma.clientContractRate.findFirst({
    where: {
      contractId: { in: candidateIds },
      guardType: args.guardType,
      OR: [{ isCurrentRate: true }, { rateStartDate: { lte: args.asOf } }],
    },
    orderBy: [{ isCurrentRate: "desc" }, { rateStartDate: "desc" }],
  })
  if (!rate) return NONE

  return {
    dailyRate: Number(rate.rate ?? 0),
    overtimeHourly: Number(rate.extraHourRate ?? 0),
    source: "CONTRACT",
    note: `contract ${rate.contractId.slice(-6)}`,
  }
}
