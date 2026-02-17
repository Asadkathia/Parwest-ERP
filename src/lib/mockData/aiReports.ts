import { mockGuardsList, mockBlacklistedGuards, mockInactiveGuards, mockTrainings } from "@/lib/mockData/guards"
import { mockClientsList } from "@/lib/mockData/clients"
import { mockDeploymentsList } from "@/lib/mockData/deployments"

export type ReportTemplate = {
  id: string
  name: string
  frequency: "Daily" | "Weekly" | "Monthly"
  owner: string
  lastGeneratedAt: string
  status: "READY" | "RUNNING" | "FAILED"
}

export type GeneratedReport = {
  id: string
  templateId: string
  templateName: string
  generatedAt: string
  status: "READY" | "RUNNING" | "FAILED"
  rowCount: number
}

const fixedNow = "2026-02-17T10:00:00.000Z"

export const mockReportTemplates: ReportTemplate[] = [
  { id: "rpt-1", name: "Guard Attendance", frequency: "Daily", owner: "Admin", lastGeneratedAt: "2026-02-17T08:20:00.000Z", status: "READY" },
  { id: "rpt-2", name: "Deployment Status", frequency: "Daily", owner: "Admin", lastGeneratedAt: "2026-02-17T08:25:00.000Z", status: "READY" },
  { id: "rpt-3", name: "Client Billing Snapshot", frequency: "Weekly", owner: "Finance", lastGeneratedAt: "2026-02-16T16:00:00.000Z", status: "READY" },
  { id: "rpt-4", name: "Inactive / Blacklisted", frequency: "Weekly", owner: "Operations", lastGeneratedAt: "2026-02-16T09:30:00.000Z", status: "READY" },
  { id: "rpt-5", name: "OJT Compliance", frequency: "Monthly", owner: "Training", lastGeneratedAt: "2026-02-01T07:10:00.000Z", status: "READY" },
]

export const mockGeneratedReports: GeneratedReport[] = [
  { id: "gen-1", templateId: "rpt-1", templateName: "Guard Attendance", generatedAt: "2026-02-17T08:20:00.000Z", status: "READY", rowCount: mockGuardsList.length * 5 },
  { id: "gen-2", templateId: "rpt-2", templateName: "Deployment Status", generatedAt: "2026-02-17T08:25:00.000Z", status: "READY", rowCount: mockDeploymentsList.length },
  { id: "gen-3", templateId: "rpt-3", templateName: "Client Billing Snapshot", generatedAt: "2026-02-16T16:00:00.000Z", status: "READY", rowCount: mockClientsList.length },
]

export function generateSystemReportRows(templateId: string) {
  if (templateId === "rpt-1") return mockGuardsList.map((g) => ({ key: g.parwestId, guard: g.name, status: g.status, presentDays: 24 }))
  if (templateId === "rpt-2") return mockDeploymentsList.map((d) => ({ key: d.id, branch: d.branchId, client: d.clientId, status: d.status }))
  if (templateId === "rpt-3") return mockClientsList.map((c) => ({ key: c.id, client: c.name, type: c.type, amount: c.branchCount * 100000 }))
  if (templateId === "rpt-4") return [
    ...mockInactiveGuards.map((g) => ({ key: g.id, category: "Inactive Guard", name: g.name, reason: g.reason })),
    ...mockBlacklistedGuards.map((g) => ({ key: g.id, category: "Blacklisted Guard", name: g.name, reason: g.reason })),
  ]
  if (templateId === "rpt-5") return mockTrainings.map((t) => ({ key: t.id, client: t.client, branch: t.branch, dueDate: t.dueDate, remarks: t.remarks }))
  return []
}

export function getFixedReportTimestamp() {
  return fixedNow
}
