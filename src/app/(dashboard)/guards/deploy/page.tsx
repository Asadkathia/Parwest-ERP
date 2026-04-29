import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { hasAction } from "@/lib/api/permissions"
import DeployGuardForm from "./form"
import { deriveManagerScope } from "@/lib/access/scope"
import { isWorkflowRuleEnabled } from "@/lib/workflows/policy"

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

    // Resolve workflow rules server-side and pass to client form. The form
    // hides the EXTRA deployment type option when this rule is disabled.
    const allowExtraType = isWorkflowRuleEnabled("deployments.allowExtraType")

    return (
        <DeployGuardForm
            lockedRegionId={scope?.regionId ?? null}
            lockedRegionalOfficeId={lockedRegionalOfficeId}
            allowExtraType={allowExtraType}
        />
    )
}
