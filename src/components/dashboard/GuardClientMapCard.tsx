import { mockDeploymentsList } from "@/lib/mockData"

export default function GuardClientMapCard() {
  const points = mockDeploymentsList.slice(0, 14).map((item, idx) => ({
    id: item.id,
    x: 10 + ((idx * 17) % 78),
    y: 12 + ((idx * 11) % 70),
    type: idx % 3 === 0 ? "client" : "guard",
  }))

  return (
    <section className="ui-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text)]">Guard & Client Map</h3>
        <p className="text-xs text-[var(--text-muted)]">Mock plotted locations</p>
      </div>
      <div className="relative overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[radial-gradient(circle_at_20%_10%,#dbe9ff_0,#f7faff_45%,#eef4ff_100%)] h-72">
        <div className="absolute inset-0 opacity-40 bg-[linear-gradient(0deg,transparent_24%,#cfdcf5_25%,transparent_26%,transparent_74%,#cfdcf5_75%,transparent_76%),linear-gradient(90deg,transparent_24%,#cfdcf5_25%,transparent_26%,transparent_74%,#cfdcf5_75%,transparent_76%)] bg-[size:40px_40px]" />
        {points.map((point) => (
          <span
            key={point.id}
            className={`absolute h-3 w-3 rounded-full ${point.type === "client" ? "bg-emerald-500" : "bg-[var(--brand)]"} shadow`}
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
          />
        ))}
      </div>
      <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[var(--brand)]" /> Guards</span>
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Clients</span>
      </div>
    </section>
  )
}
