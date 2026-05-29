import { redirect } from "next/navigation"

// Legacy alias. The /settings/system placeholder was removed (had no backing API).
// Redirect to the settings overview until a real "system" surface is built.
export default function LegacyUpdateLogosAliasPage() {
  redirect("/settings")
}
