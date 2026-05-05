import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { hasModuleAccess } from "@/lib/api/permissions"
import { prisma } from "@/lib/db"
import DeductionsPolicyClient from "./DeductionsPolicyClient"

export const dynamic = "force-dynamic"

export default async function DeductionsPolicyPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (!hasModuleAccess(session, "DEDUCTIONS")) redirect("/settings")

  const [branches, regions] = await Promise.all([
    prisma.branch.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, code: true, client: { select: { name: true } } },
      orderBy: [{ client: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.region.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  return (
    <DeductionsPolicyClient
      branchOptions={branches.map((b) => ({
        id: b.id,
        label: `${b.client?.name ?? ""} — ${b.name}${b.code ? ` (${b.code})` : ""}`,
      }))}
      regionOptions={regions.map((r) => ({ id: r.id, label: r.name }))}
    />
  )
}
