"use client"
import { useCallback, useEffect, useReducer } from "react"

export type DraftRow = {
  id: string
  rowNumber: number
  data: Record<string, unknown>
  errors: Array<{ row: number; field: string; message: string }>
  skipped: boolean
  dirty: boolean
}

export type DraftColumn = {
  key: string
  header: string
  label: string
  kind: "text" | "cnic" | "phone" | "date" | "number" | "enum" | "fk"
  required: boolean
  enumValues?: string[]
  fkOptions?: Array<{ value: string; label: string }>
  /** Display-only — editor renders this cell non-editable (e.g. joining date). */
  readOnly?: boolean
  /** Editor offers a "set for all rows" bulk control for this column (e.g. supervisor). */
  bulkApply?: boolean
}

export type DraftJobInfo = {
  id: string
  status: string
  module: string
  subModule?: string | null
  fileName: string | null
  expiresAt: string | null
  createdAt: string
}

type State = {
  loading: boolean
  error: string | null
  job: DraftJobInfo | null
  totals: { valid: number; errored: number; skipped: number; total: number }
  rowsByNumber: Map<number, DraftRow>
  columns: DraftColumn[]
}
type Action =
  | { type: "LOAD_START" }
  | { type: "LOAD_OK"; job: DraftJobInfo; totals: State["totals"]; columns: DraftColumn[] }
  | { type: "LOAD_FAIL"; message: string }
  | { type: "ROWS_LOADED"; rows: DraftRow[] }
  | { type: "ROW_PATCHED"; row: DraftRow; affected: Array<{ rowNumber: number; errors: DraftRow["errors"] }> }

function init(): State {
  return {
    loading: true, error: null, job: null,
    totals: { valid: 0, errored: 0, skipped: 0, total: 0 },
    rowsByNumber: new Map(), columns: [],
  }
}

function recomputeTotals(state: State): State {
  let valid = 0, errored = 0, skipped = 0
  for (const r of state.rowsByNumber.values()) {
    if (r.skipped) skipped += 1
    else if (r.errors.length > 0) errored += 1
    else valid += 1
  }
  return { ...state, totals: { valid, errored, skipped, total: state.rowsByNumber.size } }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "LOAD_START": return { ...state, loading: true, error: null }
    case "LOAD_OK":    return { ...state, loading: false, job: action.job, totals: action.totals, columns: action.columns }
    case "LOAD_FAIL":  return { ...state, loading: false, error: action.message }
    case "ROWS_LOADED": {
      const next = new Map(state.rowsByNumber)
      for (const r of action.rows) next.set(r.rowNumber, r)
      return recomputeTotals({ ...state, rowsByNumber: next })
    }
    case "ROW_PATCHED": {
      const next = new Map(state.rowsByNumber)
      next.set(action.row.rowNumber, action.row)
      for (const a of action.affected) {
        const existing = next.get(a.rowNumber)
        if (existing) next.set(a.rowNumber, { ...existing, errors: a.errors })
      }
      return recomputeTotals({ ...state, rowsByNumber: next })
    }
  }
}

export function useDraft(draftId: string) {
  const [state, dispatch] = useReducer(reducer, undefined, init)

  useEffect(() => {
    let cancelled = false
    async function load() {
      dispatch({ type: "LOAD_START" })
      try {
        const [head, rows] = await Promise.all([
          fetch(`/api/imports/drafts/${draftId}`).then((r) => r.json()),
          fetch(`/api/imports/drafts/${draftId}/rows?take=500`).then((r) => r.json()),
        ])
        if (cancelled) return
        if (!head?.success) {
          dispatch({ type: "LOAD_FAIL", message: head?.message ?? "Failed to load draft" })
          return
        }
        const job = head.data.job as DraftJobInfo
        const subQs = job.subModule ? `?sub=${encodeURIComponent(job.subModule)}` : ""
        const colsRes = await fetch(`/api/imports/${job.module}/columns${subQs}`).then((r) => r.json())
        if (cancelled) return
        dispatch({
          type: "LOAD_OK",
          job,
          totals: head.data.totals,
          columns: colsRes?.success ? (colsRes.data.columns ?? []) : [],
        })
        if (rows?.success) dispatch({ type: "ROWS_LOADED", rows: rows.data.rows })
      } catch (err) {
        if (!cancelled) dispatch({ type: "LOAD_FAIL", message: err instanceof Error ? err.message : "load failed" })
      }
    }
    load()
    return () => { cancelled = true }
  }, [draftId])

  const patchRow = useCallback(async (rowNumber: number, data: Record<string, unknown>) => {
    const res = await fetch(`/api/imports/drafts/${draftId}/rows/${rowNumber}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data }),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.message)
    dispatch({ type: "ROW_PATCHED", row: json.data.row, affected: json.data.affectedRows ?? [] })
    return json.data
  }, [draftId])

  const bulkPatch = useCallback(async (data: Record<string, unknown>) => {
    const res = await fetch(`/api/imports/drafts/${draftId}/rows`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data }),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.message)
    // The endpoint returns every row; replace the whole view in one dispatch.
    dispatch({ type: "ROWS_LOADED", rows: json.data.rows })
  }, [draftId])

  const setSkipped = useCallback(async (rowNumber: number, skipped: boolean) => {
    const res = await fetch(`/api/imports/drafts/${draftId}/rows/${rowNumber}/skip`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ skipped }),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.message)
    dispatch({ type: "ROW_PATCHED", row: json.data.row, affected: json.data.affectedRows ?? [] })
  }, [draftId])

  const finalize = useCallback(async () => {
    const res = await fetch(`/api/imports/drafts/${draftId}/finalize`, { method: "POST" })
    const json = await res.json()
    return { status: res.status, payload: json }
  }, [draftId])

  const discard = useCallback(async () => {
    const res = await fetch(`/api/imports/drafts/${draftId}`, { method: "DELETE" })
    return res.ok
  }, [draftId])

  return { ...state, patchRow, bulkPatch, setSkipped, finalize, discard }
}
