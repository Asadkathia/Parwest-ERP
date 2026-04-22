import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, forbidden, internalServerError, unauthorized } from "@/lib/api/response"
import { hasModuleAccess } from "@/lib/api/permissions"
import { safeAuditLog } from "@/lib/audit/safeAuditLog"
import { applyAvailableAdvances } from "@/lib/invoicing/applyAdvances"
import { fromContract, fromDeployment } from "@/lib/invoicing/rates"

function parseMonthStart(month: string) {
  const value = `${month}-01T00:00:00.000Z`
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}
function nextMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
}
function round2(n: number) { return Math.round(n * 100) / 100 }
function fmtDate(d: Date) { return d.toISOString().slice(0, 10) }
function generateInvoiceNumber(seq: number) {
  const ts = Date.now().toString().slice(-6)
  return `INV-${ts}-${String(seq).padStart(3, "0")}`
}

type GeneratedItem = {
  kind: "GUARD_SALARY" | "SPECIAL_DUTY"
  refId: string | null
  description: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

async function buildLineItems(args: {
  clientId: string
  branchId: string | null
  monthStart: Date
  monthEnd: Date
}) {
  const items: GeneratedItem[] = []
  const warnings: string[] = []

  const specialDuties = await prisma.payrollSpecialDuty.findMany({
    where: {
      clientId: args.clientId,
      ...(args.branchId ? { branchId: args.branchId } : {}),
      status: "ACTIVE",
      dateFrom: { lt: args.monthEnd },
      dateTo: { gte: args.monthStart },
    },
    include: { guard: { select: { name: true, parwestId: true } } },
  })
  for (const sd of specialDuties) {
    items.push({
      kind: "SPECIAL_DUTY",
      refId: sd.id,
      description: `Special duty: ${sd.guard.name} (${sd.guard.parwestId}) ${fmtDate(sd.dateFrom)}..${fmtDate(sd.dateTo)}`,
      quantity: sd.hours,
      unitPrice: sd.hourRate,
      lineTotal: round2(sd.hours * sd.hourRate),
    })
  }

  const deployments = await prisma.deployment.findMany({
    where: {
      clientId: args.clientId,
      ...(args.branchId ? { branchId: args.branchId } : {}),
      deploymentDate: { gte: args.monthStart, lt: args.monthEnd },
    },
    select: {
      id: true, guardId: true, deploymentDate: true,
      salary: true, overtime: true, extraHours: true, guardType: true,
      guard: { select: { name: true, parwestId: true } },
    },
  })

  type Agg = {
    guard: { name: string; parwestId: string }
    guardType: string | null
    days: Set<string>
    lastRate: { dailyRate: number; overtimeHourly: number; source: "DEPLOYMENT" | "CONTRACT" | "NONE" } | null
    latestId: string
    latestDate: Date
    otHours: number
    otRate: number
  }
  const byGuard = new Map<string, Agg>()
  for (const d of deployments) {
    const dayKey = fmtDate(d.deploymentDate)
    let agg = byGuard.get(d.guardId)
    if (!agg) {
      agg = { guard: d.guard, guardType: d.guardType, days: new Set(), lastRate: null,
              latestId: d.id, latestDate: d.deploymentDate, otHours: 0, otRate: 0 }
      byGuard.set(d.guardId, agg)
    }
    agg.days.add(dayKey)
    const dr = fromDeployment({ salary: d.salary, overtime: d.overtime })
    if (dr) agg.lastRate = dr
    if (d.deploymentDate > agg.latestDate) {
      agg.latestDate = d.deploymentDate
      agg.latestId = d.id
      if (!agg.guardType && d.guardType) agg.guardType = d.guardType
    }
    const oh = Number(d.extraHours ?? 0)
    if (oh > 0) {
      agg.otHours += oh
      if (Number(d.overtime ?? 0) > 0) agg.otRate = Number(d.overtime)
    }
  }

  for (const agg of byGuard.values()) {
    const days = agg.days.size
    const rate = agg.lastRate ?? await fromContract({
      clientId: args.clientId, branchId: args.branchId, guardType: agg.guardType, asOf: agg.latestDate,
    })
    if (rate.dailyRate <= 0) {
      warnings.push(`No rate for ${agg.guard.name} (${agg.guard.parwestId}).`)
      continue
    }
    items.push({
      kind: "GUARD_SALARY",
      refId: agg.latestId,
      description: `Salary: ${agg.guard.name} (${agg.guard.parwestId}) — ${days} day${days === 1 ? "" : "s"} @ ${rate.dailyRate} (${rate.source.toLowerCase()})`,
      quantity: days,
      unitPrice: rate.dailyRate,
      lineTotal: round2(days * rate.dailyRate),
    })
    if (agg.otHours > 0) {
      const otRate = agg.otRate || rate.overtimeHourly
      if (otRate > 0) {
        items.push({
          kind: "GUARD_SALARY",
          refId: agg.latestId,
          description: `Overtime: ${agg.guard.name} (${agg.guard.parwestId}) — ${agg.otHours}h @ ${otRate}`,
          quantity: agg.otHours,
          unitPrice: otRate,
          lineTotal: round2(agg.otHours * otRate),
        })
      }
    }
  }

  return { items, warnings }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasModuleAccess(session, "PAYROLL")) return forbidden("Access denied.")
    const managerScope = deriveManagerScope(session)

    const body = await request.json()
    const monthValue = body?.month ? String(body.month) : ""
    const taxRateRaw = body?.taxRate
    const requestedClientIds: string[] | null = Array.isArray(body?.clientIds)
      ? body.clientIds.map((s: unknown) => String(s))
      : null
    const groupByBranch: boolean = body?.groupByBranch !== false // default true

    if (!monthValue) return badRequest("month is required.")
    const monthStart = parseMonthStart(monthValue)
    if (!monthStart) return badRequest("month must be YYYY-MM.")
    const monthEnd = nextMonth(monthStart)

    let taxRate: number | null = null
    if (taxRateRaw !== undefined && taxRateRaw !== null && taxRateRaw !== "") {
      const tr = Number(taxRateRaw)
      if (!Number.isFinite(tr) || tr < 0 || tr > 1) return badRequest("taxRate must be 0..1.")
      taxRate = tr
    }

    // Find clients with deployments in the month (scoped)
    const clientWhere = requestedClientIds?.length ? { id: { in: requestedClientIds } } : {}
    const candidates = await prisma.client.findMany({
      where: clientWhere,
      select: { id: true, name: true, regionId: true },
    })
    const inScope = candidates.filter((c) =>
      !managerScope || !managerScopeDenied(managerScope, { regionId: c.regionId })
    )

    const created: { clientId: string; branchId: string | null; invoiceNumber: string; amount: number }[] = []
    const skipped: { clientId: string; branchId: string | null; reason: string }[] = []
    const errors: { clientId: string; branchId: string | null; message: string }[] = []
    let seq = 1

    for (const client of inScope) {
      // determine branches that had deployments this month
      const targets: { branchId: string | null }[] = []
      if (groupByBranch) {
        const branches = await prisma.deployment.findMany({
          where: { clientId: client.id, deploymentDate: { gte: monthStart, lt: monthEnd } },
          select: { branchId: true },
          distinct: ["branchId"],
        })
        for (const b of branches) targets.push({ branchId: b.branchId })
        if (!targets.length) targets.push({ branchId: null })
      } else {
        targets.push({ branchId: null })
      }

      for (const t of targets) {
        try {
          const dup = await prisma.invoice.findFirst({
            where: { clientId: client.id, branchId: t.branchId, month: monthStart, status: { not: "VOID" } },
            select: { id: true, invoiceNumber: true },
          })
          if (dup) {
            skipped.push({ clientId: client.id, branchId: t.branchId, reason: `exists (${dup.invoiceNumber})` })
            continue
          }

          const { items } = await buildLineItems({
            clientId: client.id, branchId: t.branchId, monthStart, monthEnd,
          })
          if (!items.length) {
            skipped.push({ clientId: client.id, branchId: t.branchId, reason: "no billable activity" })
            continue
          }

          const subtotal = round2(items.reduce((acc, i) => acc + i.lineTotal, 0))
          const taxAmount = round2(subtotal * (taxRate ?? 0))
          const amount = round2(subtotal + taxAmount)

          const invoice = await prisma.$transaction(async (tx) => {
            const inv = await tx.invoice.create({
              data: {
                clientId: client.id,
                branchId: t.branchId,
                invoiceNumber: generateInvoiceNumber(seq++),
                month: monthStart,
                amount, subtotal, taxRate, taxAmount, paidAmount: 0,
                status: "DRAFT",
                lineItems: { create: items },
              },
            })
            const { applied } = await applyAvailableAdvances(tx, {
              invoiceId: inv.id, clientId: client.id, branchId: t.branchId, invoiceAmount: amount,
            })
            if (applied > 0) {
              const fullyPaid = applied + 0.001 >= amount
              await tx.invoice.update({
                where: { id: inv.id },
                data: {
                  paidAmount: applied,
                  status: fullyPaid ? "PAID" : "PARTIAL_PAID",
                  paidAt: fullyPaid ? new Date() : null,
                },
              })
            }
            return inv
          })

          created.push({
            clientId: client.id, branchId: t.branchId,
            invoiceNumber: invoice.invoiceNumber, amount,
          })
        } catch (e) {
          errors.push({
            clientId: client.id, branchId: t.branchId,
            message: e instanceof Error ? e.message : "unknown",
          })
        }
      }
    }

    await safeAuditLog({
      userId: session.user?.id || null,
      event: "INVOICE_BULK_GENERATE",
      module: "PAYROLL",
      description: `Bulk generate ${monthValue}: created=${created.length} skipped=${skipped.length} errors=${errors.length}`,
    })

    return NextResponse.json({
      month: monthValue,
      summary: { created: created.length, skipped: skipped.length, errors: errors.length },
      created, skipped, errors,
    })
  } catch (error) {
    console.error("Error in bulk invoice generate:", error)
    return internalServerError("Failed to generate invoices")
  }
}
