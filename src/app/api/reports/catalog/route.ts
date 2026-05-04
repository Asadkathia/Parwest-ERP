import { ok } from "@/lib/api/response"
import { requireReportsAccess } from "@/lib/reports/access"
import { getAllReports } from "@/lib/reports/registry"

export async function GET() {
  const { error } = await requireReportsAccess()
  if (error) return error
  const all = await getAllReports()
  return ok(
    all.map((d) => ({
      key: d.key,
      title: d.title,
      description: d.description,
      category: d.category,
      pinned: d.pinned ?? false,
    })),
  )
}
