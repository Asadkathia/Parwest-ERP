/**
 * Shared, pure resolver for effective user permissions.
 *
 * SINGLE SOURCE OF TRUTH for combining role-level permission rows with
 * user-level override rows. Both `lib/auth.ts buildPermissionSet` (which
 * stamps the JWT and is therefore the ENFORCED set) and
 * `api/user-permissions` GET (the DISPLAYED set surfaced in the UI legend
 * "Effective access = Role OR Additional") must call this so they cannot
 * drift again.
 *
 * Semantic: **UNION per action**. An action is enabled for the user if the
 * role row OR the user override row enables it. This matches the UI promise
 * and the structural intent of the UserPermissionsManager, which already
 * disables role-granted checkboxes — meaning user override rows are
 * structurally ADDITIVE (they cannot subtract role-granted actions).
 *
 * History: prior `buildPermissionSet` used REPLACE-per-module semantics
 * (any user-level row for a module silently dropped the role rows for that
 * module). That caused silent revocation: saving a single additional
 * override checkbox would strip all role-granted actions for that module on
 * next token refresh. See
 * docs/audits/users-auth-dead-legacy-conflict-audit.md — CONFLICT-2.
 *
 * Output: a flat `string[]` containing both:
 *   - the legacy module-only key (e.g. `"GUARDS"`) for back-compat with
 *     `hasModuleAccess`, and
 *   - per-action keys (e.g. `"GUARDS:VIEW"`, `"GUARDS:UPDATE"`) for
 *     `hasAction`.
 *
 * Pure / testable: no I/O, no globals, no session — callers fetch rows and
 * pass them in.
 */

import { permissionKey } from "@/lib/constants/permissions"

/**
 * A permission row shape common to RolePermission and UserPermission.
 * Only the per-action booleans + module name are needed for resolution.
 */
export type ActionRow = {
    module: string
    canCreate?: boolean | null
    canView?: boolean | null
    canUpdate?: boolean | null
    canDelete?: boolean | null
    canRequisition?: boolean | null
}

export type ResolveInput = {
    roleRows: ReadonlyArray<ActionRow>
    userRows: ReadonlyArray<ActionRow>
}

type MergedFlags = {
    canCreate: boolean
    canView: boolean
    canUpdate: boolean
    canDelete: boolean
    canRequisition: boolean
}

const EMPTY_FLAGS: MergedFlags = {
    canCreate: false,
    canView: false,
    canUpdate: false,
    canDelete: false,
    canRequisition: false,
}

function orFlags(into: MergedFlags, row: ActionRow): MergedFlags {
    return {
        canCreate: into.canCreate || Boolean(row.canCreate),
        canView: into.canView || Boolean(row.canView),
        canUpdate: into.canUpdate || Boolean(row.canUpdate),
        canDelete: into.canDelete || Boolean(row.canDelete),
        canRequisition: into.canRequisition || Boolean(row.canRequisition),
    }
}

function anyEnabled(flags: MergedFlags): boolean {
    return (
        flags.canCreate ||
        flags.canView ||
        flags.canUpdate ||
        flags.canDelete ||
        flags.canRequisition
    )
}

/**
 * Resolve effective permissions for a user as a flat `string[]` of
 * permission keys (module-only + per-action), de-duplicated and stable.
 *
 * UNION per action across role + user override rows.
 */
export function resolveEffectivePermissions({
    roleRows,
    userRows,
}: ResolveInput): string[] {
    // Merge per-module by OR-ing each action flag across the role row and the
    // user override row for that module.
    const perModule = new Map<string, MergedFlags>()

    const merge = (row: ActionRow) => {
        const current = perModule.get(row.module) ?? EMPTY_FLAGS
        perModule.set(row.module, orFlags(current, row))
    }

    for (const row of roleRows) merge(row)
    for (const row of userRows) merge(row)

    const out = new Set<string>()
    for (const [moduleName, flags] of perModule) {
        if (!anyEnabled(flags)) continue
        // Legacy module-only key (back-compat with hasModuleAccess).
        out.add(moduleName)
        if (flags.canCreate) out.add(permissionKey(moduleName, "CREATE"))
        if (flags.canView) out.add(permissionKey(moduleName, "VIEW"))
        if (flags.canUpdate) out.add(permissionKey(moduleName, "UPDATE"))
        if (flags.canDelete) out.add(permissionKey(moduleName, "DELETE"))
        if (flags.canRequisition) out.add(permissionKey(moduleName, "REQUISITIONS"))
    }
    return Array.from(out)
}

/**
 * Resolve the per-(module, action) effective flag table that the
 * `user-permissions` GET handler returns to the UI. Same UNION semantics as
 * `resolveEffectivePermissions`, but expressed as a row-shape consumable
 * by the manager component (which also wants the per-source breakdown).
 *
 * Returns one entry per requested module (even if neither role nor user
 * grants anything — UI renders the empty row).
 */
export function resolveEffectivePermissionFlags({
    modules,
    roleRows,
    userRows,
}: {
    modules: ReadonlyArray<string>
    roleRows: ReadonlyArray<ActionRow>
    userRows: ReadonlyArray<ActionRow>
}): Array<{
    module: string
    fromRole: MergedFlags
    fromUser: MergedFlags
    effective: MergedFlags
}> {
    const roleMap = new Map(roleRows.map((r) => [r.module, r]))
    const userMap = new Map(userRows.map((r) => [r.module, r]))
    return modules.map((moduleName) => {
        const rp = roleMap.get(moduleName)
        const up = userMap.get(moduleName)
        const fromRole = rp ? orFlags(EMPTY_FLAGS, rp) : EMPTY_FLAGS
        const fromUser = up ? orFlags(EMPTY_FLAGS, up) : EMPTY_FLAGS
        const effective: MergedFlags = {
            canCreate: fromRole.canCreate || fromUser.canCreate,
            canView: fromRole.canView || fromUser.canView,
            canUpdate: fromRole.canUpdate || fromUser.canUpdate,
            canDelete: fromRole.canDelete || fromUser.canDelete,
            canRequisition: fromRole.canRequisition || fromUser.canRequisition,
        }
        return { module: moduleName, fromRole, fromUser, effective }
    })
}
