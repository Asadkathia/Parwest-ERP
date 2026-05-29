/**
 * Canonical guard-type vocabulary.
 *
 * `Deployment.guardType` (schema.prisma:600 — "Security Guard, Supervisor, etc.")
 * and `DeploymentRate.guardType` (schema.prisma:505) carry a categorical label
 * for the role a guard fills on a posting. Per `src/lib/invoicing/rateSelection.ts`
 * the value is display-only and never participates in rate selection — invoicing
 * resolves rates via `ClientContractRate` (province/city/exService/effective-date),
 * not via the deployment's `guardType` string.
 *
 * **Workflow rule (product-owner clarified):** a Deployment is created BEFORE its
 * branch ClientContract exists, so the deploy-time `guardType` value CANNOT be
 * sourced from `ClientContractRate`. It must come from a contract-independent
 * canonical vocabulary — this file.
 *
 * Source of each entry (all pulled from pre-existing usages — no new values
 * invented):
 *  - "Guard", "Supervisor", "CPO": defaults seeded by
 *    `src/app/api/guard-designation-types/route.ts:7` (DEFAULT_TYPES) and
 *    also present in `PricingManager.tsx:504`, `InvoicePrerequisitesManager.tsx:38`
 *    (the latter is being removed alongside this addition).
 *  - "SO", "ASO", "LSO", "Receptionist", "CCTV Operator", "Complaint Receiver":
 *    present in this file's own `DESIGNATION_OPTIONS` (deploy/form.tsx:153-162),
 *    in `deployments-rate/form.tsx:222-228`, and in `InvoicePrerequisitesManager`'s
 *    `GUARD_TYPE_OPTIONS`. They are an established part of the deployment-form
 *    vocabulary.
 *  - "Armed Guard", "Unarmed Guard": seeded defaults from
 *    `guard-designation-types/route.ts` and used as fallbacks in `PricingManager`.
 *
 * The first entry ("Guard") is the safe default the deploy form falls back to
 * when nothing else is selected.
 */
export const GUARD_TYPES = [
  "Guard",
  "Supervisor",
  "CPO",
  "Armed Guard",
  "Unarmed Guard",
  "SO",
  "ASO",
  "LSO",
  "Receptionist",
  "CCTV Operator",
  "Complaint Receiver",
] as const

export type GuardType = (typeof GUARD_TYPES)[number]

export const DEFAULT_GUARD_TYPE: GuardType = "Guard"
