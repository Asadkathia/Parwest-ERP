import { BRANCH_CAPACITY_FIELDS } from "@/lib/schemas/branch"

export type BranchCapacityField = (typeof BRANCH_CAPACITY_FIELDS)[number]

export type CapacityShift = "DAY" | "NIGHT" | "BOTH"

export type CapacityRule = {
    field: BranchCapacityField
    designations: string[] // case-insensitive match
    shiftTypes: CapacityShift[]
    label: string
}

// Single source of truth for the (designation, shift) → capacity-field mapping.
// Mirrored against by:
//   - src/app/api/branches/[id]/route.ts (capacity-decrease guard)
//   - src/app/api/deployments/route.ts (capacity enforcement)
//   - src/app/api/branches/[id]/capacity/route.ts (live capacity probe)
//   - src/app/(dashboard)/clients/branches/[id]/page.tsx (Capacity Card)
export const CAPACITY_USAGE_RULES: CapacityRule[] = [
    { field: "dayGuardCapacity", designations: ["guard", "security guard"], shiftTypes: ["DAY"], label: "Day Guards" },
    { field: "nightGuardCapacity", designations: ["guard", "security guard"], shiftTypes: ["NIGHT"], label: "Night Guards" },
    { field: "daySupervisorCapacity", designations: ["supervisor", "location supervisor"], shiftTypes: ["DAY"], label: "Day Supervisors" },
    { field: "nightSupervisorCapacity", designations: ["supervisor", "location supervisor"], shiftTypes: ["NIGHT"], label: "Night Supervisors" },
    { field: "cpoCapacity", designations: ["cpo"], shiftTypes: ["DAY", "NIGHT", "BOTH"], label: "CPOs (any shift)" },
    { field: "dayCpoCapacity", designations: ["cpo"], shiftTypes: ["DAY"], label: "Day CPOs" },
    { field: "nightCpoCapacity", designations: ["cpo"], shiftTypes: ["NIGHT"], label: "Night CPOs" },
    { field: "daySoCapacity", designations: ["so"], shiftTypes: ["DAY"], label: "Day SOs" },
    { field: "nightSoCapacity", designations: ["so"], shiftTypes: ["NIGHT"], label: "Night SOs" },
    { field: "dayAsoCapacity", designations: ["aso"], shiftTypes: ["DAY"], label: "Day ASOs" },
    { field: "nightAsoCapacity", designations: ["aso"], shiftTypes: ["NIGHT"], label: "Night ASOs" },
    { field: "dayLsoCapacity", designations: ["lso"], shiftTypes: ["DAY"], label: "Day LSOs" },
    { field: "nightLsoCapacity", designations: ["lso"], shiftTypes: ["NIGHT"], label: "Night LSOs" },
    { field: "dayCctvCapacity", designations: ["cctv operator"], shiftTypes: ["DAY"], label: "Day CCTV Operators" },
    { field: "nightCctvCapacity", designations: ["cctv operator"], shiftTypes: ["NIGHT"], label: "Night CCTV Operators" },
    { field: "dayReceptionistCapacity", designations: ["receptionist"], shiftTypes: ["DAY"], label: "Day Receptionists" },
    { field: "nightReceptionistCapacity", designations: ["receptionist"], shiftTypes: ["NIGHT"], label: "Night Receptionists" },
]

type DeploymentLike = {
    designation?: string | null
    shiftType?: string | null
    deploymentType?: string | null
    status?: string | null
    endDate?: Date | string | null
}

// Counts active deployments matching a rule's (designations, shiftTypes).
// EXTRA deployments are excluded — they exist *because* the cap was full and
// shouldn't push the displayed count above the cap.
export function countDeploymentsForRule(rule: CapacityRule, deployments: DeploymentLike[]): number {
    const designations = new Set(rule.designations.map((d) => d.toLowerCase()))
    const shifts = new Set(rule.shiftTypes)
    return deployments.filter((d) => {
        if (d.status !== "ACTIVE" || d.endDate) return false
        if (d.deploymentType === "EXTRA") return false
        const desig = (d.designation ?? "").trim().toLowerCase()
        const shift = (d.shiftType ?? "") as CapacityShift
        return designations.has(desig) && shifts.has(shift)
    }).length
}
