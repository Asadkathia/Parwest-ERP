"use client"

/**
 * Phase 4A — Deployment End (Revoke) form, reskinned with shadcn primitives.
 *
 * Behavior is unchanged: posts to `/api/deployments/[id]/end`. Validation
 * mirrors the legacy form via `makeDeploymentEndSchema`:
 *   - deployments.requireEndDate
 *   - deployments.disallowEndDateBeforeDeploymentDate
 *   - deployments.disallowFutureEndDate
 *
 * The destructive submit is wrapped in a shadcn AlertDialog confirmation.
 */

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import {
  AlertTriangle,
  ShieldOff,
  MapPin,
  Clock,
  Calendar,
  User,
  Building2,
} from "lucide-react"

import {
  makeDeploymentEndSchema,
  REVOKE_REASON_CODES,
  type DeploymentEndForm,
} from "@/lib/schemas/deployment-end"

import { Alert, AlertDescription, AlertTitle } from "@/components/shadcn/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/shadcn/alert-dialog"
import { Button } from "@/components/shadcn/button"
import { Card, CardContent } from "@/components/shadcn/card"
import { Input } from "@/components/shadcn/input"
import { Textarea } from "@/components/shadcn/textarea"
import { Badge } from "@/components/shadcn/badge"
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

type Deployment = {
  id: string
  status: string
  shiftType: string
  designation: string | null
  deploymentDate: Date
  endDate: Date | null
  deploymentType: string | null
  deploymentNature: string | null
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
  client: { id: string; name: string }
  branch: { id: string; name: string; city: string | null } | null
  regionalOffice: { id: string; name: string }
}

type Props = { deployment: Deployment }

const REVOKE_REASONS: Array<{
  id: (typeof REVOKE_REASON_CODES)[number]
  label: string
  desc: string
}> = [
  { id: "CLIENT_REQUEST", label: "Client Request", desc: "Client requested removal of this guard" },
  { id: "GUARD_REQUEST", label: "Guard Request", desc: "Guard voluntarily requested transfer/exit" },
  { id: "TRANSFER", label: "Transfer", desc: "Guard transferred to another deployment" },
  { id: "CONTRACT_END", label: "Contract Ended", desc: "Deployment contract period completed" },
  { id: "MISCONDUCT", label: "Misconduct", desc: "Guard removed due to disciplinary action" },
  { id: "ABSENT_WITHOUT_LEAVE", label: "Absent Without Leave (AWOL)", desc: "Guard abandoned post without authorization" },
  { id: "MEDICAL", label: "Medical Grounds", desc: "Guard unable to continue due to health" },
  { id: "TERMINATED", label: "Termination", desc: "Guard's employment terminated" },
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

function daysBetween(from: Date | string, to: Date | string) {
  const a = new Date(from)
  a.setHours(0, 0, 0, 0)
  const b = new Date(to)
  b.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000))
}

function ShiftInfo({ dep }: { dep: Deployment }) {
  const shift = dep.shiftType
  const start = shift === "DAY" ? dep.dayShiftStart : dep.nightShiftStart
  const end = shift === "DAY" ? dep.dayShiftEnd : dep.nightShiftEnd
  return (
    <Badge
      variant="outline"
      className={
        shift === "DAY"
          ? "bg-amber-50 text-amber-700 border-amber-200"
          : "bg-indigo-50 text-indigo-700 border-indigo-200"
      }
    >
      <Clock className="h-3 w-3 mr-1" />
      {shift === "DAY" ? "Day" : "Night"}
      {start && end ? ` · ${start} – ${end}` : ""}
    </Badge>
  )
}

