import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { ok, notFound, unauthorized } from "@/lib/api/response"

export const dynamic = "force-dynamic"

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return unauthorized()
  const { id } = await ctx.params

  const existing = await prisma.notification.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  })
  if (!existing) return notFound("Notification not found")

  await prisma.notification.update({
    where: { id: existing.id },
    data: { readAt: new Date() },
  })
  return ok({ id: existing.id, readAt: new Date().toISOString() })
}
