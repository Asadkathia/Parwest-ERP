import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { hasModuleAccess } from "@/lib/api/permissions"
import { prisma } from "@/lib/db"
import { forbidden, unauthorized, type ApiEnvelope } from "@/lib/api/response"
import { getInventoryV2Flags } from "@/lib/inventory/v2-flags"
import { getPrismaCode } from "@/lib/prisma-errors"

type SessionUser = {
  id?: string
  role?: string
}

export type AuthedContext = {
  userId: string
  role: string
}

export async function requireInventorySession(): Promise<AuthedContext | Response> {
  const session = await auth()
  if (!session?.user) return unauthorized()

  const user = session.user as SessionUser
  if (!user.id) return unauthorized("Authenticated user id not found in session")

  if (!hasModuleAccess(session, "INVENTORY")) return forbidden()

  return {
    userId: user.id,
    role: typeof user.role === "string" ? user.role : "UNKNOWN",
  }
}

export function requireV2WriteEnabled(): Response | null {
  const flags = getInventoryV2Flags()
  if (!flags.writeEnabled) {
    return forbidden("Inventory v2 writes are disabled by flag: inventory.v2.writeEnabled")
  }
  return null
}

export async function emitInventoryV2Audit(args: {
  userId?: string | null
  event: string
  description: string
  request?: NextRequest
}) {
  const ipAddress = args.request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null

  try {
    await prisma.auditLog.create({
      data: {
        userId: args.userId ?? null,
        event: args.event,
        module: "INVENTORY_V2",
        description: args.description,
        ipAddress,
      },
    })
  } catch (error) {
    // If actor user no longer exists (e.g. DB was truncated), do not block the business write.
    // Retry audit write without user linkage.
    if (getPrismaCode(error) === "P2003") {
      await prisma.auditLog.create({
        data: {
          userId: null,
          event: args.event,
          module: "INVENTORY_V2",
          description: `${args.description} (user reference missing)`,
          ipAddress,
        },
      })
      return
    }
    throw error
  }
}

export function parsePositiveInt(value: unknown): number | null {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

export function parseNonNegativeInt(value: unknown): number | null {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) return null
  return parsed
}

export function parseNumberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function asText(value: unknown): string | null {
  if (value == null) return null
  const text = String(value).trim()
  return text.length > 0 ? text : null
}

export function asBool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    const n = value.trim().toLowerCase()
    if (["1", "true", "yes", "on"].includes(n)) return true
    if (["0", "false", "no", "off"].includes(n)) return false
  }
  return fallback
}

export function envelopeSuccess<T>(data: T): ApiEnvelope<T> {
  return { success: true, data }
}
