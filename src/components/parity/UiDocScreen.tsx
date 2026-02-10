import Link from "next/link"

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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          {description ? <p className="text-gray-600 mt-1">{description}</p> : null}
        </div>
        {links.length > 0 ? (
          <div className="flex flex-wrap gap-2 justify-end">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="border rounded-md px-3 py-2 text-sm hover:bg-gray-50">
                {link.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      {tabs.length > 0 ? (
        <div className="border rounded-lg bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Tabs</p>
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab, index) => (
              <button
                key={tab}
                type="button"
                className={`px-3 py-1.5 text-sm rounded-full border ${index === 0 ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700"}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {sections.map((section) => (
        <section key={section.title} className="border rounded-lg bg-white p-6">
          <h2 className="text-lg font-semibold">{section.title}</h2>
          {section.description ? <p className="text-sm text-gray-600 mt-1">{section.description}</p> : null}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {section.fields.map((field) => {
              const type = field.type || "text"
              const label = (
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {field.label}
                  {field.required ? <span className="text-red-500"> *</span> : null}
                </label>
              )

              if (type === "textarea") {
                return (
                  <div key={field.label} className="md:col-span-2 lg:col-span-3">
                    {label}
                    <textarea className="w-full border rounded-md px-3 py-2" placeholder={field.placeholder || field.label} rows={3} />
                  </div>
                )
              }

              if (type === "select") {
                return (
                  <div key={field.label}>
                    {label}
                    <select className="w-full border rounded-md px-3 py-2" defaultValue="">
                      <option value="">-- Select --</option>
                      {(field.options || [field.label]).map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                )
              }

              if (type === "checkbox") {
                return (
                  <div key={field.label} className="flex items-center mt-7 gap-2">
                    <input type="checkbox" className="h-4 w-4" />
                    <label className="text-sm text-gray-700">{field.label}</label>
                  </div>
                )
              }

              return (
                <div key={field.label}>
                  {label}
                  <input type={type} className="w-full border rounded-md px-3 py-2" placeholder={field.placeholder || field.label} />
                </div>
              )
            })}
          </div>
        </section>
      ))}

      {actions.length > 0 ? (
        <div className="flex flex-wrap gap-2 justify-end">
          {actions.map((action) => (
            <button key={action} type="button" className="bg-blue-600 text-white rounded-md px-4 py-2 text-sm hover:bg-blue-700">
              {action}
            </button>
          ))}
        </div>
      ) : null}

      {table ? (
        <section className="border rounded-lg bg-white">
          {table.title ? <h2 className="text-lg font-semibold p-4 border-b">{table.title}</h2> : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {table.columns.map((column) => (
                    <th key={column} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={table.columns.length} className="px-4 py-8 text-center text-sm text-gray-500">
                    UI-only placeholder table for frontend parity.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  )
}
