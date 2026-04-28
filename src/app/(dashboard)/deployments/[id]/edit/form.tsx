"use client"

/**
 * Phase 4A — Deployment Edit (Change) form, reskinned with shadcn primitives.
 *
 * Behavior is unchanged: this flow ENDS the current deployment on the
 * effective date and CREATES a new one with the updated details. It posts
 * to `/api/deployments/[id]/change`. Validation rules mirror the legacy
 * form 1:1 via `deploymentEditSchema`.
 *
 * Server-only workflow rules surfaced as toast errors:
 *   - deployments.lockAfterEnd
 *   - deployments.blockInactiveUpdate
 *   - deployments.requireBranchContract
 *   - deployments.requireClientHasBranches
 */

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import {
  RefreshCw,
  MapPin,
  Clock,
  ArrowRight,
  Building2,
  Calendar,
  User,
  AlertTriangle,
  CheckCircle2,
  Lock,
} from "lucide-react"

import {
  deploymentEditSchema,
  CHANGE_REASON_CODES,
  type DeploymentEditForm,
} from "@/lib/schemas/deployment-edit"

import { Alert, AlertDescription, AlertTitle } from "@/components/shadcn/alert"
import { Button } from "@/components/shadcn/button"
import { Card, CardContent } from "@/components/shadcn/card"
import { Input } from "@/components/shadcn/input"
import { Textarea } from "@/components/shadcn/textarea"
import { Checkbox } from "@/components/shadcn/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/shadcn/radio-group"
import { PermissionGate } from "@/components/shadcn/permission-gate"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/shadcn/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select"

type Branch = {
  id: string
  name: string
  city: string | null
  address: string | null
}

type Client = {
  id: string
  name: string
  branches: Branch[]
}

type RegionalOffice = {
  id: string
  name: string
  seriesCode: string
}

type Deployment = {
  id: string
  guardId: string
  clientId: string
  branchId: string | null
  regionalOfficeId: string
  deploymentDate: Date
  designation: string | null
  shiftType: string
  status: string
  deploymentType: string | null
  deploymentNature: string | null
  isExtraGuard: boolean
  comment: string | null
  notes: string | null
  guardType: string | null
  dayShiftStart: string | null
  dayShiftEnd: string | null
  nightShiftStart: string | null
  nightShiftEnd: string | null
  deployedByName: string | null
  guard: {
    id: string
    name: string
    parwestId: string
    phone: string | null
    photoUrl: string | null
    isExService: boolean
    exServiceType: string | null
  }
  client: { id: string; name: string; branches: Branch[] }
  branch: { id: string; name: string } | null
  regionalOffice: { id: string; name: string; seriesCode: string }
}

type Props = {
  deployment: Deployment
  clients: Client[]
  regionalOffices: RegionalOffice[]
  /** Server-resolved value of the `deployments.blockInactiveUpdate` rule. */
  blockInactiveUpdate: boolean
}

const DESIGNATION_OPTIONS = [
  "Guard",
  "Location Supervisor",
  "CPO",
  "SO",
  "ASO",
  "LSO",
  "Receptionist",
  "CCTV Operator",
  "Complaint Receiver",
] as const

const CHANGE_REASONS: Array<{
  id: (typeof CHANGE_REASON_CODES)[number]
  label: string
  desc: string
}> = [
  { id: "CLIENT_TRANSFER", label: "Client Transfer", desc: "Moving guard to a different client" },
  { id: "BRANCH_TRANSFER", label: "Branch Transfer", desc: "Moved to a different branch of same client" },
  { id: "SHIFT_CHANGE", label: "Shift Change", desc: "Changing from day to night shift or vice versa" },
  { id: "ROLE_CHANGE", label: "Role/Designation Change", desc: "Guard's role or designation is changing" },
  { id: "OPERATIONAL", label: "Operational Requirement", desc: "Business or operational need" },
  { id: "OTHER", label: "Other", desc: "Other reason — specify in notes" },
]

