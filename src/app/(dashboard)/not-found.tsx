import * as React from "react"

import { NotFoundPage } from "@/components/shadcn/error-states"

/**
 * Dashboard-group 404. Triggered by `notFound()` calls inside any nested
 * route, or when Next.js can't match a URL within the (dashboard) group.
 */
export default function DashboardNotFound(): React.ReactElement {
  return <NotFoundPage />
}
