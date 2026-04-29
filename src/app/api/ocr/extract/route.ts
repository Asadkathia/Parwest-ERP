import { NextRequest, NextResponse } from "next/server"
import sharp from "sharp"
import { auth } from "@/lib/auth"
import { badRequest, internalServerError, unauthorized } from "@/lib/api/response"

// ── Vision OCR — Gemini or OpenAI GPT-4o ────────────────────────────────────
// Set OCR_PROVIDER=openai OR OCR_PROVIDER=gemini in .env.local
// Defaults to whichever API key is available (prefers Gemini if both set).

type Provider = "gemini" | "openai" | "openrouter"

const PREFERRED_PROVIDER = (process.env.OCR_PROVIDER as Provider) || null
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash"
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o"
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "qwen/qwen2.5-vl-72b-instruct"
const DEBUG_OCR = process.env.OCR_DEBUG === "true"

const ALLOWED_FIELDS = [
    "name", "fatherName", "motherName", "husbandName",
    "cnic", "cnicIssueDate", "cnicExpiryDate",
    "dateOfBirth", "gender", "nationality", "bloodGroup", "maritalStatus", "religion",
    "phone", "email", "addressPermanent", "addressCurrent",
    "passportNumber", "passportIssueDate", "passportExpiryDate",
    "education", "educationInstitute",
    "previousEmployer", "previousJobTitle",
    "previousEmploymentFrom", "previousEmploymentTo",
] as const

const DOC_TYPES = [
    "cnic", "passport", "license", "education_certificate",
    "employment_letter", "experience_letter", "other",
] as const

