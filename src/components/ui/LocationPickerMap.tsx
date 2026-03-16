"use client"

import dynamic from "next/dynamic"

// Lazy-load the actual map to avoid SSR issues with Leaflet
const LocationPickerMapInner = dynamic(() => import("./LocationPickerMapInner"), {
    ssr: false,
    loading: () => (
        <div className="h-72 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] flex items-center justify-center text-sm text-[var(--text-muted)]">
            Loading map…
        </div>
    ),
})

type Props = {
    latName?: string
    lngName?: string
    defaultLat?: number
    defaultLng?: number
    label?: string
    onLocationChange?: (lat: string, lng: string) => void
}

export default function LocationPickerMap({
    latName = "latitude",
    lngName = "longitude",
    defaultLat,
    defaultLng,
    label = "Location",
    onLocationChange,
}: Props) {
    return (
        <LocationPickerMapInner
            latName={latName}
            lngName={lngName}
            defaultLat={defaultLat}
            defaultLng={defaultLng}
            label={label}
            onLocationChange={onLocationChange}
        />
    )
}
