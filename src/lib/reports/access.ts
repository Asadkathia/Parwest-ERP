import type { Session } from "next-auth"
import { auth } from "@/lib/auth"
import { hasModuleAccess } from "@/lib/api/permissions"
import { forbidden, unauthorized } from "@/lib/api/response"

export type AccessResult =
  | { error: null; session: Session }
  | { error: ReturnType<typeof unauthorized>; session: null }

export async function requireReportsAccess(): Promise<AccessResult> {
  const session = await auth()
  if (!session?.user) {
    return { error: unauthorized("Sign-in required"), session: null }
  }
  if (!hasModuleAccess(session as never, "REPORTS")) {
    return { error: forbidden("REPORTS access required"), session: null }
  }
  return { error: null, session }
}