const PROMPT = `You are an OCR assistant for a Pakistani security-services HR system. Extract structured data from the attached document image.

═══ GENERAL RULES ═══
- For NAMES, CNIC numbers, dates, gender: use only the LATIN/ENGLISH text on the card. Never transliterate names from Urdu.
- For ADDRESSES ONLY: Urdu text IS allowed as a source — transliterate place names and translate structural words to English (see ADDRESS section below).
- If a field is partially obscured, smudged, or you're guessing, set confidence BELOW 0.6.
- If a field is unreadable or absent, OMIT it from the array — never include empty/guessed values.
- Format CNIC as XXXXX-XXXXXXX-X (5-7-1 digits with dashes).
- Format phone numbers as +92-XXX-XXXXXXX.
- Format ALL dates as YYYY-MM-DD (ISO). Pakistani dates are usually DD.MM.YYYY (e.g. "18.09.2001" → "2001-09-18"). The month must be 01-12 and day 01-31 — if unsure, omit.
- Gender: exactly "Male" or "Female". A single letter "M" → "Male", "F" → "Female".
- Names in Title Case (e.g. "Muhammad Asad" not "MUHAMMAD ASAD").

═══ PAKISTANI CNIC (National Identity Card) ═══
The front of a Pakistani CNIC has this layout:
- Top: green header "PAKISTAN · ISLAMIC REPUBLIC OF PAKISTAN · National Identity Card"
- LEFT SIDE — labelled fields in this exact order:
  1. "Name" label → value directly below is the HOLDER's name → field "name"
  2. "Father Name" (or "Husband Name") label → value directly below → field "fatherName" (or "husbandName")
  3. "Gender" + "Country of Stay" row → gender letter + "Pakistan"
  4. "Identity Number" → the 13-digit CNIC → field "cnic"
  5. "Date of Birth" → field "dateOfBirth"
  6. "Date of Issue" → field "cnicIssueDate"
  7. "Date of Expiry" → field "cnicExpiryDate"
- RIGHT SIDE: holder's photograph and signature (ignore)

CRITICAL:
- The name UNDER the "Name" label is the holder → field "name".
- The name UNDER the "Father Name" label is the father → field "fatherName". NEVER confuse these.
- If you see multiple English names, the FIRST (topmost, under "Name") is the holder and the SECOND (under "Father Name") is the father. Do NOT split or truncate either name.
- Country of Stay "Pakistan" → set nationality to "Pakistani" (confidence 0.75).
- FRONT: extract name, fatherName, cnic, dateOfBirth, gender, cnicIssueDate, cnicExpiryDate, nationality.
- BACK: extract addresses ONLY.

═══ ADDRESSES (from back of CNIC, Urdu text) ═══
The back typically has TWO Urdu address blocks:
- TOP block "موجودہ پتہ" / "حالیہ پتہ" (current) → field "addressCurrent"
- BOTTOM block "مستقل پتہ" (permanent) → field "addressPermanent"
If only ONE block, use it for BOTH.

Transliteration & translation:
- PLACE NAMES: transliterate phonetically. لاہور→Lahore, کراچی→Karachi, فیصل آباد→Faisalabad, اسلام آباد→Islamabad, گلبرگ→Gulberg, ماڈل ٹاؤن→Model Town.
- STRUCTURAL WORDS: مکان نمبر→House #, گلی نمبر→Street #, محلہ→Mohalla, تحصیل→Tehsil, ضلع→District, سیکٹر→Sector, بلاک→Block.
- Urdu digits ۰۱۲۳۴۵۶۷۸۹ → Latin 0123456789.
- Output: single comma-separated line (e.g. "House #123, Street #4, Mohalla Sheikhupura, District Lahore").
- Uncertain transliteration → confidence ≤ 0.6.

═══ UNREADABLE FIELDS ═══
- If a field is genuinely unreadable (smudge, glare, missing), do NOT guess. OMIT the field from the array entirely, OR include it with value "" and confidence 0.
- Never fabricate values to fill the schema. A missing field is far better than a wrong one.

═══ OUTPUT SCHEMA ═══
Return ONLY a single valid JSON object with no markdown fences, no prose, no commentary, no leading/trailing text. Schema:
{
  "docType": "cnic" | "passport" | "license" | "education_certificate" | "employment_letter" | "experience_letter" | "other",
  "overallConfidence": number (0.0-1.0),
  "fields": [
    { "field": "<one of: ${ALLOWED_FIELDS.join(", ")}>", "value": "string", "confidence": number }
  ]
}

═══ EXAMPLE OUTPUT (one-shot reference) ═══
For a clear CNIC front showing holder "Muhammad Asad", father "Abdul Rauf", CNIC 35202-1234567-1, DOB 18.09.2001:
{
  "docType": "cnic",
  "overallConfidence": 0.93,
  "fields": [
    { "field": "name", "value": "Muhammad Asad", "confidence": 0.96 },
    { "field": "fatherName", "value": "Abdul Rauf", "confidence": 0.94 },
    { "field": "cnic", "value": "35202-1234567-1", "confidence": 0.98 },
    { "field": "dateOfBirth", "value": "2001-09-18", "confidence": 0.92 },
    { "field": "gender", "value": "Male", "confidence": 0.95 },
    { "field": "nationality", "value": "Pakistani", "confidence": 0.75 }
  ]
}
Return ONLY valid JSON.`

