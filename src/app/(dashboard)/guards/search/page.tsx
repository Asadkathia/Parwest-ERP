import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import SearchGuardsManager from "./manager"

export default async function SearchGuardsPage() {
    const session = await auth()
    if (!session) redirect("/login")

    return <SearchGuardsManager />
}
