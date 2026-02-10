import { auth, signOut } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/sidebar"

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
        <div className="min-h-screen bg-gray-50">
            <Sidebar />

            <div className="lg:pl-64">
                <nav className="bg-white border-b">
                    <div className="px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between h-16 items-center">
                            <div className="lg:hidden">
                                {/* Space for mobile menu button */}
                            </div>
                            <div className="flex-1" />
                            <div className="flex items-center gap-4">
                                <span className="text-sm text-gray-600">
                                    {session.user?.name} ({session.user?.role})
                                </span>
                                <form
                                    action={async () => {
                                        "use server"
                                        await signOut()
                                    }}
                                >
                                    <button
                                        type="submit"
                                        className="text-sm text-red-600 hover:text-red-700 font-medium"
                                    >
                                        Sign Out
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                </nav>
                <main className="p-8">{children}</main>
            </div>
        </div>
    )
}
