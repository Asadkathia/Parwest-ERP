import type { Prisma, PrismaClient } from "@prisma/client"

function round2(value: number) {
  return Math.round(value * 100) / 100
}

type Tx = Prisma.TransactionClient | PrismaClient

/**
 * Apply unused client (and optional branch) advance payments against a freshly created
 * invoice, oldest first. Returns the total amount applied so the caller can update
 * the invoice's paidAmount/status accordingly. Must run inside a transaction.
 */
export async function applyAvailableAdvances(
  tx: Tx,
  args: { invoiceId: string; clientId: string; branchId: string | null; invoiceAmount: number }
) {
  const outstanding = round2(args.invoiceAmount)
  if (outstanding <= 0) return { applied: 0, applications: [] as { advanceId: string; amount: number }[] }

  const advances = await tx.clientAdvancePayment.findMany({
    where: {
      clientId: args.clientId,
      // branch-specific advances apply only to that branch; client-level advances apply anywhere
      OR: [{ branchId: null }, ...(args.branchId ? [{ branchId: args.branchId }] : [])],
    },
    orderBy: { paymentDate: "asc" },
  })

  let remaining = outstanding
  const applications: { advanceId: string; amount: number }[] = []

  for (const adv of advances) {
    if (remaining <= 0) break
    const available = round2((adv.amount ?? 0) - (adv.appliedAmount ?? 0))
    if (available <= 0) continue
    const take = round2(Math.min(available, remaining))
    if (take <= 0) continue

    await tx.clientAdvancePayment.update({
      where: { id: adv.id },
      data: { appliedAmount: round2((adv.appliedAmount ?? 0) + take) },
    })
    await tx.invoiceAdvanceApplication.create({
      data: { invoiceId: args.invoiceId, advanceId: adv.id, amount: take },
    })
    applications.push({ advanceId: adv.id, amount: take })
    remaining = round2(remaining - take)
  }

  return { applied: round2(outstanding - remaining), applications }
}
