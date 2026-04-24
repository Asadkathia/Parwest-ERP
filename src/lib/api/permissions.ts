import type { Session } from "next-auth"
import { httpMethodToAction, permissionKey } from "@/lib/constants/permissions"

type SessionLike = Session | null | undefined

function getRole(session: SessionLike): string {
  return (session?.user as { role?: string } | undefined)?.role ?? ""
}

function getPermissions(session: SessionLike): string[] {
  return (session?.user as { permissions?: string[] } | undefined)?.permissions ?? []
}

/**
 * SuperAdmin rule (matches middleware.ts and CLAUDE.md):
 *   role === "Admin" AND permissions.length === 0 → unrestricted access.
 * An Admin *with* permissions is a regional admin constrained to those permissions.
 *
 * NOTE: case-sensitive role match — "admin" (lowercase) is not a SuperAdmin.
 */
export function isSuperAdmin(session: SessionLike): boolean {
  if (!session?.user) return false
  const role = getRole(session)
  const perms = getPermissions(session)
  return role === "Admin" && perms.length === 0
}

/**
 * Module-level access check (legacy, backward-compatible).
 *
 * Returns true for SuperAdmin, or when the module-only key is present in
 * `session.user.permissions`. Module-only keys are still emitted by the JWT
 * layer alongside action keys, so this remains a valid coarse gate.
 */
export function hasModuleAccess(session: SessionLike, module: string): boolean {
  if (!session?.user) return false
  if (isSuperAdmin(session)) return true
  return getPermissions(session).includes(module)
}

/**
 * Action-level access check.
 *
 * Returns true for SuperAdmin, or when `"MODULE:ACTION"` is present in
 * `session.user.permissions`.
 *
 * IMPORTANT: this intentionally does NOT fall back to the legacy module-only
 * key. Since the JWT emits both the module key and every enabled action key,
 * the absence of `"MODULE:ACTION"` is meaningful — the action is not granted.
 */
export function hasAction(session: SessionLike, module: string, action: string): boolean {
  if (!session?.user) return false
  if (isSuperAdmin(session)) return true
  return getPermissions(session).includes(permissionKey(module, action))
}

/**
 * Convenience: map an HTTP method to its action and check it.
 *
 * GET→VIEW, POST→CREATE, PUT/PATCH→UPDATE, DELETE→DELETE.
 * For REQUISITIONS (no HTTP-verb equivalent), call hasAction() directly.
 */
export function hasHttpMethodAccess(
  session: SessionLike,
  module: string,
  method: string
): boolean {
  return hasAction(session, module, httpMethodToAction(method))
}