export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) return unauthorized()

        const body = await request.json()
        const imageBase64 = String(body?.imageBase64 || "").trim()
        if (!imageBase64) return badRequest("imageBase64 is required.")
        if (imageBase64.length > 10_000_000) {
            return badRequest("Image too large. Maximum 10 MB.")
        }

        const match = imageBase64.match(/^data:(image\/[a-z+]+);base64,(.+)$/i)
        let mimeType = match?.[1] || "image/png"
        let rawBase64 = match?.[2] || imageBase64

        // ── Server-side image preprocessing ─────────────────────────────────
        // Goals: bound token cost (downscale > 2048px) + boost OCR signal
        // (mild contrast + sharpening). On any failure, fall through to the
        // original image — preprocessing must never break the OCR flow.
        try {
            const preprocessed = await preprocessImage(rawBase64, mimeType)
            if (preprocessed) {
                rawBase64 = preprocessed.base64
                mimeType = preprocessed.mimeType
                if (DEBUG_OCR) console.log(`[OCR] Preprocessed: ${preprocessed.note}`)
            }
        } catch (e) {
            console.warn("[OCR] Preprocessing failed; using original:", e instanceof Error ? e.message : String(e))
        }

        // Decide which provider(s) to try
        const provider = pickProvider()
        if (!provider) {
            return internalServerError("No OCR provider configured. Set GEMINI_API_KEY or OPENAI_API_KEY in .env.local.")
        }

        if (DEBUG_OCR) console.log(`[OCR] Using provider: ${provider}`)

        // Build fallback chain: primary, then any other configured providers.
        const chain = buildFallbackChain(provider)
        if (DEBUG_OCR) console.log(`[OCR] Fallback chain:`, chain)

        let result: OCRResult | { error: string } = { error: "No providers attempted" }
        let actualProvider: Provider = provider

        for (const p of chain) {
            result = await callProvider(p, rawBase64, mimeType)
            actualProvider = p
            if (!("error" in result)) break

            const retriable = /\b(429|500|502|503|504|UNAVAILABLE|timeout|overload)/i.test(result.error)
            if (!retriable) break
            console.warn(`[OCR] ${p} failed (${result.error.slice(0, 80)}). Trying next provider…`)
        }

        if ("error" in result) {
            return NextResponse.json(
                { success: false, message: result.error, code: "PROVIDER_ERROR", provider: actualProvider },
                { status: 500 }
            )
        }

        // Post-process: reject malformed/hallucinated dates
        result.fields = result.fields.filter((f) => {
            const isDate = /Date$/.test(f.field) || f.field === "dateOfBirth"
            if (!isDate) return true
            const m = f.value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
            if (!m) { console.warn(`[OCR] Rejected malformed date for ${f.field}: ${f.value}`); return false }
            const mo = parseInt(m[2], 10), d = parseInt(m[3], 10)
            if (mo < 1 || mo > 12 || d < 1 || d > 31) {
                console.warn(`[OCR] Rejected invalid date for ${f.field}: ${f.value}`)
                return false
            }
            return true
        })

        return NextResponse.json({
            docType: result.docType,
            overallConfidence: result.overallConfidence,
            provider: actualProvider,
            fields: result.fields.map((f) => ({
                field: f.field,
                label: fieldLabel(f.field),
                value: f.value,
                confidence: f.confidence,
                source: providerLabel(actualProvider),
            })),
        })
    } catch (error) {
        console.error("[OCR] Top-level error:", error)
        return internalServerError("Failed to extract document fields.")
    }
}

// ── Image preprocessing ─────────────────────────────────────────────────────
// Downscales overly-large images (max 2048px on the long side), normalises
// (linear histogram stretch) and sharpens. Output is always JPEG (q=88) since
// JPEG is well-supported by every vision provider and shrinks token cost
// versus PNG. On error returns null and the caller falls back to the original.
const MAX_DIMENSION = 2048

