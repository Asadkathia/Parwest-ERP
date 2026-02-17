export type LogSeverity = "INFO" | "WARNING" | "CRITICAL"

export type AdminLogEntry = {
  id: string
  actor: string
  action: string
  module: string
  severity: LogSeverity
  createdAt: string
}

export const seededAdminLogs: AdminLogEntry[] = [
  { id: "log-1", actor: "Admin", action: "Updated guard status", module: "Guards", severity: "INFO", createdAt: "2026-02-17T07:45:00.000Z" },
  { id: "log-2", actor: "Supervisor", action: "Marked attendance", module: "Attendance", severity: "INFO", createdAt: "2026-02-17T08:00:00.000Z" },
  { id: "log-3", actor: "Manager", action: "Generated invoice", module: "Clients", severity: "WARNING", createdAt: "2026-02-17T08:20:00.000Z" },
]
