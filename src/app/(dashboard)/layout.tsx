import { auth, signOut } from "@/lib/auth"
import { redirect } from "next/navigation"
import AppShell from "@/components/ui/app-shell"
import ActionButton from "@/components/ui/action-button"

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await auth()

    if (!session) {
        redirect("/login")
    }

    return (
        <AppShell
            name={session.user?.name}
            role={session.user?.role}
            signOutSlot={
                <form
                    action={async () => {
                        "use server"
                        await signOut({ redirectTo: "/login" })
                    }}
                >
                    <ActionButton type="submit" variant="secondary">
                        Sign Out
                    </ActionButton>
                </form>
            }
        >
            {children}
        </AppShell>
    )
}