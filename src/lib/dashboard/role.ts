import type { Session } from "next-auth"

export type DashboardRole =
  | "SUPER_ADMIN"
  | "ADMIN_REGIONAL"
  | "MANAGER"
  | "SUPERVISOR"
  | "ACCOUNTANT"

export type DashboardVisibility = {
  attentionStrip: boolean
  kpiRow: boolean
  kpiSet: "full" | "reduced" | "finance"
  opsFeed: boolean
  myQueue: boolean
  coverageMap: boolean
  expiringRenewals: boolean
  financePulse: boolean
}

export function resolveDashboardRole(session: Session | null): DashboardRole {
  const role = session?.user?.role ?? ""
  const perms = (session?.user?.permissions as string[] | undefined) ?? []

  if (role === "Super User") return "SUPER_ADMIN"
  if (role === "Admin" && perms.length === 0) return "SUPER_ADMIN"
  if (role === "Admin") return "ADMIN_REGIONAL"
  if (role === "Manager") return "MANAGER"
  if (role === "Supervisor") return "SUPERVISOR"
  if (role === "Accountant") return "ACCOUNTANT"
  return "SUPERVISOR"
}

export function roleVisibility(
  role: DashboardRole,
  permissions: string[] = []
): DashboardVisibility {
  const hasPayroll = permissions.includes("PAYROLL")
  const hasClients = permissions.includes("CLIENTS")

  switch (role) {
    case "SUPER_ADMIN":
      return {
        attentionStrip: true,
        kpiRow: true,
        kpiSet: "full",
        opsFeed: true,
        myQueue: true,
        coverageMap: true,
        expiringRenewals: true,
        financePulse: true,
      }
    case "ADMIN_REGIONAL":
      return {
        attentionStrip: true,
        kpiRow: true,
        kpiSet: "full",
        opsFeed: true,
        myQueue: true,
        coverageMap: true,
        expiringRenewals: true,
        financePulse: hasPayroll || hasClients,
      }
    case "MANAGER":
      return {
        attentionStrip: true,
        kpiRow: true,
        kpiSet: "full",
        opsFeed: true,
        myQueue: true,
        coverageMap: true,
        expiringRenewals: true,
        financePulse: false,
      }
    case "SUPERVISOR":
      return {
        attentionStrip: true,
        kpiRow: true,
        kpiSet: "reduced",
        opsFeed: true,
        myQueue: true,
        coverageMap: false,
        expiringRenewals: false,
        financePulse: false,
      }
    case "ACCOUNTANT":
      return {
        attentionStrip: true,
        kpiRow: true,
        kpiSet: "finance",
        opsFeed: false,
        myQueue: true,
        coverageMap: false,
        expiringRenewals: false,
        financePulse: true,
      }
  }
}
