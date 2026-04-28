"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/shadcn/button"
import { Input } from "@/components/shadcn/input"
import { Label } from "@/components/shadcn/label"
import { Textarea } from "@/components/shadcn/textarea"
import { Checkbox } from "@/components/shadcn/checkbox"
import { Switch } from "@/components/shadcn/switch"
import { RadioGroup, RadioGroupItem } from "@/components/shadcn/radio-group"
import { Badge } from "@/components/shadcn/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/shadcn/avatar"
import { Separator } from "@/components/shadcn/separator"
import { Progress } from "@/components/shadcn/progress"
import { Skeleton } from "@/components/shadcn/skeleton"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/shadcn/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/shadcn/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/shadcn/tooltip"
import { Alert, AlertDescription, AlertTitle } from "@/components/shadcn/alert"
import { RegionSelector } from "@/components/shadcn/region-selector"
import {
  PermissionGate,
  useCanAccess,
} from "@/components/shadcn/permission-gate"
import { Stepper, type StepConfig } from "@/components/shadcn/stepper"
import { DataTable } from "@/components/shadcn/data-table"
import type { ColumnDef } from "@tanstack/react-table"
import { ParwestCurrency } from "@/components/shadcn/parwest-currency"
import { formatPKRFull, formatPKRShort } from "@/lib/format/currency"
import { CommandPalette } from "@/components/shadcn/command-palette"

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3 border-t pt-6">
      <div className="space-y-1">
        <h2 className="text-20 font-bold tracking-tight">{title}</h2>
        {subtitle ? (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      <div className="rounded-lg border p-4">{children}</div>
    </section>
  )
}

type ThemeMode = "light" | "dark" | "system"

function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return
  const root = document.documentElement
  if (mode === "system") {
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches
    root.dataset.theme = prefersDark ? "dark" : "light"
    root.classList.toggle("dark", prefersDark)
  } else {
    root.dataset.theme = mode
    root.classList.toggle("dark", mode === "dark")
  }
}

function applyDirection(dir: "ltr" | "rtl") {
  if (typeof document === "undefined") return
  document.documentElement.dir = dir
}

function PreviewToolbar() {
  const [theme, setTheme] = React.useState<ThemeMode>("system")
  const [direction, setDirection] = React.useState<"ltr" | "rtl">("ltr")

  const onTheme = (mode: ThemeMode) => {
    setTheme(mode)
    applyTheme(mode)
  }
  const onDir = (dir: "ltr" | "rtl") => {
    setDirection(dir)
    applyDirection(dir)
  }

  return (
    <div className="sticky top-0 z-40 -mx-4 mb-2 flex flex-wrap items-center gap-3 border-b bg-background/85 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Theme:
        </span>
        {(["light", "dark", "system"] as const).map((mode) => (
          <Button
            key={mode}
            size="sm"
            variant={theme === mode ? "default" : "outline"}
            onClick={() => onTheme(mode)}
          >
            {mode[0].toUpperCase() + mode.slice(1)}
          </Button>
        ))}
      </div>
      <Separator orientation="vertical" className="h-6" />
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Direction:
        </span>
        {(["ltr", "rtl"] as const).map((dir) => (
          <Button
            key={dir}
            size="sm"
            variant={direction === dir ? "default" : "outline"}
            onClick={() => onDir(dir)}
          >
            {dir.toUpperCase()}
          </Button>
        ))}
      </div>
    </div>
  )
}

const CURRENCY_COMPACT_SAMPLES = [
  247, 8500, 28000, 425000, 4_240_000, 42_400_000, 424_000_000, -15000, 0,
]

const PREVIEW_REGIONS = [
  { id: "lhr", name: "Lahore" },
  { id: "khi", name: "Karachi" },
  { id: "isb", name: "Islamabad" },
]

function RegionSelectorLoadingPreview() {
  // Render the loading-state branch by simulating an unmounted session. We
  // achieve this by reusing the Skeleton primitive directly — `RegionSelector`
  // itself can't render its loading state without a real `status: "loading"`
  // session, which we don't have here.
  return (
    <Skeleton
      className="h-9 min-w-[180px] rounded-md"
      aria-label="Loading region selector"
    />
  )
}

