export default function GuardsLoading() {
    return (
        <div className="space-y-6 animate-pulse">
            {/* Title bar */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="h-7 w-32 bg-gray-200 rounded" />
                    <div className="h-4 w-64 bg-gray-100 rounded mt-2" />
                </div>
                <div className="h-9 w-28 bg-gray-200 rounded-md" />
            </div>

            {/* Stat cards */}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-white rounded-xl border p-5 flex items-center gap-4">
                        <div className="h-10 w-10 bg-gray-100 rounded-full" />
                        <div className="space-y-2">
                            <div className="h-3 w-16 bg-gray-100 rounded" />
                            <div className="h-6 w-10 bg-gray-200 rounded" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Filter bar */}
            <div className="bg-white rounded-xl border p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="h-10 bg-gray-100 rounded-md" />
                    <div className="h-10 bg-gray-100 rounded-md" />
                    <div className="h-10 bg-gray-100 rounded-md" />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border overflow-hidden">
                <div className="bg-gray-50 border-b px-6 py-3 grid grid-cols-9 gap-4">
                    {[...Array(9)].map((_, i) => (
                        <div key={i} className="h-3 bg-gray-200 rounded" />
                    ))}
                </div>
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="px-6 py-4 border-b grid grid-cols-9 gap-4 items-center">
                        <div className="h-4 bg-gray-100 rounded" />
                        <div className="h-9 w-9 bg-gray-100 rounded-full" />
                        <div className="h-4 bg-gray-100 rounded" />
                        <div className="h-4 bg-gray-100 rounded" />
                        <div className="h-4 bg-gray-100 rounded" />
                        <div className="h-4 bg-gray-100 rounded" />
                        <div className="h-4 bg-gray-100 rounded" />
                        <div className="h-6 w-16 bg-gray-100 rounded-full" />
                        <div className="h-4 w-10 bg-gray-100 rounded" />
                    </div>
                ))}
            </div>
        </div>
    )
}