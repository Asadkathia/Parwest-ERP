import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import TrainingsManager from "./manager"

export default async function OnJobTrainingsPage() {
    const session = await auth()
    if (!session) redirect("/login")

    return <TrainingsManager />
}
