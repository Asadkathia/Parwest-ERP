"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/shadcn/button"
import { Alert, AlertDescription } from "@/components/shadcn/alert"
import { useSearchParams } from "next/navigation"
import { Filter, CheckCircle2, AlertCircle } from "lucide-react"
import { Card, CardContent } from "@/components/shadcn/card"
import DataTable from "@/components/shared/DataTable"
import RegionUrlPicker from "@/components/access/RegionUrlPicker"

type RegionOption = { id: string; name: string }

type Client = { id: string; name: string }
type ExportRow = { id: string; name: string; supervisor: string; manager: string; clientId: string }

export default function ExportBranchesManager({
  regions = [],
  locked = false,
}: {
  regions?: RegionOption[]
  locked?: boolean
} = {}) {
  const searchParams = useSearchParams()
  const urlRegionId = searchParams?.get("regionId") || ""
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  // No branch/manager export feed is wired into this screen yet. Per the
  // project rule "never show fake data; if a source is empty, show empty",
  // rows stay empty until a real data source is connected.
  const [rows] = useState<ExportRow[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        setError("")
        const url = urlRegionId
          ? `/api/clients?regionId=${encodeURIComponent(urlRegionId)}`
          : "/api/clients"
        const response = await fetch(url)
        if (!response.ok) throw new Error("Failed to load clients")
        const data = (await response.json()) as Client[]
        setClients(Array.isArray(data) ? data : [])
      } catch {
        // Don't fall back to hardcoded clients — that would leak names from
        // outside the user's region. Just surface the error.
        setClients([])
        setError("Could not load clients.")
      }
    }
    load()
  }, [urlRegionId])

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (selectedClient && row.clientId !== selectedClient) return false
      return true
    })
  }, [rows, selectedClient])

  const handleSubmit = () => {
    setNotice(`Prepared ${filtered.length} branch record(s).`)
  }

  return (
    <div className="space-y-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Export Client Branches</h2>
          <p className="mt-1 text-sm text-muted-foreground">Filter by client and export branch ownership mapping.</p>
        </div>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          handleSubmit()
        }}
        className="space-y-4"
      >
        <Card>
          <CardContent className="space-y-4 p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <RegionUrlPicker
              regions={regions}
              locked={locked}
              includeGlobalOption={!locked}
            />
            <div>
              <label className="block text-sm text-[var(--text-muted)] mb-1">Select Client</label>
              <select name="Select Client" value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} className="ui-select">
                <option value="">--Select Client--</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="inline-flex items-center gap-2"><Filter className="h-4 w-4" />Submit</Button>
          </div>
          </CardContent>
        </Card>
      </form>

      {error ? <Alert className="border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 [&>svg]:text-rose-600 dark:[&>svg]:text-rose-300"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert> : null}
      {notice ? <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 [&>svg]:text-emerald-600 dark:[&>svg]:text-emerald-300"><CheckCircle2 className="h-4 w-4" /><AlertDescription>{notice}</AlertDescription></Alert> : null}

      <DataTable
        rows={filtered}
        columns={[
          { key: "name", header: "Name", sortable: true },
          { key: "supervisor", header: "Supervisor", sortable: true },
          { key: "manager", header: "Manager", sortable: true },
        ]}
        getRowKey={(row) => row.id}
        emptyText="No Record Found"
        searchable={false}
      />
    </div>
  )
}
