import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { ok, unauthorized } from "@/lib/api/response"

export const dynamic = "force-dynamic"

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return unauthorized()

  const result = await prisma.notification.updateMany({
    where: { userId: session.user.id, readAt: null },
    data: { readAt: new Date() },
  })
  return ok({ updated: result.count })
}
