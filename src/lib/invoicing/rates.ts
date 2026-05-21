import { prisma } from "@/lib/db"
import { selectContractRate, type CandidateRate } from "@/lib/invoicing/rateSelection"

export type RateLookup = {
  dailyRate: number
  overtimeHourly: number
  source: "CONTRACT" | "NONE"
  note?: string
}

const NONE: RateLookup = { dailyRate: 0, overtimeHourly: 0, source: "NONE" }

/**
 * Resolve the single applicable contract for a (client, branch) and return its
 * candidate rates. A branch-specific active contract overrides the client-level
 * one; the client-level contract is the fallback. Returns empty when neither
 * exists.
 */
export async function resolveContractRateContext(args: {
  clientId: string
  branchId: string | null
}): Promise<{ rates: CandidateRate[]; contractId: string | null; contractBranchId: string | null }> {
  let contract: { id: string; branchId: string | null } | null = null

  if (args.branchId) {
    contract = await prisma.clientContract.findFirst({
      where: { clientId: args.clientId, branchId: args.branchId, isActive: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, branchId: true },
    })
  }
  if (!contract) {
    contract = await prisma.clientContract.findFirst({
      where: { clientId: args.clientId, branchId: null, isActive: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, branchId: true },
    })
  }
  if (!contract) return { rates: [], contractId: null, contractBranchId: null }

  const rates = await prisma.clientContractRate.findMany({
    where: { contractId: contract.id },
    orderBy: [{ rateStartDate: "desc" }, { isCurrentRate: "desc" }, { id: "asc" }],
    select: {
      id: true,
      exService: true,
      province: true,
      city: true,
      rate: true,
      extraHourRate: true,
      isCurrentRate: true,
      rateStartDate: true,
      rateEndDate: true,
    },
  })
  return { rates, contractId: contract.id, contractBranchId: contract.branchId }
}

/** Map a selected candidate rate to the billing RateLookup shape. */
export function toRateLookup(rate: CandidateRate | null, contractId: string | null): RateLookup {
  if (!rate) return NONE
  return {
    dailyRate: Number(rate.rate ?? 0),
    overtimeHourly: Number(rate.extraHourRate ?? 0),
    source: "CONTRACT",
    note: contractId ? `contract ${contractId.slice(-6)}` : undefined,
  }
}

/**
 * Single-shot lookup: resolve the contract for the (client, branch) and select
 * the rate for the given exService + geo as of a date.
 */
export async function fromContract(args: {
  clientId: string
  branchId: string | null
  exService: string
  province: string | null
  city: string | null
  asOf: Date
}): Promise<RateLookup> {
  const { rates, contractId } = await resolveContractRateContext({
    clientId: args.clientId,
    branchId: args.branchId,
  })
  const selected = selectContractRate(rates, {
    exService: args.exService,
    province: args.province,
    city: args.city,
    asOf: args.asOf,
  })
  return toRateLookup(selected, contractId)
}
