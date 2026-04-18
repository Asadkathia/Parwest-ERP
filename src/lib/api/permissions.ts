import type { Session } from "next-auth"

export function hasModuleAccess(session: Session, module: string): boolean {
  const role = (session.user as { role?: string })?.role ?? ""
  if (role.toLowerCase() === "admin") return true
  const perms = (session.user as { permissions?: string[] })?.permissions ?? []
  return perms.includes(module)
}
