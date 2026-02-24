import { redirect } from "next/navigation"

export default function LegacyGuardStatusUpdateAliasPage() {
  redirect("/guards/search")
}
