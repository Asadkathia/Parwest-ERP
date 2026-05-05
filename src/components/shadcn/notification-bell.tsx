"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Bell } from "lucide-react"

import { Button } from "@/components/shadcn/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/shadcn/popover"
import { Card, CardContent } from "@/components/shadcn/card"
import { cn } from "@/lib/utils"

type NotificationItem = {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  payload: unknown
  readAt: string | null
  createdAt: string
}

type ApiOk<T> = { success: true; data: T } | { success: false; message: string }

const POLL_MS = 60_000

function timeAgo(iso: string) {
  const d = new Date(iso)
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function NotificationBell() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [items, setItems] = React.useState<NotificationItem[]>([])
  const [unread, setUnread] = React.useState(0)

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=20", { cache: "no-store" })
      const json = (await res.json()) as ApiOk<{
        items: NotificationItem[]
        unreadCount: number
      }>
      if (!res.ok || !json.success) return
      setItems(json.data.items)
      setUnread(json.data.unreadCount)
    } catch {
      /* ignore */
    }
  }, [])

  React.useEffect(() => {
    void load()
    const t = setInterval(load, POLL_MS)
    return () => clearInterval(t)
  }, [load])

  const markRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "POST" })
    } catch {
      /* ignore */
    }
  }

  const onClick = async (n: NotificationItem) => {
    setOpen(false)
    if (!n.readAt) {
      setItems((prev) => prev.map((p) => (p.id === n.id ? { ...p, readAt: new Date().toISOString() } : p)))
      setUnread((u) => Math.max(0, u - 1))
      void markRead(n.id)
    }
    if (n.link) router.push(n.link)
  }

  const onMarkAll = async () => {
    try {
      await fetch("/api/notifications/read-all", { method: "POST" })
      setItems((prev) => prev.map((p) => ({ ...p, readAt: p.readAt ?? new Date().toISOString() })))
      setUnread(0)
    } catch {
      /* ignore */
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 ? (
            <span
              className={cn(
                "absolute -right-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-destructive-foreground"
              )}
            >
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          {unread > 0 ? (
            <Button variant="ghost" size="sm" onClick={onMarkAll}>
              Mark all read
            </Button>
          ) : null}
        </div>
        {items.length === 0 ? (
          <Card className="border-0 shadow-none">
            <CardContent className="flex flex-col items-center justify-center gap-1 p-6 text-center">
              <Bell className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium">No notifications</p>
              <p className="text-xs text-muted-foreground">You&apos;re all caught up.</p>
            </CardContent>
          </Card>
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => void onClick(n)}
                  className={cn(
                    "flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-muted/50",
                    !n.readAt && "bg-primary/5"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={cn("text-sm", !n.readAt ? "font-semibold" : "font-medium")}>
                      {n.title}
                    </span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>
                  {n.body ? (
                    <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
