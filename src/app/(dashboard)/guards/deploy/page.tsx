import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { hasAction } from "@/lib/api/permissions"
import DeployGuardForm from "./form"

export default async function DeployGuardPage() {
    const session = await auth()

    if (!session) {
        redirect("/login")
    }

    // Deploying a guard creates a deployment. Gate on GUARDS:CREATE.
    if (!hasAction(session, "GUARDS", "CREATE")) {
        redirect("/guards")
    }

    return <DeployGuardForm />
}
