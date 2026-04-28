import Link from "next/link"
import {
  Building2,
  Cog,
  CreditCard,
  Fingerprint,
  Gauge,
  MapPin,
  ScrollText,
  Settings as SettingsIcon,
  Users,
} from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/card"

const links = [
  {
    title: "Regions",
    href: "/settings/regions",
    description: "Top-level operational regions used for tenant scoping.",
    icon: MapPin,
  },
  {
    title: "Regional Offices",
    href: "/settings/offices",
    description: "Regional offices that group guards, deployments, and stores.",
    icon: Building2,
  },
  {
    title: "Guard Documents",
    href: "/settings/guard-pledgeable-documents",
    description: "Pledgeable document types collected during onboarding.",
    icon: ScrollText,
  },
  {
    title: "User Types",
    href: "/settings/user-types",
    description: "Internal user classifications used in directory listings.",
    icon: Users,
  },
  {
    title: "Guard Bank Names",
    href: "/settings/guard-bank-names",
    description: "Bank list shown when capturing guard payroll details.",
    icon: CreditCard,
  },
  {
    title: "Fingerprint Device",
    href: "/settings/fingerprint-device",
    description: "Configure the biometric capture device endpoint.",
    icon: Fingerprint,
  },
  {
    title: "Workflow Rules",
    href: "/settings/workflow-rules",
    description: "Toggle deployment and inventory validation strictness.",
    icon: Cog,
  },
  {
    title: "System Settings",
    href: "/settings/system",
    description: "Application-wide preferences and runtime flags.",
    icon: SettingsIcon,
  },
  {
    title: "Insights Configuration",
    href: "/settings/insights",
    description: "Tune dashboard insight thresholds and aggregations.",
    icon: Gauge,
  },
]

export default function SettingsOverviewPage() {
  return (
    <div className="space-y-6">
      <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold tracking-tight">{"Settings"}</h2><p className="mt-1 text-sm text-muted-foreground">{"Master settings routes and setup workflows."}</p></div></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {links.map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href} className="block">
              <Card className="h-full transition hover:shadow-md hover:border-primary/40">
                <CardHeader className="flex flex-row items-start gap-3">
                  <div className="rounded-md bg-muted p-2 text-muted-foreground">
                    <Icon className="h-4 w-4" aria-hidden />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-sm">{item.title}</CardTitle>
                    <CardDescription className="mt-1 text-xs">
                      {item.description}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="pt-0" />
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