export default function RevokeDeploymentForm({ deployment }: Props) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const todayStr = new Date().toISOString().split("T")[0]
  const minDate = new Date(deployment.deploymentDate)
    .toISOString()
    .split("T")[0]

  const schema = useMemo(
    () => makeDeploymentEndSchema(deployment.deploymentDate),
    [deployment.deploymentDate]
  )

  const form = useForm<DeploymentEndForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      endDate: todayStr,
      reasonCode: undefined as unknown as DeploymentEndForm["reasonCode"],
      notes: "",
    },
  })

  const values = form.watch()
  const duration = daysBetween(deployment.deploymentDate, values.endDate)
  const guardType = deployment.guard.isExService
    ? `Ex-Service (${deployment.guard.exServiceType || "Unknown"})`
    : "Civilian"
  const selectedReason = REVOKE_REASONS.find(
    (r) => r.id === values.reasonCode
  )

  // Open the AlertDialog only after RHF/Zod validation passes.
  const openConfirm = form.handleSubmit(() => {
    setConfirmOpen(true)
  })

  const handleConfirmedRevoke = async () => {
    // Defense-in-depth: re-validate before posting so the destructive request
    // can't fire with empty/undefined fields if the dialog is reached via an
    // unexpected path.
    const valid = await form.trigger()
    if (!valid) {
      setConfirmOpen(false)
      toast.error("Please complete the required fields.")
      return
    }
    const data = form.getValues()
    setSubmitting(true)
    try {
      const res = await fetch(`/api/deployments/${deployment.id}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endDate: data.endDate,
          reason: `[${data.reasonCode}] ${data.notes ?? ""}`.trim(),
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        const message =
          (payload as { message?: string })?.message ||
          "Failed to revoke deployment"
        toast.error(message)
        setConfirmOpen(false)
        return
      }
      toast.success("Deployment ended")
      router.push("/deployments")
      router.refresh()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to revoke deployment"
      )
      setConfirmOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={openConfirm} className="max-w-3xl mx-auto space-y-6" noValidate>
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
            <ShieldOff className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Revoke Deployment</h1>
            <p className="text-sm text-muted-foreground">
              Remove guard from deployment and stop attendance auto-generation
            </p>
          </div>
        </div>

        {/* Guard + Deployment Card */}
        <Card>
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              Current Deployment
            </h2>
            <div className="flex items-start gap-4">
              <div className="shrink-0">
                {deployment.guard.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={deployment.guard.photoUrl}
                    alt={deployment.guard.name}
                    className="h-16 w-16 rounded-full object-cover border-2 border-border"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-primary/10 border-2 border-border flex items-center justify-center">
                    <span className="text-xl font-bold text-primary">
                      {deployment.guard.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-lg font-bold">{deployment.guard.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {deployment.guard.parwestId} · {guardType}
                    </p>
                    {deployment.guard.phone ? (
                      <p className="text-sm text-muted-foreground">
                        {deployment.guard.phone}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1" />
                      ACTIVE
                    </Badge>
                    <ShiftInfo dep={deployment} />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Client</p>
                      <p className="font-medium">{deployment.client.name}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Branch</p>
                      <p className="font-medium">
                        {deployment.branch
                          ? `${deployment.branch.name}${
                              deployment.branch.city
                                ? `, ${deployment.branch.city}`
                                : ""
                            }`
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
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
                    <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Deployed On
                      </p>
                      <p className="font-medium">
                        {formatDate(deployment.deploymentDate)}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Nature</p>
                    <p className="font-medium">
                      {deployment.deploymentNature === "TEMPORARY"
                        ? "Temporary"
                        : "Permanent"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Deployed By</p>
                    <p className="font-medium">
                      {deployment.deployedByName || "—"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Warning */}
        <Alert className="border-amber-200 bg-amber-50 text-amber-800">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <AlertTitle>Revoking this deployment will:</AlertTitle>
          <AlertDescription>
            <ul className="space-y-0.5 list-disc list-inside text-amber-700">
              <li>
                Mark the deployment as <strong>INACTIVE</strong>
              </li>
              <li>
                Stop automatic daily attendance generation for this guard
              </li>
              <li>Free up the guard for a new deployment</li>
            </ul>
          </AlertDescription>
        </Alert>

        {/* Form */}
        <Card>
          <CardContent className="p-5 space-y-5">
            <FormField
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Revoke Date <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      min={minDate}
                      max={todayStr}
                      onKeyDown={(e) => e.preventDefault()}
                    />
                  </FormControl>
                  {field.value ? (
                    <p className="text-xs text-muted-foreground">
                      Deployment duration:{" "}
                      <strong>
                        {duration} day{duration !== 1 ? "s" : ""}
                      </strong>{" "}
                      ({formatDate(deployment.deploymentDate)} →{" "}
                      {formatDate(field.value)})
                    </p>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reasonCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Reason for Revocation{" "}
                    <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                    >
                      {REVOKE_REASONS.map((r) => (
                        <label
                          key={r.id}
                          className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors ${
                            field.value === r.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/40"
                          }`}
                        >
                          <RadioGroupItem value={r.id} className="mt-0.5" />
                          <div>
                            <p className="text-sm font-medium">{r.label}</p>
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
                  <FormLabel>Additional Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Any additional context or instructions..."
                      {...field}
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
                <Button type="submit" variant="destructive">
                  <ShieldOff className="h-4 w-4 mr-2" />
                  End Deployment
                </Button>
              </PermissionGate>

              <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>End deployment?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {deployment.guard.name} will be released from{" "}
                      {deployment.client.name}.
                    </AlertDialogDescription>
                  </AlertDialogHeader>

                  <div className="rounded-md bg-muted border border-border p-4 space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      <div>
                        <span className="text-muted-foreground">Guard</span>
                        <p className="font-semibold">
                          {deployment.guard.name} (
                          {deployment.guard.parwestId})
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Client</span>
                        <p className="font-semibold">
                          {deployment.client.name}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Revoke Date
                        </span>
                        <p className="font-semibold">
                          {formatDate(values.endDate)}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Reason</span>
                        <p className="font-semibold">
                          {selectedReason?.label ?? "—"}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Duration</span>
                        <p className="font-semibold">
                          {duration} day{duration !== 1 ? "s" : ""}
                        </p>
                      </div>
                      {values.notes ? (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Notes</span>
                          <p className="font-semibold">{values.notes}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={submitting}>
                      Keep open
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => {
                        e.preventDefault()
                        void handleConfirmedRevoke()
                      }}
                      disabled={submitting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {submitting ? "Revoking..." : "End Deployment"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Button asChild variant="ghost">
                <Link href={`/deployments/${deployment.id}`}>Cancel</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </Form>
  )
}
