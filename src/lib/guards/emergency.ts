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

type GuardEmergencyInput = {
  id: string
  parwestId: string
  name: string
  cnic: string
  phone?: string | null
  status: string
  fatherName?: string | null
  dateOfBirth?: Date | null
  addressCurrent?: string | null
  joiningDate?: Date | null
}

export function deriveEmergencyRowFromGuard(guard: GuardEmergencyInput): EmergencyGuardRow {
  const reasons: EmergencyReason[] = []

  // Temporary heuristic until dedicated prerequisites/doc tables are surfaced on this screen.
  if (guard.status !== "ACTIVE") reasons.push("MISSING_VERIFICATION")
  if (!guard.joiningDate) reasons.push("MISSING_PLEDGED_DOCS")
  if (!guard.phone || !guard.fatherName || !guard.dateOfBirth || !guard.addressCurrent) reasons.push("PROFILE_INCOMPLETE")
  if (reasons.length === 0) reasons.push("PROFILE_INCOMPLETE")

  const urgency: EmergencyGuardRow["urgency"] =
    reasons.length >= 2 ? "HIGH" : reasons[0] === "PROFILE_INCOMPLETE" ? "LOW" : "MEDIUM"

  return {
    id: guard.id,
    parwestId: guard.parwestId,
    name: guard.name,
    cnic: guard.cnic,
    phone: guard.phone || null,
    status: guard.status,
    urgency,
    reasons,
    source: "existing",
  }
}
