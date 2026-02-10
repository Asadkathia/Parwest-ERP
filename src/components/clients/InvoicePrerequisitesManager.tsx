"use client"

import { useMemo, useState } from "react"

type RateRow = {
  id: string
  province: string
  city: string
  guardType: string
  ratePerMonth: number
}

const TABS = ["Default Rates", "Client Provinces", "Client Cities", "Guard Types", "Invoice Header"] as const

const initialRates: RateRow[] = [
  { id: "1", province: "Punjab", city: "Lahore", guardType: "Guard", ratePerMonth: 35000 },
  { id: "2", province: "Punjab", city: "Gujranwala", guardType: "Supervisor", ratePerMonth: 48000 },
  { id: "3", province: "Sindh", city: "Karachi", guardType: "Guard", ratePerMonth: 37000 },
]

export default function InvoicePrerequisitesManager() {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("Default Rates")
  const [province, setProvince] = useState("")
  const [city, setCity] = useState("")
  const [guardType, setGuardType] = useState("")
  const [ratePerMonth, setRatePerMonth] = useState("")
  const [rows, setRows] = useState<RateRow[]>(initialRates)

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (province && row.province !== province) return false
      if (city && row.city !== city) return false
      if (guardType && row.guardType !== guardType) return false
      return true
    })
  }, [rows, province, city, guardType])

  const onSave = () => {
    if (!province || !city || !guardType || !ratePerMonth) return

    setRows((prev) => [
      {
        id: String(prev.length + 1),
        province,
        city,
        guardType,
        ratePerMonth: Number(ratePerMonth),
      },
      ...prev,
    ])
    setRatePerMonth("")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Client Invoice Prerequisites</h1>
        <p className="text-gray-600 mt-1">Manage default rates, provinces, cities, guard types, and invoice header settings.</p>
      </div>

      <div className="bg-white rounded-lg border p-4">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-sm rounded-full border ${activeTab === tab ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700"}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "Default Rates" ? (
        <>
          <div className="bg-white rounded-lg border p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Select Province</label>
                <select value={province} onChange={(e) => setProvince(e.target.value)} className="w-full border rounded-md px-3 py-2">
                  <option value="">All Provinces</option>
                  <option value="Punjab">Punjab</option>
                  <option value="Sindh">Sindh</option>
                  <option value="KPK">KPK</option>
                  <option value="Balochistan">Balochistan</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Select City</label>
                <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full border rounded-md px-3 py-2" placeholder="City" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Select Guard Type</label>
                <select value={guardType} onChange={(e) => setGuardType(e.target.value)} className="w-full border rounded-md px-3 py-2">
                  <option value="">All Types</option>
                  <option value="Guard">Guard</option>
                  <option value="Supervisor">Supervisor</option>
                  <option value="CPO">CPO</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Rate/Month</label>
                <input type="number" value={ratePerMonth} onChange={(e) => setRatePerMonth(e.target.value)} className="w-full border rounded-md px-3 py-2" placeholder="Rate" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="bg-blue-600 text-white px-3 py-2 rounded-md text-sm hover:bg-blue-700">SEARCH!</button>
              <button onClick={onSave} className="bg-green-600 text-white px-3 py-2 rounded-md text-sm hover:bg-green-700">SAVE</button>
            </div>
          </div>

          <div className="bg-white rounded-lg border overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs uppercase text-gray-600">Client Province</th>
                  <th className="px-4 py-3 text-left text-xs uppercase text-gray-600">Client City</th>
                  <th className="px-4 py-3 text-left text-xs uppercase text-gray-600">Guard Type</th>
                  <th className="px-4 py-3 text-left text-xs uppercase text-gray-600">Rate/Month</th>
                  <th className="px-4 py-3 text-left text-xs uppercase text-gray-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">No rates found.</td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">{row.province}</td>
                      <td className="px-4 py-3 text-sm">{row.city}</td>
                      <td className="px-4 py-3 text-sm">{row.guardType}</td>
                      <td className="px-4 py-3 text-sm">{row.ratePerMonth.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-blue-600">Edit</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-lg border p-10 text-center text-sm text-gray-500">
          {activeTab} UI scaffold is ready for frontend parity and can be fully wired in the next pass.
        </div>
      )}
    </div>
  )
}
