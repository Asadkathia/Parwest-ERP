"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Lock,
  RefreshCw,
  Send,
  Tag,
  Ticket as TicketIcon,
  User,
} from "lucide-react"
import { toast } from "sonner"

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
import { Badge } from "@/components/shadcn/badge"
import { Button } from "@/components/shadcn/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shadcn/card"
import { Checkbox } from "@/components/shadcn/checkbox"
import { Label } from "@/components/shadcn/label"
import { PermissionGate } from "@/components/shadcn/permission-gate"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select"
import { Textarea } from "@/components/shadcn/textarea"

type Lookup = { id: string; name: string; color?: string | null }
type UserRef = { id: string; name: string }
type TicketData = {
  id: string
  ticketNumber?: number | null
  subject: string
  description?: string | null
  sender?: UserRef | null
  assignedTo?: UserRef | null
  category?: Lookup | null
  priority?: Lookup | null
  status?: Lookup | null
  createdAt: string
  updatedAt: string
}
type Comment = {
  id: string
  message: string
  isInternal: boolean
  createdAt: string
  user: UserRef
}

const UNASSIGNED = "__UNASSIGNED__"
const NONE = "__NONE__"

function statusVariant(name: string): "default" | "secondary" | "destructive" | "outline" {
  const n = name.toLowerCase()
  if (n.includes("close") || n.includes("resolv")) return "secondary"
  if (n.includes("progress")) return "default"
  if (n.includes("reject") || n.includes("cancel")) return "destructive"
  return "outline"
}

function priorityVariant(name: string): "default" | "secondary" | "destructive" | "outline" {
  const n = name.toLowerCase()
  if (n.includes("critical") || n.includes("urgent") || n.includes("high")) return "destructive"
  if (n.includes("medium") || n.includes("normal")) return "default"
  if (n.includes("low")) return "secondary"
  return "outline"
}

function isTerminalStatus(name: string): boolean {
  const n = name.toLowerCase()
  return n.includes("close") || n.includes("resolv")
}

function StatusIcon({ name }: { name: string }) {
  const n = name.toLowerCase()
  if (n.includes("close") || n.includes("resolv")) return <CheckCircle2 className="me-1 h-3 w-3" />
  if (n.includes("progress")) return <Clock className="me-1 h-3 w-3" />
  return <AlertCircle className="me-1 h-3 w-3" />
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
      {initials}
    </span>
  )
}

