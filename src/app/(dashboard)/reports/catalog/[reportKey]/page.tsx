import { notFound } from "next/navigation"
import type { ZodTypeAny } from "zod"
import { getReport } from "@/lib/reports/registry"
import { ReportRunner, type ParamShape } from "@/components/reports/ReportRunner"

function describeShape(schema: ZodTypeAny): ParamShape[] {
  // Walk a top-level zod object schema for a flat list of fields.
  const def = (schema as unknown as { _def?: { shape?: () => Record<string, ZodTypeAny> } })._def
  const shape = def?.shape?.() ?? {}
  return Object.entries(shape).map(([name, sub]) => {
    let cur: ZodTypeAny = sub
    const subDef = (cur as unknown as { _def?: { typeName?: string; innerType?: ZodTypeAny } })._def
    const isOptional =
      subDef?.typeName === "ZodOptional" || subDef?.typeName === "ZodDefault"
    if (isOptional && subDef?.innerType) {
      cur = subDef.innerType
    }
    const innerDef = (cur as unknown as { _def?: { typeName?: string; innerType?: ZodTypeAny } })._def
    let tn = innerDef?.typeName
    if (tn === "ZodEffects" && innerDef?.innerType) {
      tn = (innerDef.innerType as unknown as { _def?: { typeName?: string } })._def?.typeName
    }
    const type: ParamShape["type"] =
      tn === "ZodNumber"
        ? "number"
        : tn === "ZodDate"
        ? "date"
        : tn === "ZodBoolean"
        ? "boolean"
        : "string"
    return { name, type, optional: Boolean(isOptional) }
  })
}

export default async function RunReportPage({
  params,
}: {
  params: Promise<{ reportKey: string }>
}) {
  const { reportKey } = await params
  const def = await getReport(reportKey)
  if (!def) notFound()
  return (
    <ReportRunner
      reportKey={def.key}
      title={def.title}
      description={def.description}
      paramShape={describeShape(def.paramsSchema)}
      columns={def.columns}
    />
  )
}
