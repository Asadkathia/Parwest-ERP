/**
 * Parwest AI – intelligent document field extractor.
 *
 * Strategy:
 *  1. Run Tesseract OCR → raw text lines
 *  2. Try label-above-value patterns (CNIC layout) AND inline label:value patterns
 *  3. Smart date assignment with conflict prevention
 *  4. Aggressive ALL-CAPS name block detection for Pakistani CNICs
 */

export type ParsedField = {
    field: string        // HTML form input name
    label: string        // human-readable label shown in preview
    value: string
    confidence: number   // 0–1
}

// ── utilities ─────────────────────────────────────────────────────────────────
function stripNoise(s: string): string {
    return s.replace(/[|\\_\[\]{}@#$%^&*]/g, " ").replace(/\s{2,}/g, " ").trim()
}

function titleCase(s: string): string {
    return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

function extract(text: string, patterns: RegExp[]): string | null {
    for (const p of patterns) {
        const m = text.match(p)
        if (m?.[1]) return stripNoise(m[1]).trim()
    }
    return null
}

/** Normalise any date variant → YYYY-MM-DD */
function toIsoDate(raw: string): string | null {
    raw = raw.trim()
    let m = raw.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/)
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`
    m = raw.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/)
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`
    return null
}

/** Normalise any CNIC variant → XXXXX-XXXXXXX-X */
function toCnic(raw: string): string | null {
    const digits = raw.replace(/\D/g, "")
    if (digits.length === 13)
        return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`
    if (/^\d{5}-\d{7}-\d$/.test(raw.trim())) return raw.trim()
    return null
}

/** Validate Pakistani phone number */
function toPhone(raw: string): string | null {
    const digits = raw.replace(/\D/g, "")
    if (digits.length === 11 && digits.startsWith("03"))
        return `+92-${digits.slice(1, 4)}-${digits.slice(4)}`
    const m = raw.match(/(\+92|0092)[- ]?(\d{3})[- ]?(\d{7})/)
    if (m) return `+92-${m[2]}-${m[3]}`
    return null
}

/** True if a string looks like a proper Pakistani name (2–5 words, letters only) */
function looksLikeName(s: string): boolean {
    const words = s.trim().split(/\s+/)
    return (
        words.length >= 2 &&
        words.length <= 6 &&
        words.every((w) => /^[A-Za-z.'-]{2,}$/.test(w)) &&
        s.length >= 4 &&
        s.length <= 60
    )
}

/**
 * Find the next non-empty line after a label line.
 * labelTest — regex that matches the LABEL line itself.
 * Returns the content of the NEXT meaningful line.
 */
function nextLineAfter(lines: string[], labelTest: RegExp): string | null {
    for (let i = 0; i < lines.length - 1; i++) {
        if (labelTest.test(lines[i].trim())) {
            for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
                const next = lines[j].trim()
                if (next.length >= 2) return next
            }
        }
    }
    return null
}

/**
 * Find a date (dd.mm.yyyy etc.) either:
 *  - inline on the same line as the label, OR
 *  - on the next non-empty line after the label
 */
function findDateNearLabel(lines: string[], labelTest: RegExp): string | null {
    const DATE_RE = /(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{4})/

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!labelTest.test(line)) continue

        // Check same line for an embedded date
        const sameLine = line.match(DATE_RE)
        if (sameLine) return sameLine[1]

        // Check next few lines
        for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
            const next = lines[j].trim()
            if (!next) continue
            const dm = next.match(DATE_RE)
            if (dm) return dm[1]
            // Stop if the next line is another label (not a date)
            if (/^[A-Z][a-z]/.test(next) && !DATE_RE.test(next)) break
        }
    }
    return null
}

// ── main extractor ────────────────────────────────────────────────────────────
export function parseCnicText(rawText: string): ParsedField[] {
    const lines = rawText.split(/\n/).map((l) => l.trim()).filter(Boolean)
    const flat  = rawText.replace(/\n+/g, " ").replace(/\s{2,}/g, " ")

    const results: ParsedField[] = []
    const usedDates = new Set<string>() // track dates already assigned

    function add(field: string, label: string, value: string | null, confidence: number) {
        if (value && value.length >= 2 && value !== "—") {
            results.push({ field, label, value, confidence })
        }
    }

    // ── CNIC Number ──────────────────────────────────────────────────────────
    const cnicRaw = extract(flat, [
        /(?:CNIC|NIC|Identity Card|Card No|Identification No)\s*[:#]?\s*(\d[\d\- ]{10,14}\d)/i,
        /\b(\d{5}[-\s]\d{7}[-\s]\d)\b/,
        /\b(\d{13})\b/,
    ])
    add("cnic", "CNIC #", cnicRaw ? toCnic(cnicRaw) : null, 0.94)

    // ── Full Name ────────────────────────────────────────────────────────────
    // Strategy A: next-line after "Name" label
    let nameVal: string | null = null
    const nameNextLine = nextLineAfter(lines, /^Name$/i)
    if (nameNextLine && looksLikeName(nameNextLine)) nameVal = nameNextLine

    // Strategy B: inline "Name: VALUE" or "Name VALUE"
    if (!nameVal) {
        nameVal = extract(flat, [
            /\bName\s*[:|]\s*([A-Z][A-Za-z\s]{2,50}?)(?:\s{2,}|Father|Date|$)/i,
            /(?:Full\s+Name|Holder\s+Name)\s*[:|]\s*([A-Za-z\s]{3,50})/i,
        ])
    }

    // Strategy C: ALL-CAPS name block detection
    // Pakistani CNICs: lines that are ALL CAPS 2-5 words = name fields
    // We collect candidates and assign first = name, second = father's name
    const allCapsNames: string[] = []
    for (const line of lines) {
        // Matches "MUHAMMAD ALI KHAN" style lines
        if (
            /^[A-Z][A-Z\s'.]{3,60}$/.test(line) &&
            looksLikeName(line) &&
            !/(PAKISTAN|REPUBLIC|NATIONAL|IDENTITY|CARD|ISLAMIC|GOVERNMENT|AUTHORITY|NADRA)/i.test(line)
        ) {
            allCapsNames.push(line)
        }
    }

    if (!nameVal && allCapsNames.length >= 1) nameVal = allCapsNames[0]

    if (nameVal && !/father|S\/O|D\/O|son of|daughter of|husband|H\/O/i.test(nameVal)) {
        add("name", "Full Name", titleCase(nameVal), 0.88)
    }

    // ── Father's / Husband's Name ─────────────────────────────────────────────
    let fatherVal: string | null = null

    // Strategy A: next-line after label
    const fatherNextLine = nextLineAfter(lines, /^(Father['s]*\s*Name|Father|S\/O|D\/O|Son\s+of|Daughter\s+of|Husband['s]*\s*Name|H\/O)$/i)
    if (fatherNextLine && looksLikeName(fatherNextLine)) fatherVal = fatherNextLine

    // Strategy B: inline patterns
    if (!fatherVal) {
        fatherVal = extract(flat, [
            /Father['s]*\s*Name\s*[:|]?\s*([A-Za-z\s]{3,50})/i,
            /(?:S\/O|SON OF|D\/O|DAUGHTER OF|H\/O|HUSBAND OF)\s*[:|]?\s*([A-Za-z\s]{3,50})/i,
            /Father\s*[:|]\s*([A-Za-z\s]{3,50})/i,
        ])
    }

    // Strategy C: second ALL-CAPS name block (if name was first block)
    if (!fatherVal && allCapsNames.length >= 2) {
        fatherVal = allCapsNames[1]
    }

    add("fatherName", "Father's Name", fatherVal ? titleCase(fatherVal) : null, 0.86)

    // ── Mother's Name ────────────────────────────────────────────────────────
    const motherNextLine = nextLineAfter(lines, /^Mother['s]*\s*Name$/i)
    const motherVal = (motherNextLine && looksLikeName(motherNextLine) ? motherNextLine : null)
        ?? extract(flat, [/Mother['s]*\s*Name\s*[:|]?\s*([A-Za-z\s]{3,50})/i])
    add("motherName", "Mother's Name", motherVal ? titleCase(motherVal) : null, 0.80)

    // ── Date of Birth ────────────────────────────────────────────────────────
    const dobRaw = findDateNearLabel(lines, /Date\s+of\s+Birth|DOB|Birth\s+Date|تاریخ\s*پیدائش/i)
    const dobIso = dobRaw ? toIsoDate(dobRaw) : null
    if (dobIso) { add("dateOfBirth", "Date of Birth", dobIso, 0.89); usedDates.add(dobIso) }

    // ── CNIC Issue Date ──────────────────────────────────────────────────────
    const issueRaw = findDateNearLabel(lines, /Date\s+of\s+Issue|Issue\s+Date|اجراء/i)
    const issueIso = issueRaw ? toIsoDate(issueRaw) : null
    if (issueIso) { add("cnicIssueDate", "CNIC Issue Date", issueIso, 0.83); usedDates.add(issueIso) }

    // ── CNIC Expiry Date ─────────────────────────────────────────────────────
    const expiryRaw = findDateNearLabel(lines, /Date\s+of\s+Expiry|Expiry\s+Date|Expiry|Expires|میعاد/i)
    const expiryIso = expiryRaw ? toIsoDate(expiryRaw) : null
    if (expiryIso) { add("cnicExpiryDate", "CNIC Expiry Date", expiryIso, 0.83); usedDates.add(expiryIso) }

    // ── Smart date fallback (ONLY for missing fields, NO duplicates) ──────────
    // Collect ALL unique dates from the document, remove already-assigned ones
    const allDatesFound = Array.from(
        flat.matchAll(/\b(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{4})\b/g)
    ).map((m) => toIsoDate(m[1])).filter(Boolean) as string[]

    const unusedDates = [...new Set(allDatesFound)].filter((d) => !usedDates.has(d)).sort()

    // DOB fallback: earliest unused date (person born earliest)
    if (!results.find((r) => r.field === "dateOfBirth") && unusedDates.length >= 1) {
        add("dateOfBirth", "Date of Birth", unusedDates[0], 0.65)
        usedDates.add(unusedDates[0])
    }

    // Issue date fallback: second earliest unused date
    if (!results.find((r) => r.field === "cnicIssueDate")) {
        const remaining = unusedDates.filter((d) => !usedDates.has(d))
        if (remaining.length >= 1) {
            add("cnicIssueDate", "CNIC Issue Date", remaining[0], 0.60)
            usedDates.add(remaining[0])
        }
    }

    // Expiry fallback: latest unused date
    if (!results.find((r) => r.field === "cnicExpiryDate")) {
        const remaining = unusedDates.filter((d) => !usedDates.has(d))
        if (remaining.length >= 1) {
            add("cnicExpiryDate", "CNIC Expiry Date", remaining[remaining.length - 1], 0.60)
        }
    }

    // ── Gender ───────────────────────────────────────────────────────────────
    const genderNextLine = nextLineAfter(lines, /^(Gender|Sex)$/i)
    const genderRaw = (genderNextLine && /^(Male|Female|M|F)$/i.test(genderNextLine) ? genderNextLine : null)
        ?? extract(flat, [/(?:Gender|Sex|صنف)\s*[:|]?\s*(Male|Female|M\b|F\b)/i])
    if (genderRaw) {
        add("gender", "Gender", /^F/i.test(genderRaw) ? "Female" : "Male", 0.82)
    }

    // ── Marital Status ───────────────────────────────────────────────────────
    const maritalRaw = extract(flat, [
        /(?:Marital\s+Status|Marital)\s*[:|]?\s*(Single|Married|Divorced|Widowed)/i,
    ])
    if (maritalRaw) add("maritalStatus", "Marital Status", maritalRaw.toLowerCase(), 0.79)

    // ── Religion ─────────────────────────────────────────────────────────────
    const religionRaw = extract(flat, [
        /(?:Religion|مذہب)\s*[:|]?\s*(Islam|Christianity|Hinduism|Other|Muslim|Christian|Hindu)/i,
    ])
    if (religionRaw) {
        const n = /muslim/i.test(religionRaw) ? "Islam"
            : /christian/i.test(religionRaw) ? "Christianity"
            : /hindu/i.test(religionRaw) ? "Hinduism"
            : religionRaw
        add("religion", "Religion", n, 0.78)
    }

    // ── Nationality ──────────────────────────────────────────────────────────
    const nationalityRaw = extract(flat, [/(?:Nationality|شہریت)\s*[:|]?\s*([A-Za-z\s]{3,30})/i])
    if (nationalityRaw) {
        add("nationality", "Nationality", titleCase(nationalityRaw), 0.76)
    } else if (/pakistan/i.test(flat)) {
        add("nationality", "Nationality", "Pakistani", 0.72)
    }

    // ── Education ────────────────────────────────────────────────────────────
    const eduRaw = extract(flat, [
        /(?:Education|Qualification|تعلیم)\s*[:|]?\s*(Matric|Intermediate|Graduate|Primary|Middle|B\.A|BSc|M\.A|Msc|Masters|Degree)/i,
    ])
    add("education", "Education", eduRaw ? titleCase(eduRaw) : null, 0.75)

    // ── Permanent Address ────────────────────────────────────────────────────
    const addrNextLine = nextLineAfter(lines, /^(Permanent\s+Address|Address|رہائش)$/i)
    const addrInline = extract(flat, [
        /(?:Permanent\s+Address|رہائش)\s*[:|]?\s*(.{15,100})/i,
        /(?:Address)\s*[:|]\s*(.{15,100})/i,
    ])
    const addrVal = (addrNextLine && addrNextLine.length >= 10 ? addrNextLine : null) ?? addrInline
    add("addressPermanent", "Permanent Address", addrVal ? stripNoise(addrVal) : null, 0.72)

    // ── Phone Number ─────────────────────────────────────────────────────────
    const phoneRaw = extract(flat, [
        /(?:Phone|Contact|Mobile|Tel|فون)\s*(?:No|Number|#)?\s*[:|]?\s*((?:\+92|0092|03)[\d\- ]{9,11})/i,
        /\b(03\d{2}[-\s]?\d{7})\b/,
    ])
    add("phone", "Phone Number", phoneRaw ? toPhone(phoneRaw) : null, 0.81)

    return results
}
