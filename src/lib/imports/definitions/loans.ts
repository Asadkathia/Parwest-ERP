import { z } from "zod"

import { prisma } from "@/lib/db"
import { coerceDate } from "@/lib/imports/coerce"
import { registerImport } from "@/lib/imports/registry"
import { memoizedResolver, optionalString, requiredString } from "@/lib/imports/rules"
import type { ColumnDescriptor } from "@/lib/imports/types"
import { parseMonthStart } from "@/lib/payroll/date-helpers"

/**
 * Guard Loans bulk import.
 *
 * Identifies the guard by Parwest ID (e.g. "PW-00001"), resolves it to the
 * Guard's primary key, then creates a Loan row. Mirrors the single-loan
 * path in `POST /api/payroll/loans` — same field mapping, same guard
 * lifecycle guard (no loans for TERMINATED/INACTIVE guards), same
 * denormalized `regionId` copy and `issuerId` actor stamping.
 */

/** Accepts "YYYY-MM" or "YYYY-MM-DD". */
const MONTH_REGEX = /^\d{4}-\d{2}(-\d{2})?$/

const PAYMENT_METHODS = ["BANK", "CASH", "MOBILE"] as const

const rowSchema = z
  .object({
    // Resolved to the Guard's id by the reference resolver before zod runs.
    guardParwestId: requiredString("parwest id", 64),
    month: requiredString("month", 10).regex(
      MONTH_REGEX,
      "month must be in the format YYYY-MM or YYYY-MM-DD",
    ),
    amount: z.coerce.number({ message: "amount is required" }).positive("amount must be greater than 0"),
    deploymentDays: z.coerce.number().int("deployment days must be an integer").nonnegative("deployment days must be ≥ 0").optional(),
    supervisor: optionalString(200),
    manager: optionalString(200),
    slipNumber: optionalString(100),
    paymentDate: optionalString(32),
    paymentMethod: z
      .preprocess(
        (v) => (typeof v === "string" ? v.trim().toUpperCase() : v),
        z.enum(PAYMENT_METHODS, {
          message: `payment method must be one of: ${PAYMENT_METHODS.join(", ")}`,
        }),
      )
      .optional(),
    bankName: optionalString(200),
    accountNumber: optionalString(64),
  })
  .passthrough()

/**
 * Resolves a Parwest ID to the Guard's primary key. Returns the id, or null
 * when no guard carries that Parwest ID (engine turns null into a row error).
 */
const guardResolver = memoizedResolver<string>("loan.guard", async (raw) => {
  const guard = await prisma.guard.findFirst({
    where: { parwestId: raw.trim() },
    select: { id: true },
  })
  return guard?.id ?? null
})

registerImport({
  module: "loans",
  label: "Guard Loans",
  description: "Bulk-create guard loan/advance records by Parwest ID.",
  requiredHeaders: ["parwest id", "month", "amount"],
  optionalHeaders: [
    "deployment days",
    "supervisor",
    "manager",
    "slip number",
    "payment date",
    "payment method",
    "bank name",
    "account number",
  ],
  headerAliases: {
    "parwest id": "guardParwestId",
    month: "month",
    amount: "amount",
    "deployment days": "deploymentDays",
    supervisor: "supervisor",
    manager: "manager",
    "slip number": "slipNumber",
    "payment date": "paymentDate",
    "payment method": "paymentMethod",
    "bank name": "bankName",
    "account number": "accountNumber",
  },
  rowSchema,
  referenceResolvers: {
    guardParwestId: guardResolver,
  },
  sampleRows: [
    {
      "parwest id": "PW-00001",
      month: "2026-05",
      amount: 5000,
      "payment method": "BANK",
    },
    {
      "parwest id": "PW-00002",
      month: "2026-05",
      amount: 3000,
      "payment method": "CASH",
    },
  ],
  columns: [
    {
      key: "guardParwestId",
      header: "parwest id",
      label: "Parwest ID",
      kind: "fk",
      required: true,
      fkOptionsLoader: async (ctx) => {
        const rows = await ctx.prisma.guard.findMany({
          where: { lifecycleStatus: { notIn: ["TERMINATED", "INACTIVE"] } },
          select: { parwestId: true, name: true },
          orderBy: { parwestId: "asc" },
          take: 1000,
        })
        return rows
          .filter((r) => r.parwestId)
          .map((r) => ({ value: r.parwestId as string, label: `${r.parwestId} — ${r.name}` }))
      },
    },
    { key: "month", header: "month", label: "Month", kind: "date", required: true },
    { key: "amount", header: "amount", label: "Amount", kind: "number", required: true },
    { key: "deploymentDays", header: "deployment days", label: "Deployment Days", kind: "number", required: false },
    { key: "supervisor", header: "supervisor", label: "Supervisor", kind: "text", required: false },
    { key: "manager", header: "manager", label: "Manager", kind: "text", required: false },
    { key: "slipNumber", header: "slip number", label: "Slip Number", kind: "text", required: false },
    { key: "paymentDate", header: "payment date", label: "Payment Date", kind: "date", required: false },
    {
      key: "paymentMethod",
      header: "payment method",
      label: "Payment Method",
      kind: "enum",
      required: false,
      enumValues: ["BANK", "CASH", "MOBILE"],
    },
    { key: "bankName", header: "bank name", label: "Bank Name", kind: "text", required: false },
    { key: "accountNumber", header: "account number", label: "Account Number", kind: "text", required: false },
  ] satisfies ColumnDescriptor[],
  duplicates: [
    {
      fields: ["guardParwestId", "month"],
      scope: "payload",
      message: "Duplicate loan for this guard + month in the upload",
    },
  ],
  persist: async (row, ctx) => {
    const r = row as {
      guardParwestId: string // resolved → guard id
      month: string
      amount: number
      deploymentDays?: number
      supervisor?: string
      manager?: string
      slipNumber?: string
      paymentDate?: string
      paymentMethod?: string
      bankName?: string
      accountNumber?: string
    }

    const guard = await ctx.tx.guard.findUnique({
      where: { id: r.guardParwestId },
      select: { id: true, regionId: true, lifecycleStatus: true },
    })
    if (!guard) throw new Error("Guard no longer exists")
    if (guard.lifecycleStatus === "TERMINATED" || guard.lifecycleStatus === "INACTIVE") {
      throw new Error(
        `Cannot create a loan for a ${String(guard.lifecycleStatus).toLowerCase()} guard.`,
      )
    }

    const month = parseMonthStart(r.month)
    if (!month) throw new Error("Invalid month value.")

    const paymentDate = r.paymentDate ? coerceDate(r.paymentDate) : null

    await ctx.tx.loan.create({
      data: {
        guardId: guard.id,
        month,
        amount: Number(r.amount),
        status: "PENDING",
        deploymentDays: r.deploymentDays != null ? Number(r.deploymentDays) : null,
        supervisor: r.supervisor ? String(r.supervisor) : null,
        manager: r.manager ? String(r.manager) : null,
        slipNumber: r.slipNumber ? String(r.slipNumber) : null,
        paymentDate: paymentDate ?? null,
        paymentMethod: r.paymentMethod ? String(r.paymentMethod).toUpperCase() : null,
        bankName: r.bankName ? String(r.bankName) : null,
        accountNumber: r.accountNumber ? String(r.accountNumber) : null,
        regionId: guard.regionId ?? null,
        issuerId: ctx.actorUserId ?? null,
      },
    })
  },
})
