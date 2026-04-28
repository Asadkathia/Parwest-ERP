import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { isSuperAdmin } from "@/lib/api/permissions"
import PreviewClient from "./PreviewClient"

/**
 * Phase 0b: shadcn/ui primitives smoke-test harness.
 *
 * Renders one of every primitive added in Phase 0b, gated to SuperAdmin.
 * Used as visual QA for design-token wiring and Tailwind v4 @theme bridge.
 *
 * Route: /_dev/components-preview
 */
export default async function ComponentsPreviewPage() {
  const session = await auth()
  if (!isSuperAdmin(session)) notFound()

  return <PreviewClient />
}
