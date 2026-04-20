"use client"

import { useEffect, useState } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

function fixLeafletIcons() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  })
}

const PICK_ICON = L.divIcon({
  className: "",
  html: `<span style="display:inline-block;width:18px;height:18px;border-radius:50%;background:#6366f1;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></span>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -12],
})

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

export default function CoordPickerMap({
  lat,
  lng,
  onSelect,
}: {
  lat: number | null
  lng: number | null
  onSelect: (lat: number, lng: number) => void
}) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    fixLeafletIcons()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- defer client-only leaflet init until after hydration
    setReady(true)
  }, [])

  if (!ready) return null

  const defaultCenter: [number, number] = lat != null && lng != null ? [lat, lng] : [30.3753, 69.3451]
  const defaultZoom = lat != null ? 12 : 5

  return (
    <MapContainer
      key={`${lat}-${lng}`}
      center={defaultCenter}
      zoom={defaultZoom}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onPick={onSelect} />
      {lat != null && lng != null && (
        <Marker position={[lat, lng]} icon={PICK_ICON}>
          <Popup>
            <p className="text-xs font-medium">Selected location</p>
            <p className="text-xs text-gray-500">{lat.toFixed(6)}, {lng.toFixed(6)}</p>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  )
}