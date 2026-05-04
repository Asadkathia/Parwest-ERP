import { prisma } from "@/lib/db"
import { ReportFormat as PrismaReportFormat, ReportRunStatus } from "@prisma/client"
import type {
  ReportContext,
  ReportDefinition,
  ReportFormat,
  ReportResultRow,
} from "./types"
import { formatCsv } from "./formatters/csv"
import { formatXlsx } from "./formatters/xlsx"
import { formatPdf } from "./formatters/pdf"
import { putArtifact } from "./storage"

const TO_PRISMA: Record<ReportFormat, PrismaReportFormat> = {
  csv: "CSV",
  xlsx: "XLSX",
  pdf: "PDF",
}

export interface RunOptions {
  definition: ReportDefinition
  rawParams: unknown
  format: ReportFormat
  ctx: ReportContext
  scheduledId?: string
}

export interface RunResult {
  runId: string
  fileKey: string
  rowCount: number
  fileSize: number
}

function paramsSummary(p: unknown): string {
  if (!p || typeof p !== "object") return ""
  return Object.entries(p as Record<string, unknown>)
    .filter(([, v]) => v != null && v !== "")
    .map(
      ([k, v]) =>
        `${k}=${v instanceof Date ? v.toISOString().slice(0, 10) : String(v)}`
    )
    .join(" · ")
}

export async function runReport(opts: RunOptions): Promise<RunResult> {
  const { definition, rawParams, format, ctx, scheduledId } = opts
  const params = definition.paramsSchema.parse(rawParams)

  const run = await prisma.reportRun.create({
    data: {
      reportKey: definition.key,
      paramsJson: params as object,
      format: TO_PRISMA[format],
      status: ReportRunStatus.RUNNING,
      requestedById: ctx.userId || null,
      scheduledId: scheduledId ?? null,
      startedAt: new Date(),
    },
  })

  try {
    const rows = (await definition.run(params, ctx)) as ReportResultRow[]
    const buf =
      format === "csv"
        ? await formatCsv(definition.columns, rows)
        : format === "xlsx"
        ? await formatXlsx(definition.title, definition.columns, rows)
        : await formatPdf(
            definition.title,
            paramsSummary(params),
            definition.columns,
            rows
          )

    const artifact = await putArtifact(run.id, buf, format)
    await prisma.reportRun.update({
      where: { id: run.id },
      data: {
        status: ReportRunStatus.SUCCEEDED,
        fileKey: artifact.fileKey,
        fileSize: artifact.size,
        rowCount: rows.length,
        finishedAt: new Date(),
      },
    })
    return {
      runId: run.id,
      fileKey: artifact.fileKey,
      rowCount: rows.length,
      fileSize: artifact.size,
    }
  } catch (err) {
    await prisma.reportRun.update({
      where: { id: run.id },
      data: {
        status: ReportRunStatus.FAILED,
        error: err instanceof Error ? err.message : String(err),
        finishedAt: new Date(),
      },
    })
    throw err
  }
}
