import { prisma } from "@/lib/db"

export type AuditEvent =
  | "CREATED"
  | "UPDATED"
  | "DELETED"
  | "VIEWED"
  | "APPROVED"
  | "REJECTED"
  | "BLACKLISTED"
  | "UNBLACKLISTED"
  | "LOGIN"
  | "LOGOUT"
  | (string & {})

export type RecordAuditInput = {
  userId?: string | null
  event: AuditEvent
  module: string
  ipAddress?: string | null
  description?: string | null
  targetEntityType?: string | null
  targetEntityId?: string | null
  targetRegionId?: string | null
  targetRegionalOfficeId?: string | null
}

/**
 * Write an AuditLog row with optional target-entity enrichment.
 * Fire-and-forget: failures are logged but never thrown.
 *
 * New writers should prefer this helper over raw `prisma.auditLog.create`
 * so that insights like scope-violation detection (B9) have target region
 * to work with.
 */
export async function recordAudit(input: RecordAuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        event: input.event,
        module: input.module,
        ipAddress: input.ipAddress ?? null,
        description: input.description ?? null,
        targetEntityType: input.targetEntityType ?? null,
        targetEntityId: input.targetEntityId ?? null,
        targetRegionId: input.targetRegionId ?? null,
        targetRegionalOfficeId: input.targetRegionalOfficeId ?? null,
      },
    })
  } catch (err) {
    console.error("[audit] failed to write AuditLog:", err)
  }
}
