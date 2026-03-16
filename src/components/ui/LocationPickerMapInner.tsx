"use client"

import { useEffect, useRef, useState } from "react"
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet"
import { MapPin, Loader2, X, Search } from "lucide-react"
import "leaflet/dist/leaflet.css"
import L from "leaflet"

// Fix Leaflet default marker icons broken by Next.js/webpack
const markerIcon = new L.Icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
})

// Pakistan center — zoom 6 shows all provinces + major city names clearly
const PAKISTAN_CENTER: [number, number] = [30.3753, 69.3451]
const DEFAULT_ZOOM = 6

type LatLng = { lat: number; lng: number }

type Props = {
    latName: string
    lngName: string
    defaultLat?: number
    defaultLng?: number
    label: string
    onLocationChange?: (lat: string, lng: string) => void
}

function ClickHandler({ onPick }: { onPick: (ll: LatLng) => void }) {
    useMapEvents({ click(e) { onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) } })
    return null
}

// Forces map to fly to a new position when flyTarget changes
function FlyTo({ position }: { position: LatLng | null }) {
    const map = useMap()
    useEffect(() => {
        if (position) map.flyTo([position.lat, position.lng], 14, { duration: 1.2 })
    }, [map, position])
    return null
}

// Forces initial view to Pakistan on mount (overrides any cached tile position)
function SetInitialView({ center, zoom }: { center: [number, number]; zoom: number }) {
    const map = useMap()
    useEffect(() => {
        map.setView(center, zoom)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    return null
}

type NominatimResult = {
    lat: string
    lon: string
    display_name: string
}

export default function LocationPickerMapInner({ latName, lngName, defaultLat, defaultLng, label, onLocationChange }: Props) {
    const initialPos: LatLng | null =
        defaultLat != null && defaultLng != null ? { lat: defaultLat, lng: defaultLng } : null

    const [marker, setMarker] = useState<LatLng | null>(initialPos)
    const [flyTarget, setFlyTarget] = useState<LatLng | null>(null)
    const [query, setQuery] = useState("")
    const [results, setResults] = useState<NominatimResult[]>([])
    const [searching, setSearching] = useState(false)
    const [showResults, setShowResults] = useState(false)
    const searchRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node))
                setShowResults(false)
        }
        document.addEventListener("mousedown", handler)
        return () => document.removeEventListener("mousedown", handler)
    }, [])

    const search = async () => {
        const q = query.trim()
        if (!q) return
        setSearching(true)
        setShowResults(false)
        try {
            // Bias results to Pakistan; fallback to worldwide if nothing found
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=pk&limit=6&accept-language=en`,
                { headers: { "Accept-Language": "en" } }
            )
            let data: NominatimResult[] = await res.json()
            // Fallback: if no PK results, search worldwide
            if (data.length === 0) {
                const res2 = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=6&accept-language=en`
                )
                data = await res2.json()
            }
            setResults(data)
            setShowResults(true)
        } catch {
            // silently fail
        } finally {
            setSearching(false)
        }
    }

    const applyMarker = (pos: LatLng) => {
        setMarker(pos)
        setFlyTarget(pos)
        onLocationChange?.(pos.lat.toFixed(7), pos.lng.toFixed(7))
    }

    const pickResult = (result: NominatimResult) => {
        const pos = { lat: parseFloat(result.lat), lng: parseFloat(result.lon) }
        applyMarker(pos)
        setQuery(result.display_name)
        setShowResults(false)
    }

    const clearMarker = () => {
        setMarker(null)
        setQuery("")
        setResults([])
        onLocationChange?.("", "")
    }

    const center: [number, number] = initialPos ? [initialPos.lat, initialPos.lng] : PAKISTAN_CENTER

    return (
        <div className="space-y-2">
            {/* Search bar — no icon inside input to avoid overlap */}
            <div ref={searchRef} className="relative">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && void search()}
                        className="ui-input flex-1"
                        placeholder={`Search ${label} — city, area or address in Pakistan…`}
                    />
                    {query && (
                        <button type="button" onClick={clearMarker}
                            className="flex-shrink-0 px-2 text-[var(--text-muted)] hover:text-red-500">
                            <X size={15} />
                        </button>
                    )}
                    <button type="button" onClick={() => void search()} disabled={searching}
                        className="ui-btn ui-btn-secondary px-3 flex items-center gap-1.5 text-sm flex-shrink-0">
                        {searching
                            ? <Loader2 size={14} className="animate-spin" />
                            : <Search size={14} />}
                        Search
                    </button>
                </div>

                {/* Search results — z-[2100] to always appear above Leaflet */}
                {showResults && results.length > 0 && (
                    <div className="absolute z-[2100] mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white shadow-lg max-h-52 overflow-y-auto">
                        {results.map((r, i) => (
                            <button key={i} type="button" onClick={() => pickResult(r)}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--surface-muted)] flex items-start gap-2">
                                <MapPin size={13} className="mt-0.5 flex-shrink-0 text-[var(--brand)]" />
                                <span className="line-clamp-2">{r.display_name}</span>
                            </button>
                        ))}
                    </div>
                )}
                {showResults && results.length === 0 && !searching && (
                    <div className="absolute z-[2100] mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white shadow px-3 py-2 text-sm text-[var(--text-muted)]">
                        No results found.
                    </div>
                )}
            </div>

            {/* Map — CartoDB Voyager tiles (free, no API key, clear colors) */}
            <div className="relative rounded-[var(--radius-md)] overflow-hidden border border-[var(--border)]">
                <MapContainer
                    key="location-picker"
                    center={center}
                    zoom={DEFAULT_ZOOM}
                    className="h-72 w-full"
                    scrollWheelZoom
                >
                    {/* OpenStreetMap Standard — shows city/town/street names at every zoom level */}
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        maxZoom={19}
                    />
                    <SetInitialView center={center} zoom={DEFAULT_ZOOM} />
                    <ClickHandler onPick={(ll) => applyMarker(ll)} />
                    <FlyTo position={flyTarget} />
                    {marker && <Marker position={[marker.lat, marker.lng]} icon={markerIcon} />}
                </MapContainer>
                <p className="absolute bottom-2 left-2 z-[999] rounded bg-black/60 px-2 py-0.5 text-[11px] text-white pointer-events-none">
                    Click anywhere to drop a marker
                </p>
            </div>

            {/* Coordinates display */}
            {marker ? (
                <div className="flex items-center gap-3 rounded-[var(--radius-md)] bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--text-muted)]">
                    <MapPin size={13} className="text-[var(--brand)]" />
                    <span>
                        Lat: <strong className="text-[var(--text)]">{marker.lat.toFixed(6)}</strong>
                        &nbsp;·&nbsp;
                        Lng: <strong className="text-[var(--text)]">{marker.lng.toFixed(6)}</strong>
                    </span>
                    <button type="button" onClick={clearMarker} className="ml-auto text-red-500 hover:underline text-xs">
                        Clear
                    </button>
                </div>
            ) : (
                <p className="text-xs text-[var(--text-muted)]">No location selected. Search or click on the map.</p>
            )}

            {/* Hidden form inputs */}
            <input type="hidden" name={latName} value={marker ? marker.lat.toFixed(7) : ""} />
            <input type="hidden" name={lngName} value={marker ? marker.lng.toFixed(7) : ""} />
        </div>
    )
}
