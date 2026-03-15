/**
 * Parwest AI — Entity Extractor
 *
 * Uses compromise.js (NLP) + regex to pull typed entities from OCR text:
 *   Person names, Dates, Phone numbers, ID numbers, Organizations, Addresses
 *
 * compromise.js is loaded LAZILY (dynamic import) so it never blocks
 * the initial page load. The ~230KB bundle only downloads when OCR
 * results are ready to classify.
 *
 * Safe for concurrent calls — each call creates its own nlp instance.
 */

import type { DocType } from "./document-classifier"

export interface ExtractedEntities {
    /** Person name candidates, ordered by position in document */
    persons: Array<{ text: string; position: number }>
    /** Dates found, normalised to YYYY-MM-DD where possible */
    dates:   Array<{ raw: string; iso: string | null; position: number }>
    /** Phone numbers found */
    phones:  Array<{ raw: string; position: number }>
    /** ID / reference numbers (CNIC, passport, roll no, account no) */
    ids:     Array<{ raw: string; type: string; position: number }>
    /** Organisation / institution names */
    orgs:    Array<{ text: string; position: number }>
    /** Address candidates */
    addresses: Array<{ text: string; position: number }>
    /** Key-value pairs found near labels (Label → Value on same/next line) */
    labeledValues: Map<string, string>
}

// ── Date normalisation ────────────────────────────────────────────────────────
function toIsoDate(raw: string): string | null {
    raw = raw.trim()
    let m = raw.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/)
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`
    m = raw.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/)
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`
    // "01 January 2000"
    const MONTHS: Record<string, string> = {
        january:"01",february:"02",march:"03",april:"04",may:"05",june:"06",
        july:"07",august:"08",september:"09",october:"10",november:"11",december:"12",
        jan:"01",feb:"02",mar:"03",apr:"04",jun:"06",jul:"07",aug:"08",
        sep:"09",oct:"10",nov:"11",dec:"12",
    }
    m = raw.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/)
    if (m && MONTHS[m[2].toLowerCase()]) {
        return `${m[3]}-${MONTHS[m[2].toLowerCase()]}-${m[1].padStart(2, "0")}`
    }
    return null
}

