import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import InactiveGuardsManager from "./manager"

export default async function InactiveGuardsPage() {
    const session = await auth()
    if (!session) redirect("/login")

    return <InactiveGuardsManager />
}
