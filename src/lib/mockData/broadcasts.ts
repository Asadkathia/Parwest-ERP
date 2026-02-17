export type AudienceScope = "ALL_USERS" | "ROLE" | "REGIONAL_OFFICE"

export type BroadcastMessage = {
  id: string
  title: string
  message: string
  audience: AudienceScope
  audienceValue: string | null
  createdBy: string
  createdAt: string
}

export const seededBroadcasts: BroadcastMessage[] = [
  {
    id: "b-1",
    title: "Monthly Compliance Reminder",
    message: "Please complete document verification checks before month close.",
    audience: "ALL_USERS",
    audienceValue: null,
    createdBy: "Admin",
    createdAt: "2026-02-15T09:30:00.000Z",
  },
  {
    id: "b-2",
    title: "Deployment Timing Update",
    message: "Night shift handover must be completed by 7:50 PM.",
    audience: "ROLE",
    audienceValue: "Supervisor",
    createdBy: "Admin",
    createdAt: "2026-02-16T14:15:00.000Z",
  },
]
