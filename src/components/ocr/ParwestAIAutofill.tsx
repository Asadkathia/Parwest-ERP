"use client"

import { useState, useRef, useCallback } from "react"
import {
    Sparkles, Upload, CheckCircle, XCircle, RefreshCw,
    ChevronDown, ChevronUp, Zap, FileText, Image as ImageIcon, AlertCircle, Tag,
} from "lucide-react"
import { classifyDocument, type ClassificationResult } from "@/lib/ocr/document-classifier"
import { extractEntities } from "@/lib/ocr/entity-extractor"
import { mapEntitiesToFields, type ParsedField } from "@/lib/ocr/field-mapper"

interface Props {
    onApply: (fields: Record<string, string>) => void
}

type FileStatus = "pending" | "processing" | "done" | "error"

interface FileJob {
    id: string
    file: File
    status: FileStatus
    progress: number
    progressLabel: string
    fields: ParsedField[]
    classification: ClassificationResult | null
    error: string
    preview: string | null
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ value }: { value: number }) {
    return (
        <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                    width: `${value}%`,
                    background: "linear-gradient(90deg,#6366f1,#8b5cf6,#a78bfa)",
                }}
            />
        </div>
    )
}

// ── Confidence pill ───────────────────────────────────────────────────────────
function ConfidencePill({ value }: { value: number }) {
    const pct = Math.round(value * 100)
    const color = pct >= 85 ? "#16a34a" : pct >= 65 ? "#d97706" : "#dc2626"
    return (
        <span
            className="ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
            style={{ color, background: `${color}18` }}
        >
            {pct}%
        </span>
    )
}

