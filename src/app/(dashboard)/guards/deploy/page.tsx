import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { hasAction } from "@/lib/api/permissions"
import DeployGuardForm from "./form"
import { deriveManagerScope } from "@/lib/access/scope"

export default async function DeployGuardPage() {
    const session = await auth()

    if (!session) {
        redirect("/login")
    }

    // Deploying a guard creates a deployment. Gate on GUARDS:CREATE.
    if (!hasAction(session, "GUARDS", "CREATE")) {
        redirect("/guards")
    }

    const scope = deriveManagerScope(session)
    const lockedRegionalOfficeId =
        scope && scope.regionalOfficeIds.length === 1 ? scope.regionalOfficeIds[0] : null

    return (
        <DeployGuardForm
            lockedRegionId={scope?.regionId ?? null}
            lockedRegionalOfficeId={lockedRegionalOfficeId}
        />
    )
}
