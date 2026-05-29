import { redirect } from "next/navigation"

// Decommissioned: the parallel `UserTypesManager` UI duplicated /users + /users/roles
// (different/incorrect gating, banned window.confirm, bypassed canonical isSuperAdmin).
// Canonical destination is the /users module — see docs/audits/users-auth-dead-legacy-conflict-audit.md (LEGACY/DUP for UserTypesManager).
export default function UserTypesPage() {
  redirect("/users")
}
