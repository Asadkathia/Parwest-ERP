import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import BlacklistManager from "./manager"

export default async function BlacklistedGuardsPage() {
    const session = await auth()
    if (!session) redirect("/login")

    return <BlacklistManager />
}