async function preprocessImage(
    base64: string,
    mimeType: string,
): Promise<{ base64: string; mimeType: string; note: string } | null> {
    const buffer = Buffer.from(base64, "base64")
    if (buffer.length === 0) return null

    const pipeline = sharp(buffer, { failOn: "none" })
    const meta = await pipeline.metadata()
    const longSide = Math.max(meta.width || 0, meta.height || 0)
    if (longSide === 0) return null

    let chain = sharp(buffer, { failOn: "none" }).rotate() // honour EXIF orientation

    const resized = longSide > MAX_DIMENSION
    if (resized) {
        chain = chain.resize({
            width: (meta.width || 0) >= (meta.height || 0) ? MAX_DIMENSION : undefined,
            height: (meta.height || 0) > (meta.width || 0) ? MAX_DIMENSION : undefined,
            fit: "inside",
            withoutEnlargement: true,
        })
    }

    // Normalise (linear histogram stretch) + mild sharpen — improves OCR on
    // dim or low-contrast camera photos. Keep colour: CNIC fronts mix Urdu
    // and English, and provider models do better with the original colour.
    chain = chain.normalise().sharpen({ sigma: 0.6 })

    const out = await chain.jpeg({ quality: 88, mozjpeg: true }).toBuffer()
    const note = `${meta.width}x${meta.height} ${mimeType} ${buffer.length}B → ${MAX_DIMENSION}-cap jpeg ${out.length}B${resized ? " (resized)" : ""}`
    return {
        base64: out.toString("base64"),
        mimeType: "image/jpeg",
        note,
    }
}

// ── Provider selection ──────────────────────────────────────────────────────
function providerHasKey(p: Provider): boolean {
    if (p === "gemini") return !!process.env.GEMINI_API_KEY
    if (p === "openai") return !!process.env.OPENAI_API_KEY
    if (p === "openrouter") return !!process.env.OPENROUTER_API_KEY
    return false
}

function pickProvider(): Provider | null {
    if (PREFERRED_PROVIDER && providerHasKey(PREFERRED_PROVIDER)) return PREFERRED_PROVIDER
    // Auto-pick order: OpenRouter (Qwen) → Gemini → OpenAI
    // Qwen 2.5 VL is strong on Urdu/Arabic OCR; Gemini is fast; OpenAI is reliable
    const order: Provider[] = ["openrouter", "gemini", "openai"]
    return order.find(providerHasKey) || null
}

function buildFallbackChain(primary: Provider): Provider[] {
    const all: Provider[] = ["openrouter", "gemini", "openai"]
    const rest = all.filter((p) => p !== primary && providerHasKey(p))
    return [primary, ...rest]
}

function providerLabel(p: Provider): string {
    if (p === "openai") return "GPT-4o Vision"
    if (p === "openrouter") return `OpenRouter (${OPENROUTER_MODEL})`
    return "Gemini Vision"
}

async function callProvider(p: Provider, base64: string, mimeType: string): Promise<OCRResult | { error: string }> {
    try {
        if (p === "gemini") return await callGemini(base64, mimeType)
        if (p === "openai") return await callOpenAI(base64, mimeType)
        return await callOpenRouter(base64, mimeType)
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[OCR] ${p} threw:`, msg)
        // Return a retriable error string so the fallback chain kicks in
        return { error: `503 ${p} fetch failed: ${msg.slice(0, 200)}` }
    }
}

// 60-second per-provider timeout via AbortController
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 60_000): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
        return await fetch(url, { ...init, signal: controller.signal })
    } finally {
        clearTimeout(timer)
    }
}

type OCRResult = {
    docType: string
    overallConfidence: number
    fields: Array<{ field: string; value: string; confidence: number }>
}

// ── Gemini ──────────────────────────────────────────────────────────────────
async function callGemini(base64: string, mimeType: string): Promise<OCRResult | { error: string }> {
    const apiKey = process.env.GEMINI_API_KEY!
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`

    const res = await fetchWithTimeout(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mimeType, data: base64 } }] }],
            generationConfig: { response_mime_type: "application/json", temperature: 0.1 },
        }),
    }, 45_000)

    if (!res.ok) {
        const errText = await res.text().catch(() => "")
        console.error(`[OCR] Gemini ${res.status} (model: ${GEMINI_MODEL}):`, errText.slice(0, 500))
        return { error: `Gemini ${res.status}: ${errText.slice(0, 300)}` }
    }

    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return { error: "Gemini returned no content." }
    if (DEBUG_OCR) console.log("[OCR] Gemini raw:", text.slice(0, 1000))

    try {
        return JSON.parse(text) as OCRResult
    } catch {
        return { error: "Gemini returned invalid JSON." }
    }
}