function PermissionGateDisabledExample() {
  // Demo a label that uses `useCanAccess` — when denied, label changes copy.
  const allowed = useCanAccess("DEMO", "CREATE")
  return (
    <span className="text-xs text-muted-foreground">
      useCanAccess(&quot;DEMO&quot;, &quot;CREATE&quot;) →{" "}
      <code>{String(allowed)}</code>
    </span>
  )
}

const GUARD_STEPS: StepConfig[] = [
  { id: "personal", label: "Personal", meta: "Name, CNIC, DOB" },
  { id: "service", label: "Service", meta: "Designation, shift" },
  { id: "address", label: "Address", meta: "Permanent, current" },
  { id: "bank", label: "Bank", meta: "Account, salary" },
  { id: "documents", label: "Documents", meta: "CNIC, photo" },
  { id: "review", label: "Review", meta: "Confirm before save" },
]

type PreviewGuard = {
  parwestId: string
  name: string
  designation: string
  status: "ACTIVE" | "PENDING" | "INACTIVE" | "TERMINATED"
  salary: number
}

const PREVIEW_GUARDS: PreviewGuard[] = [
  { parwestId: "PW-0001", name: "Ahmed Khan", designation: "Guard", status: "ACTIVE", salary: 32000 },
  { parwestId: "PW-0002", name: "Bilal Hussain", designation: "Supervisor", status: "ACTIVE", salary: 45000 },
  { parwestId: "PW-0003", name: "Faisal Iqbal", designation: "Guard", status: "PENDING", salary: 30000 },
  { parwestId: "PW-0004", name: "Hamza Raza", designation: "Guard", status: "INACTIVE", salary: 28000 },
  { parwestId: "PW-0005", name: "Imran Sheikh", designation: "Guard", status: "ACTIVE", salary: 32000 },
  { parwestId: "PW-0006", name: "Javed Akhtar", designation: "Driver", status: "ACTIVE", salary: 35000 },
  { parwestId: "PW-0007", name: "Kashif Mehmood", designation: "Guard", status: "TERMINATED", salary: 0 },
  { parwestId: "PW-0008", name: "Lateef Anwar", designation: "Guard", status: "PENDING", salary: 30000 },
  { parwestId: "PW-0009", name: "Moeen Ali", designation: "Supervisor", status: "ACTIVE", salary: 47000 },
  { parwestId: "PW-0010", name: "Nadeem Tariq", designation: "Guard", status: "ACTIVE", salary: 32000 },
]

function statusBadgeVariant(
  status: PreviewGuard["status"]
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "ACTIVE":
      return "default"
    case "PENDING":
      return "secondary"
    case "INACTIVE":
      return "outline"
    case "TERMINATED":
      return "destructive"
  }
}

const PREVIEW_GUARD_COLUMNS: ColumnDef<PreviewGuard>[] = [
  {
    accessorKey: "parwestId",
    header: "Parwest ID",
    cell: ({ row }) => (
      <span className="font-mono tabular-nums text-xs">
        {row.getValue("parwestId")}
      </span>
    ),
  },
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "designation",
    header: "Designation",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as PreviewGuard["status"]
      return (
        <Badge variant={statusBadgeVariant(status)}>{status}</Badge>
      )
    },
  },
  {
    accessorKey: "salary",
    header: () => <span className="block text-end">Salary (PKR)</span>,
    cell: ({ row }) => (
      <span className="block text-end tabular-nums">
        {(row.getValue("salary") as number).toLocaleString("en-PK")}
      </span>
    ),
  },
]

