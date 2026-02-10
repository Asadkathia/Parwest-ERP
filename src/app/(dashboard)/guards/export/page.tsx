import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import ExportGuardsManager from "./manager"

export default async function ExportGuardsPage() {
    const session = await auth()
    if (!session) redirect("/login")

    return <ExportGuardsManager />
}
