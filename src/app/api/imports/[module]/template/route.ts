import { NextResponse } from "next/server"

import { badRequest, forbidden, unauthorized } from "@/lib/api/response"
import { auth } from "@/lib/auth"
import { hasAction } from "@/lib/api/permissions"
import { buildTemplateXlsx } from "@/lib/imports/excel"
import "@/lib/imports/definitions"
import { getImportDefinition } from "@/lib/imports/registry"

/**
 * GET /api/imports/[module]/template
 * GET /api/imports/[module]/template?sub=loans
 *
 * Returns a downloadable .xlsx with the required + optional headers
 * for the chosen import. The first data row(s) include the schema's
 * `sampleRows` as worked examples.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ module: string }> },
) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!hasAction(session, "IMPORTS", "VIEW")) return forbidden()

  const { module } = await params
  const subModule = new URL(request.url).searchParams.get("sub") || undefined

  const definition = getImportDefinition(module, subModule)
  if (!definition) {
    return badRequest(
      `Unsupported import '${module}${subModule ? `::${subModule}` : ""}'.`,
    )
  }

  const buffer = await buildTemplateXlsx({
    module: definition.module,
    subModule: definition.subModule,
    label: definition.label,
    requiredHeaders: definition.requiredHeaders,
    optionalHeaders: definition.optionalHeaders,
    sampleRows: definition.sampleRows,
  })

  const fileName = definition.subModule
    ? `${definition.module}-${definition.subModule}-template.xlsx`
    : `${definition.module}-template.xlsx`

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  })
}
