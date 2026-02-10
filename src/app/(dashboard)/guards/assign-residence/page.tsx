import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import AssignResidenceForm from "./form"

export default async function AssignResidencePage() {
    const session = await auth()
    if (!session) redirect("/login")

    return <AssignResidenceForm />
}
