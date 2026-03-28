"use client"

import dynamic from "next/dynamic"
import { MapPin } from "lucide-react"

type MapClient = {
  id: string
  name: string
  city: string | null
  latitude: number | null
  longitude: number | null
}
type MapOffice = {
  id: string
  name: string
  seriesCode: string
  address: string | null
  latitude: number | null
  longitude: number | null
}

// Dynamic import to prevent SSR — Leaflet requires window
const LocationMap = dynamic(() => import("./LocationMap"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-72 bg-[var(--surface-muted)] rounded-[var(--radius-md)] border border-[var(--border)]">
      <p className="text-sm text-[var(--text-muted)]">Loading map…</p>
    </div>
  ),
})

export default function GuardClientMapCard({
  clients = [],
  regionalOffices = [],
}: {
  clients?: MapClient[]
  regionalOffices?: MapOffice[]
}) {
  const clientPins  = clients.filter((c) => c.latitude != null && c.longitude != null)
  const officePins  = regionalOffices.filter((o) => o.latitude != null && o.longitude != null)
  const hasNoCoords = clientPins.length === 0 && officePins.length === 0

  return (
    <section className="ui-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text)] flex items-center gap-1.5">
          <MapPin className="h-4 w-4 text-[var(--brand)]" />
          Deployment Coverage Map
        </h3>
        <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Clients ({clientPins.length})
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
            Regional Offices ({officePins.length})
          </span>
        </div>
      </div>

      <div className="relative h-80 rounded-[var(--radius-md)] overflow-hidden border border-[var(--border)]">
        <LocationMap clients={clients} regionalOffices={regionalOffices} />
      </div>

      {hasNoCoords && (
        <p className="text-xs text-[var(--text-muted)] text-center">
          No coordinates configured yet. Add latitude/longitude to clients or regional offices to see pins.
        </p>
      )}
    </section>
  )
}