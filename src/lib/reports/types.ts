import type { PrismaClient } from "@prisma/client"
import type { z, ZodTypeAny } from "zod"
import type { ManagerScope } from "@/lib/access/scope"

export type ReportFormat = "csv" | "xlsx" | "pdf"

export type ReportCategory =
  | "guards"
  | "clients"
  | "deployments"
  | "financial"
  | "inventory"
  | "other"

export interface ReportColumn {
  key: string
  label: string
  type: "string" | "number" | "currency" | "date" | "boolean"
  align?: "left" | "right" | "center"
  width?: number
}

export type ReportResultRow = Record<
  string,
  string | number | boolean | Date | null | undefined
>

export interface ReportContext {
  userId: string
  scope: ManagerScope | null
  prisma: PrismaClient
}

export interface ReportDefinition<P extends ZodTypeAny = ZodTypeAny> {
  key: string
  title: string
  description: string
  category: ReportCategory
  pinned?: boolean
  paramsSchema: P
  columns: ReportColumn[]
  run: (params: z.infer<P>, ctx: ReportContext) => Promise<ReportResultRow[]>
  chart?: { kind: "bar" | "line" | "pie"; xKey: string; yKey: string }
}
