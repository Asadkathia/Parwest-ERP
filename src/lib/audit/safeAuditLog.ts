import { prisma } from "@/lib/db"

type SafeAuditArgs = {
  userId: string | null | undefined
  event: string
  module: string
  description?: string
  ipAddress?: string
}

/**
 * Non-critical audit log writer.
 *
 * - Validates the userId points to a real User row; if not, nullifies it so the
 *   FK to User doesn't fail. Sessions that outlive their user row would
 *   otherwise throw P2003 and roll back the surrounding transaction.
 * - Swallows any other write error (console warning only). Callers should not
 *   depend on audit persistence — it's best-effort.
 * - Always runs on the global `prisma` client, never a transaction client.
 *   Call this *after* a transaction commits, never inside one.
 */
export async function safeAuditLog(args: SafeAuditArgs): Promise<void> {
  try {
    let userId = args.userId ?? null
    if (userId) {
      const exists = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      })
      if (!exists) userId = null
    }
    await prisma.auditLog.create({
      data: {
        userId,
        event: args.event,
        module: args.module,
        description: args.description ?? null,
        ipAddress: args.ipAddress ?? null,
      },
    })
  } catch (error) {
    console.warn("safeAuditLog write failed (non-critical):", error)
  }
}