// ── OpenAI GPT-4o Vision ────────────────────────────────────────────────────
async function callOpenAI(base64: string, mimeType: string): Promise<OCRResult | { error: string }> {
    const apiKey = process.env.OPENAI_API_KEY!
    const dataUrl = `data:${mimeType};base64,${base64}`

    const res = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: OPENAI_MODEL,
            temperature: 0.1,
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: PROMPT },
                        { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
                    ],
                },
            ],
        }),
    }, 60_000)

    if (!res.ok) {
        const errText = await res.text().catch(() => "")
        console.error(`[OCR] OpenAI ${res.status} (model: ${OPENAI_MODEL}):`, errText.slice(0, 500))
        return { error: `OpenAI ${res.status}: ${errText.slice(0, 300)}` }
    }

    const data = await res.json()
    const text = data?.choices?.[0]?.message?.content
    if (!text) return { error: "OpenAI returned no content." }
    if (DEBUG_OCR) console.log("[OCR] OpenAI raw:", text.slice(0, 1000))

    try {
        return JSON.parse(text) as OCRResult
    } catch {
        return { error: "OpenAI returned invalid JSON." }
    }
}

// ── OpenRouter (Qwen 2.5 VL and others) ─────────────────────────────────────
async function callOpenRouter(base64: string, mimeType: string): Promise<OCRResult | { error: string }> {
    const apiKey = process.env.OPENROUTER_API_KEY!
    const dataUrl = `data:${mimeType};base64,${base64}`

    const res = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "HTTP-Referer": "https://parwest-erp.local",
            "X-Title": "Parwest ERP",
        },
        body: JSON.stringify({
            model: OPENROUTER_MODEL,
            temperature: 0.1,
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: PROMPT },
                        { type: "image_url", image_url: { url: dataUrl } },
                    ],
                },
            ],
        }),
    }, 90_000)

    if (!res.ok) {
        const errText = await res.text().catch(() => "")
        console.error(`[OCR] OpenRouter ${res.status} (model: ${OPENROUTER_MODEL}):`, errText.slice(0, 500))
        return { error: `OpenRouter ${res.status}: ${errText.slice(0, 300)}` }
    }

    const data = await res.json()
    const text = data?.choices?.[0]?.message?.content
    if (!text) return { error: "OpenRouter returned no content." }
    if (DEBUG_OCR) console.log("[OCR] OpenRouter raw:", text.slice(0, 1000))

    // Qwen sometimes wraps JSON in ```json fences — strip those
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim()
    try {
        return JSON.parse(cleaned) as OCRResult
    } catch {
        return { error: "OpenRouter returned invalid JSON." }
    }
}

function fieldLabel(field: string): string {
    const labels: Record<string, string> = {
        name: "Full Name",
        fatherName: "Father's Name",
        motherName: "Mother's Name",
        husbandName: "Husband's Name",
        cnic: "CNIC #",
        cnicIssueDate: "CNIC Issue Date",
        cnicExpiryDate: "CNIC Expiry Date",
        dateOfBirth: "Date of Birth",
        gender: "Gender",
        nationality: "Nationality",
        bloodGroup: "Blood Group",
        maritalStatus: "Marital Status",
        religion: "Religion",
        phone: "Phone Number",
        email: "Email",
        addressPermanent: "Permanent Address",
        addressCurrent: "Current Address",
        passportNumber: "Passport Number",
        passportIssueDate: "Passport Issue Date",
        passportExpiryDate: "Passport Expiry Date",
        education: "Education",
        educationInstitute: "Institute",
        previousEmployer: "Previous Employer",
        previousJobTitle: "Previous Designation",
        previousEmploymentFrom: "Employment From",
        previousEmploymentTo: "Employment To",
    }
    return labels[field] || field
}

// Avoid unused var warnings for constants used only as type references
void DOC_TYPES
