import { Bell } from "lucide-react"
import { Input } from "@/components/ui/form-controls"
import ActionButton from "@/components/ui/action-button"
import { isMockEnabled } from "@/lib/mockData"

type Props = {
  name?: string | null
  role?: string | null
  signOutSlot?: React.ReactNode
}

export default function Topbar({ name, role, signOutSlot }: Props) {
  const mockMode = isMockEnabled()

  return (
    <header className="mx-3 mt-3 ui-card px-4 py-3 md:px-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex-1 max-w-2xl">
          <Input placeholder="Search for anything..." />
        </div>
        <div className="flex items-center justify-end gap-3">
          {mockMode ? (
            <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              Mock Mode Active
            </span>
          ) : null}
          <ActionButton variant="secondary" className="h-10 w-10 p-0 flex items-center justify-center">
            <Bell className="h-4 w-4" />
          </ActionButton>
          <div className="text-right">
            <p className="text-sm font-semibold text-[var(--text)]">{name || "Admin"}</p>
            <p className="text-xs text-[var(--text-muted)]">{role || "User"}</p>
          </div>
          {signOutSlot}
        </div>
      </div>
    </header>
  )
}
