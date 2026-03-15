/**
 * Parwest AI — Field Mapper
 *
 * Takes the classified doc type + extracted entities and maps them
 * to the exact HTML form field names used across ALL Parwest forms.
 *
 * Each DocType has its own mapping strategy so the system knows
 * "for a CNIC: first person = name, second = fatherName"
 * vs "for an employment letter: person = name, org = previousEmployer"
 *
 * To add a new form or doc type: add/extend the MAPPING_STRATEGIES below.
 */

import type { DocType } from "./document-classifier"
import type { ExtractedEntities } from "./entity-extractor"

export type ParsedField = {
    field: string
    label: string
    value: string
    confidence: number
    source: string     // which signal produced this (for debugging / display)
}

// ── Normalisation helpers ─────────────────────────────────────────────────────
function titleCase(s: string) {
    return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

function normaliseCnic(raw: string): string | null {
    const digits = raw.replace(/\D/g, "")
    if (digits.length === 13)
        return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`
    if (/^\d{5}-\d{7}-\d$/.test(raw.trim())) return raw.trim()
    return null
}

function normalisePhone(raw: string): string | null {
    const digits = raw.replace(/\D/g, "")
    if (digits.length === 11 && digits.startsWith("03"))
        return `+92-${digits.slice(1, 4)}-${digits.slice(4)}`
    const m = raw.match(/(\+92|0092)[- ]?(\d{3})[- ]?(\d{7})/)
    if (m) return `+92-${m[2]}-${m[3]}`
    return null
}

// ── Strategy per document type ────────────────────────────────────────────────
type FieldResult = { field: string; label: string; value: string; confidence: number; source: string } | null

type FieldStrategy = (entities: ExtractedEntities) => FieldResult[]

const STRATEGIES: Partial<Record<DocType, FieldStrategy>> = {

    // ── CNIC ──────────────────────────────────────────────────────────────────
    cnic: (e) => {
        const out: FieldResult[] = []

        // CNIC number
        const cnicId = e.ids.find((id) => id.type === "cnic")
        if (cnicId) {
            const norm = normaliseCnic(cnicId.raw)
            if (norm) out.push({ field: "cnic", label: "CNIC #", value: norm, confidence: 0.95, source: "ID pattern" })
        }

        // Names — person[0] = applicant, person[1] = father/husband
        const persons = e.persons
        const labeledName   = e.labeledValues.get("name") ?? e.labeledValues.get("full name")
        const labeledFather = e.labeledValues.get("father name")
            ?? e.labeledValues.get("father's name")
            ?? e.labeledValues.get("s/o")
            ?? e.labeledValues.get("d/o")
            ?? e.labeledValues.get("h/o")
            ?? e.labeledValues.get("husband name")
            ?? e.labeledValues.get("husband's name")

        if (labeledName) {
            out.push({ field: "name", label: "Full Name", value: titleCase(labeledName), confidence: 0.92, source: "Label:Name" })
        } else if (persons[0]) {
            out.push({ field: "name", label: "Full Name", value: titleCase(persons[0].text), confidence: 0.82, source: "NER:Person[0]" })
        }

        if (labeledFather) {
            out.push({ field: "fatherName", label: "Father's Name", value: titleCase(labeledFather), confidence: 0.90, source: "Label:Father" })
        } else if (persons[1]) {
            out.push({ field: "fatherName", label: "Father's Name", value: titleCase(persons[1].text), confidence: 0.78, source: "NER:Person[1]" })
        }

        const labeledMother = e.labeledValues.get("mother name") ?? e.labeledValues.get("mother's name")
        if (labeledMother) {
            out.push({ field: "motherName", label: "Mother's Name", value: titleCase(labeledMother), confidence: 0.85, source: "Label:Mother" })
        }

        // Dates — assign by label first, then by sorted position
        const usedIso = new Set<string>()
        const datesByLabel = {
            dob:    e.labeledValues.get("date of birth") ?? e.labeledValues.get("dob") ?? e.labeledValues.get("birth date"),
            issue:  e.labeledValues.get("date of issue") ?? e.labeledValues.get("issue date") ?? e.labeledValues.get("issued"),
            expiry: e.labeledValues.get("date of expiry") ?? e.labeledValues.get("expiry date") ?? e.labeledValues.get("expiry"),
        }

        // Helper: push a date field
        function pushDate(field: string, label: string, raw: string | undefined, conf: number, src: string) {
            if (!raw) return
            // Try to normalise from labeled value (might already be YYYY-MM-DD)
            let iso = raw
            if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
                // Use dates array from entities
                const match = e.dates.find((d) => d.raw === raw || d.iso === raw)
                iso = match?.iso ?? raw
            }
            if (!iso || usedIso.has(iso)) return
            usedIso.add(iso)
            out.push({ field, label, value: iso, confidence: conf, source: src })
        }

        pushDate("dateOfBirth",   "Date of Birth",    datesByLabel.dob,    0.90, "Label:DOB")
        pushDate("cnicIssueDate", "CNIC Issue Date",  datesByLabel.issue,  0.85, "Label:Issue")
        pushDate("cnicExpiryDate","CNIC Expiry Date", datesByLabel.expiry, 0.85, "Label:Expiry")

        // Fallback: assign remaining dates by sorted order (oldest = DOB)
        if (!datesByLabel.dob || !datesByLabel.issue || !datesByLabel.expiry) {
            const remaining = e.dates
                .filter((d) => d.iso && !usedIso.has(d.iso))
                .sort((a, b) => (a.iso ?? "").localeCompare(b.iso ?? ""))

            if (!out.find((x) => x?.field === "dateOfBirth") && remaining[0]) {
                pushDate("dateOfBirth",   "Date of Birth",    remaining[0].iso ?? remaining[0].raw, 0.65, "Fallback:DOB")
            }
            if (!out.find((x) => x?.field === "cnicIssueDate") && remaining.length >= 2) {
                const sorted = remaining.filter((d) => !usedIso.has(d.iso ?? ""))
                if (sorted[0]) pushDate("cnicIssueDate", "CNIC Issue Date", sorted[0].iso ?? sorted[0].raw, 0.58, "Fallback:Issue")
            }
            if (!out.find((x) => x?.field === "cnicExpiryDate") && remaining.length >= 2) {
                const sorted = remaining.filter((d) => !usedIso.has(d.iso ?? ""))
                const last = sorted[sorted.length - 1]
                if (last) pushDate("cnicExpiryDate", "CNIC Expiry Date", last.iso ?? last.raw, 0.58, "Fallback:Expiry")
            }
        }

        // Gender
        const genderVal = e.labeledValues.get("gender") ?? e.labeledValues.get("sex")
        if (genderVal) {
            out.push({ field: "gender", label: "Gender", value: /^F/i.test(genderVal) ? "Female" : "Male", confidence: 0.85, source: "Label:Gender" })
        }

        // Nationality
        const natVal = e.labeledValues.get("nationality")
        if (natVal) {
            out.push({ field: "nationality", label: "Nationality", value: titleCase(natVal), confidence: 0.80, source: "Label:Nationality" })
        } else {
            out.push({ field: "nationality", label: "Nationality", value: "Pakistani", confidence: 0.72, source: "Default:Pakistan" })
        }

        // Phone
        if (e.phones[0]) {
            const norm = normalisePhone(e.phones[0].raw)
            if (norm) out.push({ field: "phone", label: "Phone Number", value: norm, confidence: 0.82, source: "PhonePattern" })
        }

        // Address
        if (e.addresses[0]) {
            out.push({ field: "addressPermanent", label: "Permanent Address", value: e.addresses[0].text, confidence: 0.72, source: "AddressPattern" })
        }

        return out
    },

    // ── Passport ──────────────────────────────────────────────────────────────
    passport: (e) => {
        const out: FieldResult[] = []

        const ppId = e.ids.find((id) => id.type === "passport")
        if (ppId) out.push({ field: "passportNo", label: "Passport #", value: ppId.raw, confidence: 0.95, source: "PassportPattern" })

        const lName = e.labeledValues.get("name") ?? e.labeledValues.get("full name")
        if (lName) {
            out.push({ field: "name", label: "Full Name", value: titleCase(lName), confidence: 0.92, source: "Label:Name" })
        } else if (e.persons[0]) {
            out.push({ field: "name", label: "Full Name", value: titleCase(e.persons[0].text), confidence: 0.80, source: "NER:Person" })
        }

        const lFather = e.labeledValues.get("father name") ?? e.labeledValues.get("father's name")
        if (lFather) out.push({ field: "fatherName", label: "Father's Name", value: titleCase(lFather), confidence: 0.88, source: "Label:Father" })

        const dob = e.labeledValues.get("date of birth") ?? e.labeledValues.get("dob")
        if (dob) out.push({ field: "dateOfBirth", label: "Date of Birth", value: dob, confidence: 0.90, source: "Label:DOB" })

        const expiry = e.labeledValues.get("date of expiry") ?? e.labeledValues.get("expiry")
        if (expiry) out.push({ field: "cnicExpiryDate", label: "Passport Expiry", value: expiry, confidence: 0.85, source: "Label:Expiry" })

        const nat = e.labeledValues.get("nationality")
        if (nat) out.push({ field: "nationality", label: "Nationality", value: titleCase(nat), confidence: 0.85, source: "Label:Nationality" })

        if (e.phones[0]) {
            const norm = normalisePhone(e.phones[0].raw)
            if (norm) out.push({ field: "phone", label: "Phone Number", value: norm, confidence: 0.80, source: "PhonePattern" })
        }

        return out
    },

    // ── Police Verification Certificate ───────────────────────────────────────
    police_verification: (e) => {
        const out: FieldResult[] = []

        const lName = e.labeledValues.get("name") ?? e.labeledValues.get("full name")
        if (lName) {
            out.push({ field: "name", label: "Full Name", value: titleCase(lName), confidence: 0.90, source: "Label:Name" })
        } else if (e.persons[0]) {
            out.push({ field: "name", label: "Full Name", value: titleCase(e.persons[0].text), confidence: 0.78, source: "NER:Person" })
        }

        const lFather = e.labeledValues.get("father name") ?? e.labeledValues.get("s/o") ?? e.labeledValues.get("father's name")
        if (lFather) out.push({ field: "fatherName", label: "Father's Name", value: titleCase(lFather), confidence: 0.85, source: "Label:Father" })

        const cnicId = e.ids.find((id) => id.type === "cnic")
        if (cnicId) {
            const norm = normaliseCnic(cnicId.raw)
            if (norm) out.push({ field: "cnic", label: "CNIC #", value: norm, confidence: 0.93, source: "ID:CNIC" })
        }

        const addr = e.labeledValues.get("address") ?? e.labeledValues.get("permanent address")
        if (addr) out.push({ field: "addressPermanent", label: "Permanent Address", value: addr, confidence: 0.78, source: "Label:Address" })
        else if (e.addresses[0]) out.push({ field: "addressPermanent", label: "Permanent Address", value: e.addresses[0].text, confidence: 0.65, source: "AddressPattern" })

        if (e.phones[0]) {
            const norm = normalisePhone(e.phones[0].raw)
            if (norm) out.push({ field: "phone", label: "Phone Number", value: norm, confidence: 0.80, source: "PhonePattern" })
        }

        return out
    },

    // ── Medical Certificate ───────────────────────────────────────────────────
    medical_certificate: (e) => {
        const out: FieldResult[] = []

        const lName = e.labeledValues.get("name") ?? e.labeledValues.get("full name")
        if (lName) {
            out.push({ field: "name", label: "Full Name", value: titleCase(lName), confidence: 0.88, source: "Label:Name" })
        } else if (e.persons[0]) {
            out.push({ field: "name", label: "Full Name", value: titleCase(e.persons[0].text), confidence: 0.72, source: "NER:Person" })
        }

        const cnicId = e.ids.find((id) => id.type === "cnic")
        if (cnicId) {
            const norm = normaliseCnic(cnicId.raw)
            if (norm) out.push({ field: "cnic", label: "CNIC #", value: norm, confidence: 0.93, source: "ID:CNIC" })
        }

        const bg = e.labeledValues.get("blood group")
        if (bg) out.push({ field: "bloodGroup", label: "Blood Group", value: bg.toUpperCase(), confidence: 0.85, source: "Label:BloodGroup" })

        if (e.phones[0]) {
            const norm = normalisePhone(e.phones[0].raw)
            if (norm) out.push({ field: "phone", label: "Phone Number", value: norm, confidence: 0.78, source: "PhonePattern" })
        }

        return out
    },

    // ── Education Certificate ─────────────────────────────────────────────────
    education_certificate: (e) => {
        const out: FieldResult[] = []

        const lName = e.labeledValues.get("name") ?? e.labeledValues.get("full name")
        if (lName) {
            out.push({ field: "name", label: "Full Name", value: titleCase(lName), confidence: 0.88, source: "Label:Name" })
        } else if (e.persons[0]) {
            out.push({ field: "name", label: "Full Name", value: titleCase(e.persons[0].text), confidence: 0.73, source: "NER:Person" })
        }

        const lFather = e.labeledValues.get("father name") ?? e.labeledValues.get("father's name") ?? e.labeledValues.get("s/o")
        if (lFather) out.push({ field: "fatherName", label: "Father's Name", value: titleCase(lFather), confidence: 0.83, source: "Label:Father" })

        const roll = e.ids.find((id) => id.type === "roll_no")
        if (roll) out.push({ field: "rollNo", label: "Roll Number", value: roll.raw, confidence: 0.88, source: "RollPattern" })

        const cnicId = e.ids.find((id) => id.type === "cnic")
        if (cnicId) {
            const norm = normaliseCnic(cnicId.raw)
            if (norm) out.push({ field: "cnic", label: "CNIC #", value: norm, confidence: 0.92, source: "ID:CNIC" })
        }

        // Education level from labeled values or org names
        const edu = e.labeledValues.get("qualification") ?? e.labeledValues.get("education")
        if (edu) out.push({ field: "education", label: "Education", value: titleCase(edu), confidence: 0.82, source: "Label:Education" })

        const inst = e.orgs[0]
        if (inst) out.push({ field: "educationInstitute", label: "Institute", value: inst.text, confidence: 0.72, source: "NER:Org" })

        return out
    },

    // ── Employment Letter ─────────────────────────────────────────────────────
    employment_letter: (e) => {
        const out: FieldResult[] = []

        const lName = e.labeledValues.get("name") ?? e.labeledValues.get("full name")
        if (lName) {
            out.push({ field: "name", label: "Full Name", value: titleCase(lName), confidence: 0.88, source: "Label:Name" })
        } else if (e.persons[0]) {
            out.push({ field: "name", label: "Full Name", value: titleCase(e.persons[0].text), confidence: 0.72, source: "NER:Person" })
        }

        const cnicId = e.ids.find((id) => id.type === "cnic")
        if (cnicId) {
            const norm = normaliseCnic(cnicId.raw)
            if (norm) out.push({ field: "cnic", label: "CNIC #", value: norm, confidence: 0.93, source: "ID:CNIC" })
        }

        const designation = e.labeledValues.get("designation") ?? e.labeledValues.get("position") ?? e.labeledValues.get("job title")
        if (designation) out.push({ field: "previousJobTitle", label: "Previous Designation", value: titleCase(designation), confidence: 0.82, source: "Label:Designation" })

        const employer = e.labeledValues.get("organization") ?? e.labeledValues.get("company") ?? e.labeledValues.get("employer")
        if (employer) {
            out.push({ field: "previousEmployer", label: "Previous Employer", value: employer, confidence: 0.80, source: "Label:Employer" })
        } else if (e.orgs[0]) {
            out.push({ field: "previousEmployer", label: "Previous Employer", value: e.orgs[0].text, confidence: 0.68, source: "NER:Org" })
        }

        const joining = e.labeledValues.get("joining date") ?? e.labeledValues.get("date of joining") ?? e.labeledValues.get("date of appointment")
        if (joining) out.push({ field: "previousEmploymentFrom", label: "Employment From", value: joining, confidence: 0.80, source: "Label:JoiningDate" })

        if (e.phones[0]) {
            const norm = normalisePhone(e.phones[0].raw)
            if (norm) out.push({ field: "phone", label: "Phone Number", value: norm, confidence: 0.78, source: "PhonePattern" })
        }

        return out
    },

    // ── Birth Certificate ─────────────────────────────────────────────────────
    birth_certificate: (e) => {
        const out: FieldResult[] = []

        const lName = e.labeledValues.get("name") ?? e.labeledValues.get("full name")
        if (lName) {
            out.push({ field: "name", label: "Full Name", value: titleCase(lName), confidence: 0.88, source: "Label:Name" })
        } else if (e.persons[0]) {
            out.push({ field: "name", label: "Full Name", value: titleCase(e.persons[0].text), confidence: 0.72, source: "NER:Person" })
        }

        const lFather = e.labeledValues.get("father name") ?? e.labeledValues.get("father's name")
        if (lFather) out.push({ field: "fatherName", label: "Father's Name", value: titleCase(lFather), confidence: 0.85, source: "Label:Father" })

        const lMother = e.labeledValues.get("mother name") ?? e.labeledValues.get("mother's name")
        if (lMother) out.push({ field: "motherName", label: "Mother's Name", value: titleCase(lMother), confidence: 0.83, source: "Label:Mother" })

        const dob = e.labeledValues.get("date of birth") ?? e.labeledValues.get("born on") ?? e.dates[0]?.iso
        if (dob) out.push({ field: "dateOfBirth", label: "Date of Birth", value: dob, confidence: 0.88, source: "DOB" })

        return out
    },

    // ── Domicile ──────────────────────────────────────────────────────────────
    domicile: (e) => {
        const out: FieldResult[] = []

        const lName = e.labeledValues.get("name") ?? e.labeledValues.get("full name")
        if (lName) {
            out.push({ field: "name", label: "Full Name", value: titleCase(lName), confidence: 0.88, source: "Label:Name" })
        } else if (e.persons[0]) {
            out.push({ field: "name", label: "Full Name", value: titleCase(e.persons[0].text), confidence: 0.72, source: "NER:Person" })
        }

        const lFather = e.labeledValues.get("father name") ?? e.labeledValues.get("s/o") ?? e.labeledValues.get("father's name")
        if (lFather) out.push({ field: "fatherName", label: "Father's Name", value: titleCase(lFather), confidence: 0.83, source: "Label:Father" })

        const cnicId = e.ids.find((id) => id.type === "cnic")
        if (cnicId) {
            const norm = normaliseCnic(cnicId.raw)
            if (norm) out.push({ field: "cnic", label: "CNIC #", value: norm, confidence: 0.93, source: "ID:CNIC" })
        }

        const addr = e.labeledValues.get("address") ?? e.labeledValues.get("permanent address") ?? e.addresses[0]?.text
        if (addr) out.push({ field: "addressPermanent", label: "Permanent Address", value: addr, confidence: 0.78, source: "Address" })

        return out
    },
}

// ── Generic fallback strategy (unknown doc type) ──────────────────────────────
function genericStrategy(e: ExtractedEntities): FieldResult[] {
    const out: FieldResult[] = []

    // Always try to get a name
    const lName = e.labeledValues.get("name") ?? e.labeledValues.get("full name")
    if (lName) {
        out.push({ field: "name", label: "Full Name", value: titleCase(lName), confidence: 0.80, source: "Label:Name" })
    } else if (e.persons[0]) {
        out.push({ field: "name", label: "Full Name", value: titleCase(e.persons[0].text), confidence: 0.65, source: "NER:Person" })
    }

    const lFather = e.labeledValues.get("father name") ?? e.labeledValues.get("father's name") ?? e.labeledValues.get("s/o")
    if (lFather) out.push({ field: "fatherName", label: "Father's Name", value: titleCase(lFather), confidence: 0.75, source: "Label:Father" })

    const cnicId = e.ids.find((id) => id.type === "cnic")
    if (cnicId) {
        const norm = normaliseCnic(cnicId.raw)
        if (norm) out.push({ field: "cnic", label: "CNIC #", value: norm, confidence: 0.92, source: "ID:CNIC" })
    }

    if (e.phones[0]) {
        const norm = normalisePhone(e.phones[0].raw)
        if (norm) out.push({ field: "phone", label: "Phone Number", value: norm, confidence: 0.75, source: "PhonePattern" })
    }

    if (e.addresses[0]) {
        out.push({ field: "addressPermanent", label: "Permanent Address", value: e.addresses[0].text, confidence: 0.60, source: "AddressPattern" })
    }

    return out
}

// ── Main mapper ───────────────────────────────────────────────────────────────
export function mapEntitiesToFields(
    docType: DocType,
    entities: ExtractedEntities,
): ParsedField[] {
    const strategy = STRATEGIES[docType] ?? genericStrategy
    const raw = strategy(entities)

    // Filter nulls, remove empty values, deduplicate by field (highest conf wins)
    const seen = new Map<string, ParsedField>()
    for (const item of raw) {
        if (!item || !item.value || item.value.trim().length < 2) continue
        const existing = seen.get(item.field)
        if (!existing || item.confidence > existing.confidence) {
            seen.set(item.field, item as ParsedField)
        }
    }

    return Array.from(seen.values()).sort((a, b) => b.confidence - a.confidence)
}
