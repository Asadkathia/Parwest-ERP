import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import DeploymentRatesForm from "./form"

export default async function DeploymentsRatePage() {
    const session = await auth()
    if (!session) redirect("/login")

    return <DeploymentRatesForm />
}