export default function TicketDetail({
  paramsPromise,
  canUpdate = true,
}: {
  paramsPromise: Promise<{ id: string }>
  canUpdate?: boolean
}) {
  const { id } = use(paramsPromise)
  const router = useRouter()

  const [ticket, setTicket] = useState<TicketData | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [categories, setCategories] = useState<Lookup[]>([])
  const [priorities, setPriorities] = useState<Lookup[]>([])
  const [statuses, setStatuses] = useState<Lookup[]>([])
  const [users, setUsers] = useState<UserRef[]>([])

  const [loading, setLoading] = useState(true)

  // Reply form
  const [message, setMessage] = useState("")
  const [isInternal, setIsInternal] = useState(false)
  const [posting, setPosting] = useState(false)

  // Field updating
  const [updating, setUpdating] = useState(false)

  // Destructive status-change confirm
  const [pendingStatus, setPendingStatus] = useState<Lookup | null>(null)

  const loadTicket = async () => {
    try {
      const [t, c] = await Promise.all([
        fetch(`/api/tickets/${id}`).then((r) => r.json()),
        fetch(`/api/tickets/${id}/comments`).then((r) => r.json()).catch(() => []),
      ])
      setTicket(t)
      setComments(Array.isArray(c) ? c : [])
    } catch {
      toast.error("Failed to load ticket.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTicket()
    Promise.all([
      fetch("/api/tickets/categories").then((r) => r.json()).catch(() => []),
      fetch("/api/tickets/priorities").then((r) => r.json()).catch(() => []),
      fetch("/api/tickets/statuses").then((r) => r.json()).catch(() => []),
      fetch("/api/users").then((r) => r.json()).catch(() => []),
    ]).then(([c, p, s, u]) => {
      setCategories(Array.isArray(c) ? c : [])
      setPriorities(Array.isArray(p) ? p : [])
      setStatuses(Array.isArray(s) ? s : [])
      setUsers(Array.isArray(u) ? u : [])
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const patch = async (field: Record<string, string | null>) => {
    setUpdating(true)
    try {
      const res = await fetch(`/api/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(field),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg =
          (data && typeof data.message === "string" && data.message) ||
          "Failed to update."
        throw new Error(msg)
      }
      setTicket(data)
      toast.success("Ticket updated.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update.")
    } finally {
      setUpdating(false)
    }
  }

  const handleStatusChange = (statusId: string) => {
    const next = statuses.find((s) => s.id === statusId)
    if (!next) return
    if (isTerminalStatus(next.name) && next.id !== ticket?.status?.id) {
      setPendingStatus(next)
      return
    }
    void patch({ statusId })
  }

  const confirmTerminalStatus = async () => {
    if (!pendingStatus) return
    await patch({ statusId: pendingStatus.id })
    setPendingStatus(null)
  }

  const handleReply = async () => {
    if (!message.trim()) return
    setPosting(true)
    try {
      const res = await fetch(`/api/tickets/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim(), isInternal }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg =
          (data && typeof data.message === "string" && data.message) ||
          "Failed to post comment."
        throw new Error(msg)
      }
      setComments((prev) => [...prev, data])
      setMessage("")
      setIsInternal(false)
      toast.success("Comment posted.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to post comment.")
    } finally {
      setPosting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="py-24 text-center">
        <p className="text-muted-foreground">Ticket not found.</p>
        <Button variant="link" onClick={() => router.back()} className="mt-4">
          Go back
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="mt-1 shrink-0"
        >
          <ArrowLeft className="me-1.5 h-4 w-4" /> Back
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <TicketIcon className="h-5 w-5 text-primary shrink-0" />
            {ticket.ticketNumber && (
              <Badge variant="outline" className="font-mono">
                #{ticket.ticketNumber}
              </Badge>
            )}
            {ticket.status && (
              <Badge variant={statusVariant(ticket.status.name)}>
                <StatusIcon name={ticket.status.name} />
                {ticket.status.name}
              </Badge>
            )}
            {ticket.priority && (
              <Badge variant={priorityVariant(ticket.priority.name)}>
                {ticket.priority.name}
              </Badge>
            )}
          </div>
          <h1 className="text-xl font-bold mt-2 leading-snug">{ticket.subject}</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Submitted by{" "}
            <span className="font-medium text-foreground">
              {ticket.sender?.name ?? "Unknown"}
            </span>
            {" · "}
            {new Date(ticket.createdAt).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}{" "}
            {new Date(ticket.createdAt).toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">
        {/* Main — description + comments */}
        <div className="space-y-4">
          {/* Description */}
          {ticket.description && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Description
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {ticket.description}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Comment thread */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-muted/50 py-3">
              <CardTitle className="text-sm font-semibold">
                Comments{" "}
                <span className="text-muted-foreground font-normal ml-1">
                  ({comments.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {comments.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  No comments yet. Be the first to reply.
                </div>
              ) : (
                <div className="divide-y">
                  {comments.map((c) => (
                    <div
                      key={c.id}
                      className={`px-5 py-4 ${
                        c.isInternal ? "bg-amber-50 dark:bg-amber-950/20" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar name={c.user.name} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-sm font-semibold">
                              {c.user.name}
                            </span>
                            {c.isInternal && (
                              <Badge
                                variant="outline"
                                className="text-amber-700 border-amber-300 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400"
                              >
                                <Lock className="me-1 h-2.5 w-2.5" />
                                Internal Note
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground ml-auto">
                              {new Date(c.createdAt).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}{" "}
                              {new Date(c.createdAt).toLocaleTimeString("en-GB", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">
                            {c.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Reply form */}
              {canUpdate ? (
                <div className="px-5 py-4 border-t bg-muted/30 space-y-3">
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="min-h-[100px]"
                    placeholder="Write a reply..."
                  />
                  <div className="flex items-center justify-between gap-3">
                    <Label className="flex items-center gap-2 cursor-pointer select-none">
                      <Checkbox
                        checked={isInternal}
                        onCheckedChange={(v) => setIsInternal(Boolean(v))}
                      />
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Lock className="h-3.5 w-3.5" /> Internal note (admin only)
                      </span>
                    </Label>
                    <Button
                      onClick={handleReply}
                      disabled={posting || !message.trim()}
                    >
                      <Send className="me-2 h-4 w-4" />
                      {posting ? "Sending..." : "Send Reply"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar — ticket controls */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Ticket Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status */}
              <div>
                <Label className="mb-1.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <AlertCircle className="h-3 w-3" /> Status
                </Label>
                <PermissionGate module="TICKETING" action="UPDATE" mode="disable">
                  <Select
                    value={ticket.status?.id ?? ""}
                    onValueChange={handleStatusChange}
                    disabled={updating || !canUpdate}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </PermissionGate>
              </div>

              {/* Priority */}
              <div>
                <Label className="mb-1.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <Tag className="h-3 w-3" /> Priority
                </Label>
                <Select
                  value={ticket.priority?.id ?? ""}
                  onValueChange={(v) => void patch({ priorityId: v })}
                  disabled={updating || !canUpdate}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {priorities.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Category */}
              <div>
                <Label className="mb-1.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <Tag className="h-3 w-3" /> Category
                </Label>
                <Select
                  value={ticket.category?.id ?? NONE}
                  onValueChange={(v) =>
                    void patch({ categoryId: v === NONE ? null : v })
                  }
                  disabled={updating || !canUpdate}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>— None —</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Assigned To */}
              <div>
                <Label className="mb-1.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <User className="h-3 w-3" /> Assigned To
                </Label>
                <Select
                  value={ticket.assignedTo?.id ?? UNASSIGNED}
                  onValueChange={(v) =>
                    void patch({ assignedToId: v === UNASSIGNED ? null : v })
                  }
                  disabled={updating || !canUpdate}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED}>— Unassigned —</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!ticket.assignedTo && (
                  <p className="text-xs text-destructive mt-1 font-medium">
                    Not assigned
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Meta info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Ticket #</span>
                <span className="font-mono font-semibold">
                  {ticket.ticketNumber ?? "—"}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Sender</span>
                <span className="font-medium text-right">
                  {ticket.sender?.name ?? "—"}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Created</span>
                <span className="text-right">
                  {new Date(ticket.createdAt).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Updated</span>
                <span className="text-right">
                  {new Date(ticket.updatedAt).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Destructive status-change confirm */}
      <AlertDialog
        open={pendingStatus !== null}
        onOpenChange={(open) => {
          if (!open) setPendingStatus(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Set status to {pendingStatus?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This is a terminal status. The ticket may not be reopened from the
              UI once {pendingStatus?.name.toLowerCase()}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void confirmTerminalStatus()
              }}
              disabled={updating}
            >
              {updating ? "Updating..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
