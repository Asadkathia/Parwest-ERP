import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import Link from "next/link"
import SectionTitle from "@/components/ui/section-title"
import { Card, CardBody } from "@/components/ui/card"

const assignmentTabs = [
  { title: "M/S Relationship", href: "/users/ms-relationship", description: "Assign managers to supervisors and review mappings." },
  { title: "C/S Relationship", href: "/users/cs-relationship", description: "Assign client branches to supervisors." },
  { title: "Switch Supervisor", href: "/users/switch-supervisor", description: "Transfer guards between supervisors by office scope." },
]

export default async function UserAssignmentsTransfersPage() {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <div className="space-y-6">
      <SectionTitle title="Assignments & Transfers" subtitle="Supervisor assignment and transfer workflows." />
      <div className="grid gap-4 md:grid-cols-2">
        {assignmentTabs.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="h-full transition hover:shadow-[var(--shadow-md)]">
              <CardBody className="space-y-1">
                <p className="text-sm font-semibold text-[var(--text)]">{item.title}</p>
                <p className="text-xs text-[var(--text-muted)]">{item.description}</p>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
