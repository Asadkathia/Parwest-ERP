import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import AssignResidenceForm from "./form"
import { deriveManagerScope } from "@/lib/access/scope"

export default async function AssignResidencePage() {
    const session = await auth()
    if (!session) redirect("/login")

    const scope = deriveManagerScope(session)
    return <AssignResidenceForm lockedRegionId={scope?.regionId ?? null} />
}
