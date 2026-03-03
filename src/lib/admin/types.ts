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

export type LogSeverity = "INFO" | "WARNING" | "CRITICAL"

export type AdminLogEntry = {
  id: string
  actor: string
  action: string
  module: string
  severity: LogSeverity
  createdAt: string
}
