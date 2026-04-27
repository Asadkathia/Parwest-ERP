import { NextRequest } from "next/server"
import { StoreInventoryDemandResponseStatus } from "@prisma/client"
import { getPrismaCode } from "@/lib/prisma-errors"
import { badRequest, internalServerError, notFound, ok } from "@/lib/api/response"
import { prisma } from "@/lib/db"
import { asText, emitInventoryV2Audit, ensureStoreInScope, requireInventorySession, requireV2WriteEnabled } from "@/lib/inventory/store-v2-api"
import { parseDemandResponseMeta, serializeDemandResponseMeta } from "@/lib/inventory/demand-response-meta"

type Params = { params: Promise<{ id: string; responseId: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await requireInventorySession()
  if (session instanceof Response) return session

  const writeBlocked = requireV2WriteEnabled()
  if (writeBlocked) return writeBlocked

  const { id: demandId, responseId } = await params

  try {
    const body = (await request.json()) as Record<string, unknown>
    const transportType = String(body.transportType ?? body.type ?? "").trim().toUpperCase()
    if (transportType !== "SELF" && transportType !== "COURIER") {
      return badRequest("transportType must be SELF or COURIER.")
    }

    const response = await prisma.storeInventoryDemandResponse.findFirst({
      where: { id: responseId, demandId },
    })
    if (!response) return notFound("Demand response not found.")

    // Adding transport metadata is performed by the responder warehouse — gate it
    // on scope over the responder store.
    const denied = await ensureStoreInScope(response.responderStoreId, session.scope, "Demand response not found.")
    if (denied) return denied

    const meta = parseDemandResponseMeta(response.notes)
    if (meta.receive?.receivedAt) {
      return badRequest("Transport cannot be modified after receive confirmation.")
    }

    const transport = {
      type: transportType as "SELF" | "COURIER",
      driverName: asText(body.driverName),
      driverPhone: asText(body.driverPhone),
      vehicleNumber: asText(body.vehicleNumber),
      courierCompany: asText(body.courierCompany),
      courierBy: asText(body.courierBy),
      courierTrackingId: asText(body.courierTrackingId),
      courierDate: asText(body.courierDate),
      addedAt: new Date().toISOString(),
      addedByUserId: session.userId,
    }

    if (transport.type === "SELF") {
      if (!transport.driverName || !transport.driverPhone || !transport.vehicleNumber) {
        return badRequest("driverName, driverPhone and vehicleNumber are required for SELF transport.")
      }
    }

    if (transport.type === "COURIER") {
      if (!transport.courierCompany || !transport.courierBy) {
        return badRequest("courierCompany and courierBy are required for COURIER transport.")
      }
    }

    const updated = await prisma.storeInventoryDemandResponse.update({
      where: { id: responseId },
      data: {
        status: response.status === StoreInventoryDemandResponseStatus.PENDING
          ? StoreInventoryDemandResponseStatus.APPROVED
          : response.status,
        notes: serializeDemandResponseMeta({
          ...meta,
          transport,
        }),
      },
      include: {
        lines: true,
        responderStore: true,
        responder: { select: { id: true, name: true, email: true } },
      },
    })

    await emitInventoryV2Audit({
      userId: session.userId,
      event: "DEMAND_RESPONSE_TRANSPORT_ADDED",
      description: `Added transport for demand response ${responseId}`,
      request,
    })

    return ok(updated)
  } catch (error) {
    const code = getPrismaCode(error)
    if (code === "P2025") return notFound("Demand response not found.")

    console.error(`store-inventory v2 demand response transport PATCH (${responseId}) failed`, error)
    return internalServerError("Failed to add transport details.")
  }
}
