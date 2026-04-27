import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import NewTrainingForm from "./form"
import { deriveManagerScope } from "@/lib/access/scope"

export default async function AddNewTrainingPage() {
    const session = await auth()
    if (!session) redirect("/login")

    const scope = deriveManagerScope(session)
    const lockedRegionalOfficeId =
        scope && scope.regionalOfficeIds.length === 1 ? scope.regionalOfficeIds[0] : null

    return (
        <NewTrainingForm
            lockedRegionId={scope?.regionId ?? null}
            lockedRegionalOfficeId={lockedRegionalOfficeId}
        />
    )
}
