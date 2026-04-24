"use client"

import { useState } from "react"
import Link from "next/link"
import StatusChip from "@/components/ui/status-chip"
import { Trash2 } from "lucide-react"

type UserRow = {
  id: string
  name: string
  email: string
  status: string
  lastLoginAt: string | null
  role: { name: string } | null
}

export default function UsersTable({
  initialUsers,
  isAdmin,
  canUpdate,
  canDelete,
}: {
  initialUsers: UserRow[]
  isAdmin: boolean
  canUpdate?: boolean
  canDelete?: boolean
}) {
  // Default to the legacy isAdmin gate for backward compatibility when capability props aren't passed.
  const showEdit = canUpdate ?? isAdmin
  const showDelete = canDelete ?? isAdmin
  const [users, setUsers] = useState(initialUsers)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState("")

  async function handleDelete(user: UserRow) {
    if (!confirm(`Delete user "${user.name}" (${user.email})? This cannot be undone.`)) return
    setDeleting(user.id)
    setError("")
    try {
      const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.message || "Failed to delete user.")
        return
      }
      setUsers((prev) => prev.filter((u) => u.id !== user.id))
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setDeleting(null)
    }
  }

  return (
    <section className="ui-card overflow-x-auto space-y-0">
      {error && (
        <div className="px-6 py-3 bg-red-50 border-b border-red-200 text-sm text-red-700">{error}</div>
      )}
      <table className="w-full min-w-[960px]">
        <thead className="bg-[var(--surface-muted)] border-b border-[var(--border)]">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Name</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Email</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Role</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Status</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Last Login</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {users.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-6 py-12 text-center text-[var(--text-muted)]">
                <p className="text-base font-medium text-[var(--text)]">No users found.</p>
              </td>
            </tr>
          ) : (
            users.map((user) => (
              <tr key={user.id} className="hover:bg-[var(--surface-muted)]">
                <td className="px-6 py-4 text-sm font-medium text-[var(--text)]">{user.name}</td>
                <td className="px-6 py-4 text-sm text-[var(--text)]">{user.email}</td>
                <td className="px-6 py-4 text-sm text-[var(--text)]">{user.role?.name || "—"}</td>
                <td className="px-6 py-4 text-sm">
                  <StatusChip label={user.status} variant={user.status === "ACTIVE" ? "success" : "warning"} />
                </td>
                <td className="px-6 py-4 text-sm text-[var(--text-muted)]">
                  {user.lastLoginAt
                    ? new Date(user.lastLoginAt).toLocaleString("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "Never"}
                </td>
                <td className="px-6 py-4 text-sm">
                  <div className="flex items-center gap-3">
                    <Link href={`/users/${user.id}`} className="text-[var(--brand)] hover:underline font-medium">
                      View
                    </Link>
                    {showEdit && (
                      <Link
                        href={`/users/${user.id}/edit`}
                        className="text-[var(--brand)] hover:underline font-medium"
                      >
                        Edit
                      </Link>
                    )}
                    {showDelete && (
                      <button
                        onClick={() => handleDelete(user)}
                        disabled={deleting === user.id}
                        className="text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors"
                        title="Delete user"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  )
}