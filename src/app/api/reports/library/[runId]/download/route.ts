import { NextRequest } from "next/server"
import { notFound } from "@/lib/api/response"
import { requireReportsAccess } from "@/lib/reports/access"
import { prisma } from "@/lib/db"
import { getArtifact, contentTypeFor } from "@/lib/reports/storage"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { error } = await requireReportsAccess()
  if (error) return error

  const { runId } = await params
  const run = await prisma.reportRun.findUnique({ where: { id: runId } })
  if (!run || !run.fileKey) return notFound("Run or artifact not found")

  const ext = run.format.toLowerCase() as "csv" | "xlsx" | "pdf"
  const buf = await getArtifact(run.fileKey)
  const u8 = new Uint8Array(buf.byteLength)
  u8.set(buf)
  return new Response(u8, {
    headers: {
      "Content-Type": contentTypeFor(ext),
      "Content-Disposition": `attachment; filename="${run.reportKey}-${runId}.${ext}"`,
    },
  })
}
