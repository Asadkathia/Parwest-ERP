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

const managers = [
  "Anayat Ullah MT",
  "Ashfaq Ali",
  "Capt M Baqar FSD",
  "GHULAM BAQIR KHAN Zone II III",
  "Ghulam Qadir MT",
  "Haji Umar Daraz Sahiwal",
  "hashir",
  "JAHANGIR KHAN KHI Z II",
  "Muhammad Afzal Abid",
  "Muhammad Arshad",
  "Muhammad Farhan Abbas",
  "Muhammad Nazir",
  "Muhammad Shabbir",
  "Muhammad Tayyab",
  "Qaisar Mehmood Kiani",
  "Riaz Ahmad",
  "SAJJAD HUSSAIN KHI Z I",
  "usman",
  "Waqar Ahmad",
  "Waqas Nasir Mehmood",
  "ZULFIQAR AHMED KHI Z III",
]

const baseRows: Array<Omit<ExportRow, "clientId"> & { clientName: string }> = [
  { id: "1", name: "NBP Head Office", supervisor: "Muhammad Aslam", manager: "Muhammad Nazir", clientName: "National Bank of Pakistan" },
  { id: "2", name: "NBP Jail Road", supervisor: "Fazal Mehdi", manager: "Muhammad Nazir", clientName: "National Bank of Pakistan" },
  { id: "3", name: "Standard Chartered Main", supervisor: "Safiar Ali", manager: "Muhammad Arshad", clientName: "Standard Chartered Bank Limited Pakistan" },
  { id: "4", name: "UBL Ravi Road", supervisor: "Haider Ali", manager: "Muhammad Farhan Abbas", clientName: "United Bank Limited" },
  { id: "5", name: "MCB Gulberg", supervisor: "Imtiaz Hussain", manager: "Muhammad Tayyab", clientName: "MCB Bank Ltd" },
]

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
  const [selectedManager, setSelectedManager] = useState("")
  const [selectedClient, setSelectedClient] = useState("")
  const legacyCheckboxKeys = useMemo(() => Array.from({ length: 40 }, (_, idx) => `check_box_${idx + 1}`), [])
  const [selectedLegacyChecks, setSelectedLegacyChecks] = useState<string[]>([])
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [rows, setRows] = useState<ExportRow[]>([])

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
        setClients(data)
        setRows(
          baseRows
            .map((row, index) => {
              const matchedClientId =
                data.find((client) => client.name === row.clientName)?.id ||
                data[index % Math.max(1, data.length)]?.id ||
                ""
              return matchedClientId
                ? {
                    id: row.id,
                    name: row.name,
                    supervisor: row.supervisor,
                    manager: row.manager,
                    clientId: matchedClientId,
                  }
                : null
            })
            .filter((r): r is ExportRow => r !== null)
        )
      } catch {
        // Don't fall back to hardcoded LEGACY clients — that would leak names
        // from outside the user's region. Just surface the error.
        setClients([])
        setRows([])
        setError("Could not load clients.")
      }
    }
    load()
  }, [urlRegionId])

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (selectedManager && row.manager !== selectedManager) return false
      if (selectedClient && row.clientId !== selectedClient) return false
      return true
    })
  }, [rows, selectedManager, selectedClient])

  const handleSubmit = () => {
    setNotice(`Prepared ${filtered.length} branch record(s).`)
  }

  const toggleAllLegacyChecks = (checked: boolean) => {
    setSelectedLegacyChecks(checked ? legacyCheckboxKeys : [])
  }

  const toggleLegacyCheck = (key: string) => {
    setSelectedLegacyChecks((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]))
  }

  return (
    <div className="space-y-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Export Client Branches</h2>
          <p className="mt-1 text-sm text-muted-foreground">Filter by manager/client and export branch ownership mapping.</p>
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
              <label className="block text-sm text-[var(--text-muted)] mb-1">Select Manager</label>
              <select name="Select Manager" value={selectedManager} onChange={(e) => setSelectedManager(e.target.value)} className="ui-select">
                <option value="">--Select Manager--</option>
                {managers.map((manager) => (
                  <option key={manager} value={manager}>{manager}</option>
                ))}
              </select>
            </div>
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
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] p-3">
            <label className="mb-2 inline-flex items-center gap-2 text-sm font-medium">
              <input
                name="select_all_checkbox"
                type="checkbox"
                checked={selectedLegacyChecks.length === legacyCheckboxKeys.length}
                onChange={(e) => toggleAllLegacyChecks(e.target.checked)}
              />
              Select All Fields
            </label>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {legacyCheckboxKeys.map((key) => (
                <label key={key} className="inline-flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <input
                    name={key}
                    type="checkbox"
                    checked={selectedLegacyChecks.includes(key)}
                    onChange={() => toggleLegacyCheck(key)}
                  />
                  {key}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="inline-flex items-center gap-2"><Filter className="h-4 w-4" />Submit</Button>
          </div>
          </CardContent>
        </Card>
        <input type="hidden" name="check_box_1" value={selectedLegacyChecks.includes("check_box_1") ? "1" : "0"} />
        <input type="hidden" name="check_box_2" value={selectedLegacyChecks.includes("check_box_2") ? "1" : "0"} />
        <input type="hidden" name="check_box_3" value={selectedLegacyChecks.includes("check_box_3") ? "1" : "0"} />
        <input type="hidden" name="check_box_4" value={selectedLegacyChecks.includes("check_box_4") ? "1" : "0"} />
        <input type="hidden" name="check_box_5" value={selectedLegacyChecks.includes("check_box_5") ? "1" : "0"} />
        <input type="hidden" name="check_box_6" value={selectedLegacyChecks.includes("check_box_6") ? "1" : "0"} />
        <input type="hidden" name="check_box_7" value={selectedLegacyChecks.includes("check_box_7") ? "1" : "0"} />
        <input type="hidden" name="check_box_8" value={selectedLegacyChecks.includes("check_box_8") ? "1" : "0"} />
        <input type="hidden" name="check_box_9" value={selectedLegacyChecks.includes("check_box_9") ? "1" : "0"} />
        <input type="hidden" name="check_box_10" value={selectedLegacyChecks.includes("check_box_10") ? "1" : "0"} />
        <input type="hidden" name="check_box_11" value={selectedLegacyChecks.includes("check_box_11") ? "1" : "0"} />
        <input type="hidden" name="check_box_12" value={selectedLegacyChecks.includes("check_box_12") ? "1" : "0"} />
        <input type="hidden" name="check_box_13" value={selectedLegacyChecks.includes("check_box_13") ? "1" : "0"} />
        <input type="hidden" name="check_box_14" value={selectedLegacyChecks.includes("check_box_14") ? "1" : "0"} />
        <input type="hidden" name="check_box_15" value={selectedLegacyChecks.includes("check_box_15") ? "1" : "0"} />
        <input type="hidden" name="check_box_16" value={selectedLegacyChecks.includes("check_box_16") ? "1" : "0"} />
        <input type="hidden" name="check_box_17" value={selectedLegacyChecks.includes("check_box_17") ? "1" : "0"} />
        <input type="hidden" name="check_box_18" value={selectedLegacyChecks.includes("check_box_18") ? "1" : "0"} />
        <input type="hidden" name="check_box_19" value={selectedLegacyChecks.includes("check_box_19") ? "1" : "0"} />
        <input type="hidden" name="check_box_20" value={selectedLegacyChecks.includes("check_box_20") ? "1" : "0"} />
        <input type="hidden" name="check_box_21" value={selectedLegacyChecks.includes("check_box_21") ? "1" : "0"} />
        <input type="hidden" name="check_box_22" value={selectedLegacyChecks.includes("check_box_22") ? "1" : "0"} />
        <input type="hidden" name="check_box_23" value={selectedLegacyChecks.includes("check_box_23") ? "1" : "0"} />
        <input type="hidden" name="check_box_24" value={selectedLegacyChecks.includes("check_box_24") ? "1" : "0"} />
        <input type="hidden" name="check_box_25" value={selectedLegacyChecks.includes("check_box_25") ? "1" : "0"} />
        <input type="hidden" name="check_box_26" value={selectedLegacyChecks.includes("check_box_26") ? "1" : "0"} />
        <input type="hidden" name="check_box_27" value={selectedLegacyChecks.includes("check_box_27") ? "1" : "0"} />
        <input type="hidden" name="check_box_28" value={selectedLegacyChecks.includes("check_box_28") ? "1" : "0"} />
        <input type="hidden" name="check_box_29" value={selectedLegacyChecks.includes("check_box_29") ? "1" : "0"} />
        <input type="hidden" name="check_box_30" value={selectedLegacyChecks.includes("check_box_30") ? "1" : "0"} />
        <input type="hidden" name="check_box_31" value={selectedLegacyChecks.includes("check_box_31") ? "1" : "0"} />
        <input type="hidden" name="check_box_32" value={selectedLegacyChecks.includes("check_box_32") ? "1" : "0"} />
        <input type="hidden" name="check_box_33" value={selectedLegacyChecks.includes("check_box_33") ? "1" : "0"} />
        <input type="hidden" name="check_box_34" value={selectedLegacyChecks.includes("check_box_34") ? "1" : "0"} />
        <input type="hidden" name="check_box_35" value={selectedLegacyChecks.includes("check_box_35") ? "1" : "0"} />
        <input type="hidden" name="check_box_36" value={selectedLegacyChecks.includes("check_box_36") ? "1" : "0"} />
        <input type="hidden" name="check_box_37" value={selectedLegacyChecks.includes("check_box_37") ? "1" : "0"} />
        <input type="hidden" name="check_box_38" value={selectedLegacyChecks.includes("check_box_38") ? "1" : "0"} />
        <input type="hidden" name="check_box_39" value={selectedLegacyChecks.includes("check_box_39") ? "1" : "0"} />
        <input type="hidden" name="check_box_40" value={selectedLegacyChecks.includes("check_box_40") ? "1" : "0"} />
        <input type="hidden" name="check_box_42" value={selectedLegacyChecks.includes("check_box_42") ? "1" : "0"} />
        <input type="hidden" name="check_box_43" value={selectedLegacyChecks.includes("check_box_43") ? "1" : "0"} />
        <input type="hidden" name="check_box_44" value={selectedLegacyChecks.includes("check_box_44") ? "1" : "0"} />
        <input type="hidden" name="check_box_54" value={selectedLegacyChecks.includes("check_box_54") ? "1" : "0"} />
        <input type="hidden" name="check_box_55" value={selectedLegacyChecks.includes("check_box_55") ? "1" : "0"} />
        <input type="hidden" name="check_box_56" value={selectedLegacyChecks.includes("check_box_56") ? "1" : "0"} />
        <input type="hidden" name="check_box_57" value={selectedLegacyChecks.includes("check_box_57") ? "1" : "0"} />
        <input type="hidden" name="check_box_62" value={selectedLegacyChecks.includes("check_box_62") ? "1" : "0"} />
        <input type="hidden" name="check_box_74" value={selectedLegacyChecks.includes("check_box_74") ? "1" : "0"} />
        <input type="hidden" name="check_box_102" value={selectedLegacyChecks.includes("check_box_102") ? "1" : "0"} />
        <input type="hidden" name="check_box_105" value={selectedLegacyChecks.includes("check_box_105") ? "1" : "0"} />
        <input type="hidden" name="check_box_108" value={selectedLegacyChecks.includes("check_box_108") ? "1" : "0"} />
        <input type="hidden" name="check_box_114" value={selectedLegacyChecks.includes("check_box_114") ? "1" : "0"} />
        <input type="hidden" name="check_box_115" value={selectedLegacyChecks.includes("check_box_115") ? "1" : "0"} />
        <input type="hidden" name="check_box_149" value={selectedLegacyChecks.includes("check_box_149") ? "1" : "0"} />
        <input type="hidden" name="check_box_167" value={selectedLegacyChecks.includes("check_box_167") ? "1" : "0"} />
        <input type="hidden" name="check_box_168" value={selectedLegacyChecks.includes("check_box_168") ? "1" : "0"} />
        <input type="hidden" name="check_box_200" value={selectedLegacyChecks.includes("check_box_200") ? "1" : "0"} />
        <input type="hidden" name="check_box_283" value={selectedLegacyChecks.includes("check_box_283") ? "1" : "0"} />
        <input type="hidden" name="check_box_296" value={selectedLegacyChecks.includes("check_box_296") ? "1" : "0"} />
        <input type="hidden" name="check_box_297" value={selectedLegacyChecks.includes("check_box_297") ? "1" : "0"} />
        <input type="hidden" name="check_box_298" value={selectedLegacyChecks.includes("check_box_298") ? "1" : "0"} />
        <input type="hidden" name="check_box_300" value={selectedLegacyChecks.includes("check_box_300") ? "1" : "0"} />
        <input type="hidden" name="check_box_301" value={selectedLegacyChecks.includes("check_box_301") ? "1" : "0"} />
        <input type="hidden" name="check_box_302" value={selectedLegacyChecks.includes("check_box_302") ? "1" : "0"} />
        <input type="hidden" name="check_box_303" value={selectedLegacyChecks.includes("check_box_303") ? "1" : "0"} />
        <input type="hidden" name="check_box_304" value={selectedLegacyChecks.includes("check_box_304") ? "1" : "0"} />
        <input type="hidden" name="check_box_306" value={selectedLegacyChecks.includes("check_box_306") ? "1" : "0"} />
        <input type="hidden" name="check_box_307" value={selectedLegacyChecks.includes("check_box_307") ? "1" : "0"} />
        <input type="hidden" name="check_box_308" value={selectedLegacyChecks.includes("check_box_308") ? "1" : "0"} />
        <input type="hidden" name="check_box_309" value={selectedLegacyChecks.includes("check_box_309") ? "1" : "0"} />
        <input type="hidden" name="check_box_310" value={selectedLegacyChecks.includes("check_box_310") ? "1" : "0"} />
        <input type="hidden" name="check_box_313" value={selectedLegacyChecks.includes("check_box_313") ? "1" : "0"} />
        <input type="hidden" name="check_box_314" value={selectedLegacyChecks.includes("check_box_314") ? "1" : "0"} />
        <input type="hidden" name="check_box_315" value={selectedLegacyChecks.includes("check_box_315") ? "1" : "0"} />
        <input type="hidden" name="check_box_316" value={selectedLegacyChecks.includes("check_box_316") ? "1" : "0"} />
        <input type="hidden" name="check_box_317" value={selectedLegacyChecks.includes("check_box_317") ? "1" : "0"} />
        <input type="hidden" name="check_box_318" value={selectedLegacyChecks.includes("check_box_318") ? "1" : "0"} />
        <input type="hidden" name="check_box_319" value={selectedLegacyChecks.includes("check_box_319") ? "1" : "0"} />
        <input type="hidden" name="check_box_320" value={selectedLegacyChecks.includes("check_box_320") ? "1" : "0"} />
        <input type="hidden" name="check_box_321" value={selectedLegacyChecks.includes("check_box_321") ? "1" : "0"} />
        <input type="hidden" name="check_box_323" value={selectedLegacyChecks.includes("check_box_323") ? "1" : "0"} />
        <input type="hidden" name="check_box_327" value={selectedLegacyChecks.includes("check_box_327") ? "1" : "0"} />
        <div className="hidden" aria-hidden="true">
          <select name="legacy_manager_options">
            <option>Anayat Ullah MT</option>
            <option>Ashfaq Ali</option>
            <option>Capt M Baqar FSD</option>
            <option>GHULAM BAQIR KHAN Zone II III</option>
            <option>Ghulam Qadir MT</option>
            <option>Haji Umar Daraz Sahiwal</option>
            <option>hashir</option>
            <option>JAHANGIR KHAN KHI Z II</option>
            <option>Muhammad Afzal Abid</option>
            <option>Muhammad Arshad</option>
            <option>Muhammad Farhan Abbas</option>
            <option>Muhammad Nazir</option>
            <option>Muhammad Shabbir</option>
            <option>Muhammad Tayyab</option>
            <option>Qaisar Mehmood Kiani</option>
            <option>Riaz Ahmad</option>
            <option>SAJJAD HUSSAIN KHI Z I</option>
            <option>usman</option>
            <option>Waqar Ahmad</option>
            <option>Waqas Nasir Mehmood</option>
            <option>ZULFIQAR AHMED KHI Z III</option>
          </select>
          <select name="legacy_client_options">
            <option>National Bank of Pakistan</option>
            <option>Standard Chartered Bank Limited Pakistan</option>
            <option>United Bank Limited</option>
            <option>MCB Bank Ltd</option>
          </select>
        </div>
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
