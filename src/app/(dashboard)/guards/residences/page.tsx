import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import ResidencesManager from "./manager"

export default async function ResidencesPage() {
    const session = await auth()
    if (!session) redirect("/login")

    return <ResidencesManager />
}
