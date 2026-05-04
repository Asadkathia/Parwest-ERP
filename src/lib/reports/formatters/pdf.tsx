import React from "react"
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer"
import type { ReportColumn, ReportResultRow } from "../types"

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 8.5, fontFamily: "Helvetica" },
  title: { fontSize: 14, marginBottom: 4 },
  subtitle: { fontSize: 9, color: "#555", marginBottom: 10 },
  pageMeta: {
    position: "absolute",
    bottom: 12,
    left: 24,
    right: 24,
    fontSize: 8,
    color: "#888",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderColor: "#ddd",
    paddingVertical: 3,
  },
  thRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#888",
    paddingVertical: 3,
    backgroundColor: "#f3f4f6",
  },
  th: { fontFamily: "Helvetica-Bold" },
  cell: { paddingHorizontal: 4 },
})

function formatCell(v: unknown, t: ReportColumn["type"]): string {
  if (v == null) return ""
  if (t === "date" && v instanceof Date) return v.toISOString().slice(0, 10)
  if (t === "currency" && typeof v === "number") {
    return v.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
  }
  if (t === "number" && typeof v === "number") return v.toLocaleString()
  if (t === "boolean") return v ? "Yes" : "No"
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v)
}

const ROWS_PER_PAGE = 32

export async function formatPdf(
  title: string,
  paramsSummary: string,
  columns: ReportColumn[],
  rows: ReportResultRow[]
): Promise<Buffer> {
  const widths = columns.map((c) => c.width ?? 80)
  const total = widths.reduce((a, b) => a + b, 0) || 1
  const pct = widths.map((w) => `${((w / total) * 100).toFixed(2)}%`)

  const pageGroups: ReportResultRow[][] = []
  if (rows.length === 0) {
    pageGroups.push([])
  } else {
    for (let i = 0; i < rows.length; i += ROWS_PER_PAGE) {
      pageGroups.push(rows.slice(i, i + ROWS_PER_PAGE))
    }
  }
  const totalPages = pageGroups.length
  const generatedAt = new Date().toISOString().replace("T", " ").slice(0, 19)

  const doc = (
    <Document>
      {pageGroups.map((group, pageIdx) => (
        <Page key={pageIdx} size="A4" orientation="landscape" style={styles.page}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>
            {paramsSummary || "All records"} · {rows.length.toLocaleString()} row
            {rows.length === 1 ? "" : "s"}
          </Text>
          <View style={styles.thRow}>
            {columns.map((c, i) => (
              <Text
                key={c.key}
                style={[
                  styles.cell,
                  styles.th,
                  { width: pct[i] as `${number}%` },
                  c.align === "right" ? { textAlign: "right" } : {},
                ]}
              >
                {c.label}
              </Text>
            ))}
          </View>
          {group.length === 0 ? (
            <Text style={{ marginTop: 12, color: "#888" }}>
              No matching records.
            </Text>
          ) : (
            group.map((r, idx) => (
              <View key={idx} style={styles.row} wrap={false}>
                {columns.map((c, i) => (
                  <Text
                    key={c.key}
                    style={[
                      styles.cell,
                      { width: pct[i] as `${number}%` },
                      c.align === "right" ? { textAlign: "right" } : {},
                    ]}
                  >
                    {formatCell(r[c.key], c.type)}
                  </Text>
                ))}
              </View>
            ))
          )}
          <View style={styles.pageMeta} fixed>
            <Text>Generated {generatedAt}</Text>
            <Text>
              Page {pageIdx + 1} of {totalPages}
            </Text>
          </View>
        </Page>
      ))}
    </Document>
  )
  const buf = await renderToBuffer(doc)
  return buf as Buffer
}
