"use client"

export type Envelope<T> = { success: true; data: T } | { success: false; message: string; code?: string }

export async function apiGet<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" })
  const payload = (await response.json().catch(() => null)) as Envelope<T> | T | null

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "success" in payload && payload.success === false
        ? payload.message
        : `Request failed (${response.status})`
    throw new Error(message)
  }

  if (payload && typeof payload === "object" && "success" in payload) {
    if (payload.success) return payload.data
    throw new Error(payload.message)
  }

  return payload as T
}

export async function apiSend<T>(url: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body == null ? undefined : JSON.stringify(body),
  })

  const payload = (await response.json().catch(() => null)) as Envelope<T> | T | null

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "success" in payload && payload.success === false
        ? payload.message
        : `Request failed (${response.status})`
    throw new Error(message)
  }

  if (payload && typeof payload === "object" && "success" in payload) {
    if (payload.success) return payload.data
    throw new Error(payload.message)
  }

  return payload as T
}
