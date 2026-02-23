"use client"

import { useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import ActionButton from "@/components/ui/action-button"
import InlineAlert from "@/components/ui/inline-alert"

type FormState = {
  name: string
  email: string
  role: string
  region: string
  office: string
  contact: string
  password: string
  status: string
}

const defaultForm: FormState = {
  name: "",
  email: "",
  role: "",
  region: "",
  office: "",
  contact: "",
  password: "",
  status: "Active",
}

export default function UserEnrollmentManager() {
  const [form, setForm] = useState<FormState>(defaultForm)
  const [notice, setNotice] = useState("")

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const onSubmit = () => {
    if (!form.name || !form.email || !form.role || !form.contact || !form.password) {
      setNotice("Please fill all required fields.")
      return
    }
    setNotice("User saved in frontend mock mode.")
    setForm(defaultForm)
  }

  const onReset = () => {
    setForm(defaultForm)
    setNotice("Form reset.")
  }

  return (
    <div className="space-y-6">
      <SectionTitle title="User Enrolment Form" subtitle="Legacy user creation form fields." />

      {notice ? <InlineAlert type="success" message={notice} /> : null}

      <FilterBar className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="User's Name" required value={form.name} onChange={(v) => setField("name", v)} />
          <Field label="Email" required type="email" value={form.email} onChange={(v) => setField("email", v)} />

          <SelectField
            label="User Role"
            required
            value={form.role}
            onChange={(v) => setField("role", v)}
            options={["Admin", "Manager", "Supervisor", "Accountant", "Inventory Incharge"]}
            placeholder="-- Select User Role --"
          />
          <SelectField
            label="Select Region"
            value={form.region}
            onChange={(v) => setField("region", v)}
            options={["Punjab", "Sindh", "KPK", "Balochistan", "ICT Islamabad"]}
            placeholder="-- Select Region --"
          />

          <SelectField
            label="Regional Office"
            value={form.office}
            onChange={(v) => setField("office", v)}
            options={["head office lahore", "karachi office", "islamabad office"]}
            placeholder="-- Select Regional Office --"
          />
          <Field label="Contact #" required value={form.contact} onChange={(v) => setField("contact", v)} />

          <Field label="Password" required type="password" value={form.password} onChange={(v) => setField("password", v)} />
          <SelectField
            label="Status"
            value={form.status}
            onChange={(v) => setField("status", v)}
            options={["Active", "Inactive"]}
            placeholder="-- Select Status --"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={onSubmit}>Submit</ActionButton>
          <ActionButton variant="secondary" onClick={onReset}>Reset</ActionButton>
        </div>
      </FilterBar>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  required?: boolean
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-[var(--text-muted)]">
        {label}
        {required ? " *" : ""}
      </label>
      <input className="ui-input" type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder: string
  required?: boolean
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-[var(--text-muted)]">
        {label}
        {required ? " *" : ""}
      </label>
      <select className="ui-select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={`${label}-${option}`} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  )
}

