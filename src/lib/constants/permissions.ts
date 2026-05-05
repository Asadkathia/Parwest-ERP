/**
 * Single source of truth for permission modules, actions, and key formatting.
 *
 * Permission key format: `"MODULE:ACTION"` (colon separator).
 *
 * Tokens emit BOTH the legacy module-only key (e.g. `"GUARDS"`) AND action
 * keys (e.g. `"GUARDS:VIEW"`) so that legacy module-level checks continue to
 * work while action-aware code can query per-action permissions.
 */

/**
 * Canonical list of permission modules.
 *
 * NOTE: this is the union of the three previous duplicate lists:
 *  - src/components/users/UserPermissionsManager.tsx
 *  - src/components/users/RolePermissionsManager.tsx
 *  - src/app/api/user-permissions/route.ts
 * All three were identical; this is now the only definition.
 */
export const MODULES = [
    "GUARDS",
    "PAYROLL",
    "INVENTORY",
    "USERS",
    "CLIENTS",
    "TICKETING",
    "SETTINGS",
    "REPORTS",
    "IMPORTS",
    "REQUISITIONS",
    "AUDIT",
    "ADMIN_APPROVALS",
    "DEDUCTIONS",
] as const

export const ACTIONS = [
    "CREATE",
    "VIEW",
    "UPDATE",
    "DELETE",
    "REQUISITIONS",
] as const

/**
 * Extended (non-CRUD) action keys for granular policy controls.
 * These are NOT rendered in the generic permissions matrix UI;
 * they are surfaced on dedicated screens (e.g. Deductions Policy settings).
 * Checked via `hasAction(session, module, action)` directly.
 */
export const EXTENDED_ACTIONS = [
    // Deductions policy
    "RATE_PROPOSE",
    "RATE_APPROVE",
    "RATE_RETROACTIVE",
    "POLICY_EDIT",
    // Payroll-side per-line override
    "DEDUCTION_OVERRIDE",
] as const

export type ExtendedActionKey = (typeof EXTENDED_ACTIONS)[number]

export type ModuleKey = (typeof MODULES)[number]
export type ActionKey = (typeof ACTIONS)[number]
export type PermissionKey = `${ModuleKey}:${ActionKey}`

/**
 * Map an HTTP method to its corresponding action key.
 *
 * GET    → VIEW
 * POST   → CREATE
 * PUT    → UPDATE
 * PATCH  → UPDATE
 * DELETE → DELETE
 *
 * NOTE: REQUISITIONS is NOT an HTTP-verb-derived action and is intentionally
 * unmapped here; routes that need it must call `hasAction(session, module, "REQUISITIONS")`
 * directly.
 */
export function httpMethodToAction(method: string): ActionKey {
    const m = String(method ?? "").toUpperCase()
    switch (m) {
        case "GET":
            return "VIEW"
        case "POST":
            return "CREATE"
        case "PUT":
        case "PATCH":
            return "UPDATE"
        case "DELETE":
            return "DELETE"
        default:
            throw new Error(`httpMethodToAction: unsupported HTTP method "${method}"`)
    }
}

/**
 * Format a "MODULE:ACTION" permission key. Inputs are upper-cased for safety.
 */
export function permissionKey(module: string, action: string): string {
    return `${String(module).toUpperCase()}:${String(action).toUpperCase()}`
}
