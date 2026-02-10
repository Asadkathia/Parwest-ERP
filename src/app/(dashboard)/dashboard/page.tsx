import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"

export default async function DashboardPage() {
    const session = await auth()

    if (!session) {
        redirect("/login")
    }

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold">Dashboard</h1>
                <p className="text-muted-foreground mt-2">
                    Welcome back, {session.user?.name}!
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border bg-card p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Total Guards</p>
                            <h3 className="text-2xl font-bold mt-2">0</h3>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <svg className="h-6 w-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                        </div>
                    </div>
                </div>

                <div className="rounded-lg border bg-card p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Active Deployments</p>
                            <h3 className="text-2xl font-bold mt-2">0</h3>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                            <svg className="h-6 w-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>
                </div>

                <div className="rounded-lg border bg-card p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Total Clients</p>
                            <h3 className="text-2xl font-bold mt-2">0</h3>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                            <svg className="h-6 w-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                        </div>
                    </div>
                </div>

                <div className="rounded-lg border bg-card p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Pending Tickets</p>
                            <h3 className="text-2xl font-bold mt-2">0</h3>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                            <svg className="h-6 w-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-8 rounded-lg border bg-card p-6 shadow-sm">
                <h2 className="text-xl font-semibold mb-4">User Information</h2>
                <div className="space-y-2">
                    <p><span className="font-medium">Name:</span> {session.user?.name}</p>
                    <p><span className="font-medium">Email:</span> {session.user?.email}</p>
                    <p><span className="font-medium">Role:</span> {session.user?.role}</p>
                </div>
            </div>

            <div className="mt-8 rounded-lg border bg-card p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-4">
                    <h2 className="text-xl font-semibold">Home (Map View)</h2>
                    <div className="flex items-center gap-2">
                        <select className="border rounded-md px-3 py-2 text-sm">
                            <option>All Clients</option>
                        </select>
                        <button className="bg-blue-600 text-white rounded-md px-4 py-2 text-sm hover:bg-blue-700">GO</button>
                    </div>
                </div>
                <div className="h-72 rounded-lg border bg-gradient-to-br from-blue-50 to-gray-100 flex items-center justify-center text-sm text-gray-600">
                    Map placeholder for deployment/client markers
                </div>
                <div className="flex items-center justify-between">
                    <span className="inline-flex items-center rounded-full bg-green-100 text-green-800 px-3 py-1 text-sm font-medium">
                        Online Users : 53
                    </span>
                    <Link href="/dashboard/online-users" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                        Open Online Users →
                    </Link>
                </div>
            </div>
        </div>
    )
}
