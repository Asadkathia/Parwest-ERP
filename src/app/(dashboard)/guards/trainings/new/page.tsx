import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import NewTrainingForm from "./form"

export default async function AddNewTrainingPage() {
    const session = await auth()
    if (!session) redirect("/login")

    return <NewTrainingForm />
}
