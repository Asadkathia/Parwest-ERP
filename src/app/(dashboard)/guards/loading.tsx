export default function GuardsLoading() {
    return (
        <div className="space-y-6 animate-pulse">
            {/* Title bar */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="h-7 w-32 bg-muted rounded" />
                    <div className="h-4 w-64 bg-muted rounded mt-2" />
                </div>
                <div className="h-9 w-28 bg-muted rounded-md" />
            </div>

            {/* Stat cards */}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-card rounded-xl border p-5 flex items-center gap-4">
                        <div className="h-10 w-10 bg-muted rounded-full" />
                        <div className="space-y-2">
                            <div className="h-3 w-16 bg-muted rounded" />
                            <div className="h-6 w-10 bg-muted rounded" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Filter bar */}
            <div className="bg-card rounded-xl border p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="h-10 bg-muted rounded-md" />
                    <div className="h-10 bg-muted rounded-md" />
                    <div className="h-10 bg-muted rounded-md" />
                </div>
            </div>

            {/* Table */}
            <div className="bg-card rounded-xl border overflow-hidden">
                <div className="bg-muted border-b px-6 py-3 grid grid-cols-9 gap-4">
                    {[...Array(9)].map((_, i) => (
                        <div key={i} className="h-3 bg-muted-foreground/20 rounded" />
                    ))}
                </div>
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="px-6 py-4 border-b grid grid-cols-9 gap-4 items-center">
                        <div className="h-4 bg-muted rounded" />
                        <div className="h-9 w-9 bg-muted rounded-full" />
                        <div className="h-4 bg-muted rounded" />
                        <div className="h-4 bg-muted rounded" />
                        <div className="h-4 bg-muted rounded" />
                        <div className="h-4 bg-muted rounded" />
                        <div className="h-4 bg-muted rounded" />
                        <div className="h-6 w-16 bg-muted rounded-full" />
                        <div className="h-4 w-10 bg-muted rounded" />
                    </div>
                ))}
            </div>
        </div>
    )
}