// ── Doc type badge ────────────────────────────────────────────────────────────
function DocTypeBadge({ result }: { result: ClassificationResult }) {
    const color = result.confidence >= 0.7 ? "bg-teal-100 text-teal-700 border-teal-200"
        : result.confidence >= 0.4 ? "bg-amber-100 text-amber-700 border-amber-200"
        : "bg-gray-100 text-gray-500 border-gray-200"
    return (
        <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${color}`}>
            <Tag className="h-2.5 w-2.5" />
            {result.label}
        </span>
    )
}

// ── File type icon ────────────────────────────────────────────────────────────
function FileIcon({ file }: { file: File }) {
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    return isPdf
        ? <FileText className="h-4 w-4 text-red-500 shrink-0" />
        : <ImageIcon className="h-4 w-4 text-blue-500 shrink-0" />
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: FileStatus }) {
    if (status === "pending")    return <span className="text-[10px] text-gray-400 font-medium">Queued</span>
    if (status === "processing") return <Zap className="h-3.5 w-3.5 animate-pulse text-violet-500" />
    if (status === "done")       return <CheckCircle className="h-3.5 w-3.5 text-green-500" />
    return <XCircle className="h-3.5 w-3.5 text-red-500" />
}

function uid() { return Math.random().toString(36).slice(2) }

/** Merge fields from multiple scans — highest confidence per field wins */
function mergeFields(allFields: ParsedField[][]): ParsedField[] {
    const best = new Map<string, ParsedField>()
    for (const fields of allFields) {
        for (const f of fields) {
            const existing = best.get(f.field)
            if (!existing || f.confidence > existing.confidence) {
                best.set(f.field, f)
            }
        }
    }
    return Array.from(best.values()).sort((a, b) => b.confidence - a.confidence)
}

export default function ParwestAIAutofill({ onApply }: Props) {
    const fileRef = useRef<HTMLInputElement>(null)
    const [jobs, setJobs] = useState<FileJob[]>([])
    const [mergedFields, setMergedFields] = useState<ParsedField[]>([])
    const [selected, setSelected] = useState<Record<string, boolean>>({})
    const [expanded, setExpanded] = useState(true)
    const [allDone, setAllDone] = useState(false)

    const isProcessing = jobs.some((j) => j.status === "processing" || j.status === "pending")

    const reset = () => {
        setJobs([])
        setMergedFields([])
        setSelected({})
        setAllDone(false)
        if (fileRef.current) fileRef.current.value = ""
    }

    const updateJob = useCallback((id: string, patch: Partial<FileJob>) => {
        setJobs((prev) => prev.map((j) => j.id === id ? { ...j, ...patch } : j))
    }, [])

    // ── File → image data URL ─────────────────────────────────────────────────
    const imageFileToDataUrl = (file: File): Promise<string> =>
        new Promise((res, rej) => {
            const reader = new FileReader()
            reader.onload  = () => res(reader.result as string)
            reader.onerror = () => rej(new Error("Failed to read file"))
            reader.readAsDataURL(file)
        })

    const pdfToImageDataUrl = async (
        file: File,
        onProgress: (label: string, pct: number) => void
    ): Promise<string> => {
        onProgress("Loading PDF renderer…", 10)
        const arrayBuffer = await file.arrayBuffer()
        const pdfjsLib = await import("pdfjs-dist/build/pdf.mjs")
        pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdn.jsdelivr.net/npm/pdfjs-dist@5/build/pdf.worker.min.mjs"
        onProgress("Parsing PDF…", 18)
        const pdf      = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        const page     = await pdf.getPage(1)
        const viewport = page.getViewport({ scale: 2.5 })
        const canvas   = document.createElement("canvas")
        canvas.width   = viewport.width
        canvas.height  = viewport.height
        const ctx = canvas.getContext("2d")!
        onProgress("Rendering PDF page…", 25)
        await page.render({ canvasContext: ctx, canvas, viewport }).promise
        onProgress("PDF rendered — starting OCR…", 32)
        return canvas.toDataURL("image/png")
    }

    // ── Full pipeline for one file ────────────────────────────────────────────
    const processFile = useCallback(async (job: FileJob): Promise<ParsedField[]> => {
        const { id, file } = job
        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")

        updateJob(id, { status: "processing", progress: 5, progressLabel: "Reading file…" })

        try {
            // ── Step 1: get image data URL ────────────────────────────────────
            let imageDataUrl: string
            if (isPdf) {
                imageDataUrl = await pdfToImageDataUrl(file, (label, pct) =>
                    updateJob(id, { progressLabel: label, progress: pct })
                )
                updateJob(id, { preview: imageDataUrl })
            } else {
                updateJob(id, { progressLabel: "Reading image…", progress: 12 })
                imageDataUrl = await imageFileToDataUrl(file)
                updateJob(id, { preview: imageDataUrl })
            }

            // ── Step 2: Try Gemini Vision (primary) ──────────────────────────
            try {
                updateJob(id, { progress: 35, progressLabel: "Analysing with AI vision…" })
                const llmRes = await fetch("/api/ocr/extract", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ imageBase64: imageDataUrl }),
                })
                if (llmRes.ok) {
                    const llm = await llmRes.json() as {
                        docType: string
                        overallConfidence: number
                        fields: ParsedField[]
                    }
                    if (Array.isArray(llm.fields) && llm.fields.length > 0) {
                        updateJob(id, {
                            progress: 100,
                            progressLabel: "Done",
                            status: "done",
                            fields: llm.fields,
                            classification: {
                                docType: llm.docType as ClassificationResult["docType"],
                                label: llm.docType.replace(/_/g, " ").toUpperCase(),
                                confidence: llm.overallConfidence,
                            } as ClassificationResult,
                        })
                        return llm.fields
                    }
                } else {
                    // Non-ok — log and fall back
                    console.warn("Gemini OCR failed, falling back to Tesseract")
                }
            } catch (err) {
                console.warn("Gemini OCR error, falling back to Tesseract:", err)
            }

            // ── Step 2b: Tesseract OCR (fallback) ────────────────────────────
            updateJob(id, { progress: 36, progressLabel: "Falling back to local OCR…" })
            const { createWorker } = await import("tesseract.js")
            const worker = await createWorker("eng", 1, {
                logger: (m: { status: string; progress: number }) => {
                    if (m.status === "loading tesseract core")
                        updateJob(id, { progress: 38, progressLabel: "Loading OCR engine…" })
                    else if (m.status === "loading language traineddata")
                        updateJob(id, { progress: 50, progressLabel: "Loading language model…" })
                    else if (m.status === "initializing api")
                        updateJob(id, { progress: 65, progressLabel: "Initialising scanner…" })
                    else if (m.status === "recognizing text")
                        updateJob(id, {
                            progress: 68 + Math.round(m.progress * 15),
                            progressLabel: `Scanning text… ${Math.round(m.progress * 100)}%`,
                        })
                },
                workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@7/dist/worker.min.js",
                langPath:   "https://tessdata.projectnaptha.com/4.0.0",
                corePath:   "https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core-simd-lstm.wasm.js",
            })

            updateJob(id, { progress: 83, progressLabel: "Extracting text…" })
            const { data } = await worker.recognize(imageDataUrl)
            await worker.terminate()

            const ocrText = data.text

            // ── Step 3: Classify document type ───────────────────────────────
            updateJob(id, { progress: 87, progressLabel: "Identifying document type…" })
            const classification = classifyDocument(ocrText)
            updateJob(id, { classification })

            // ── Step 4: Extract entities (NER + regex) ───────────────────────
            const entities = await extractEntities(
                ocrText,
                classification.docType,
                (msg) => updateJob(id, { progressLabel: msg, progress: 91 })
            )

            // ── Step 5: Map entities → form fields ───────────────────────────
            updateJob(id, { progress: 96, progressLabel: "Mapping form fields…" })
            const fields = mapEntitiesToFields(classification.docType, entities)

            if (fields.length === 0) {
                updateJob(id, {
                    status: "error",
                    error: `No fields found in this ${classification.label}. Try a clearer scan.`,
                })
                return []
            }

            updateJob(id, { status: "done", progress: 100, fields })
            return fields

        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            let friendly = `Processing failed: ${msg}`
            if (msg.toLowerCase().includes("password"))
                friendly = "PDF is password-protected."
            else if (msg.toLowerCase().includes("network"))
                friendly = "Network error — check internet connection."
            else if (msg.toLowerCase().includes("image"))
                friendly = "Could not process — use JPG, PNG, or unlocked PDF."
            updateJob(id, { status: "error", error: friendly })
            return []
        }
    }, [updateJob])

    // ── Run all jobs sequentially (prevents memory overload) ─────────────────
    const runAll = useCallback(async (newJobs: FileJob[]) => {
        const allResults: ParsedField[][] = []
        for (const job of newJobs) {
            const fields = await processFile(job)
            if (fields.length > 0) allResults.push(fields)
        }
        const merged = mergeFields(allResults)
        setMergedFields(merged)
        // ── Confidence gate: only auto-check fields ≥ 75% confidence ─────────
        // Lower-confidence fields are shown but require explicit user check
        setSelected(Object.fromEntries(merged.map((f) => [f.field, f.confidence >= 0.75])))
        setAllDone(true)
    }, [processFile])

    // ── Handle file selection ─────────────────────────────────────────────────
    const handleFiles = (files: File[]) => {
        const accepted = files.filter((f) =>
            f.type.startsWith("image/") ||
            f.type === "application/pdf" ||
            f.name.toLowerCase().endsWith(".pdf")
        )
        if (accepted.length === 0) return

        const newJobs: FileJob[] = accepted.map((file) => ({
            id: uid(), file,
            status: "pending", progress: 0, progressLabel: "Queued…",
            fields: [], classification: null, error: "",
            preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
        }))

        setJobs(newJobs)
        setMergedFields([])
        setSelected({})
        setAllDone(false)
        runAll(newJobs)
    }

    const handleApply = () => {
        const toApply = mergedFields
            .filter((f) => selected[f.field])
            .reduce<Record<string, string>>((acc, f) => { acc[f.field] = f.value; return acc }, {})
        onApply(toApply)
    }

    const toggleField = (field: string) =>
        setSelected((prev) => ({ ...prev, [field]: !prev[field] }))

    const anySelected = Object.values(selected).some(Boolean)
    const doneCount  = jobs.filter((j) => j.status === "done").length
    const errorCount = jobs.filter((j) => j.status === "error").length

    return (
        <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 overflow-hidden shadow-sm">
            {/* ── Header ── */}
            <button
                type="button"
                className="flex w-full items-center gap-3 px-5 py-4 text-left"
                onClick={() => setExpanded((v) => !v)}
            >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 shadow-sm">
                    <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-violet-900">Parwest AI Autofill</span>
                        <span className="rounded-full bg-violet-100 border border-violet-200 px-2 py-0.5 text-[10px] font-semibold text-violet-600 uppercase tracking-wide">
                            AI Powered
                        </span>
                    </div>
                    <p className="text-xs text-violet-500 mt-0.5">
                        Upload any document — CNIC, passport, certificates, letters
                    </p>
                </div>
                <div className="text-violet-400">
                    {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
            </button>

            {expanded && (
                <div className="border-t border-violet-100 px-5 pb-5 pt-4 space-y-4">

                    {/* ── Upload zone ── */}
                    {jobs.length === 0 && (
                        <div
                            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-violet-300 bg-white/70 py-8 text-center transition-colors hover:border-violet-500 hover:bg-violet-50"
                            onClick={() => fileRef.current?.click()}
                            onDrop={(e) => { e.preventDefault(); handleFiles(Array.from(e.dataTransfer.files)) }}
                            onDragOver={(e) => e.preventDefault()}
                        >
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100">
                                <Upload className="h-5 w-5 text-violet-600" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-violet-800">Drop any document here</p>
                                <p className="text-xs text-violet-400 mt-0.5">
                                    CNIC · Passport · Certificates · Letters · JPG · PNG · PDF
                                </p>
                            </div>
                            <span className="mt-1 rounded-lg bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white shadow">
                                Choose Files
                            </span>
                        </div>
                    )}

                    {/* ── File job list ── */}
                    {jobs.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-violet-700">
                                    {jobs.length} file{jobs.length !== 1 ? "s" : ""}
                                    {doneCount > 0 && ` · ${doneCount} scanned`}
                                    {errorCount > 0 && ` · ${errorCount} failed`}
                                </span>
                                {!isProcessing && (
                                    <button
                                        type="button"
                                        onClick={reset}
                                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
                                    >
                                        <RefreshCw className="h-3 w-3" /> New scan
                                    </button>
                                )}
                            </div>

                            {jobs.map((job) => (
                                <div
                                    key={job.id}
                                    className={`rounded-lg border px-3 py-2 space-y-1.5 ${
                                        job.status === "done"    ? "border-green-200 bg-green-50/50" :
                                        job.status === "error"   ? "border-red-200 bg-red-50/50" :
                                        job.status === "processing" ? "border-violet-200 bg-white" :
                                        "border-gray-200 bg-white/60"
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        {job.preview ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={job.preview} alt="preview"
                                                className="h-8 w-10 rounded object-cover border border-gray-200 shrink-0" />
                                        ) : (
                                            <div className="h-8 w-10 flex items-center justify-center rounded border border-gray-200 bg-gray-50 shrink-0">
                                                <FileIcon file={job.file} />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <FileIcon file={job.file} />
                                                <span className="text-xs font-medium text-gray-700 truncate max-w-[140px]">
                                                    {job.file.name}
                                                </span>
                                                <span className="text-[10px] text-gray-400 shrink-0">
                                                    ({(job.file.size / 1024).toFixed(0)} KB)
                                                </span>
                                                {job.classification && job.status === "done" && (
                                                    <DocTypeBadge result={job.classification} />
                                                )}
                                            </div>
                                            {job.status === "processing" && (
                                                <span className="text-[10px] text-violet-500">{job.progressLabel}</span>
                                            )}
                                            {job.status === "done" && (
                                                <span className="text-[10px] text-green-600">
                                                    {job.fields.length} field{job.fields.length !== 1 ? "s" : ""} extracted
                                                </span>
                                            )}
                                            {job.status === "error" && (
                                                <span className="text-[10px] text-red-500 flex items-center gap-0.5">
                                                    <AlertCircle className="h-3 w-3" /> {job.error}
                                                </span>
                                            )}
                                        </div>
                                        <StatusBadge status={job.status} />
                                    </div>
                                    {job.status === "processing" && <ProgressBar value={job.progress} />}
                                </div>
                            ))}

                            {!allDone && (
                                <button
                                    type="button"
                                    onClick={() => fileRef.current?.click()}
                                    disabled={isProcessing}
                                    className="w-full rounded-lg border-2 border-dashed border-violet-200 py-2 text-xs font-medium text-violet-500 hover:border-violet-400 hover:bg-violet-50 transition-colors disabled:opacity-40"
                                >
                                    + Add more files
                                </button>
                            )}
                        </div>
                    )}

                    {/* ── Merged Results ── */}
                    {allDone && mergedFields.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-semibold text-green-700">
                                <CheckCircle className="h-4 w-4" />
                                {mergedFields.length} field{mergedFields.length !== 1 ? "s" : ""} extracted
                                {jobs.length > 1 && (
                                    <span className="text-xs font-normal text-gray-400">
                                        — merged from {doneCount} document{doneCount !== 1 ? "s" : ""}
                                    </span>
                                )}
                            </div>

                            <div className="grid gap-1.5 sm:grid-cols-2">
                                {mergedFields.map((f) => {
                                    const lowConf = f.confidence < 0.75
                                    return (
                                        <label
                                            key={f.field}
                                            className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-xs transition-colors ${
                                                selected[f.field]
                                                    ? lowConf
                                                        ? "border-amber-300 bg-amber-50"
                                                        : "border-violet-300 bg-violet-50"
                                                    : lowConf
                                                        ? "border-amber-200 bg-white"
                                                        : "border-gray-200 bg-white opacity-60"
                                            }`}
                                            title={lowConf ? "Low confidence — please verify before applying" : undefined}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={!!selected[f.field]}
                                                onChange={() => toggleField(f.field)}
                                                className="accent-violet-600 shrink-0"
                                            />
                                            <div className="min-w-0 flex-1">
                                                <div className="font-semibold text-gray-600 truncate flex items-center gap-1">
                                                    {f.label}
                                                    {lowConf && <AlertCircle className="h-3 w-3 text-amber-600 shrink-0" />}
                                                </div>
                                                <div className="text-gray-500 truncate">{f.value}</div>
                                            </div>
                                            <ConfidencePill value={f.confidence} />
                                        </label>
                                    )
                                })}
                            </div>

                            <button
                                type="button"
                                onClick={handleApply}
                                disabled={!anySelected}
                                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 py-2.5 text-sm font-semibold text-white shadow-md transition-opacity disabled:opacity-40 hover:opacity-90"
                            >
                                <Sparkles className="h-4 w-4" />
                                Apply {Object.values(selected).filter(Boolean).length} Field{Object.values(selected).filter(Boolean).length !== 1 ? "s" : ""} to Form
                            </button>
                        </div>
                    )}

                    {allDone && mergedFields.length === 0 && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
                            <div className="flex items-center gap-2 text-amber-700 text-sm font-medium">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                No recognisable fields found
                            </div>
                            <p className="text-xs text-amber-600">
                                Try a clearer scan or a different document with visible text.
                            </p>
                            <button type="button" onClick={reset}
                                className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:underline">
                                <RefreshCw className="h-3 w-3" /> Try again
                            </button>
                        </div>
                    )}

                    <input
                        ref={fileRef} type="file" accept="image/*,.pdf" multiple className="hidden"
                        onChange={(e) => handleFiles(Array.from(e.target.files || []))}
                    />
                </div>
            )}
        </div>
    )
}
