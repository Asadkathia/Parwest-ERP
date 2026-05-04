import { z } from "zod"
import { registerReport } from "../../registry"
import type { ReportDefinition } from "../../types"

const params = z.object({
  prompt: z.string().min(3).max(500),
})

const definition: ReportDefinition<typeof params> = {
  key: "other.ai-summary",
  title: "AI report",
  description: "AI-generated narrative report; one row per generated paragraph.",
  category: "other",
  paramsSchema: params,
  columns: [
    { key: "section", label: "Section", type: "string", width: 18 },
    { key: "content", label: "Content", type: "string", width: 60 },
  ],
  async run({ prompt }) {
    // Existing endpoint (kept) returns a string narrative.
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"
    const res = await fetch(`${base}/api/reports/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    }).catch(() => null)
    if (!res || !res.ok) {
      return [{ section: "Error", content: "Unable to reach AI report endpoint." }]
    }
    const data = (await res.json().catch(() => null)) as { data?: { text?: string } } | null
    const text = data?.data?.text ?? ""
    const paragraphs = text.split(/\n{2,}/).filter(Boolean)
    return paragraphs.map((p, i) => ({
      section: `Section ${i + 1}`,
      content: p.trim(),
    }))
  },
}

registerReport(definition)
export default definition
