import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import GuardAttendanceManager from "./manager"

export default async function GuardAttendancePage() {
    const session = await auth()
    if (!session) redirect("/login")

    return <GuardAttendanceManager />
}
