"use client"

import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { Bot, Plus, Send, Sparkles, User } from "lucide-react"
import { cn } from "@/lib/utils"

type ChatMessage = {
  id: string
  role: "assistant" | "user"
  content: string
  timestamp: string
}

type ChatThread = {
  id: string
  title: string
  mode: "report" | "query"
  messages: ChatMessage[]
  updatedAt: string
}

const starterMessage: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "I am your AI assistant for ERP reporting and data queries. Ask for snapshots, trends, and operational counts in plain language.",
  timestamp: new Date().toISOString(),
}

export default function AiReportingScreen() {
  const [threads, setThreads] = useState<ChatThread[]>([
    {
      id: "thread-1",
      title: "New chat",
      mode: "report",
      messages: [starterMessage],
      updatedAt: new Date().toISOString(),
    },
  ])
  const [activeThreadId, setActiveThreadId] = useState("thread-1")
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const scrollAnchorRef = useRef<HTMLDivElement>(null)

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? threads[0],
    [threads, activeThreadId]
  )
  const mode = activeThread?.mode ?? "report"
  const messages = activeThread?.messages ?? [starterMessage]

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading])

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  const updateThread = (threadId: string, updater: (thread: ChatThread) => ChatThread) => {
    setThreads((prev) => prev.map((thread) => (thread.id === threadId ? updater(thread) : thread)))
  }

  const createThread = () => {
    const now = new Date().toISOString()
    const id = `thread-${crypto.randomUUID()}`
    const next: ChatThread = {
      id,
      title: "New chat",
      mode: "report",
      messages: [starterMessage],
      updatedAt: now,
    }
    setThreads((prev) => [next, ...prev])
    setActiveThreadId(id)
    setInput("")
    setError("")
  }

  const sendPrompt = async () => {
    const prompt = input.trim()
    if (!prompt || loading || !activeThread) return

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt,
      timestamp: new Date().toISOString(),
    }

    const nextTitle = activeThread.title === "New chat" ? prompt.slice(0, 36) : activeThread.title
    updateThread(activeThread.id, (thread) => ({
      ...thread,
      title: nextTitle,
      messages: [...thread.messages, userMsg],
      updatedAt: new Date().toISOString(),
    }))

    setInput("")
    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/reports/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, mode }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || "Failed to get AI response")

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: String(data.answer || "No response"),
        timestamp: String(data.timestamp || new Date().toISOString()),
      }

      updateThread(activeThread.id, (thread) => ({
        ...thread,
        messages: [...thread.messages, assistantMsg],
        updatedAt: new Date().toISOString(),
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get AI response")
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    await sendPrompt()
  }

  return (
    <div className="h-[calc(100vh-7.5rem)] min-h-[38rem] overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[#f7f9fc] shadow-[var(--shadow-sm)]">
      <div className="grid h-full grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden border-r border-[var(--border)] bg-[#f2f5fb] lg:flex lg:flex-col">
          <div className="p-3">
            <button
              type="button"
              onClick={createThread}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" />
              New chat
            </button>
          </div>

          <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            Recent
          </div>

          <div className="flex-1 space-y-1 overflow-y-auto px-2 pb-3">
            {threads.map((thread) => {
              const isActive = thread.id === activeThreadId
              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => {
                    setActiveThreadId(thread.id)
                    setError("")
                  }}
                  className={cn(
                    "w-full rounded-xl border px-3 py-2 text-left transition",
                    isActive
                      ? "border-[var(--brand)] bg-white shadow-[var(--shadow-xs)]"
                      : "border-transparent bg-transparent hover:border-[var(--border)] hover:bg-white"
                  )}
                >
                  <p className="truncate text-sm font-medium text-[var(--text)]">{thread.title}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {thread.mode === "report" ? "Report mode" : "Query mode"}
                  </p>
                </button>
              )
            })}
          </div>
        </aside>

        <section className="flex h-full flex-col bg-[var(--surface)]">
          <header className="border-b border-[var(--border)] bg-white px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--brand)] text-white">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h1 className="text-base font-semibold text-[var(--text)]">AI Chat</h1>
                  <p className="text-xs text-[var(--text-muted)]">
                    Reporting assistant for ERP insights and data queries
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-[#f7f9fc] p-1">
                <button
                  type="button"
                  onClick={() => updateThread(activeThread.id, (thread) => ({ ...thread, mode: "report" }))}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                    mode === "report" ? "bg-[var(--brand)] text-white" : "text-[var(--text-muted)] hover:text-[var(--text)]"
                  )}
                >
                  Report
                </button>
                <button
                  type="button"
                  onClick={() => updateThread(activeThread.id, (thread) => ({ ...thread, mode: "query" }))}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                    mode === "query" ? "bg-[var(--brand)] text-white" : "text-[var(--text-muted)] hover:text-[var(--text)]"
                  )}
                >
                  Query
                </button>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto bg-[#f8fafc] px-4 py-6 md:px-8">
            <div className="mx-auto w-full max-w-3xl space-y-6">
              {messages.map((msg) => (
                <div key={msg.id} className={cn("flex w-full", msg.role === "assistant" ? "justify-start" : "justify-end")}>
                  <div
                    className={cn(
                      "max-w-[92%] rounded-2xl border px-4 py-3 text-sm leading-6 shadow-[var(--shadow-xs)] whitespace-pre-wrap md:max-w-[85%]",
                      msg.role === "assistant"
                        ? "border-[var(--border)] bg-white text-[var(--text)]"
                        : "border-[var(--brand)] bg-[var(--brand)] text-white"
                    )}
                  >
                    <div className="mb-1.5 flex items-center gap-2 text-xs opacity-80">
                      {msg.role === "assistant" ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                      <span>{msg.role === "assistant" ? "Parwest AI" : "You"}</span>
                    </div>
                    <p>{msg.content}</p>
                  </div>
                </div>
              ))}

              {loading ? (
                <div className="flex justify-start">
                  <div className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--text-muted)]">
                    Thinking...
                  </div>
                </div>
              ) : null}

              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <div ref={scrollAnchorRef} />
            </div>
          </div>

          <footer className="border-t border-[var(--border)] bg-white px-4 py-3 md:px-8 md:py-4">
            <form onSubmit={onSubmit} className="mx-auto w-full max-w-3xl">
              <div className="rounded-2xl border border-[var(--border)] bg-[#f8fafc] p-2 shadow-[var(--shadow-xs)]">
                <textarea
                  className="h-24 w-full resize-none border-0 bg-transparent px-2 py-1 text-sm text-[var(--text)] outline-none"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    mode === "report"
                      ? "Ask for a report: e.g. monthly guard deployment summary by region"
                      : "Ask a data question: e.g. how many inactive guards do we have?"
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      void sendPrompt()
                    }
                  }}
                />
                <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] px-2 pt-2">
                  <p className="text-xs text-[var(--text-muted)]">
                    {mode === "report" ? "Report mode" : "Query mode"} • Shift+Enter for new line
                  </p>
                  <button
                    type="submit"
                    disabled={!canSend}
                    className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    Send
                  </button>
                </div>
              </div>
            </form>
          </footer>
        </section>
      </div>
    </div>
  )
}
