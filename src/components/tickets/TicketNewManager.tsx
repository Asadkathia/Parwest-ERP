"use client"

import { useEffect, useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import ActionButton from "@/components/ui/action-button"
import InlineAlert from "@/components/ui/inline-alert"

type Lookup = { id: string; name: string }
type UserLookup = { id: string; name: string; email?: string }

type FormState = {
  subject: string
  description: string
  categoryId: string
  priorityId: string
  statusId: string
  assignedToId: string
}

const DEFAULT_FORM: FormState = {
  subject: "",
  description: "",
  categoryId: "",
  priorityId: "",
  statusId: "",
  assignedToId: "",
}

export default function TicketNewManager() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [categories, setCategories] = useState<Lookup[]>([])
  const [priorities, setPriorities] = useState<Lookup[]>([])
  const [statuses, setStatuses] = useState<Lookup[]>([])
  const [users, setUsers] = useState<UserLookup[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    async function loadDependencies() {
      try {
        const [catRes, prioRes, statusRes, usersRes] = await Promise.all([
          fetch("/api/tickets/categories", { cache: "no-store" }),
          fetch("/api/tickets/priorities", { cache: "no-store" }),
          fetch("/api/tickets/statuses", { cache: "no-store" }),
          fetch("/api/users", { cache: "no-store" }),
        ])
        const [catJson, prioJson, statusJson, usersJson] = await Promise.all([
          catRes.json().catch(() => []),
          prioRes.json().catch(() => []),
          statusRes.json().catch(() => []),
          usersRes.json().catch(() => []),
        ])
        if (cancelled) return
        setCategories(Array.isArray(catJson) ? catJson : [])
        setPriorities(Array.isArray(prioJson) ? prioJson : [])
        setStatuses(Array.isArray(statusJson) ? statusJson : [])
        setUsers(Array.isArray(usersJson) ? usersJson : [])
      } catch {
        if (!cancelled) {
          setError("Failed to load ticket dependencies.")
        }
      }
    }

    void loadDependencies()
    return () => {
      cancelled = true
    }
  }, [])

  const canSubmit = useMemo(
    () => Boolean(form.subject && form.categoryId && form.priorityId && form.statusId),
    [form.subject, form.categoryId, form.priorityId, form.statusId]
  )

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const submit = async () => {
    setNotice("")
    setError("")
    if (!canSubmit) {
      setError("Please fill all required fields.")
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          assignedToId: form.assignedToId || null,
          description: form.description || null,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || "Failed to create ticket.")

      setNotice("Ticket created successfully.")
      setForm(DEFAULT_FORM)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to create ticket.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionTitle title="Create Ticket" subtitle="Create a new ticket and assign it to a user." />
      {notice ? <InlineAlert type="success" message={notice} /> : null}
      {error ? <InlineAlert type="error" message={error} /> : null}

      <FilterBar className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Subject" value={form.subject} onChange={(value) => setField("subject", value)} required />
          <SelectField label="Category" value={form.categoryId} onChange={(value) => setField("categoryId", value)} rows={categories} required />
          <SelectField label="Priority" value={form.priorityId} onChange={(value) => setField("priorityId", value)} rows={priorities} required />
          <SelectField label="Status" value={form.statusId} onChange={(value) => setField("statusId", value)} rows={statuses} required />
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Assign To</label>
            <select className="ui-select" value={form.assignedToId} onChange={(e) => setField("assignedToId", e.target.value)}>
              <option value="">Unassigned</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Description</label>
            <textarea
              className="ui-textarea min-h-28"
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="Describe issue..."
            />
          </div>
        </div>

        <div className="flex gap-2">
          <ActionButton onClick={submit} disabled={!canSubmit || submitting}>
            {submitting ? "Submitting..." : "Submit"}
          </ActionButton>
          <ActionButton variant="secondary" onClick={() => setForm(DEFAULT_FORM)}>
            Reset
          </ActionButton>
        </div>
      </FilterBar>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-[var(--text-muted)]">
        {label}
        {required ? " *" : ""}
      </label>
      <input className="ui-input" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function SelectField({
  label,
  value,
  onChange,
  rows,
  required = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  rows: Lookup[]
  required?: boolean
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-[var(--text-muted)]">
        {label}
        {required ? " *" : ""}
      </label>
      <select className="ui-select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select {label}</option>
        {rows.map((row) => (
          <option key={row.id} value={row.id}>
            {row.name}
          </option>
        ))}
      </select>
    </div>
  )
}
