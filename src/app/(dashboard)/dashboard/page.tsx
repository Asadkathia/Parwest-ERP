import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { BellRing, Building2, MapPinned, MessageSquareMore, ShieldCheck, Sparkles, Users } from "lucide-react"
import StatCard from "@/components/ui/stat-card"
import { Card, CardBody, CardHeader } from "@/components/ui/card"
import SectionTitle from "@/components/ui/section-title"
import Panel from "@/components/ui/panel"
import ActionButton from "@/components/ui/action-button"
import { Select } from "@/components/ui/form-controls"
import StatusChip from "@/components/ui/status-chip"

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Dashboard"
        subtitle={`Welcome back, ${session.user?.name || "Admin"}.`}
        action={
          <Link
            href="/dashboard/ai-chat"
            className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--brand)] px-3 py-2 text-sm font-medium text-white shadow-[var(--shadow-xs)]"
          >
            <Sparkles className="h-4 w-4" />
            AI Chat
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Guards" value={0} tone="brand" icon={<Users className="h-5 w-5" />} />
        <StatCard label="Active Deployments" value={0} tone="success" icon={<MapPinned className="h-5 w-5" />} />
        <StatCard label="Total Clients" value={0} tone="warning" icon={<Building2 className="h-5 w-5" />} />
        <StatCard label="Pending Tickets" value={0} tone="danger" icon={<MessageSquareMore className="h-5 w-5" />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader>
            <SectionTitle
              title="Things To Do"
              subtitle="Today's events"
              action={
                <div className="flex items-center gap-2">
                  <Select className="w-40">
                    <option>All Clients</option>
                  </Select>
                  <ActionButton>New To Do</ActionButton>
                </div>
              }
            />
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[linear-gradient(180deg,#f8faff_0%,#f4f7ff_100%)] p-4">
              <div className="grid grid-cols-6 gap-3 text-center text-xs text-[var(--text-muted)] mb-4">
                {["Mon 21", "Tue 22", "Wed 23", "Thu 24", "Fri 25", "Sat 26"].map((day, idx) => (
                  <div key={day} className={idx === 1 ? "font-semibold text-[var(--brand)]" : ""}>{day}</div>
                ))}
              </div>
              <div className="space-y-2">
                <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2 text-sm">
                  <p className="font-medium">Fire Inspection today</p>
                  <p className="text-xs text-[var(--text-muted)]">2:00 pm</p>
                </div>
                <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2 text-sm">
                  <p className="font-medium">Waste pickup scheduled</p>
                  <p className="text-xs text-[var(--text-muted)]">2:00 to 4:00 pm</p>
                </div>
                <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2 text-sm">
                  <p className="font-medium">Night supervisor briefing</p>
                  <p className="text-xs text-[var(--text-muted)]">8:00 pm</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <StatusChip variant="success" label="Online Users : 53" />
              <Link href="/dashboard/online-users" className="text-sm font-semibold text-[var(--brand)] hover:underline">
                Open Online Users
              </Link>
            </div>
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Panel>
            <SectionTitle title="Compliance" subtitle="Alerts and upcoming expiries" />
            <div className="mt-3 space-y-2 text-sm">
              <div className="rounded-[var(--radius-md)] border border-[var(--border)] p-3">
                <p><strong>5 new</strong> contracts are due to expire this week.</p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--border)] p-3">
                <p>Dr. Kang&apos;s CDS license expires in 30 days.</p>
              </div>
            </div>
          </Panel>

          <Panel>
            <SectionTitle title="Reminder" subtitle="Today's reminders" />
            <div className="mt-3 space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <BellRing className="h-4 w-4 mt-0.5 text-[var(--brand)]" />
                <p>3 chat messages not acknowledged.</p>
              </div>
              <div className="flex items-start gap-2">
                <BellRing className="h-4 w-4 mt-0.5 text-[var(--brand)]" />
                <p>3 tasks due today.</p>
              </div>
              <div className="flex items-start gap-2">
                <BellRing className="h-4 w-4 mt-0.5 text-[var(--brand)]" />
                <p>2 overdue tickets need action.</p>
              </div>
            </div>
          </Panel>

          <Panel>
            <SectionTitle title="Celebration" subtitle="This week" />
            <div className="mt-3 flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-[var(--brand)]" />
              <p>Dr. John Smith&apos;s birthday on 24 May.</p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
