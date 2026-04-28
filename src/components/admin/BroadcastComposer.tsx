"use client"

import { useState } from "react"
import { Button } from "@/components/shadcn/button"
import type { AudienceScope, BroadcastMessage } from "@/lib/admin/types"

type Props = {
  onCreate: (message: BroadcastMessage) => void
}

export default function BroadcastComposer({ onCreate }: Props) {
  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [audience, setAudience] = useState<AudienceScope>("ALL_USERS")
  const [audienceValue, setAudienceValue] = useState("")

  const submit = () => {
    if (!title.trim() || !message.trim()) return
    onCreate({
      id: `b-${crypto.randomUUID()}`,
      title: title.trim(),
      message: message.trim(),
      audience,
      audienceValue: audience === "ALL_USERS" ? null : audienceValue || null,
      createdBy: "Admin",
      createdAt: new Date().toISOString(),
    })
    setTitle("")
    setMessage("")
    setAudienceValue("")
  }

  return (
    <section className="ui-card p-4 space-y-3">
      <h3 className="text-sm font-semibold text-[var(--text)]">Broadcast Message</h3>
      <input className="ui-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
      <textarea className="ui-textarea" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message for users" />
      <div className="grid gap-3 md:grid-cols-2">
        <select className="ui-select" value={audience} onChange={(e) => setAudience(e.target.value as AudienceScope)}>
          <option value="ALL_USERS">All users</option>
          <option value="ROLE">Role</option>
          <option value="REGIONAL_OFFICE">Regional office</option>
        </select>
        <input className="ui-input" value={audienceValue} onChange={(e) => setAudienceValue(e.target.value)} placeholder="Role or office (optional)" />
      </div>
      <Button onClick={submit}>Send Broadcast</Button>
    </section>
  )
}
