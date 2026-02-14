import Topbar from "@/components/ui/topbar"
import { Sidebar } from "@/components/sidebar"

type Props = {
  name?: string | null
  role?: string | null
  signOutSlot?: React.ReactNode
  children: React.ReactNode
}

export default function AppShell({ name, role, signOutSlot, children }: Props) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <Topbar name={name} role={role} signOutSlot={signOutSlot} />
        <main className="app-content">{children}</main>
      </div>
    </div>
  )
}
