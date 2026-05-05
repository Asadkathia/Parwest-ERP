import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { ok, unauthorized } from "@/lib/api/response"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return unauthorized()
  const url = new URL(req.url)
  const onlyUnread = url.searchParams.get("unread") === "true"
  const limit = Math.min(Number(url.searchParams.get("limit") || 25), 100)

  const where = {
    userId: session.user.id,
    ...(onlyUnread ? { readAt: null } : {}),
  }
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        link: true,
        payload: true,
        readAt: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({
      where: { userId: session.user.id, readAt: null },
    }),
  ])

  return ok({ items, unreadCount })
}
