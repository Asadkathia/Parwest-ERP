import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { badRequest, forbidden, internalServerError, unauthorized } from "@/lib/api/response"
import { hasModuleAccess } from "@/lib/api/permissions"

const EARNING_KEYS = [
  "basicSalary",
  "workingDays",
  "paidWorkingDays",
  "overtime",
  "gazettedHolidays",
  "gazettedHolidaysOvertimeAmount",
  "arrears",
] as const

const DEDUCTION_KEYS = [
  "advanceSalary",
  "eobi",
  "mess",
  "specialBranch",
  "apsaaTraining",
  "absencePenalty",
] as const

type EarningKey = (typeof EARNING_KEYS)[number]
type DeductionKey = (typeof DEDUCTION_KEYS)[number]

type SlipRow = {
  parwestId?: string
  guardId?: string
  [k: string]: unknown
}

import { parseMonthRange as parseMonth } from "@/lib/payroll/date-helpers"

function num(v: unknown): number {
  if (v == null || v === "") return 0
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""))
  return Number.isFinite(n) ? n : 0
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasModuleAccess(session, "PAYROLL")) return forbidden("Access denied.")

    const body = await request.json()
    const monthRaw = String(body.month || "")
    const month = parseMonth(monthRaw)
    if (!month) return badRequest("month is required (YYYY-MM).")

    const enabledEarnings: EarningKey[] = Array.isArray(body.earnings)
      ? body.earnings.filter((k: string) => EARNING_KEYS.includes(k as EarningKey))
      : [...EARNING_KEYS]
    const enabledDeductions: DeductionKey[] = Array.isArray(body.deductions)
      ? body.deductions.filter((k: string) => DEDUCTION_KEYS.includes(k as DeductionKey))
      : [...DEDUCTION_KEYS]

    const rows: SlipRow[] = Array.isArray(body.rows) ? body.rows : []
    if (rows.length === 0) return badRequest("rows array is required.")

    const results: {
      parwestId: string
      success: boolean
      slipId?: string
      grossPay?: number
      netPayable?: number
      error?: string
    }[] = []

    for (const row of rows) {
      const parwestId = row.parwestId ? String(row.parwestId).trim() : ""
      const guardIdInput = row.guardId ? String(row.guardId).trim() : ""
      if (!parwestId && !guardIdInput) {
        results.push({ parwestId: "", success: false, error: "Missing parwestId/guardId." })
        continue
      }

      const guard = await prisma.guard.findFirst({
        where: guardIdInput ? { id: guardIdInput } : { parwestId },
        select: { id: true, parwestId: true },
      })
      if (!guard) {
        results.push({ parwestId: parwestId || guardIdInput, success: false, error: "Guard not found." })
        continue
      }

      const earnings: Record<string, number> = {}
      let grossPay = 0
      for (const key of enabledEarnings) {
        const value = num(row[key])
        earnings[key] = value
        // Treat days fields as counts (not monetary) for gross calc
        if (key !== "workingDays" && key !== "paidWorkingDays") {
          grossPay += value
        }
      }

      const deductions: Record<string, number> = {}
      let totalDeductions = 0
      for (const key of enabledDeductions) {
        const value = num(row[key])
        deductions[key] = value
        totalDeductions += value
      }

      const netPayable = Number((grossPay - totalDeductions).toFixed(2))

      try {
        const slip = await prisma.payrollSalarySlip.upsert({
          where: {
            guardId_month_year: {
              guardId: guard.id,
              month: month.start,
              year: month.year,
            },
          },
          create: {
            guardId: guard.id,
            month: month.start,
            year: month.year,
            earningsJson: JSON.stringify(earnings),
            deductionsJson: JSON.stringify(deductions),
            grossPay: Number(grossPay.toFixed(2)),
            netPayable,
            generatedById: session.user?.id ?? null,
          },
          update: {
            earningsJson: JSON.stringify(earnings),
            deductionsJson: JSON.stringify(deductions),
            grossPay: Number(grossPay.toFixed(2)),
            netPayable,
            generatedById: session.user?.id ?? null,
          },
        })
        results.push({
          parwestId: guard.parwestId,
          success: true,
          slipId: slip.id,
          grossPay: Number(grossPay.toFixed(0)),
          netPayable: Number(netPayable.toFixed(0)),
        })
      } catch (e) {
        results.push({
          parwestId: guard.parwestId,
          success: false,
          error: String((e as Error).message ?? "upsert failed"),
        })
      }
    }

    const successCount = results.filter((r) => r.success).length
    return NextResponse.json({
      generated: successCount,
      total: rows.length,
      month: month.start.toISOString().slice(0, 7),
      results,
    })
  } catch (error) {
    console.error("Error generating salary slips:", error)
    return internalServerError("Failed to generate salary slips.")
  }
}
