"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { Loader2 } from "lucide-react"

type RegionalOffice = { id: string; name: string }

const STATUS_OPTIONS = [
    { value: "ACTIVE",     label: "Active" },
    { value: "PENDING",    label: "Pending" },
    { value: "PRESENT",    label: "Present" },
    { value: "DEFAULT",    label: "Default" },
    { value: "INACTIVE",   label: "Inactive" },
    { value: "TERMINATED", label: "Terminated" },
]

interface Props {
    offices: RegionalOffice[]
}

export default function GuardsFilterBar({ offices }: Props) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [isPending, startTransition] = useTransition()

    const [search, setSearch] = useState(searchParams.get("q") ?? "")
    const [status, setStatus] = useState(searchParams.get("status") ?? "")
    const [officeId, setOfficeId] = useState(searchParams.get("officeId") ?? "")
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const pushParams = useCallback(
        (q: string, s: string, o: string) => {
            const params = new URLSearchParams()
            if (q) params.set("q", q)
            if (s) params.set("status", s)
            if (o) params.set("officeId", o)
            startTransition(() => {
                router.push(`${pathname}?${params.toString()}`)
            })
        },
        [router, pathname]
    )

    // Debounce search input
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
            pushParams(search, status, officeId)
        }, 350)
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search])

    const handleStatus = (val: string) => {
        setStatus(val)
        pushParams(search, val, officeId)
    }

    const handleOffice = (val: string) => {
        setOfficeId(val)
        pushParams(search, status, val)
    }

    return (
        <div className="space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by name, CNIC, or Parwest ID..."
                        className="ui-input pr-8"
                    />
                    {isPending && (
                        <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                    )}
                </div>
                <select
                    value={status}
                    onChange={(e) => handleStatus(e.target.value)}
                    disabled={isPending}
                    className="ui-select disabled:opacity-60"
                >
                    <option value="">All Status</option>
                    {STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </select>
                <select
                    value={officeId}
                    onChange={(e) => handleOffice(e.target.value)}
                    disabled={isPending}
                    className="ui-select disabled:opacity-60"
                >
                    <option value="">All Regions</option>
                    {offices.map((o) => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                </select>
            </div>
            {isPending && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading results…
                </div>
            )}
        </div>
    )
}