"use client"

import { useEffect, useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import ActionButton from "@/components/ui/action-button"
import InlineAlert from "@/components/ui/inline-alert"
import { checkPasswordStrength } from "@/lib/validation/formats"

type RoleOption = { id: string; name: string; scopeType?: "GLOBAL" | "REGIONAL" }
type RegionOption = { id: string; name: string }
type OfficeOption = { id: string; name: string; regionId?: string | null }

type FormState = {
  name: string
  email: string
  roleId: string
  regionId: string
  regionalOfficeId: string
  contactNumber: string
  password: string
  status: "ACTIVE" | "INACTIVE"
}

const defaultForm: FormState = {
  name: "",
  email: "",
  roleId: "",
  regionId: "",
  regionalOfficeId: "",
  contactNumber: "",
  password: "",
  status: "ACTIVE",
}

export default function UserEnrollmentManager() {
  const [form, setForm] = useState<FormState>(defaultForm)
  const [roles, setRoles] = useState<RoleOption[]>([])
  const [regions, setRegions] = useState<RegionOption[]>([])
  const [offices, setOffices] = useState<OfficeOption[]>([])
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadDependencies() {
      try {
        const [rolesRes, regionsRes, officesRes] = await Promise.all([
          fetch("/api/roles", { cache: "no-store" }),
          fetch("/api/regions", { cache: "no-store" }),
          fetch("/api/regional-offices", { cache: "no-store" }),
        ])

        if (!rolesRes.ok || !regionsRes.ok || !officesRes.ok) {
          throw new Error("Failed to load user form dependencies.")
        }

        const [rolesJson, regionsJson, officesJson] = await Promise.all([
          rolesRes.json(),
          regionsRes.json(),
          officesRes.json(),
        ])

        if (cancelled) return
        setRoles(Array.isArray(rolesJson) ? rolesJson : [])
        setRegions(Array.isArray(regionsJson) ? regionsJson : [])
        setOffices(Array.isArray(officesJson) ? officesJson : [])
      } catch (loadError) {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : "Failed to load form data.")
      }
    }

    void loadDependencies()
    return () => {
      cancelled = true
    }
  }, [])

  const selectedRole = useMemo(
    () => roles.find((r) => r.id === form.roleId) || null,
    [roles, form.roleId]
  )
  const isGlobalRole = selectedRole?.scopeType === "GLOBAL"
  const isRegionalRole = selectedRole?.scopeType === "REGIONAL"

  const availableOffices = useMemo(() => {
    if (!form.regionId) return offices
    return offices.filter((office) => !office.regionId || office.regionId === form.regionId)
  }, [offices, form.regionId])

  // When the user picks a GLOBAL role, clear any region/office that may have
  // been set (the API rejects region assignments on GLOBAL roles).
  useEffect(() => {
    if (isGlobalRole && (form.regionId || form.regionalOfficeId)) {
      setForm((prev) => ({ ...prev, regionId: "", regionalOfficeId: "" }))
    }
  }, [isGlobalRole, form.regionId, form.regionalOfficeId])

  const passwordStrength = useMemo(
    () => checkPasswordStrength(form.password, form.email),
    [form.password, form.email]
  )

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const EMAIL_DOMAIN = "@parwestgroup.com"

  const onSubmit = async () => {
    setNotice("")
    setError("")

    if (!form.name || !form.email || !form.roleId || !form.contactNumber || !form.password) {
      setError("Please fill all required fields.")
      return
    }

    if (!form.email.endsWith(EMAIL_DOMAIN)) {
      setError(`Email must end with ${EMAIL_DOMAIN}.`)
      return
    }

    if (isRegionalRole && (!form.regionId || !form.regionalOfficeId)) {
      setError("Region and Regional Office are required for regional roles.")
      return
    }

    const strength = checkPasswordStrength(form.password, form.email)
    if (!strength.ok) {
      setError(`Password is too weak — needs: ${strength.issues.join(", ")}.`)
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to create user.")
      }
      setNotice("User created successfully.")
      setForm(defaultForm)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to create user.")
    } finally {
      setSubmitting(false)
    }
  }

  const onReset = () => {
    setForm(defaultForm)
    setError("")
    setNotice("")
  }

  return (
    <div className="space-y-6">
      <SectionTitle title="User Enrolment Form" subtitle="Create users with role, region, and office mapping." />

      {notice ? <InlineAlert type="success" message={notice} /> : null}
      {error ? <InlineAlert type="error" message={error} /> : null}

      <FilterBar className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="User's Name" required value={form.name} onChange={(v) => setField("name", v)} />
          <Field label="Email (must end with @parwestgroup.com)" required type="email" value={form.email} onChange={(v) => setField("email", v)} />

          <SelectField
            label="User Role"
            required
            value={form.roleId}
            onChange={(v) => setField("roleId", v)}
            options={roles.map((role) => ({ value: role.id, label: role.name }))}
            placeholder="-- Select User Role --"
          />
          <SelectField
            label="Select Region"
            required={isRegionalRole}
            disabled={isGlobalRole}
            value={form.regionId}
            onChange={(v) => {
              setField("regionId", v)
              setField("regionalOfficeId", "")
            }}
            options={regions.map((region) => ({ value: region.id, label: region.name }))}
            placeholder={isGlobalRole ? "Not applicable for global roles" : "-- Select Region --"}
          />

          <SelectField
            label="Regional Office"
            required={isRegionalRole}
            disabled={isGlobalRole}
            value={form.regionalOfficeId}
            onChange={(v) => setField("regionalOfficeId", v)}
            options={availableOffices.map((office) => ({ value: office.id, label: office.name }))}
            placeholder={isGlobalRole ? "Not applicable for global roles" : "-- Select Regional Office --"}
          />
          <Field label="Contact #" required value={form.contactNumber} onChange={(v) => setField("contactNumber", v)} />

          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Password *</label>
            <input
              className="ui-input"
              type="password"
              value={form.password}
              onChange={(e) => setField("password", e.target.value)}
            />
            {form.password ? (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1" aria-label={`Password strength ${passwordStrength.score} of 4`}>
                  {[1, 2, 3, 4].map((i) => {
                    const active = i <= passwordStrength.score
                    const color = !active
                      ? "bg-gray-200"
                      : passwordStrength.score <= 1
                      ? "bg-red-500"
                      : passwordStrength.score === 2
                      ? "bg-orange-500"
                      : passwordStrength.score === 3
                      ? "bg-yellow-500"
                      : "bg-green-600"
                    return <div key={i} className={`h-1.5 flex-1 rounded ${color}`} />
                  })}
                </div>
                {passwordStrength.ok ? (
                  <p className="text-xs text-green-700">✓ Password is strong</p>
                ) : (
                  <ul className="list-disc pl-4 text-xs text-red-600">
                    {passwordStrength.issues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
          <SelectField
            label="Status"
            value={form.status}
            onChange={(v) => setField("status", v as FormState["status"])}
            options={[
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
            ]}
            placeholder="-- Select Status --"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={onSubmit} disabled={submitting}>
            {submitting ? "Submitting..." : "Submit"}
          </ActionButton>
          <ActionButton variant="secondary" onClick={onReset}>
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
  disabled,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  placeholder: string
  required?: boolean
  disabled?: boolean
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-[var(--text-muted)]">
        {label}
        {required ? " *" : ""}
      </label>
      <select
        className="ui-select"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
