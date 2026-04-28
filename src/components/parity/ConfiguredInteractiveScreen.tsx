"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/shadcn/button"
import { CheckCircle2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/shadcn/alert"
import { Card, CardContent } from "@/components/shadcn/card"
import Link from "next/link"
import type { ScreenConfig } from "@/lib/parity/screenConfigs"
type Props = {
  config: ScreenConfig
  links?: Array<{ label: string; href: string }>
}

type Row = Record<string, string>

function normalizeKey(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_")
}

export default function ConfiguredInteractiveScreen({ config, links = [] }: Props) {
  const [activeTab, setActiveTab] = useState(config.tabs?.[0] || "")
  const [form, setForm] = useState<Record<string, string>>({})
  const [rows, setRows] = useState<Row[]>([])
  const [search, setSearch] = useState("")
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const tableColumns = config.table?.columns || []

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows
    return rows.filter((row) => Object.values(row).join(" ").toLowerCase().includes(search.toLowerCase()))
  }, [rows, search])

  const setField = (label: string, value: string) => {
    const key = normalizeKey(label)
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const valueOf = (label: string) => {
    const key = normalizeKey(label)
    return form[key] || ""
  }

  const onRunAction = (action: string) => {
    const lower = action.toLowerCase()
    const allFields = (config.sections || []).flatMap((section) => section.fields)
    const requiredFields = allFields.filter((field) => field.required)
    const missingFields = requiredFields.filter((field) => !valueOf(field.label).trim()).map((field) => field.label)

    setNotice(null)

    if (lower.includes("clear") || lower.includes("reset")) {
      setForm({})
      setSearch("")
      setNotice({ type: "success", text: `${action} completed.` })
      return
    }

    if (lower.includes("search") || lower.includes("filter")) {
      const query = Object.values(form).join(" ").trim()
      if (!query) {
        setNotice({ type: "error", text: "Enter at least one filter value before running search." })
        return
      }
      setSearch(query)
      setNotice({ type: "success", text: "Search filters applied." })
      return
    }

    if (tableColumns.length > 0 && (lower.includes("save") || lower.includes("add") || lower.includes("create") || lower.includes("submit") || lower.includes("generate") || lower.includes("assign") || lower.includes("switch") || lower.includes("approve") || lower.includes("reject") || lower.includes("process"))) {
      if (missingFields.length > 0) {
        setNotice({ type: "error", text: `Missing required fields: ${missingFields.join(", ")}` })
        return
      }

      const row: Row = {}
      tableColumns.forEach((col) => {
        const key = normalizeKey(col)
        row[col] = form[key] || form[normalizeKey(col.replace("/", " "))] || "—"
      })
      setRows((prev) => [{ ...row }, ...prev])
      setNotice({ type: "success", text: `${action} completed in frontend mode.` })
      return
    }

    if (lower.includes("export") || lower.includes("download")) {
      setNotice({ type: "success", text: `${action} queued (frontend-only simulation).` })
      return
    }

    setNotice({ type: "success", text: `${action} triggered.` })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold tracking-tight">{(config.title)}</h2><p className="mt-1 text-sm text-muted-foreground">{(config.description)}</p></div></div>
        {links.length > 0 ? (
          <div className="flex flex-wrap gap-2 justify-end">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="ui-btn ui-btn-secondary">
                {link.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      {config.tabs && config.tabs.length > 0 ? (
        <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap gap-2">
            {config.tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${activeTab === tab ? "bg-[var(--brand)] text-white border-[var(--brand)]" : "bg-[var(--surface)] text-[var(--text)] border-[var(--border)] hover:bg-[var(--surface-muted)]"}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
      ) : null}

      {notice ? (
        ((notice.type) === "success" ? <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 [&>svg]:text-emerald-600 dark:[&>svg]:text-emerald-300"><CheckCircle2 className="h-4 w-4" /><AlertDescription>{(notice.text)}</AlertDescription></Alert> : <Alert className="border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 [&>svg]:text-rose-600 dark:[&>svg]:text-rose-300"><AlertCircle className="h-4 w-4" /><AlertDescription>{(notice.text)}</AlertDescription></Alert>)
      ) : null}

      {config.sections?.map((section) => (
        <Card key={section.title}>
          <CardContent className="p-5">
          <h2 className="text-lg font-semibold text-[var(--text)]">{section.title}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {section.fields.map((field) => {
              const type = field.type || "text"
              const labelNode = (
                <label className="block text-sm text-[var(--text-muted)] mb-1">
                  {field.label}
                  {field.required ? <span className="text-red-500"> *</span> : null}
                </label>
              )

              if (type === "checkbox") {
                return (
                  <div key={field.label} className="flex items-center gap-2 mt-7">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--brand)]"
                      checked={valueOf(field.label) === "true"}
                      onChange={(e) => setField(field.label, e.target.checked ? "true" : "false")}
                    />
                    <span className="text-sm text-[var(--text)]">{field.label}</span>
                  </div>
                )
              }

              if (type === "select") {
                return (
                  <div key={field.label}>
                    {labelNode}
                    <select
                      className="ui-select"
                      value={valueOf(field.label)}
                      onChange={(e) => setField(field.label, e.target.value)}
                    >
                      <option value="">-- Select --</option>
                      {(field.options || [field.label]).map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                )
              }

              if (type === "textarea") {
                return (
                  <div key={field.label} className="md:col-span-2 lg:col-span-3">
                    {labelNode}
                    <textarea
                      className="ui-textarea"
                      value={valueOf(field.label)}
                      onChange={(e) => setField(field.label, e.target.value)}
                      rows={3}
                      placeholder={field.placeholder || field.label}
                    />
                  </div>
                )
              }

              return (
                <div key={field.label}>
                  {labelNode}
                  <input
                    className="ui-input"
                    type={type}
                    value={valueOf(field.label)}
                    onChange={(e) => setField(field.label, e.target.value)}
                    placeholder={field.placeholder || field.label}
                  />
                </div>
              )
            })}
          </div>
          </CardContent>
        </Card>
      ))}

      {config.actions && config.actions.length > 0 ? (
        <div className="flex flex-wrap gap-2 justify-end">
          {config.actions.map((action) => (
            <Button key={action} type="button" onClick={() => onRunAction(action)}>
              {action}
            </Button>
          ))}
        </div>
      ) : null}

      {config.table ? (
        <section className="ui-card overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead className="bg-[var(--surface-muted)] border-b border-[var(--border)]">
              <tr>
                {config.table.columns.map((col: string) => (
                  <th key={col} className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={config.table.columns.length} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                    No records found. Use the form actions above to create frontend entries.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, index) => (
                  <tr key={index} className="hover:bg-[var(--surface-muted)]">
                    {config.table!.columns.map((col: string) => (
                      <td key={col} className="px-4 py-3 text-sm">{row[col] || "—"}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  )
}
