import Link from "next/link"
import SectionTitle from "@/components/ui/section-title"
import ActionButton from "@/components/ui/action-button"
import { Card, CardBody, CardHeader } from "@/components/ui/card"
import { Checkbox, Input, Select, Textarea } from "@/components/ui/form-controls"

export type UiField = {
  label: string
  type?: "text" | "email" | "number" | "date" | "month" | "textarea" | "select" | "checkbox"
  placeholder?: string
  required?: boolean
  options?: string[]
}

export type UiSection = {
  title: string
  description?: string
  fields: UiField[]
}

export type UiTable = {
  title?: string
  columns: string[]
}

type Props = {
  title: string
  description?: string
  tabs?: string[]
  sections?: UiSection[]
  table?: UiTable
  actions?: string[]
  links?: Array<{ label: string; href: string }>
}

export default function UiDocScreen({
  title,
  description,
  tabs = [],
  sections = [],
  table,
  actions = [],
  links = [],
}: Props) {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <SectionTitle title={title} subtitle={description} />
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

      {tabs.length > 0 ? (
        <Card>
          <CardBody>
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-2">Tabs</p>
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab, index) => (
                <button
                  key={tab}
                  type="button"
                  className={`px-3 py-1.5 text-sm rounded-full border ${index === 0 ? "bg-[var(--brand)] text-white border-[var(--brand)]" : "bg-white text-[var(--text)] border-[var(--border)]"}`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </CardBody>
        </Card>
      ) : null}

      {sections.map((section) => (
        <Card key={section.title}>
          <CardBody>
            <h2 className="text-lg font-semibold text-[var(--text)]">{section.title}</h2>
            {section.description ? <p className="text-sm text-[var(--text-muted)] mt-1">{section.description}</p> : null}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {section.fields.map((field) => {
                const type = field.type || "text"
                const label = (
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                    {field.label}
                    {field.required ? <span className="text-red-500"> *</span> : null}
                  </label>
                )

                if (type === "textarea") {
                  return (
                    <div key={field.label} className="md:col-span-2 lg:col-span-3">
                      {label}
                      <Textarea placeholder={field.placeholder || field.label} rows={3} />
                    </div>
                  )
                }

                if (type === "select") {
                  return (
                    <div key={field.label}>
                      {label}
                      <Select defaultValue="">
                        <option value="">-- Select --</option>
                        {(field.options || [field.label]).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )
                }

                if (type === "checkbox") {
                  return (
                    <div key={field.label} className="flex items-center mt-7 gap-2">
                      <Checkbox />
                      <label className="text-sm text-[var(--text)]">{field.label}</label>
                    </div>
                  )
                }

                return (
                  <div key={field.label}>
                    {label}
                    <Input type={type} placeholder={field.placeholder || field.label} />
                  </div>
                )
              })}
            </div>
          </CardBody>
        </Card>
      ))}

      {actions.length > 0 ? (
        <div className="flex flex-wrap gap-2 justify-end">
          {actions.map((action) => (
            <ActionButton key={action} type="button">
              {action}
            </ActionButton>
          ))}
        </div>
      ) : null}

      {table ? (
        <Card>
          {table.title ? (
            <CardHeader>
              <h2 className="text-lg font-semibold text-[var(--text)]">{table.title}</h2>
            </CardHeader>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="bg-[var(--surface-muted)] border-b border-[var(--border)]">
                <tr>
                  {table.columns.map((column) => (
                    <th key={column} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={table.columns.length} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                    UI-only placeholder table for frontend parity.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  )
}
