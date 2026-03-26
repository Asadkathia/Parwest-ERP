export type DemandAllocationMetaLine = {
  demandLineId: string
  productId: string
  requestedQty?: number
  fulfilledNewQty: number
  fulfilledReusableQty: number
  note?: string | null
}

export type DemandTransportType = "SELF" | "COURIER"

export type DemandTransportMeta = {
  type: DemandTransportType
  driverName?: string | null
  driverPhone?: string | null
  vehicleNumber?: string | null
  courierCompany?: string | null
  courierBy?: string | null
  courierTrackingId?: string | null
  courierDate?: string | null
  addedAt?: string | null
  addedByUserId?: string | null
}

export type DemandReceiveMetaLine = {
  demandLineId: string
  productId: string
  receivedNewQty: number
  receivedReusableQty: number
  remarks?: string | null
}

export type DemandReceiveMeta = {
  receivedAt: string
  receivedByUserId?: string | null
  remarks?: string | null
  lines: DemandReceiveMetaLine[]
}

export type DemandResponseMeta = {
  version: 1
  responseRemarks?: string | null
  allocations: DemandAllocationMetaLine[]
  transport?: DemandTransportMeta | null
  receive?: DemandReceiveMeta | null
}

const EMPTY_META: DemandResponseMeta = {
  version: 1,
  responseRemarks: null,
  allocations: [],
  transport: null,
  receive: null,
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return Math.floor(parsed)
}

function asText(value: unknown): string | null {
  const text = String(value ?? "").trim()
  return text.length ? text : null
}

export function parseDemandResponseMeta(raw: unknown): DemandResponseMeta {
  if (!raw || typeof raw !== "string") return EMPTY_META

  try {
    const parsed = JSON.parse(raw) as Partial<DemandResponseMeta>
    const allocations = Array.isArray(parsed.allocations)
      ? parsed.allocations
          .map((line) => ({
            demandLineId: String(line?.demandLineId ?? "").trim(),
            productId: String(line?.productId ?? "").trim(),
            requestedQty: line?.requestedQty != null ? asNumber(line.requestedQty) : undefined,
            fulfilledNewQty: asNumber(line?.fulfilledNewQty),
            fulfilledReusableQty: asNumber(line?.fulfilledReusableQty),
            note: asText(line?.note),
          }))
          .filter((line) => line.demandLineId && line.productId)
      : []

    const receiveLines = Array.isArray(parsed.receive?.lines)
      ? parsed.receive!.lines
          .map((line) => ({
            demandLineId: String(line?.demandLineId ?? "").trim(),
            productId: String(line?.productId ?? "").trim(),
            receivedNewQty: asNumber(line?.receivedNewQty),
            receivedReusableQty: asNumber(line?.receivedReusableQty),
            remarks: asText(line?.remarks),
          }))
          .filter((line) => line.demandLineId && line.productId)
      : []

    return {
      version: 1,
      responseRemarks: asText(parsed.responseRemarks),
      allocations,
      transport: parsed.transport
        ? {
            type: String(parsed.transport.type ?? "SELF").toUpperCase() === "COURIER" ? "COURIER" : "SELF",
            driverName: asText(parsed.transport.driverName),
            driverPhone: asText(parsed.transport.driverPhone),
            vehicleNumber: asText(parsed.transport.vehicleNumber),
            courierCompany: asText(parsed.transport.courierCompany),
            courierBy: asText(parsed.transport.courierBy),
            courierTrackingId: asText(parsed.transport.courierTrackingId),
            courierDate: asText(parsed.transport.courierDate),
            addedAt: asText(parsed.transport.addedAt),
            addedByUserId: asText(parsed.transport.addedByUserId),
          }
        : null,
      receive: parsed.receive
        ? {
            receivedAt: String(parsed.receive.receivedAt ?? "").trim(),
            receivedByUserId: asText(parsed.receive.receivedByUserId),
            remarks: asText(parsed.receive.remarks),
            lines: receiveLines,
          }
        : null,
    }
  } catch {
    return EMPTY_META
  }
}

export function serializeDemandResponseMeta(meta: DemandResponseMeta): string {
  return JSON.stringify(meta)
}

export function totalAllocatedForMeta(meta: DemandResponseMeta): number {
  return meta.allocations.reduce((sum, line) => sum + line.fulfilledNewQty + line.fulfilledReusableQty, 0)
}

export function totalReceivedForMeta(meta: DemandResponseMeta): number {
  if (!meta.receive) return 0
  return meta.receive.lines.reduce((sum, line) => sum + line.receivedNewQty + line.receivedReusableQty, 0)
}
