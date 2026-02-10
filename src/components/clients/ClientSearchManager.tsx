"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

type ClientRow = {
  id: string
  name: string
  type: string
  city: string | null
  isBranchless: boolean
  status: string
  logoUrl: string | null
}

type Props = {
  title: string
  subtitle: string
}

export default function ClientSearchManager({ title, subtitle }: Props) {
  const [rows, setRows] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [name, setName] = useState("")
  const [clientType, setClientType] = useState("")
  const [city, setCity] = useState("")

  const loadRows = async () => {
    try {
      setLoading(true)
      setError("")
      const response = await fetch("/api/clients")
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || "Failed to fetch clients")
      }
      const data = await response.json()
      setRows(data)
    } catch (err: any) {
      setError(err.message)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRows()
  }, [])

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (name && !row.name.toLowerCase().includes(name.toLowerCase())) return false
      if (clientType && row.type.toLowerCase() !== clientType.toLowerCase()) return false
      if (city && !(row.city || "").toLowerCase().includes(city.toLowerCase())) return false
      return true
    })
  }, [rows, name, clientType, city])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-gray-600 mt-1">{subtitle}</p>
      </div>

      <div className="bg-white rounded-lg border p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded-md px-3 py-2" placeholder="Enter client name" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Select Client Type</label>
            <select value={clientType} onChange={(e) => setClientType(e.target.value)} className="w-full border rounded-md px-3 py-2">
              <option value="">--Select Client Type--</option>
              <option value="BANK">Bank</option>
              <option value="MANUFACTURER">Manufacturer</option>
              <option value="RETAIL">Retail</option>
              <option value="CORPORATE">Corporate</option>
              <option value="GOVERNMENT">Government</option>
              <option value="RESIDENTIAL">Residential</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Select City</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full border rounded-md px-3 py-2" placeholder="--Select City--" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={loadRows} className="bg-blue-600 text-white px-3 py-2 rounded-md text-sm hover:bg-blue-700">Search</button>
          <button
            onClick={() => {
              setName("")
              setClientType("")
              setCity("")
            }}
            className="border px-3 py-2 rounded-md text-sm hover:bg-gray-50"
          >
            Clear
          </button>
        </div>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full min-w-[980px]">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs uppercase text-gray-600">ID</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-gray-600">Logo</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-gray-600">Name</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-gray-600">Type</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-gray-600">City</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-gray-600">Is Branchless</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-gray-600">Status</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-gray-600">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">No clients found.</td></tr>
            ) : (
              filtered.map((row, index) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{index + 1}</td>
                  <td className="px-4 py-3 text-sm">
                    {row.logoUrl ? (
                      <img src={row.logoUrl} alt={row.name} className="h-8 w-8 rounded object-cover" />
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-blue-600">
                    <Link href={`/clients/${row.id}`}>{row.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-sm">{row.type}</td>
                  <td className="px-4 py-3 text-sm">{row.city || "—"}</td>
                  <td className="px-4 py-3 text-sm">{row.isBranchless ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-sm">{row.status}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-3">
                      <Link href={`/clients/${row.id}`} className="text-blue-600 hover:text-blue-700">View</Link>
                      <Link href={`/clients/${row.id}/edit`} className="text-green-600 hover:text-green-700">Edit</Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
