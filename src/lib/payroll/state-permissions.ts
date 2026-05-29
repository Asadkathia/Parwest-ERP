/**
 * Shared permission helpers for the payroll state machine.
 *
 * SuperAdmin convention (from CLAUDE.md):
 *   role === "Super User"                          ⇒ always unrestricted SuperAdmin.
 *   role === "Admin" AND permissions.length === 0  ⇒ unrestricted SuperAdmin.
 * An Admin *with* permissions is a regional admin restricted to those modules.
 *
 * F-1 (payroll audit): this module previously shipped a *divergent* local
 * `isSuperAdmin` that dropped the `"Super User"` branch, locking the highest-
 * privilege role out of every SuperAdmin-gated payroll-state action (and the
 * tickets routes that import the same symbol). The canonical implementation
 * lives in `@/lib/api/permissions`; we re-export it here so every importer
 * (7 payroll-state routes + 3 tickets routes) inherits the fix without edits.
 * The re-export name and signature are unchanged.
 */

import type { Session } from "next-auth"

export { isSuperAdmin } from "@/lib/api/permissions"

export function getActorIdentity(session: Session): { id: string; name: string } {
  const id = (session.user as { id?: string })?.id ?? "unknown"
  const name =
    (session.user as { name?: string })?.name ??
    (session.user as { email?: string })?.email ??
    "unknown"
  return { id, name }
}
