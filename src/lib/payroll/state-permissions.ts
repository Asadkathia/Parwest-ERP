/**
 * Shared permission helpers for the payroll state machine.
 *
 * SuperAdmin convention (from CLAUDE.md):
 *   role === "Admin" AND permissions.length === 0  ⇒ unrestricted SuperAdmin.
 * An Admin *with* permissions is a regional admin restricted to those modules.
 *
 * The Session typings (`src/types/next-auth.d.ts`) do not declare
 * `permissions` on `session.user`, but `src/lib/auth.ts` writes it via
 * `session.user.permissions = ...`. We read it through a typed cast.
 */

import type { Session } from "next-auth"

export function isSuperAdmin(session: Session | null | undefined): boolean {
  if (!session?.user) return false
  const role = (session.user as { role?: string }).role
  if (role !== "Admin") return false
  const perms = (session.user as { permissions?: string[] }).permissions ?? []
  return perms.length === 0
}

export function getActorIdentity(session: Session): { id: string; name: string } {
  const id = (session.user as { id?: string })?.id ?? "unknown"
  const name =
    (session.user as { name?: string })?.name ??
    (session.user as { email?: string })?.email ??
    "unknown"
  return { id, name }
}
