import type { BillingMode } from "@prisma/client"
import { prisma } from "@/lib/db"
import { type ScopedRate } from "@/lib/invoicing/rateSelection"
import { type GuardRate } from "@/lib/invoicing/guardRate"

export type RateLookup = {
  dailyRate: number
  overtimeHourly: number
  source: "CONTRACT" | "NONE"
  note?: string
}

const NONE: RateLookup = { dailyRate: 0, overtimeHourly: 0, source: "NONE" }

export type ContractRateContext = {
  billingMode: BillingMode
  contractId: string | null
  contractBranchId: string | null
  /** Populated for MANUAL contracts; empty otherwise. */
  scopedRates: ScopedRate[]
  /** Populated for DYNAMIC contracts; empty otherwise. */
  guardRates: GuardRate[]
}

const EMPTY_CONTEXT: ContractRateContext = {
  billingMode: "MANUAL",
  contractId: null,
  contractBranchId: null,
  scopedRates: [],
  guardRates: [],
}

/**
 * Resolve the single applicable contract for a (client, branch) and load the
 * rate set that matches its billing mode. A branch-specific active contract
 * overrides the client-level one; the client-level contract is the fallback.
 *
 * - MANUAL  → scoped `ClientContractRate` rows (resolved by most-specific scope).
 * - DYNAMIC → per-guard `ContractGuardRate` rows.
 *
 * Returns an empty MANUAL context when no contract exists.
 */
export async function resolveContractRateContext(args: {
  clientId: string
  branchId: string | null
}): Promise<ContractRateContext> {
  let contract: { id: string; branchId: string | null; billingMode: BillingMode } | null = null

  if (args.branchId) {
    contract = await prisma.clientContract.findFirst({
      where: { clientId: args.clientId, branchId: args.branchId, isActive: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, branchId: true, billingMode: true },
    })
  }
  if (!contract) {
    contract = await prisma.clientContract.findFirst({
      where: { clientId: args.clientId, branchId: null, isActive: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, branchId: true, billingMode: true },
    })
  }
  if (!contract) return EMPTY_CONTEXT

  if (contract.billingMode === "DYNAMIC") {
    const guardRates = await prisma.contractGuardRate.findMany({
      where: { contractId: contract.id },
      select: {
        id: true,
        guardId: true,
        rate: true,
        extraHourRate: true,
        isCurrentRate: true,
        rateStartDate: true,
        rateEndDate: true,
      },
    })
    return {
      billingMode: "DYNAMIC",
      contractId: contract.id,
      contractBranchId: contract.branchId,
      scopedRates: [],
      guardRates,
    }
  }

  const scopedRows = await prisma.clientContractRate.findMany({
    where: { contractId: contract.id },
    select: {
      id: true,
      scopeLevel: true,
      scopeBranchId: true,
      scopeRegionId: true,
      scopeProvince: true,
      rate: true,
      extraHourRate: true,
      isCurrentRate: true,
      rateStartDate: true,
      rateEndDate: true,
    },
  })
  // Only rows with an explicit scope participate in MANUAL scope resolution.
  const scopedRates: ScopedRate[] = scopedRows
    .filter((r): r is typeof r & { scopeLevel: NonNullable<typeof r.scopeLevel> } => r.scopeLevel != null)
    .map((r) => ({
      id: r.id,
      scopeLevel: r.scopeLevel,
      scopeBranchId: r.scopeBranchId,
      scopeRegionId: r.scopeRegionId,
      scopeProvince: r.scopeProvince,
      rate: r.rate,
      extraHourRate: r.extraHourRate,
      isCurrentRate: r.isCurrentRate,
      rateStartDate: r.rateStartDate,
      rateEndDate: r.rateEndDate,
    }))
  return {
    billingMode: "MANUAL",
    contractId: contract.id,
    contractBranchId: contract.branchId,
    scopedRates,
    guardRates: [],
  }
}

/** Map a selected rate (scoped or per-guard) to the billing RateLookup shape. */
export function toRateLookup(
  rate: { rate: number; extraHourRate: number | null } | null,
  contractId: string | null,
): RateLookup {
  if (!rate) return NONE
  return {
    dailyRate: Number(rate.rate ?? 0),
    overtimeHourly: Number(rate.extraHourRate ?? 0),
    source: "CONTRACT",
    note: contractId ? `contract ${contractId.slice(-6)}` : undefined,
  }
}