export default function PreviewClient() {
  const [progress, setProgress] = React.useState(33)
  const [region, setRegion] = React.useState<string | null>(null)
  const [stepIndex, setStepIndex] = React.useState(2)

  return (
    <TooltipProvider>
      <div className="mx-auto max-w-6xl space-y-8 p-8">
        <PreviewToolbar />
        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            shadcn/ui primitives — Phase 0b smoke test
          </h1>
          <p className="text-sm text-muted-foreground">
            Visual QA harness for the design-system v1.1 migration. SuperAdmin
            only.
          </p>
        </header>

        <Section title="Buttons">
          <div className="flex flex-wrap gap-2">
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
            <Button disabled>Disabled</Button>
          </div>
        </Section>

        <Section title="Form fields">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="preview-name">Name</Label>
              <Input id="preview-name" placeholder="Jane Doe" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preview-region">Region</Label>
              <Select>
                <SelectTrigger id="preview-region">
                  <SelectValue placeholder="Select a region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lhr">Lahore</SelectItem>
                  <SelectItem value="khi">Karachi</SelectItem>
                  <SelectItem value="isb">Islamabad</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="preview-notes">Notes</Label>
              <Textarea id="preview-notes" placeholder="Type something…" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="preview-tos" />
              <Label htmlFor="preview-tos">Accept terms</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="preview-sw" />
              <Label htmlFor="preview-sw">Enable feature flag</Label>
            </div>
            <RadioGroup defaultValue="a" className="sm:col-span-2 flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem id="rg-a" value="a" />
                <Label htmlFor="rg-a">Option A</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem id="rg-b" value="b" />
                <Label htmlFor="rg-b">Option B</Label>
              </div>
            </RadioGroup>
          </div>
        </Section>

        <Section title="Badges & avatars">
          <div className="flex flex-wrap items-center gap-3">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Separator orientation="vertical" className="h-6" />
            <Avatar>
              <AvatarImage src="" alt="JD" />
              <AvatarFallback>JD</AvatarFallback>
            </Avatar>
            <Avatar>
              <AvatarFallback>AS</AvatarFallback>
            </Avatar>
          </div>
        </Section>

        <Section title="Tabs">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="pt-3 text-sm">
              Overview tab content.
            </TabsContent>
            <TabsContent value="details" className="pt-3 text-sm">
              Details tab content.
            </TabsContent>
            <TabsContent value="history" className="pt-3 text-sm">
              History tab content.
            </TabsContent>
          </Tabs>
        </Section>

        <Section title="Card">
          <Card>
            <CardHeader>
              <CardTitle>Deployment summary</CardTitle>
              <CardDescription>
                Mock card to verify shadcn Card renders against Parwest tokens.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Surface uses <code>--card</code> / <code>--card-foreground</code>;
              border uses <code>--border</code>.
            </CardContent>
            <CardFooter className="gap-2">
              <Button size="sm">Primary action</Button>
              <Button size="sm" variant="outline">
                Secondary
              </Button>
            </CardFooter>
          </Card>
        </Section>

        <Section title="Dialog & Tooltip">
          <div className="flex flex-wrap items-center gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Open dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirm action</DialogTitle>
                  <DialogDescription>
                    Just a smoke test for Radix Dialog primitive theming.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="ghost">Cancel</Button>
                  </DialogClose>
                  <Button>Confirm</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost">Hover for tooltip</Button>
              </TooltipTrigger>
              <TooltipContent>Tooltip body</TooltipContent>
            </Tooltip>
          </div>
        </Section>

        <Section title="Toast (sonner)">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => toast.success("Hello")}>Success toast</Button>
            <Button
              variant="destructive"
              onClick={() => toast.error("Something went wrong")}
            >
              Error toast
            </Button>
            <Button
              variant="outline"
              onClick={() => toast.info("Just an FYI")}
            >
              Info toast
            </Button>
          </div>
        </Section>

        <Section title="Alert / Progress / Skeleton">
          <div className="space-y-4">
            <Alert>
              <AlertTitle>Heads up</AlertTitle>
              <AlertDescription>
                Default alert primitive — uses border + foreground tokens.
              </AlertDescription>
            </Alert>
            <Alert variant="destructive">
              <AlertTitle>Validation failed</AlertTitle>
              <AlertDescription>
                Destructive variant uses <code>--destructive</code>.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Progress value={progress} />
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setProgress((p) => (p >= 100 ? 0 : Math.min(100, p + 17)))
                }
              >
                Advance progress
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </Section>

        <Section title="Region selector (Phase 1B)">
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                forceMode=&quot;global&quot;
              </p>
              <RegionSelector
                regions={PREVIEW_REGIONS}
                value={region}
                onChange={setRegion}
                forceMode="global"
              />
              <p className="text-xs text-muted-foreground">
                value: <code>{region === null ? "null (Global)" : region}</code>
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                forceMode=&quot;regional&quot;
              </p>
              <RegionSelector
                regions={PREVIEW_REGIONS}
                value="lhr"
                onChange={() => {}}
                forceMode="regional"
              />
              <p className="text-xs text-muted-foreground">
                Read-only badge — locked to the user&apos;s region.
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                loading
              </p>
              <RegionSelectorLoadingPreview />
              <p className="text-xs text-muted-foreground">
                Skeleton while session is resolving.
              </p>
            </div>
          </div>
        </Section>

        <Section title="Permission gate (Phase 1B)">
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                mode=&quot;hide&quot; (DEMO module — denied → nothing renders)
              </p>
              <div className="rounded border border-dashed p-3 text-xs text-muted-foreground">
                Below this line should be empty:
                <div className="pt-2">
                  <PermissionGate module="DEMO" action="CREATE" mode="hide">
                    <Button>You should not see me</Button>
                  </PermissionGate>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                mode=&quot;disable&quot; (wraps a Button — disabled + tooltip)
              </p>
              <PermissionGate module="DEMO" action="CREATE" mode="disable">
                <Button>Create something</Button>
              </PermissionGate>
              <PermissionGateDisabledExample />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                mode=&quot;message&quot; (default — Alert wraps a Card)
              </p>
              <PermissionGate module="DEMO" action="VIEW" mode="message">
                <Card>
                  <CardHeader>
                    <CardTitle>Sensitive data</CardTitle>
                    <CardDescription>
                      Only visible when the gate allows.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    This card never renders for users without DEMO:VIEW.
                  </CardContent>
                </Card>
              </PermissionGate>
            </div>
          </div>
        </Section>

        <Section title="Stepper (Phase 1A)">
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Horizontal variant
              </p>
              <Stepper
                steps={GUARD_STEPS}
                currentStep={stepIndex}
                onStepClick={setStepIndex}
                variant="horizontal"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-[16rem_1fr]">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Sidebar variant
                </p>
                <div className="rounded-md border p-2">
                  <Stepper
                    steps={GUARD_STEPS}
                    currentStep={stepIndex}
                    onStepClick={setStepIndex}
                    variant="sidebar"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Controls
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setStepIndex((s) => Math.max(0, s - 1))
                    }
                    disabled={stepIndex === 0}
                  >
                    Back
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      setStepIndex((s) =>
                        Math.min(GUARD_STEPS.length - 1, s + 1)
                      )
                    }
                    disabled={stepIndex === GUARD_STEPS.length - 1}
                  >
                    Next
                  </Button>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    Step {stepIndex + 1} of {GUARD_STEPS.length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section title="DataTable (Phase 1A)">
          <DataTable
            columns={PREVIEW_GUARD_COLUMNS}
            data={PREVIEW_GUARDS}
            searchKey="name"
            searchPlaceholder="Search guards by name…"
            pageSize={5}
            emptyMessage="No guards found."
          />
        </Section>

        <Section
          title="Currency (Phase 1C)"
          subtitle="PKR helpers + <ParwestCurrency> — short form in tables/KPIs, full form (Pakistani lakh/crore grouping) in tooltips and exports."
        >
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Compact form (hover for full)
              </p>
              <div className="divide-y rounded-md border">
                {CURRENCY_COMPACT_SAMPLES.map((value) => (
                  <div
                    key={value}
                    className="grid grid-cols-3 items-center gap-4 px-3 py-2 text-sm"
                  >
                    <code className="font-mono text-xs text-muted-foreground">
                      {value}
                    </code>
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatPKRShort(value)}
                    </span>
                    <div className="justify-self-end">
                      <ParwestCurrency value={value} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Full form (no tooltip)
              </p>
              <div className="grid grid-cols-3 items-center gap-4 rounded-md border px-3 py-2 text-sm">
                <code className="font-mono text-xs text-muted-foreground">
                  424000000
                </code>
                <span className="font-mono text-xs text-muted-foreground">
                  {formatPKRFull(424_000_000)}
                </span>
                <div className="justify-self-end">
                  <ParwestCurrency value={424_000_000} compact={false} />
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section
          title="Command Palette (Phase 2C)"
          subtitle="Cmd/Ctrl+K opens it (Phase 2B emits the event). Click below to dispatch the same event."
        >
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.dispatchEvent(
                    new CustomEvent("open-command-palette")
                  )
                }
              }}
            >
              Open command palette (⌘K)
            </Button>
            <span className="text-xs text-muted-foreground">
              Escape closes. Enter selects. Items filter by your module
              permissions.
            </span>
          </div>
          {/* Mounted once so it can listen for the event. */}
          <CommandPalette />
        </Section>
      </div>
    </TooltipProvider>
  )
}
