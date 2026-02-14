"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import SectionTitle from "@/components/ui/section-title"
import ActionButton from "@/components/ui/action-button"
import InlineAlert from "@/components/ui/inline-alert"
import { Card, CardBody } from "@/components/ui/card"

type Region = {
  id: string
  name: string
}

type RegionalOffice = {
  id: string
  name: string
  seriesCode: string
  regionId: string
  region: {
    id: string
    name: string
  }
}

type Props = {
  regions: Region[]
  regionalOffices: RegionalOffice[]
}

export default function PrerequisitesManager({ regions, regionalOffices }: Props) {
  const router = useRouter()
  const [showRegionForm, setShowRegionForm] = useState(false)
  const [showOfficeForm, setShowOfficeForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleAddRegion = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    const formData = new FormData(e.currentTarget)
    const data = { name: formData.get("name") }

    try {
      const response = await fetch("/api/regions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) throw new Error("Failed to create region")

      router.refresh()
      setShowRegionForm(false)
      ;(e.target as HTMLFormElement).reset()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAddOffice = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get("name"),
      seriesCode: formData.get("seriesCode"),
      regionId: formData.get("regionId"),
    }

    try {
      const response = await fetch("/api/regional-offices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) throw new Error("Failed to create regional office")

      router.refresh()
      setShowOfficeForm(false)
      ;(e.target as HTMLFormElement).reset()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      {error ? <InlineAlert type="error" message={error} /> : null}

      <Card>
        <CardBody className="space-y-5">
          <div className="flex items-center justify-between">
            <SectionTitle title="Regions" subtitle="Manage region master list for guard workflows." />
            <ActionButton onClick={() => setShowRegionForm((p) => !p)} className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Region
            </ActionButton>
          </div>

          {showRegionForm ? (
            <form onSubmit={handleAddRegion} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <label className="block text-sm text-[var(--text-muted)] mb-2">
                Region Name <span className="text-red-500">*</span>
              </label>
              <input type="text" name="name" required placeholder="e.g., Punjab, Sindh, KPK" className="ui-input" />
              <div className="flex gap-2 mt-4">
                <ActionButton type="submit" disabled={loading}>{loading ? "Saving..." : "Save Region"}</ActionButton>
                <ActionButton type="button" variant="secondary" onClick={() => setShowRegionForm(false)}>Cancel</ActionButton>
              </div>
            </form>
          ) : null}

          <div className="space-y-2">
            {regions.length === 0 ? (
              <p className="text-[var(--text-muted)] text-center py-8">No regions added yet</p>
            ) : (
              regions.map((region) => (
                <div key={region.id} className="rounded-[var(--radius-md)] border border-[var(--border)] p-4 hover:bg-[var(--surface-muted)]">
                  <p className="font-medium">{region.name}</p>
                </div>
              ))
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-5">
          <div className="flex items-center justify-between">
            <SectionTitle title="Regional Offices" subtitle="Manage offices mapped to regions." />
            <ActionButton onClick={() => setShowOfficeForm((p) => !p)} disabled={regions.length === 0} className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Regional Office
            </ActionButton>
          </div>

          {regions.length === 0 ? (
            <InlineAlert type="error" message="Please add at least one region before creating regional offices." />
          ) : null}

          {showOfficeForm ? (
            <form onSubmit={handleAddOffice} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-[var(--text-muted)] mb-2">
                    Office Name <span className="text-red-500">*</span>
                  </label>
                  <input type="text" name="name" required placeholder="e.g., Lahore Office" className="ui-input" />
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-muted)] mb-2">
                    Series Code <span className="text-red-500">*</span>
                  </label>
                  <input type="text" name="seriesCode" required placeholder="e.g., LHR, KHI" className="ui-input" />
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-muted)] mb-2">
                    Region <span className="text-red-500">*</span>
                  </label>
                  <select name="regionId" required className="ui-select">
                    <option value="">Select region</option>
                    {regions.map((region) => (
                      <option key={region.id} value={region.id}>
                        {region.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <ActionButton type="submit" disabled={loading}>{loading ? "Saving..." : "Save Office"}</ActionButton>
                <ActionButton type="button" variant="secondary" onClick={() => setShowOfficeForm(false)}>Cancel</ActionButton>
              </div>
            </form>
          ) : null}

          <div className="space-y-2">
            {regionalOffices.length === 0 ? (
              <p className="text-[var(--text-muted)] text-center py-8">No regional offices added yet</p>
            ) : (
              regionalOffices.map((office) => (
                <div key={office.id} className="rounded-[var(--radius-md)] border border-[var(--border)] p-4 hover:bg-[var(--surface-muted)]">
                  <p className="font-medium">{office.name}</p>
                  <p className="text-sm text-[var(--text-muted)]">
                    Series: {office.seriesCode} | Region: {office.region.name}
                  </p>
                </div>
              ))
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
