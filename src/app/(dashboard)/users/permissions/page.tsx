import { redirect } from "next/navigation"

export default function UserPermissionsPage() {
  redirect("/users/roles?tab=overrides")
}
