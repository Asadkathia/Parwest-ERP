import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import DeployGuardForm from "./form"

export default async function DeployGuardPage() {
    const session = await auth()

    if (!session) {
        redirect("/login")
    }

    return <DeployGuardForm />
}
