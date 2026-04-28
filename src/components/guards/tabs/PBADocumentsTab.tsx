"use client"

import { useState } from "react"
import { FileText, Eye, Download, ShieldCheck } from "lucide-react"
import type { GuardTabModel } from "@/components/guards/tabs/types"

interface PBADocumentsTabProps {
    guard: GuardTabModel & { id?: string }
}

// ── escape HTML to prevent XSS ────────────────────────────────────────────────
function esc(v: unknown): string {
    if (v === null || v === undefined) return "—"
    return String(v)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
}

function fmtDate(d?: string | Date | null): string {
    if (!d) return "—"
    const parsed = d instanceof Date ? d : new Date(d)
    if (isNaN(parsed.getTime())) return "—"
    return parsed.toISOString().split("T")[0]
}

// ── SA-05 template ────────────────────────────────────────────────────────────
function generateSA05(guard: GuardTabModel & { id?: string }): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>PBA SA-05 — ${esc(guard.name)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #000; background: #f4f4f4; }
  .page {
    max-width: 800px; margin: 20px auto; background: #fff;
    padding: 30px 36px 24px; position: relative;
    box-shadow: 0 2px 12px rgba(0,0,0,.12);
  }
  .pba-ref {
    position: absolute; top: 20px; right: 36px;
    font-weight: bold; font-size: 11px;
    border: 1px solid #000; padding: 2px 8px;
  }
  table { width: 100%; border-collapse: collapse; }
  td, th { border: 1px solid #333; padding: 5px 9px; vertical-align: top; }
  .header-cell { text-align: center; font-weight: bold; padding: 7px; }
  .lbl { width: 46%; }
  .blue { color: #1d4ed8; }
  .red  { color: #dc2626; }
  .sec  { font-weight: bold; background: #1a1a1a; color: #fff; padding: 5px 9px; font-size: 11px; margin-top: 10px; }
  .gap  { height: 10px; border: none; }
  .guard-id { text-align: right; margin-top: 6px; font-size: 11px; font-weight: bold; }
  .print-bar {
    position: fixed; top: 0; left: 0; right: 0; z-index: 99;
    background: #1e40af; color: #fff; padding: 8px 20px;
    display: flex; align-items: center; justify-between;
    font-size: 13px; font-weight: 600; gap: 12px;
  }
  .print-bar span { flex: 1; }
  .print-bar button {
    background: #fff; color: #1e40af; border: none;
    padding: 5px 18px; border-radius: 5px; cursor: pointer;
    font-size: 13px; font-weight: 600;
  }
  .print-bar button:hover { background: #e0e7ff; }
  @media print {
    .print-bar { display: none !important; }
    body { background: #fff; }
    .page { margin: 0; box-shadow: none; padding: 20px 24px; }
  }
</style>
</head>
<body>
<div class="print-bar">
  <span>PBA SA-05 — ${esc(guard.name)}</span>
  <button onclick="window.print()">&#128438; Print / Save PDF</button>
</div>
<div style="height:44px"></div>
<div class="page">
  <div class="pba-ref">PBA-SA-05</div>

  <table>
    <tr>
      <td colspan="2" class="header-cell" style="font-size:13px; border-bottom:none; padding:10px 8px;">
        PARTICULARS &amp; DOCUMENTS OF GUARDS / SUPERVISORS
      </td>
    </tr>
    <tr>
      <td colspan="2" class="header-cell" style="border-top:none; padding:5px 8px;">
        FOR PBA RECORDS PURPOSES
      </td>
    </tr>
    <tr>
      <td class="lbl" style="font-weight:bold;">EMPLOYER SECURITY AGENCY</td>
      <td class="blue" style="font-weight:bold;">Parwest Pacific Security (Pvt.) Ltd.</td>
    </tr>
    <tr><td colspan="2" style="border:none;" class="gap"></td></tr>
    <tr>
      <td class="lbl">CNIC Number</td>
      <td class="blue">${esc(guard.cnic)}</td>
    </tr>
    <tr>
      <td>Name</td>
      <td class="blue">${esc(guard.name)}</td>
    </tr>
    <tr>
      <td>Father's Name</td>
      <td class="blue">${esc(guard.fatherName)}</td>
    </tr>
    <tr>
      <td>Date of Birth</td>
      <td class="blue">${fmtDate(guard.dateOfBirth)}</td>
    </tr>
    <tr><td colspan="2" style="border:none;" class="gap"></td></tr>
  </table>

  <div class="sec">Training Particulars (For Guards Training)</div>
  <table>
    <tr>
      <td class="lbl">Name of Training Institute</td>
      <td class="blue">APSAA Training School</td>
    </tr>
    <tr>
      <td>Training Period (Specific dates &nbsp; from - to)</td>
      <td><span class="red">One week mandatory training</span> &nbsp;&nbsp;&nbsp;&nbsp; To</td>
    </tr>
    <tr>
      <td>Name of Firing Range where last Firing Session Taken</td>
      <td class="blue">APSAA Training School</td>
    </tr>
    <tr>
      <td>Date of Firing Session:</td>
      <td></td>
    </tr>
  </table>

  <div class="sec">Medical Fitness Status</div>
  <table>
    <tr>
      <td class="lbl">Hospital / Clinic / Doctor Name</td>
      <td></td>
    </tr>
    <tr>
      <td>Checkup Date</td>
      <td></td>
    </tr>
    <tr>
      <td>Checkup Status (Fit / Unfit)</td>
      <td></td>
    </tr>
    <tr>
      <td>Comments</td>
      <td></td>
    </tr>
    <tr><td colspan="2" style="border:none;" class="gap"></td></tr>
  </table>

  <table style="margin-top:10px;">
    <tr>
      <td class="lbl" style="font-weight:bold;">Attachments:</td>
      <td></td>
    </tr>
    <tr>
      <td>CNIC Photocopy (both sides)</td>
      <td class="blue">Attached</td>
    </tr>
    <tr>
      <td>Photograph (Not more than 6 months old)</td>
      <td class="blue">Attached</td>
    </tr>
    <tr>
      <td colspan="2" style="height:64px; padding:8px 9px; vertical-align:bottom;">
        Signature &amp; Stamp of Security Agency
      </td>
    </tr>
  </table>

  <div class="guard-id">${esc(guard.parwestId)}</div>
</div>
</body>
</html>`
}

// ── SA-11 template ────────────────────────────────────────────────────────────
function generateSA11(guard: GuardTabModel & { id?: string }): string {
    const rels = guard.nearestRelatives ?? []
    const ref1 = rels[0] ?? {}
    const ref2 = rels[1] ?? {}

    const refRow = (
        ref: { name?: string; cnic?: string; relation?: string; address?: string; contact?: string },
        num: string
    ) => `
    <tr>
      <td class="lbl">Name of ${num} Reference</td>
      <td class="blue">${esc(ref.name)}</td>
    </tr>
    <tr>
      <td>CNIC Number</td>
      <td class="blue">${esc(ref.cnic)}</td>
    </tr>
    <tr>
      <td>Relationship</td>
      <td class="blue">${esc(ref.relation)}</td>
    </tr>
    <tr>
      <td>Address</td>
      <td class="blue">${esc(ref.address)}</td>
    </tr>
    <tr>
      <td>Phone Number</td>
      <td class="blue">${esc(ref.contact)}</td>
    </tr>`

    const verifRef = (
        ref: { name?: string; relation?: string },
        num: string
    ) => `
    <tr>
      <td>${num} REFERENCE</td>
      <td>${ref.name
        ? `<span class="blue">${esc(ref.name)}</span>&emsp;<span class="blue">${esc(ref.relation)}</span>&emsp;Through personal telephonic verification`
        : "—"
      }</td>
    </tr>`

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>PBA SA-11 — ${esc(guard.name)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 10.5px; color: #000; background: #f4f4f4; }
  .page {
    max-width: 800px; margin: 20px auto; background: #fff;
    padding: 30px 36px 24px; position: relative;
    box-shadow: 0 2px 12px rgba(0,0,0,.12);
  }
  .pba-ref {
    position: absolute; top: 20px; right: 36px;
    font-weight: bold; font-size: 11px;
    border: 1px solid #000; padding: 2px 8px;
  }
  table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  td { border: 1px solid #333; padding: 4px 9px; vertical-align: top; }
  .header-cell { text-align: center; font-weight: bold; padding: 6px; }
  .lbl { width: 42%; }
  .blue { color: #1d4ed8; }
  .sec-hdr {
    font-weight: bold; border: 1px solid #333; border-bottom: none;
    padding: 4px 9px; background: #f0f0f0; font-size: 11px;
    margin-top: 6px;
  }
  .note { font-size: 9px; font-style: italic; padding: 3px 9px; }
  .guard-id { text-align: right; margin-top: 6px; font-size: 11px; font-weight: bold; }
  .print-bar {
    position: fixed; top: 0; left: 0; right: 0; z-index: 99;
    background: #6d28d9; color: #fff; padding: 8px 20px;
    display: flex; align-items: center; justify-content: space-between;
    font-size: 13px; font-weight: 600;
  }
  .print-bar button {
    background: #fff; color: #6d28d9; border: none;
    padding: 5px 18px; border-radius: 5px; cursor: pointer;
    font-size: 13px; font-weight: 600;
  }
  .print-bar button:hover { background: #ede9fe; }
  @media print {
    .print-bar { display: none !important; }
    body { background: #fff; }
    .page { margin: 0; box-shadow: none; padding: 20px 24px; }
  }
</style>
</head>
<body>
<div class="print-bar">
  <span>PBA SA-11 — ${esc(guard.name)}</span>
  <button onclick="window.print()">&#128438; Print / Save PDF</button>
</div>
<div style="height:44px"></div>
<div class="page">
  <div class="pba-ref">PBA-SA-11</div>

  <table>
    <tr>
      <td colspan="2" class="header-cell" style="font-size:12px; border-bottom:none; padding:9px 8px;">
        VERIFICATION STATUS OF PARTICULARS OF GUARDS / SUPERVISORS
      </td>
    </tr>
    <tr>
      <td colspan="2" class="header-cell" style="border-top:none; padding:5px 8px;">
        FOR PBA RECORDS
      </td>
    </tr>
    <tr>
      <td class="lbl" style="font-weight:bold;">EMPLOYER SECURITY AGENCY</td>
      <td style="font-weight:bold;">PARWEST PACIFIC SECURITY(PVT.) LTD.</td>
    </tr>
    <tr>
      <td>CNIC Number</td>
      <td class="blue">${esc(guard.cnic)}</td>
    </tr>
    <tr>
      <td>Name</td>
      <td class="blue">${esc(guard.name)}</td>
    </tr>
    <tr>
      <td>Joining Date</td>
      <td class="blue">${fmtDate(guard.joiningDate)}</td>
    </tr>
    <tr>
      <td>Permanent Address</td>
      <td class="blue">${esc(guard.addressPermanent)}</td>
    </tr>
    <tr>
      <td>Phone Numbers</td>
      <td class="blue">${esc(guard.phone)}</td>
    </tr>
    <tr>
      <td>Residential Address</td>
      <td class="blue">${esc(guard.addressCurrent || guard.addressPermanent)}</td>
    </tr>
    <tr>
      <td>Phone Numbers</td>
      <td class="blue">${esc(guard.phone)}</td>
    </tr>
  </table>

  <!-- 1st Reference -->
  <table>${refRow(ref1, "1st")}</table>

  <!-- 2nd Reference -->
  <table>${refRow(ref2, "2nd")}</table>

  <!-- Employment History -->
  <table>
    <tr>
      <td class="lbl">Name of Last Employer</td>
      <td class="blue">No Employed Before</td>
    </tr>
    <tr><td>Joining Date &amp; Departure Date</td><td>-</td></tr>
    <tr><td>Employment Document Submitted</td><td>-</td></tr>

    <tr>
      <td>Name of 2nd Last Employer</td>
      <td class="blue">No Employed Before</td>
    </tr>
    <tr><td>Joining Date &amp; Departure Date</td><td>-</td></tr>
    <tr><td>Employment Document Submitted</td><td>-</td></tr>

    <tr>
      <td>Name of 3rd Last Employer</td>
      <td class="blue">No Employed Before</td>
    </tr>
    <tr><td>Joining Date &amp; Departure Date</td><td>-</td></tr>
    <tr><td>Employment Document Submitted</td><td>-</td></tr>

    <tr>
      <td colspan="2" class="note">
        (Where incumbent has had more than three employers in last 15 years, provide further information on extra sheet)
      </td>
    </tr>
  </table>

  <!-- Verification Status -->
  <div class="sec-hdr">VERIFICATION STATUS:</div>
  <table>
    <tr>
      <td class="lbl">CNIC</td>
      <td class="blue">Through NADRA Verisys</td>
    </tr>
    <tr>
      <td>PERMANENT ADDRESS &amp; PHONE</td>
      <td class="blue">Through Home Town Police Verification</td>
    </tr>
    <tr>
      <td>RESIDENTIAL ADDRESS &amp; PHONE</td>
      <td class="blue">Same as Above</td>
    </tr>
    ${verifRef(ref1, "1ST")}
    ${verifRef(ref2, "2ND")}
    <tr>
      <td>LAST EMPLOYMENT</td>
      <td class="blue">No Employed Before</td>
    </tr>
    <tr>
      <td>2ND LAST EMPLOYMENT</td>
      <td class="blue">No Employed Before</td>
    </tr>
    <tr>
      <td>3RD LAST EMPLOYMENT</td>
      <td class="blue">No Employed Before</td>
    </tr>
    <tr>
      <td>COMPANY SIGNATURE &amp; STAMP</td>
      <td style="height:54px;"></td>
    </tr>
  </table>

  <div class="guard-id">${esc(guard.parwestId)}</div>
</div>
</body>
</html>`
}

// ── SA-10 template ────────────────────────────────────────────────────────────
function generateSA10(guard: GuardTabModel & { id?: string }): string {
    const rels = guard.nearestRelatives ?? []
    const ref1 = rels[0] ?? {}
    const ref2 = rels[1] ?? {}

    const refBlock = (
        ref: { name?: string; cnic?: string; relation?: string; address?: string; contact?: string },
        num: string
    ) => `
    <tr>
      <td class="lbl">Name of ${num} Reference</td>
      <td class="blue">${esc(ref.name)}</td>
    </tr>
    <tr><td>CNIC Number</td><td class="blue">${esc(ref.cnic)}</td></tr>
    <tr><td>Relationship</td><td class="blue">${esc(ref.relation)}</td></tr>
    <tr><td>Address</td><td class="blue" style="min-height:36px;">${esc(ref.address)}</td></tr>
    <tr><td colspan="2" style="border:none;height:4px;"></td></tr>
    <tr><td>Phone Number</td><td class="blue">${esc(ref.contact)}</td></tr>`

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>PBA SA-10 — ${esc(guard.name)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 10.5px; color: #000; background: #f4f4f4; }
  .page {
    max-width: 800px; margin: 20px auto; background: #fff;
    padding: 30px 36px 24px; position: relative;
    box-shadow: 0 2px 12px rgba(0,0,0,.12);
  }
  .pba-ref {
    position: absolute; top: 20px; right: 36px;
    font-weight: bold; font-size: 11px;
    border: 1px solid #000; padding: 2px 8px;
  }
  table { width: 100%; border-collapse: collapse; margin-bottom: 3px; }
  td { border: 1px solid #333; padding: 4px 9px; vertical-align: top; }
  .header-cell { text-align: center; font-weight: bold; padding: 6px 8px; }
  .lbl { width: 42%; }
  .blue { color: #1d4ed8; }
  .sec-hdr {
    font-weight: bold; background: #1a1a1a; color: #fff;
    padding: 5px 9px; font-size: 11px; margin-top: 6px;
  }
  .conf-text { font-size: 10.5px; padding: 8px 9px; line-height: 1.5; border: 1px solid #333; border-top: none; }
  .sig-row { display: flex; gap: 24px; padding: 18px 9px 8px; font-size: 10.5px; border: 1px solid #333; border-top: none; }
  .sig-line { flex: 1; border-bottom: 1px solid #000; padding-bottom: 2px; }
  .guard-id { text-align: right; margin-top: 6px; font-size: 11px; font-weight: bold; }
  .print-bar {
    position: fixed; top: 0; left: 0; right: 0; z-index: 99;
    background: #047857; color: #fff; padding: 8px 20px;
    display: flex; align-items: center; justify-content: space-between;
    font-size: 13px; font-weight: 600;
  }
  .print-bar button {
    background: #fff; color: #047857; border: none;
    padding: 5px 18px; border-radius: 5px; cursor: pointer;
    font-size: 13px; font-weight: 600;
  }
  .print-bar button:hover { background: #d1fae5; }
  @media print {
    .print-bar { display: none !important; }
    body { background: #fff; }
    .page { margin: 0; box-shadow: none; padding: 20px 24px; }
  }
</style>
</head>
<body>
<div class="print-bar">
  <span>PBA SA-10 — ${esc(guard.name)}</span>
  <button onclick="window.print()">&#128438; Print / Save PDF</button>
</div>
<div style="height:44px"></div>
<div class="page">
  <div class="pba-ref">PBA-SA-10</div>

  <table>
    <tr>
      <td colspan="2" class="header-cell" style="font-size:11.5px; padding:8px;">
        PARTICULARS OF EX-SERVICEMEN (ARMED / PARA MILITARY FORCES) GUARDS / SUPERVISORS
      </td>
    </tr>
    <tr>
      <td class="lbl" style="font-weight:bold;">EMPLOYER SECURITY AGENCY</td>
      <td style="font-weight:bold;">Parwest Pacific Security(Pvt.) Ltd.</td>
    </tr>
    <tr><td colspan="2" style="border:none;height:6px;"></td></tr>
    <tr><td>CNIC Number</td><td class="blue">${esc(guard.cnic)}</td></tr>
    <tr><td>Name</td><td class="blue">${esc(guard.name)}</td></tr>
    <tr><td>Joining Date</td><td class="blue">${fmtDate(guard.joiningDate)}</td></tr>
    <tr>
      <td>Permanent Address</td>
      <td class="blue" style="min-height:40px;">${esc(guard.addressPermanent)}</td>
    </tr>
    <tr><td colspan="2" style="border:none;height:4px;"></td></tr>
    <tr><td>Phone Numbers</td><td class="blue">${esc(guard.phone)}</td></tr>
    <tr>
      <td>Residential Address</td>
      <td class="blue" style="min-height:40px;">${esc(guard.addressCurrent || guard.addressPermanent)}</td>
    </tr>
    <tr><td colspan="2" style="border:none;height:4px;"></td></tr>
    <tr><td>Phone Numbers</td><td class="blue">${esc(guard.phone)}</td></tr>
  </table>

  <!-- References -->
  <table>${refBlock(ref1, "1st")}</table>
  <table>${refBlock(ref2, "2nd")}</table>

  <!-- Armed Forces & Employment -->
  <table>
    <tr>
      <td class="lbl">Name of Armed Forces Unit Served</td>
      <td class="blue">${esc((guard as Record<string, unknown>).armedForcesUnit)}</td>
    </tr>
    <tr>
      <td>Joining Date &amp; Departure Date</td>
      <td class="blue">${esc((guard as Record<string, unknown>).armedForcesService)}</td>
    </tr>
    <tr>
      <td>Last Employer (other than Armed Forces)</td>
      <td></td>
    </tr>
    <tr><td>Joining Date &amp; Departure Date</td><td></td></tr>
    <tr>
      <td>2nd Last Employer (other than Armed Forces)</td>
      <td></td>
    </tr>
    <tr><td>Joining Date &amp; Departure Date</td><td></td></tr>
  </table>

  <!-- Confirmation -->
  <div class="sec-hdr">CONFIRMATION OF VERIFICATION OF CREDENTIALS</div>
  <div class="conf-text">
    We hereby confirm that verification of the above particulars have been completed by us from concerned/
    relevant departments/authorities/organizations/persons.
  </div>
  <div class="sig-row">
    <div style="font-weight:bold; min-width:220px;">COMPANY AUTHORIZED SIGNATURE</div>
    <div style="flex:1;">
      <div>Name <span class="sig-line">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></div>
      <div style="margin-top:10px;">Date <span class="sig-line">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></div>
    </div>
  </div>

  <div class="guard-id">MT-5141</div>
</div>
</body>
</html>`
}

// ── document card config ──────────────────────────────────────────────────────
/* eslint-disable no-restricted-syntax -- per-document-type accent palettes used as inline styles for PDF/print rendering; kept as discrete color tuples */
const PBA_DOCS = [
    {
        id: "SA05",
        title: "Particulars & Documents",
        subtitle: "Guards / Supervisors — PBA Records",
        accent: "#0d9488",
        accentLight: "#f0fdfa",
        accentBorder: "#99f6e4",
        iconBg: "#ccfbf1",
        visibility: "all" as const,
    },
    {
        id: "SA10",
        title: "Ex-Servicemen Particulars",
        subtitle: "Armed / Para Military Forces — PBA Records",
        accent: "#059669",
        accentLight: "#f0fdf4",
        accentBorder: "#a7f3d0",
        iconBg: "#d1fae5",
        visibility: "exservice" as const,   // only for ex-servicemen
    },
    {
        id: "SA11",
        title: "Verification Status",
        subtitle: "Guard Particulars — PBA Records",
        accent: "#7c3aed",
        accentLight: "#f5f3ff",
        accentBorder: "#ddd6fe",
        iconBg: "#ede9fe",
        visibility: "civilian" as const,    // only for civilians
    },
]
/* eslint-enable no-restricted-syntax */

// Determine if a guard is ex-service from any source
function isExServiceGuard(guard: GuardTabModel & { id?: string }): boolean {
    // Check new previousEmployments JSON
    const prevEmps = (guard as Record<string, unknown>).previousEmployments
    if (Array.isArray(prevEmps) && prevEmps.length > 0) {
        return prevEmps.some((e: Record<string, unknown>) => e.isExService === true)
    }
    // Fall back to legacy fields
    if (guard.isExService) return true
    if (guard.exServiceType && guard.exServiceType !== "CIVILIAN") return true
    return false
}

// ── main component ────────────────────────────────────────────────────────────
export default function PBADocumentsTab({ guard }: PBADocumentsTabProps) {
    const [loading, setLoading] = useState<string | null>(null)
    const exService = isExServiceGuard(guard)

    const openDoc = (docId: string, triggerPrint: boolean) => {
        let html = ""
        if (docId === "SA05") html = generateSA05(guard)
        else if (docId === "SA10") html = generateSA10(guard)
        else if (docId === "SA11") html = generateSA11(guard)
        else return

        setLoading(`${docId}-${triggerPrint ? "dl" : "view"}`)
        const blob = new Blob([html], { type: "text/html" })
        const url = URL.createObjectURL(blob)
        const w = window.open(url, "_blank", "width=940,height=740")
        if (!w) { URL.revokeObjectURL(url); setLoading(null); return }
        if (triggerPrint) {
            w.onload = () => { setTimeout(() => { w.print(); URL.revokeObjectURL(url) }, 400) }
        } else {
            setTimeout(() => URL.revokeObjectURL(url), 60_000)
        }
        setTimeout(() => setLoading(null), 800)
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">PBA Documents</h2>
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    PBA Compliance Documents
                </div>
            </div>

            {/* Guard type info banner */}
            <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
                exService
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-violet-200 bg-violet-50 text-violet-700"
            }`}>
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>
                    Guard type: <strong>{exService ? "Ex-Serviceman" : "Civilian"}</strong>.
                    {exService ? " SA-05 + SA-10 are applicable." : " SA-05 + SA-11 are applicable."}
                </span>
            </div>

            {/* Document cards */}
            <div className="grid gap-4 sm:grid-cols-3">
                {PBA_DOCS.map((doc) => {
                    // Visibility: all = always show; exservice = only ex-service; civilian = only civilian
                    if (doc.visibility === "exservice" && !exService) return null
                    if (doc.visibility === "civilian" && exService) return null

                    const isViewLoading = loading === `${doc.id}-view`
                    const isDlLoading   = loading === `${doc.id}-dl`

                    return (
                        <div
                            key={doc.id}
                            className="relative flex flex-col rounded-xl border bg-white overflow-hidden transition-shadow"
                            style={{
                                borderColor: doc.accentBorder,
                                boxShadow: `0 1px 8px 0 ${doc.accentBorder}88`,
                            }}
                        >
                            {/* Colour accent strip */}
                            <div className="h-1.5 w-full" style={{ background: doc.accent }} />

                            {/* Card body */}
                            <div className="flex flex-col gap-3 p-5">
                                {/* Icon + doc id */}
                                <div className="flex items-start justify-between">
                                    <div
                                        className="flex h-11 w-11 items-center justify-center rounded-xl"
                                        style={{ background: doc.iconBg }}
                                    >
                                        <FileText className="h-5 w-5" style={{ color: doc.accent }} />
                                    </div>
                                    <span
                                        className="rounded-md px-2 py-0.5 text-xs font-bold tracking-wide"
                                        style={{
                                            background: doc.accentLight,
                                            color: doc.accent,
                                            border: `1px solid ${doc.accentBorder}`,
                                        }}
                                    >
                                        PBA-{doc.id}
                                    </span>
                                </div>

                                {/* Title */}
                                <div>
                                    <p className="text-sm font-semibold text-gray-800 leading-snug">{doc.title}</p>
                                    <p className="mt-0.5 text-[11px] text-gray-400 leading-snug">{doc.subtitle}</p>
                                </div>

                                {/* Action buttons */}
                                <div className="flex gap-2 pt-1">
                                    <button
                                        onClick={() => openDoc(doc.id, false)}
                                        disabled={isViewLoading || isDlLoading}
                                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50"
                                        style={{ borderColor: doc.accentBorder, color: doc.accent, background: doc.accentLight }}
                                    >
                                        <Eye className="h-3.5 w-3.5" />
                                        {isViewLoading ? "Opening…" : "View"}
                                    </button>
                                    <button
                                        onClick={() => openDoc(doc.id, true)}
                                        disabled={isViewLoading || isDlLoading}
                                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white transition-opacity disabled:opacity-50"
                                        style={{ background: doc.accent }}
                                    >
                                        <Download className="h-3.5 w-3.5" />
                                        {isDlLoading ? "Opening…" : "Download"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Missing references hint */}
            {(!guard.nearestRelatives || guard.nearestRelatives.length === 0) && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
                    Tip: Reference fields in SA-10 and SA-11 will be empty until Nearest Relatives are added to this guard&apos;s profile.
                </p>
            )}
        </div>
    )
}
