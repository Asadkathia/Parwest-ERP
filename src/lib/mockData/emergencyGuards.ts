import { mockGuardsList } from "@/lib/mockData/guards"

export type EmergencyReason =
  | "CNIC_EXPIRY_SOON"
  | "MISSING_VERIFICATION"
  | "MISSING_PLEDGED_DOCS"
  | "PROFILE_INCOMPLETE"

export type EmergencyGuardRow = {
  id: string
  parwestId: string
  name: string
  cnic?: string
  phone?: string | null
  status: string
  urgency: "HIGH" | "MEDIUM" | "LOW"
  reasons: EmergencyReason[]
  source?: "existing" | "manual"
}

export function getMockEmergencyGuardPool(): EmergencyGuardRow[] {
  return mockGuardsList.map((guard, idx) => {
    const reasons: EmergencyReason[] = []

    if (idx % 2 === 0) reasons.push("CNIC_EXPIRY_SOON")
    if (idx % 3 === 0) reasons.push("MISSING_VERIFICATION")
    if (idx % 4 === 0) reasons.push("MISSING_PLEDGED_DOCS")
    if (reasons.length === 0) reasons.push("PROFILE_INCOMPLETE")

    return {
      id: guard.id,
      parwestId: guard.parwestId,
      name: guard.name,
      cnic: guard.cnic,
      phone: guard.phone || null,
      status: guard.status,
      urgency: reasons.length >= 2 ? "HIGH" : reasons[0] === "PROFILE_INCOMPLETE" ? "LOW" : "MEDIUM",
      reasons,
      source: "existing",
    }
  })
}
