/**
 * Parwest AI — Document Type Classifier
 *
 * Pure rule-based scoring, zero external dependencies, zero network calls.
 * Scores every document type against keyword/pattern signals in the OCR text
 * and returns the most likely type + a confidence level.
 *
 * Adding a new doc type: add a new entry to CLASSIFIERS below.
 */

export type DocType =
    | "cnic"
    | "passport"
    | "driving_license"
    | "police_verification"
    | "character_certificate"
    | "medical_certificate"
    | "education_certificate"
    | "employment_letter"
    | "bank_statement"
    | "birth_certificate"
    | "domicile"
    | "unknown"

export interface ClassificationResult {
    docType: DocType
    confidence: number   // 0–1
    label: string        // human-readable
    hints: string[]      // which signals fired
}

// ── Signal types ──────────────────────────────────────────────────────────────
interface Signal {
    pattern: RegExp
    weight: number
    hint: string
}

interface DocClassifier {
    type: DocType
    label: string
    signals: Signal[]
    /** Minimum score to be considered this type */
    threshold: number
}

// ── Classifier definitions ────────────────────────────────────────────────────
const CLASSIFIERS: DocClassifier[] = [
    {
        type: "cnic",
        label: "National ID Card (CNIC)",
        threshold: 3,
        signals: [
            { pattern: /national\s+identity\s+card/i,          weight: 5, hint: "NADRA header" },
            { pattern: /\b\d{5}-\d{7}-\d\b/,                   weight: 5, hint: "CNIC number format" },
            { pattern: /\b\d{13}\b/,                            weight: 3, hint: "13-digit number" },
            { pattern: /islamic\s+republic\s+of\s+pakistan/i,   weight: 2, hint: "Pakistan header" },
            { pattern: /NADRA/i,                                weight: 3, hint: "NADRA text" },
            { pattern: /date\s+of\s+issue/i,                   weight: 2, hint: "Issue date label" },
            { pattern: /date\s+of\s+expiry/i,                  weight: 2, hint: "Expiry date label" },
            { pattern: /date\s+of\s+birth/i,                   weight: 1, hint: "DOB label" },
            { pattern: /(?:S\/O|D\/O|H\/O|son\s+of|daughter\s+of)/i, weight: 3, hint: "Relation prefix" },
        ],
    },
    {
        type: "passport",
        label: "Passport",
        threshold: 3,
        signals: [
            { pattern: /passport/i,                            weight: 5, hint: "Passport keyword" },
            { pattern: /\bP[A-Z]{1}\d{7}\b/,                  weight: 5, hint: "Passport number format" },
            { pattern: /place\s+of\s+birth/i,                  weight: 3, hint: "Place of birth label" },
            { pattern: /nationality/i,                         weight: 1, hint: "Nationality label" },
            { pattern: /machine\s+readable|MRZ|MRZL/i,        weight: 4, hint: "MRZ zone" },
            { pattern: /date\s+of\s+issue|date\s+of\s+expiry/i, weight: 2, hint: "Date labels" },
            { pattern: /<<</,                                   weight: 4, hint: "MRZ delimiter" },
        ],
    },
    {
        type: "driving_license",
        label: "Driving License",
        threshold: 3,
        signals: [
            { pattern: /driving\s+licen[sc]e/i,                weight: 6, hint: "License keyword" },
            { pattern: /licen[sc]e\s+no/i,                     weight: 4, hint: "License number label" },
            { pattern: /vehicle\s+class|vehicle\s+type/i,      weight: 4, hint: "Vehicle class" },
            { pattern: /traffic\s+police/i,                    weight: 3, hint: "Traffic police" },
            { pattern: /blood\s+group/i,                       weight: 1, hint: "Blood group" },
        ],
    },
    {
        type: "police_verification",
        label: "Police Verification Certificate",
        threshold: 3,
        signals: [
            { pattern: /police\s+verification/i,               weight: 6, hint: "Police verification" },
            { pattern: /character\s+certificate/i,             weight: 3, hint: "Character cert" },
            { pattern: /station\s+house\s+officer|SHO/i,       weight: 4, hint: "SHO title" },
            { pattern: /no\s+criminal\s+record|no\s+FIR/i,    weight: 5, hint: "Clean record statement" },
            { pattern: /district\s+police/i,                   weight: 3, hint: "District police" },
            { pattern: /verified|verification/i,               weight: 2, hint: "Verification keyword" },
            { pattern: /police\s+station/i,                    weight: 3, hint: "Police station" },
        ],
    },
    {
        type: "character_certificate",
        label: "Character Certificate",
        threshold: 3,
        signals: [
            { pattern: /character\s+certificate/i,             weight: 6, hint: "Character cert header" },
            { pattern: /good\s+character|moral\s+character/i,  weight: 5, hint: "Character statement" },
            { pattern: /principal|headmaster|head\s+master/i,  weight: 3, hint: "Issuing authority" },
            { pattern: /certif(?:y|ied|icate)/i,               weight: 2, hint: "Certificate keyword" },
        ],
    },
    {
        type: "medical_certificate",
        label: "Medical / Health Certificate",
        threshold: 3,
        signals: [
            { pattern: /medical\s+certificate/i,               weight: 6, hint: "Medical cert header" },
            { pattern: /health\s+certificate/i,                weight: 5, hint: "Health cert header" },
            { pattern: /fitness\s+certificate/i,               weight: 5, hint: "Fitness cert" },
            { pattern: /doctor|physician|MBBS|M\.B\.B\.S/i,   weight: 3, hint: "Doctor credential" },
            { pattern: /blood\s+pressure|blood\s+group/i,      weight: 3, hint: "Medical data" },
            { pattern: /hospital|clinic/i,                     weight: 2, hint: "Medical facility" },
            { pattern: /medically\s+fit|physically\s+fit/i,   weight: 5, hint: "Fitness statement" },
            { pattern: /eyesight|vision/i,                     weight: 2, hint: "Eyesight check" },
        ],
    },
    {
        type: "education_certificate",
        label: "Educational Certificate / Degree",
        threshold: 3,
        signals: [
            { pattern: /board\s+of\s+(intermediate|secondary|education)/i, weight: 6, hint: "Education board" },
            { pattern: /university|college|institution/i,      weight: 3, hint: "Academic institution" },
            { pattern: /matric(?:ulation)?|intermediate|bachelor|master/i, weight: 4, hint: "Academic level" },
            { pattern: /roll\s+no|roll\s+number/i,             weight: 4, hint: "Roll number" },
            { pattern: /marks\s+obtained|total\s+marks/i,      weight: 5, hint: "Marks info" },
            { pattern: /degree|diploma|certificate/i,          weight: 2, hint: "Credential keyword" },
            { pattern: /pass(?:ed)?|division/i,                weight: 2, hint: "Result keyword" },
        ],
    },
    {
        type: "employment_letter",
        label: "Employment / Experience Letter",
        threshold: 3,
        signals: [
            { pattern: /experience\s+letter|employment\s+letter/i, weight: 6, hint: "Employment letter" },
            { pattern: /to\s+whom\s+it\s+may\s+concern/i,     weight: 4, hint: "Standard letter opener" },
            { pattern: /designation|job\s+title|position/i,   weight: 3, hint: "Job title" },
            { pattern: /salary|emoluments|remuneration/i,      weight: 3, hint: "Salary mention" },
            { pattern: /joining\s+date|date\s+of\s+joining/i, weight: 4, hint: "Joining date" },
            { pattern: /resignation|leaving|relieved/i,        weight: 3, hint: "Departure terms" },
            { pattern: /company|organization|firm|employer/i,  weight: 2, hint: "Employer entity" },
        ],
    },
    {
        type: "bank_statement",
        label: "Bank Statement / Document",
        threshold: 3,
        signals: [
            { pattern: /bank\s+statement/i,                    weight: 6, hint: "Bank statement header" },
            { pattern: /account\s+no|account\s+number/i,       weight: 4, hint: "Account number" },
            { pattern: /IBAN/i,                                 weight: 5, hint: "IBAN number" },
            { pattern: /debit|credit|balance/i,                weight: 3, hint: "Transaction terms" },
            { pattern: /branch\s+code|SWIFT/i,                 weight: 4, hint: "Bank codes" },
            { pattern: /HBL|MCB|UBL|ABL|NBP|Meezan|Faysal|Allied/i, weight: 3, hint: "Pakistani bank name" },
        ],
    },
    {
        type: "birth_certificate",
        label: "Birth Certificate",
        threshold: 3,
        signals: [
            { pattern: /birth\s+certificate/i,                 weight: 6, hint: "Birth cert header" },
            { pattern: /union\s+council|NADRA/i,               weight: 3, hint: "Issuing authority" },
            { pattern: /born\s+on|date\s+of\s+birth/i,        weight: 3, hint: "Birth date label" },
            { pattern: /mother['s]*\s+name|father['s]*\s+name/i, weight: 3, hint: "Parent names" },
            { pattern: /registration\s+no/i,                   weight: 2, hint: "Registration number" },
        ],
    },
    {
        type: "domicile",
        label: "Domicile Certificate",
        threshold: 3,
        signals: [
            { pattern: /domicile/i,                            weight: 8, hint: "Domicile keyword" },
            { pattern: /permanent\s+resident/i,                weight: 4, hint: "Residency statement" },
            { pattern: /district|tehsil|division/i,            weight: 2, hint: "Administrative area" },
            { pattern: /deputy\s+commissioner|DC\s+office/i,   weight: 4, hint: "DC office" },
        ],
    },
]

// ── Classifier engine ─────────────────────────────────────────────────────────
export function classifyDocument(ocrText: string): ClassificationResult {
    const scores: Array<{ classifier: DocClassifier; score: number; hints: string[] }> = []

    for (const clf of CLASSIFIERS) {
        let score = 0
        const hints: string[] = []

        for (const sig of clf.signals) {
            if (sig.pattern.test(ocrText)) {
                score += sig.weight
                hints.push(sig.hint)
            }
        }

        if (score >= clf.threshold) {
            scores.push({ classifier: clf, score, hints })
        }
    }

    if (scores.length === 0) {
        return { docType: "unknown", confidence: 0, label: "Unknown Document", hints: [] }
    }

    // Winner = highest score
    scores.sort((a, b) => b.score - a.score)
    const winner = scores[0]

    // Normalise score to 0–1 (max possible score per type)
    const maxPossible = winner.classifier.signals.reduce((s, sig) => s + sig.weight, 0)
    const confidence  = Math.min(winner.score / maxPossible, 1)

    return {
        docType:    winner.classifier.type,
        confidence: Math.round(confidence * 100) / 100,
        label:      winner.classifier.label,
        hints:      winner.hints,
    }
}
