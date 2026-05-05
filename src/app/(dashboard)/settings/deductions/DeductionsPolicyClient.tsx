"use client"

/**
 * Single consolidated Deductions Policy management page.
 *
 * Tabs for every canonical rate table — APSAA branch, CWF region, EOBI, ESSI,
 * APSAA Punjab, Uniform plan, Uniform resignation tiers, Night-call rules.
 * Each tab mounts the shared RatePolicyManager parameterized by config.
 */

import { useMemo, useState } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/shadcn/tabs"
import RatePolicyManager, {
  type RateTableConfig,
  type ScopeOption,
} from "@/components/deductions/RatePolicyManager"

type Props = {
  branchOptions: ScopeOption[]
  regionOptions: ScopeOption[]
}

export default function DeductionsPolicyClient({ branchOptions, regionOptions }: Props) {
  const [tab, setTab] = useState<string>("apsaa")

  const configs = useMemo(
    () => ({
      apsaa: {
        title: "APSAA — branch rate",
        description:
          "Per-client-branch APSAA rate, applied monthly. Each branch has its own effective-dated rate row.",
        config: {
          apiPath: "/api/deductions/apsaa-branch-rates",
          scope: { kind: "branch" as const },
          fields: [{ kind: "amount", key: "amount", label: "Amount (Rs)" }],
          rowCells: [{ key: "amount", label: "Amount" }],
        } satisfies RateTableConfig,
        scopeOptions: branchOptions,
      },
      cwf: {
        title: "CWF — region rate",
        description:
          "Region-wise approved Contribution Welfare Fund. One active rate per region; supersession-based.",
        config: {
          apiPath: "/api/deductions/cwf-region-rates",
          scope: { kind: "region" as const },
          fields: [{ kind: "amount", key: "amount", label: "Amount (Rs)" }],
          rowCells: [{ key: "amount", label: "Amount" }],
        } satisfies RateTableConfig,
        scopeOptions: regionOptions,
      },
      eobi: {
        title: "EOBI — notified rate",
        description:
          "Global EOBI contribution rate. Applied to guards with active EOBI enrollment.",
        config: {
          apiPath: "/api/deductions/eobi-rates",
          scope: { kind: "global" as const },
          fields: [{ kind: "amount", key: "amount", label: "Amount (Rs)" }],
          rowCells: [{ key: "amount", label: "Amount" }],
        } satisfies RateTableConfig,
      },
      essi: {
        title: "ESSI — notified rate",
        description:
          "Global Provincial ESSI rate. Applied to guards with active ESSI enrollment.",
        config: {
          apiPath: "/api/deductions/essi-rates",
          scope: { kind: "global" as const },
          fields: [{ kind: "amount", key: "amount", label: "Amount (Rs)" }],
          rowCells: [{ key: "amount", label: "Amount" }],
        } satisfies RateTableConfig,
      },
      apsaaPunjab: {
        title: "APSAA — Punjab",
        description:
          "Auto-applied to guards deployed in Punjab. Single global effective-dated rate.",
        config: {
          apiPath: "/api/deductions/apsaa-punjab-rates",
          scope: { kind: "global" as const },
          fields: [{ kind: "amount", key: "amount", label: "Amount (Rs)" }],
          rowCells: [{ key: "amount", label: "Amount" }],
        } satisfies RateTableConfig,
      },
      uniformPlan: {
        title: "Uniform plan",
        description:
          "Jersey total cost + installment plan. Issuing a jersey snapshots this plan and spawns N installments.",
        config: {
          apiPath: "/api/deductions/uniform-plans",
          scope: { kind: "global" as const },
          fields: [
            { kind: "number", key: "totalCost", label: "Total cost (Rs)" },
            { kind: "number", key: "installmentAmount", label: "Installment amount (Rs)" },
            { kind: "number", key: "installmentCount", label: "Installment count" },
          ],
          rowCells: [
            { key: "totalCost", label: "Total cost" },
            { key: "installmentAmount", label: "Installment" },
            { key: "installmentCount", label: "Count" },
          ],
        } satisfies RateTableConfig,
      },
      uniformTiers: {
        title: "Uniform resignation tiers",
        description:
          "Tenure-tier recovery on resignation. e.g. <3mo → Rs 5,000; 3–6mo → Rs 3,000.",
        config: {
          apiPath: "/api/deductions/uniform-resignation-tiers",
          scope: { kind: "global" as const },
          fields: [
            { kind: "number", key: "minMonths", label: "Min months (inclusive)" },
            { kind: "number", key: "maxMonths", label: "Max months (exclusive)" },
            { kind: "amount", key: "amount", label: "Amount (Rs)" },
          ],
          rowCells: [
            { key: "minMonths", label: "Min" },
            { key: "maxMonths", label: "Max" },
            { key: "amount", label: "Amount" },
          ],
        } satisfies RateTableConfig,
      },
      nightCall: {
        title: "Night-call rules",
        description:
          "Day-salary deduction policy for missed night calls. Day-rate basis: BASE_DIV_30 (basePay/30) or CUSTOM.",
        config: {
          apiPath: "/api/deductions/night-call-rules",
          scope: { kind: "global" as const },
          fields: [
            { kind: "number", key: "callsPerNight", label: "Calls per night", defaultValue: 3 },
            {
              kind: "number",
              key: "twoMissedDeduction",
              label: "Days deducted on 2 missed in one night",
              defaultValue: 1,
            },
            {
              kind: "number",
              key: "repeatedDayPenalty",
              label: "Days deducted on next-day repeat",
              defaultValue: 1,
            },
            {
              kind: "number",
              key: "consecutiveOneMissedDeductionDay",
              label: "Days deducted on consecutive 1-missed (day 2)",
              defaultValue: 1,
            },
            {
              kind: "select",
              key: "dayRateBasis",
              label: "Day-rate basis",
              defaultValue: "BASE_DIV_30",
              options: [
                { value: "BASE_DIV_30", label: "Base salary ÷ 30" },
                { value: "CUSTOM", label: "Custom amount" },
              ],
            },
            { kind: "number", key: "customDayRate", label: "Custom day rate (if CUSTOM)" },
          ],
          rowCells: [
            { key: "callsPerNight", label: "Calls/night" },
            { key: "dayRateBasis", label: "Basis" },
            { key: "customDayRate", label: "Custom rate" },
            { key: "twoMissedDeduction", label: "2-missed days" },
            { key: "repeatedDayPenalty", label: "Repeat days" },
          ],
        } satisfies RateTableConfig,
      },
    }),
    [branchOptions, regionOptions]
  )

  type ConfigKey = keyof typeof configs
  const active = configs[tab as ConfigKey]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Deductions Policy</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Canonical effective-dated rates and rules driving every payroll deduction. Every change
          is a new row; activating supersedes the prior active row. Backdated changes require
          DEDUCTIONS:RATE_RETROACTIVE.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="flex flex-wrap gap-1">
          <TabsTrigger value="apsaa">APSAA</TabsTrigger>
          <TabsTrigger value="cwf">CWF</TabsTrigger>
          <TabsTrigger value="eobi">EOBI</TabsTrigger>
          <TabsTrigger value="essi">ESSI</TabsTrigger>
          <TabsTrigger value="apsaaPunjab">APSAA Punjab</TabsTrigger>
          <TabsTrigger value="uniformPlan">Uniform plan</TabsTrigger>
          <TabsTrigger value="uniformTiers">Resignation tiers</TabsTrigger>
          <TabsTrigger value="nightCall">Night call</TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          <RatePolicyManager
            title={active.title}
            description={active.description}
            config={active.config}
            scopeOptions={"scopeOptions" in active ? active.scopeOptions : undefined}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
