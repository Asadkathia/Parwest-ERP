import { NextRequest } from "next/server"

/**
 * Validates a cron request. Accepts either:
 *   - `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sends this when CRON_SECRET is set)
 *   - `x-cron-secret: <CRON_SECRET>` (manual trigger / debugging)
 *
 * Returns true when authorized OR when CRON_SECRET is unset in non-production
 * (so local dev can hit cron routes without ceremony). In production with no
 * secret configured, requests are rejected.
 */
export function isAuthorizedCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return process.env.NODE_ENV !== "production"
  }
  const auth = req.headers.get("authorization") || ""
  if (auth === `Bearer ${secret}`) return true
  if (req.headers.get("x-cron-secret") === secret) return true
  return false
}