function formatDate(d: Date | string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export default function ChangeDeploymentForm({
  deployment,
  clients,
  regionalOffices,
  blockInactiveUpdate,
}: Props) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [step, setStep] = useState<"form" | "confirm">("form")

  // Workflow gate: blockInactiveUpdate. Server enforces and resolves the
  // rule value (this is a client component — see page.tsx for the source).
  const isLocked = blockInactiveUpdate && deployment.status !== "ACTIVE"

  const todayStr = new Date().toISOString().split("T")[0]
  const minDate = new Date(deployment.deploymentDate).toISOString().split("T")[0]

  const form = useForm<DeploymentEditForm>({
    resolver: zodResolver(deploymentEditSchema),
    defaultValues: {
      clientId: deployment.clientId,
      branchId: deployment.branchId ?? "",
      regionalOfficeId: deployment.regionalOfficeId,
      shiftType: (deployment.shiftType as "DAY" | "NIGHT" | "BOTH") || "DAY",
      designation: deployment.designation || "Guard",
      deploymentType:
        (deployment.deploymentType as "REGULAR" | "OVERTIME") || "REGULAR",
      deploymentNature:
        (deployment.deploymentNature as "PERMANENT" | "TEMPORARY") ||
        "PERMANENT",
      isExtraGuard: deployment.isExtraGuard,
      dayShiftStart: deployment.dayShiftStart || "08:00",
      dayShiftEnd: deployment.dayShiftEnd || "20:00",
      nightShiftStart: deployment.nightShiftStart || "20:00",
      nightShiftEnd: deployment.nightShiftEnd || "08:00",
      effectiveDate: todayStr,
      // changeReason intentionally undefined — RHF will mark required.
      changeReason: undefined as unknown as DeploymentEditForm["changeReason"],
      notes: "",
    },
  })

  const values = form.watch()
  const clientId = values.clientId
  const branchId = values.branchId ?? ""
  const shiftType = values.shiftType
  const isExtraGuard = values.isExtraGuard
  const changeReason = values.changeReason

  const availableBranches = useMemo(() => {
    const c = clients.find((x) => x.id === clientId)
    return c?.branches ?? []
  }, [clientId, clients])

  // Reset branch when client changes (mirrors legacy behavior).
  useEffect(() => {
    if (clientId && clientId !== deployment.clientId) {
      const branchInClient = availableBranches.some((b) => b.id === branchId)
      if (!branchInClient) {
        form.setValue("branchId", "")
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, availableBranches])

  // Extra guard implies temporary nature.
  useEffect(() => {
    if (isExtraGuard && values.deploymentNature !== "TEMPORARY") {
      form.setValue("deploymentNature", "TEMPORARY")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExtraGuard])

  // Detect what changed for the confirmation summary.
  const changes: { field: string; from: string; to: string }[] = []
  const currentClient = clients.find((c) => c.id === deployment.clientId)
  const newClient = clients.find((c) => c.id === clientId)
  const currentBranch = deployment.client.branches.find(
    (b) => b.id === deployment.branchId
  )
  const newBranch = availableBranches.find((b) => b.id === branchId)

  if (clientId !== deployment.clientId) {
    changes.push({
      field: "Client",
      from: currentClient?.name || deployment.clientId,
      to: newClient?.name || clientId,
    })
  }
  if (branchId !== (deployment.branchId || "")) {
    changes.push({
      field: "Branch",
      from: currentBranch?.name || "None",
      to: newBranch?.name || "None",
    })
  }
  if (shiftType !== deployment.shiftType) {
    changes.push({
      field: "Shift",
      from: deployment.shiftType,
      to: String(shiftType ?? ""),
    })
  }
  if ((values.designation ?? "") !== (deployment.designation || "")) {
    changes.push({
      field: "Designation",
      from: deployment.designation || "—",
      to: String(values.designation ?? ""),
    })
  }
  if ((values.deploymentType ?? "REGULAR") !== (deployment.deploymentType || "REGULAR")) {
    changes.push({
      field: "Deployment Type",
      from: deployment.deploymentType || "REGULAR",
      to: String(values.deploymentType ?? "REGULAR"),
    })
  }
  if ((values.deploymentNature ?? "PERMANENT") !== (deployment.deploymentNature || "PERMANENT")) {
    changes.push({
      field: "Nature",
      from: deployment.deploymentNature || "PERMANENT",
      to: String(values.deploymentNature ?? "PERMANENT"),
    })
  }
  if (values.regionalOfficeId !== deployment.regionalOfficeId) {
    const curOffice = regionalOffices.find(
      (o) => o.id === deployment.regionalOfficeId
    )
    const newOffice = regionalOffices.find(
      (o) => o.id === values.regionalOfficeId
    )
    changes.push({
      field: "Regional Office",
      from: curOffice?.name || deployment.regionalOfficeId,
      to: newOffice?.name || values.regionalOfficeId,
    })
  }

  const guardType = deployment.guard.isExService
    ? `Ex-Service (${deployment.guard.exServiceType || "Unknown"})`
    : "Civilian"

  const onSubmit = form.handleSubmit(async (data) => {
    if (isLocked) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/deployments/${deployment.id}/change`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          effectiveDate: data.effectiveDate,
          changeReason: data.changeReason,
          clientId: data.clientId,
          branchId: data.branchId || null,
          regionalOfficeId: data.regionalOfficeId,
          shiftType: data.shiftType,
          designation: data.designation,
          deploymentType: data.deploymentType,
          deploymentNature: data.deploymentNature,
          isExtraGuard: data.isExtraGuard,
          dayShiftStart: data.shiftType === "DAY" ? data.dayShiftStart : null,
          dayShiftEnd: data.shiftType === "DAY" ? data.dayShiftEnd : null,
          nightShiftStart:
            data.shiftType === "NIGHT" ? data.nightShiftStart : null,
          nightShiftEnd: data.shiftType === "NIGHT" ? data.nightShiftEnd : null,
          notes: data.notes,
        }),
      })

      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        const message =
          (payload as { message?: string })?.message ||
          "Failed to change deployment"
        toast.error(message)
        setStep("form")
        return
      }

      toast.success("Deployment updated")
      const newId = (payload as { newDeployment?: { id?: string } })
        ?.newDeployment?.id
      router.push(newId ? `/deployments/${newId}` : "/deployments")
      router.refresh()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to change deployment"
      )
      setStep("form")
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <Form {...form}>
      <form
        onSubmit={onSubmit}
        className="max-w-4xl mx-auto space-y-6"
        noValidate
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <RefreshCw className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Change Deployment</h1>
            <p className="text-sm text-muted-foreground">
              Ends the current deployment and creates a new one with updated
              details
            </p>
          </div>
        </div>

        {isLocked ? (
          <Alert variant="destructive">
            <Lock className="h-4 w-4" aria-hidden />
            <AlertTitle>Deployment locked</AlertTitle>
            <AlertDescription>
              This deployment cannot be updated while inactive (workflow rule
              blockInactiveUpdate).
            </AlertDescription>
          </Alert>
        ) : null}

        {/* Guard Card */}
        <Card>
          <CardContent className="p-5">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Guard
            </h2>
            <div className="flex items-center gap-4">
              {deployment.guard.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={deployment.guard.photoUrl}
                  alt={deployment.guard.name}
                  className="h-14 w-14 rounded-full object-cover border-2 border-border"
                />
              ) : (
                <div className="h-14 w-14 rounded-full bg-primary/10 border-2 border-border flex items-center justify-center">
                  <span className="text-lg font-bold text-primary">
                    {deployment.guard.name.charAt(0)}
                  </span>
                </div>
              )}
              <div>
                <h3 className="font-bold">{deployment.guard.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {deployment.guard.parwestId} · {guardType}
                </p>
                {deployment.guard.phone ? (
                  <p className="text-sm text-muted-foreground">
                    {deployment.guard.phone}
                  </p>
                ) : null}
              </div>
              <div className="ml-auto text-right text-sm">
                <p className="text-xs text-muted-foreground">Deployed since</p>
                <p className="font-semibold">
                  {formatDate(deployment.deploymentDate)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  by {deployment.deployedByName || "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {step === "form" ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Current (read-only) */}
              <Card>
                <CardContent className="p-5">
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Current Deployment
                  </h2>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Client · Branch
                        </p>
                        <p className="font-medium">{deployment.client.name}</p>
                        {deployment.branch ? (
                          <p className="text-muted-foreground">
                            {deployment.branch.name}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Shift</p>
                        <p className="font-medium">{deployment.shiftType}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Designation
                        </p>
                        <p className="font-medium">
                          {deployment.designation || "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Regional Office
                        </p>
                        <p className="font-medium">
                          {deployment.regionalOffice.name}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Type · Nature
                      </p>
                      <p className="font-medium">
                        {deployment.deploymentType || "REGULAR"} ·{" "}
                        {deployment.deploymentNature || "PERMANENT"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* New (editable) */}
              <Card>
                <CardContent className="p-5">
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
                    <ArrowRight className="h-3.5 w-3.5 text-primary" />
                    New Deployment Details
                  </h2>
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="clientId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Client <span className="text-red-500">*</span>
                          </FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={isLocked}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select client..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {clients.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="branchId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Branch</FormLabel>
                          <Select
                            value={field.value ?? ""}
                            onValueChange={field.onChange}
                            disabled={!clientId || isLocked}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select branch..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {availableBranches.map((b) => (
                                <SelectItem key={b.id} value={b.id}>
                                  {b.city ? `${b.name} · ${b.city}` : b.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="regionalOfficeId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Regional Office{" "}
                            <span className="text-red-500">*</span>
                          </FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={isLocked}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select office..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {regionalOffices.map((o) => (
                                <SelectItem key={o.id} value={o.id}>
                                  {o.name} ({o.seriesCode})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Shift selector */}
                    <FormField
                      control={form.control}
                      name="shiftType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Shift</FormLabel>
                          <FormControl>
                            <div className="flex gap-2">
                              {(["DAY", "NIGHT"] as const).map((s) => (
                                <Button
                                  key={s}
                                  type="button"
                                  variant={
                                    field.value === s ? "default" : "outline"
                                  }
                                  className="flex-1"
                                  disabled={isLocked}
                                  onClick={() => field.onChange(s)}
                                >
                                  {s === "DAY" ? "☀ Day" : "🌙 Night"}
                                </Button>
                              ))}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {shiftType === "DAY" ? (
                      <div className="grid grid-cols-2 gap-2">
                        <FormField
                          control={form.control}
                          name="dayShiftStart"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Start</FormLabel>
                              <FormControl>
                                <Input
                                  type="time"
                                  {...field}
                                  disabled={isLocked}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="dayShiftEnd"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">End</FormLabel>
                              <FormControl>
                                <Input
                                  type="time"
                                  {...field}
                                  disabled={isLocked}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <FormField
                          control={form.control}
                          name="nightShiftStart"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Start</FormLabel>
                              <FormControl>
                                <Input
                                  type="time"
                                  {...field}
                                  disabled={isLocked}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="nightShiftEnd"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">End</FormLabel>
                              <FormControl>
                                <Input
                                  type="time"
                                  {...field}
                                  disabled={isLocked}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}

                    <FormField
                      control={form.control}
                      name="designation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Designation</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={isLocked}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {DESIGNATION_OPTIONS.map((d) => (
                                <SelectItem key={d} value={d}>
                                  {d}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="deploymentType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Deployment Type{" "}
                              <span className="text-xs text-muted-foreground font-normal">
                                (metadata only)
                              </span>
                            </FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                              disabled={isLocked}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="REGULAR">Regular</SelectItem>
                                <SelectItem value="OVERTIME">
                                  Overtime
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="deploymentNature"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nature</FormLabel>
                            {isExtraGuard ? (
                              <FormControl>
                                <Input
                                  value="Temporary"
                                  readOnly
                                  className="bg-muted text-muted-foreground cursor-not-allowed"
                                />
                              </FormControl>
                            ) : (
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                                disabled={isLocked}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="PERMANENT">
                                    Permanent
                                  </SelectItem>
                                  <SelectItem value="TEMPORARY">
                                    Temporary
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="isExtraGuard"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center gap-2 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={(v) => field.onChange(!!v)}
                              disabled={isLocked}
                            />
                          </FormControl>
                          <FormLabel className="!mt-0 cursor-pointer">
                            Extra Guard
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Change details */}
            <Card>
              <CardContent className="p-5 space-y-4">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Change Details
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="effectiveDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Effective Date{" "}
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            min={minDate}
                            max={todayStr}
                            disabled={isLocked}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          Current deployment ends on this date; new one starts
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="changeReason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Reason for Change{" "}
                        <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <RadioGroup
                          value={field.value ?? ""}
                          onValueChange={field.onChange}
                          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2"
                          disabled={isLocked}
                        >
                          {CHANGE_REASONS.map((r) => (
                            <label
                              key={r.id}
                              className={`flex items-start gap-2.5 rounded-md border p-3 cursor-pointer transition-colors ${
                                field.value === r.id
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:border-primary/40"
                              }`}
                            >
                              <RadioGroupItem
                                value={r.id}
                                className="mt-0.5"
                              />
                              <div>
                                <p className="text-sm font-medium">
                                  {r.label}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {r.desc}
                                </p>
                              </div>
                            </label>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={3}
                          placeholder="Additional context for this change..."
                          {...field}
                          disabled={isLocked}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-3 pt-2 border-t border-border">
                  <PermissionGate
                    module="GUARDS"
                    action="CREATE"
                    mode="disable"
                  >
                    <Button
                      type="button"
                      disabled={
                        isLocked ||
                        !changeReason ||
                        !values.effectiveDate ||
                        changes.length === 0
                      }
                      onClick={() => setStep("confirm")}
                    >
                      Review Changes
                    </Button>
                  </PermissionGate>
                  <Button asChild variant="ghost">
                    <Link href={`/deployments/${deployment.id}`}>Cancel</Link>
                  </Button>
                </div>

                {changes.length === 0 && changeReason ? (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> No changes detected —
                    modify at least one field above.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </>
        ) : (
          /* Confirmation */
          <Card>
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-3 pb-4 border-b border-border">
                <CheckCircle2 className="h-6 w-6 text-primary" />
                <div>
                  <h2 className="text-base font-semibold">
                    Confirm Deployment Change
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Review changes before applying
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                  Changes ({changes.length})
                </h3>
                <div className="space-y-2">
                  {changes.map((c) => (
                    <div
                      key={c.field}
                      className="flex items-center gap-3 text-sm bg-muted rounded-md px-4 py-2.5"
                    >
                      <span className="font-medium w-32 shrink-0">
                        {c.field}
                      </span>
                      <span className="text-muted-foreground line-through">
                        {c.from}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="font-semibold text-primary">{c.to}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm bg-muted rounded-md p-4">
                <div>
                  <p className="text-xs text-muted-foreground">Effective Date</p>
                  <p className="font-semibold flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    {formatDate(values.effectiveDate)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Reason</p>
                  <p className="font-semibold">
                    {CHANGE_REASONS.find((r) => r.id === changeReason)?.label}
                  </p>
                </div>
              </div>

              <Alert>
                <AlertTitle>What will happen</AlertTitle>
                <AlertDescription>
                  Current deployment ends on {formatDate(values.effectiveDate)}.
                  A new deployment starts on the same date with the updated
                  details. Attendance auto-generation continues under the new
                  deployment.
                </AlertDescription>
              </Alert>

              <div className="flex gap-3">
                <PermissionGate
                  module="GUARDS"
                  action="UPDATE"
                  mode="disable"
                >
                  <Button
                    type="submit"
                    disabled={submitting || isLocked}
                    className="inline-flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    {submitting ? "Applying..." : "Save Changes"}
                  </Button>
                </PermissionGate>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep("form")}
                >
                  Go Back
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </form>
    </Form>
  )
}