/** True if string could be a person name (no digits, 2–6 words, alphabetic) */
function isNameLike(s: string): boolean {
    const words = s.trim().split(/\s+/)
    return (
        words.length >= 2 && words.length <= 6 &&
        words.every((w) => /^[A-Za-z.'-]{2,}$/.test(w)) &&
        s.length >= 4 && s.length <= 65
    )
}

/** Strip common OCR noise */
function clean(s: string): string {
    return s.replace(/[|\\_\[\]{}@#$%^*]/g, " ").replace(/\s{2,}/g, " ").trim()
}

// ── Label-value extraction (handles "Label: value" and "Label\nvalue") ───────
function extractLabeledValues(lines: string[]): Map<string, string> {
    const map = new Map<string, string>()

    // Known label keywords — normalised to lowercase key
    const LABEL_KEYS = [
        "name", "full name", "father name", "father's name", "husband name",
        "husband's name", "mother name", "mother's name", "s/o", "d/o", "h/o",
        "date of birth", "dob", "birth date",
        "date of issue", "issue date", "issued",
        "date of expiry", "expiry date", "expiry", "expires",
        "gender", "sex", "marital status",
        "religion", "nationality", "education", "qualification",
        "address", "permanent address", "current address", "residential address",
        "phone", "mobile", "contact", "contact no", "cell",
        "cnic", "nic", "id no", "identity no", "identity number",
        "designation", "position", "job title",
        "organization", "company", "employer",
        "joining date", "date of joining", "date of appointment",
        "salary", "blood group",
        "roll no", "roll number",
        "registration no", "registration number",
        "account no", "account number", "iban",
    ]

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        const lower = line.toLowerCase()

        for (const key of LABEL_KEYS) {
            // Inline: "Name: Muhammad Ali" or "Name  Muhammad Ali"
            if (lower.startsWith(key)) {
                const rest = line.slice(key.length).replace(/^[\s:|\-]+/, "").trim()
                if (rest.length >= 2) {
                    map.set(key, clean(rest))
                    break
                }
                // Next non-empty line contains value
                for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
                    const next = lines[j].trim()
                    if (next.length >= 2) {
                        map.set(key, clean(next))
                        break
                    }
                }
                break
            }
        }
    }

    return map
}

// ── Main extraction function ──────────────────────────────────────────────────
export async function extractEntities(
    ocrText: string,
    docType: DocType,
    onProgress?: (msg: string) => void
): Promise<ExtractedEntities> {

    const lines = ocrText.split(/\n/).map((l) => l.trim()).filter(Boolean)
    const flat  = ocrText.replace(/\n+/g, " ").replace(/\s{2,}/g, " ")

    onProgress?.("Analysing document structure…")

    // ── 1. Extract labeled key-value pairs (cheap, synchronous) ──────────────
    const labeledValues = extractLabeledValues(lines)

    // ── 2. Regex-based entity detection (synchronous, fast) ──────────────────
    const dates: ExtractedEntities["dates"] = []
    const DATE_RE = /\b(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{4}|\d{4}[.\-/]\d{2}[.\-/]\d{2}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\b/g
    let dm: RegExpExecArray | null
    while ((dm = DATE_RE.exec(flat)) !== null) {
        dates.push({ raw: dm[1], iso: toIsoDate(dm[1]), position: dm.index })
    }

    const phones: ExtractedEntities["phones"] = []
    const PHONE_RE = /\b((?:\+92|0092|03)\d{2}[\s\-]?\d{7,8})\b/g
    let pm: RegExpExecArray | null
    while ((pm = PHONE_RE.exec(flat)) !== null) {
        phones.push({ raw: pm[1], position: pm.index })
    }

    const ids: ExtractedEntities["ids"] = []
    // CNIC
    const cnicRe = /\b(\d{5}[-\s]\d{7}[-\s]\d|\d{13})\b/g
    let cm: RegExpExecArray | null
    while ((cm = cnicRe.exec(flat)) !== null) {
        ids.push({ raw: cm[1], type: "cnic", position: cm.index })
    }
    // Passport (P + letter + 7 digits)
    const ppRe = /\b([A-Z]{2}\d{7})\b/g
    let pp: RegExpExecArray | null
    while ((pp = ppRe.exec(flat)) !== null) {
        ids.push({ raw: pp[1], type: "passport", position: pp.index })
    }
    // Generic roll/registration numbers
    const rollRe = /(?:roll\s+no|reg(?:istration)?\s*no)[:\s]+([A-Z0-9\-]{4,20})/gi
    let rl: RegExpExecArray | null
    while ((rl = rollRe.exec(flat)) !== null) {
        ids.push({ raw: rl[1], type: "roll_no", position: rl.index })
    }

    // Addresses — look for house/street/sector patterns
    const addresses: ExtractedEntities["addresses"] = []
    const addrRe = /(?:house|h\.no|plot|street|road|avenue|block|sector|phase|village|mohalla)[^,\n]{5,80}/gi
    let ar: RegExpExecArray | null
    while ((ar = addrRe.exec(flat)) !== null) {
        addresses.push({ text: clean(ar[0]), position: ar.index })
    }
    // Also grab labeled address values
    const addrFromLabel = labeledValues.get("address")
        || labeledValues.get("permanent address")
        || labeledValues.get("current address")
        || labeledValues.get("residential address")
    if (addrFromLabel && addrFromLabel.length >= 10) {
        addresses.unshift({ text: addrFromLabel, position: -1 })
    }

    // ── 3. NLP Person/Org detection via compromise.js (lazy load) ────────────
    const persons: ExtractedEntities["persons"] = []
    const orgs:    ExtractedEntities["orgs"]    = []

    onProgress?.("Running name recognition…")

    try {
        // Dynamic import — only downloaded once, cached by browser
        const nlp = (await import("compromise")).default

        // Run NLP on the OCR text (compromise handles the heavy lifting)
        const doc = nlp(ocrText)

        // Extract person names
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        doc.people().forEach((person: any) => {
            const text = (person.text() as string).trim()
            if (isNameLike(text)) {
                const pos = ocrText.indexOf(text)
                persons.push({ text: clean(text), position: pos })
            }
        })

        // Extract organization names
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        doc.organizations().forEach((org: any) => {
            const text = (org.text() as string).trim()
            if (text.length >= 3) {
                const pos = ocrText.indexOf(text)
                orgs.push({ text: clean(text), position: pos })
            }
        })

    } catch {
        // If compromise fails to load (e.g., offline), fall back to ALL-CAPS heuristic
        // This ensures the system degrades gracefully instead of crashing
        for (const line of lines) {
            if (
                /^[A-Z][A-Z\s'.]{3,60}$/.test(line) &&
                isNameLike(line) &&
                !/(PAKISTAN|REPUBLIC|NATIONAL|IDENTITY|CARD|ISLAMIC|GOVERNMENT|AUTHORITY|NADRA|BOARD|UNIVERSITY|POLICE|HOSPITAL)/i.test(line)
            ) {
                persons.push({ text: line, position: ocrText.indexOf(line) })
            }
        }
    }

    // ── 4. Supplement persons from labeled values ─────────────────────────────
    const nameSources = [
        labeledValues.get("name") ?? labeledValues.get("full name"),
        labeledValues.get("father name") ?? labeledValues.get("father's name"),
        labeledValues.get("husband name") ?? labeledValues.get("husband's name"),
        labeledValues.get("mother name") ?? labeledValues.get("mother's name"),
        labeledValues.get("s/o"),
        labeledValues.get("d/o"),
        labeledValues.get("h/o"),
    ]
    for (const src of nameSources) {
        if (src && isNameLike(src) && !persons.some((p) => p.text.toLowerCase() === src.toLowerCase())) {
            persons.push({ text: src, position: ocrText.indexOf(src) })
        }
    }

    // Sort all positional arrays by position (document order)
    persons.sort((a, b) => a.position - b.position)
    dates.sort((a, b) => a.position - b.position)

    // Deduplicate persons (same text, different positions → keep first)
    const seenPersons = new Set<string>()
    const uniquePersons = persons.filter((p) => {
        const key = p.text.toLowerCase()
        if (seenPersons.has(key)) return false
        seenPersons.add(key)
        return true
    })

    onProgress?.("Mapping fields…")

    return {
        persons:       uniquePersons,
        dates,
        phones,
        ids,
        orgs,
        addresses,
        labeledValues,
    }
}
