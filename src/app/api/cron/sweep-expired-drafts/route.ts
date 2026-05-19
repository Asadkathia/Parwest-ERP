import { NextRequest, NextResponse } from "next/server"
import { isAuthorizedCronRequest } from "@/lib/cron/auth"
import { sweepExpiredDrafts } from "@/lib/imports/drafts"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * GET /api/cron/sweep-expired-drafts
 *
 * Daily Vercel Cron entrypoint. Deletes BulkImportJob rows where
 * status=DRAFT and expiresAt < now(). Cascade removes child rows.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }
  const result = await sweepExpiredDrafts()
  return NextResponse.json({ success: true, data: result })
}
