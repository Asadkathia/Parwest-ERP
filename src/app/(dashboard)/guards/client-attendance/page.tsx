import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import ClientAttendanceManager from "./manager"

export default async function ClientAttendancePage() {
    const session = await auth()
    if (!session) redirect("/login")

    return <ClientAttendanceManager />
}
