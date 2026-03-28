"use client"

import { useEffect } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

// Fix Leaflet's broken default icon URLs under webpack/Next.js
function fixLeafletIcons() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  })
}

// Custom coloured circle icons
function makeCircleIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.35)"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -8],
  })
}

const CLIENT_ICON = makeCircleIcon("#10b981")       // emerald
const OFFICE_ICON  = makeCircleIcon("#6366f1")      // indigo

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

// Auto-fit bounds when data is available
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) {
      map.setView(points[0], 10)
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 12 })
    }
  }, [map, points])
  return null
}

export default function LocationMap({
  clients,
  regionalOffices,
}: {
  clients: MapClient[]
  regionalOffices: MapOffice[]
}) {
  useEffect(() => { fixLeafletIcons() }, [])

  const clientPins = clients.filter((c) => c.latitude != null && c.longitude != null)
  const officePins = regionalOffices.filter((o) => o.latitude != null && o.longitude != null)

  // All coordinate points for bounds fitting; default center = Pakistan
  const allPoints: [number, number][] = [
    ...clientPins.map((c) => [c.latitude!, c.longitude!] as [number, number]),
    ...officePins.map((o) => [o.latitude!, o.longitude!] as [number, number]),
  ]
  const defaultCenter: [number, number] = [30.3753, 69.3451]
  const defaultZoom = 5

  return (
    <MapContainer
      center={defaultCenter}
      zoom={defaultZoom}
      style={{ height: "100%", width: "100%", borderRadius: "var(--radius-md)" }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {allPoints.length > 0 && <FitBounds points={allPoints} />}

      {clientPins.map((c) => (
        <Marker key={`client-${c.id}`} position={[c.latitude!, c.longitude!]} icon={CLIENT_ICON}>
          <Popup>
            <div className="text-sm">
              <p className="font-semibold">{c.name}</p>
              {c.city && <p className="text-gray-500 text-xs">{c.city}</p>}
              <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-xs bg-emerald-100 text-emerald-700">Client</span>
            </div>
          </Popup>
        </Marker>
      ))}

      {officePins.map((o) => (
        <Marker key={`office-${o.id}`} position={[o.latitude!, o.longitude!]} icon={OFFICE_ICON}>
          <Popup>
            <div className="text-sm">
              <p className="font-semibold">{o.name}</p>
              <p className="text-gray-500 text-xs">Code: {o.seriesCode}</p>
              {o.address && <p className="text-gray-500 text-xs">{o.address}</p>}
              <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-xs bg-indigo-100 text-indigo-700">Regional Office</span>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}