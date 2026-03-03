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
