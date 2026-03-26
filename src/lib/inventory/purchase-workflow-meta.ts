export type PurchaseOrderMeta = {
  approvalReference?: string | null
  invoiceDate?: string | null
  deliveryChallanNumber?: string | null
}

export type PurchaseReceiveLineMeta = {
  purchaseLineId: string
  productId: string
  productName?: string | null
  variant?: string | null
  requestedQty: number
  newReceivedQty: number
  damagedQty: number
  okQty: number
  reusableQty: number
  remarks?: string | null
}

export type PurchaseTransportMeta = {
  transportType: "SELF" | "COURIER"
  driverName?: string | null
  driverPhone?: string | null
  vehicleNumber?: string | null
  courierCompany?: string | null
  courierTrackingId?: string | null
  courierBy?: string | null
  courierDate?: string | null
}

export type PurchaseStatusHistoryMeta = {
  status: "PENDING" | "RECEIVED" | "CANCELLED"
  changedByUserId?: string | null
  changedByName?: string | null
  changedAt: string
  remarks?: string | null
  lines?: PurchaseReceiveLineMeta[]
}

export type PurchaseWorkflowMeta = {
  transport?: PurchaseTransportMeta | null
  history: PurchaseStatusHistoryMeta[]
}

export type ParsedPurchaseMeta = {
  note: string | null
  purchaseOrder: PurchaseOrderMeta
  workflow: PurchaseWorkflowMeta
}

const PO_META_PREFIX = "[PO_META]"
const WORKFLOW_META_PREFIX = "[WORKFLOW_META]"

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  try {
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function extractChunk(text: string, marker: string): string | null {
  const start = text.indexOf(marker)
  if (start < 0) return null
  const from = start + marker.length
  const nextPo = text.indexOf(PO_META_PREFIX, from)
  const nextWf = text.indexOf(WORKFLOW_META_PREFIX, from)
  const candidates = [nextPo, nextWf].filter((value) => value >= 0)
  const end = candidates.length ? Math.min(...candidates) : text.length
  return text.slice(from, end).trim() || null
}

export function parsePurchaseNotes(raw: string | null | undefined): ParsedPurchaseMeta {
  const text = String(raw ?? "")

  const poChunk = extractChunk(text, PO_META_PREFIX)
  const workflowChunk = extractChunk(text, WORKFLOW_META_PREFIX)

  const cleanedNote = text
    .replace(new RegExp(`${PO_META_PREFIX}[\\s\\S]*$`), "")
    .replace(new RegExp(`${WORKFLOW_META_PREFIX}[\\s\\S]*$`), "")
    .trim()

  const purchaseOrder = safeJsonParse<PurchaseOrderMeta>(poChunk, {})
  const workflow = safeJsonParse<PurchaseWorkflowMeta>(workflowChunk, { history: [] })

  if (!Array.isArray(workflow.history)) workflow.history = []

  return {
    note: cleanedNote || null,
    purchaseOrder: {
      approvalReference: purchaseOrder.approvalReference || null,
      invoiceDate: purchaseOrder.invoiceDate || null,
      deliveryChallanNumber: purchaseOrder.deliveryChallanNumber || null,
    },
    workflow: {
      transport: workflow.transport || null,
      history: workflow.history,
    },
  }
}

export function serializePurchaseNotes(input: ParsedPurchaseMeta): string | null {
  const chunks: string[] = []
  if (input.note?.trim()) chunks.push(input.note.trim())
  chunks.push(`${PO_META_PREFIX}${JSON.stringify(input.purchaseOrder || {})}`)
  chunks.push(`${WORKFLOW_META_PREFIX}${JSON.stringify(input.workflow || { history: [] })}`)
  return chunks.join("\n")
}

