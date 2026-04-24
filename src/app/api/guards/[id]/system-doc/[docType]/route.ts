import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { forbidden } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtDate(d: Date | string | null | undefined, style: "long" | "short" = "long"): string {
    if (!d) return "—"
    const dt = typeof d === "string" ? new Date(d) : d
    if (isNaN(dt.getTime())) return "—"
    const day = String(dt.getDate()).padStart(2, "0")
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    const year = dt.getFullYear()
    if (style === "short") return `${day}-${months[dt.getMonth()]}-${year}`
    return `${day} ${months[dt.getMonth()]} ${year}`
}

function parseJson<T>(s: string | null | undefined): T[] {
    if (!s) return []
    try { return JSON.parse(s) as T[] } catch { return [] }
}

function escHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")
}

function v(val: string | null | undefined, fallback = "—"): string {
    const s = val && val.trim() ? val.trim() : fallback
    return escHtml(s)
}

const LOGO = "/pps_logo.png"
const COMPANY = "Parwest Pacific Security (Pvt.) Ltd."
const ADDRESS = "176, Street No. 4, Cavalry Ground, Lahore Cantt. - Pakistan"
const PHONE = "+92-42-36655166, 36654545, 36668549"
const FAX = "+92-42-36654122"
const EMAIL = "parwest@gmail.com"

const HEADER_CSS = `
  body{margin:0;padding:0;background:#fff;font-family:'Segoe UI',Arial,sans-serif;}
  .clearfix{clear:both;}
  .logo-row{display:flex;align-items:center;gap:16px;padding:16px 20px 8px;}
  .logo-row img{width:80px;height:80px;object-fit:contain;}
  .logo-text h1{margin:0;font-size:22px;font-weight:700;color:#000;text-transform:uppercase;}
  .logo-text h2{margin:0;font-size:13px;font-weight:400;color:#333;}
  .logo-text a{font-size:13px;color:#333;text-decoration:none;}
  @media print{
    @page{margin:10mm;}
    button{display:none!important;}
  }
`

function printBtn(): string {
    return `<div style="text-align:center;padding:10px;"><button onclick="window.print()" style="background:#1a56db;color:#fff;border:none;padding:8px 20px;font-size:14px;border-radius:6px;cursor:pointer;">🖨 Print</button></div>`
}

// ─── Form A ───────────────────────────────────────────────────────────────────
// Structure mirrors the original Laravel Blade template exactly:
//  • Photo section: outer 2-col table [left stacked sub-tables | right photo col]
//  • Each "row" of personal info is a separate sub-table inside the left column
//    so columns are independent per row (matching the original)
//  • Full-width rows (Passing Year → Address) are separate sub-tables below
//  • Employment, Relatives, Family use the same separate-sub-table pattern

function generateFormA(g: Record<string, unknown>, baseUrl: string): string {
    type Relative = { name?: string; fatherName?: string; relation?: string; profession?: string; cnic?: string; contact?: string; address?: string }
    type Employment = { company?: string; nameOfCompany?: string; duration?: string; startDate?: string; endDate?: string }
    type FamilyMember = { name?: string; relation?: string; age?: string; profession?: string; address?: string }

    const relatives = parseJson<Relative>(g.nearestRelativesJson as string)
    const employment = parseJson<Employment>(g.previousEmploymentsJson as string).filter(e => !((e as Record<string, unknown>).isExService))
    const family = parseJson<FamilyMember>(g.familyMembersJson as string)

    // ── CSS helpers ──────────────────────────────────────────────────────────
    const B = "border:1px solid #4a4a4a;"
    // First-row cells in a stacked sub-table section
    const LB1 = `${B}background:#d0d0d0;font-weight:700;font-size:8.5px;padding:2px 5px;white-space:nowrap;vertical-align:middle;`
    const VL1 = `${B}font-size:9px;padding:2px 5px;vertical-align:middle;`
    // Subsequent rows in same section: remove top border to avoid doubling
    const LBx = `border:1px solid #4a4a4a;border-top:0;background:#d0d0d0;font-weight:700;font-size:8.5px;padding:2px 5px;white-space:nowrap;vertical-align:middle;`
    const VLx = `border:1px solid #4a4a4a;border-top:0;font-size:9px;padding:2px 5px;vertical-align:middle;`
    // Section header (dark bar)
    const SH = `background:#4a4a4a;color:#fff;font-weight:700;font-size:9px;padding:3px 8px;display:block;`
    // Table / header / data cell
    const TBL = `border-collapse:collapse;width:100%;`
    const TH  = `${B}background:#d0d0d0;font-weight:700;font-size:8.5px;padding:2px 4px;text-align:center;vertical-align:middle;`
    const TD  = `${B}font-size:9px;padding:2px 4px;vertical-align:middle;`

    // ── Employment rows ──────────────────────────────────────────────────────
    const empRows = employment.slice(0, 6).map((e, i) => `
      <tr>
        <td style="${TD}text-align:center;width:4%;">${i + 1}</td>
        <td style="${TD}">${v(e.nameOfCompany ?? e.company)}</td>
        <td style="${TD}text-align:center;width:16%;">${v(e.duration)}</td>
        <td style="${TD}text-align:center;width:18%;">${e.startDate ? fmtDate(e.startDate, "short") : "—"}</td>
        <td style="${TD}text-align:center;width:18%;">${e.endDate ? fmtDate(e.endDate, "short") : "—"}</td>
      </tr>`).join("")
    const empEmpty = Array.from({ length: Math.max(0, 2 - Math.min(6, employment.length)) }, () =>
        `<tr><td style="${TD}height:14px;width:4%;"></td><td style="${TD}"></td><td style="${TD}width:16%;"></td><td style="${TD}width:18%;"></td><td style="${TD}width:18%;"></td></tr>`
    ).join("")

    // ── Relative rows — each relative = 3 separate sub-tables stacked in data col ─
    const relRows = relatives.slice(0, 3).map((r, i) => {
        // sub-row B (2nd): has 3 label-value pairs, border-top:0
        const RBx = `border:1px solid #4a4a4a;border-top:0;background:#d0d0d0;font-weight:700;font-size:8.5px;padding:2px 5px;white-space:nowrap;vertical-align:middle;`
        const RVx = `border:1px solid #4a4a4a;border-top:0;font-size:9px;padding:2px 5px;vertical-align:middle;`
        return `
      <tr>
        <td rowspan="3" style="${B}text-align:center;font-weight:700;font-size:9px;vertical-align:middle;width:4%;padding:2px;">${i + 1}</td>
        <td style="padding:0;vertical-align:top;${B}border-left:0;">
          <!-- sub-row A: Full Name | Father's Name -->
          <table style="${TBL}">
            <tr>
              <td style="${LB1}width:12%;">Full Name</td>
              <td style="${VL1}">${v(r.name)}</td>
              <td style="${LB1}width:14%;">Father's Name</td>
              <td style="${VL1}">${v(r.fatherName)}</td>
            </tr>
          </table>
          <!-- sub-row B: Relation | CNIC# | Profession -->
          <table style="${TBL}">
            <tr>
              <td style="${RBx}width:12%;">Relation</td>
              <td style="${RVx}width:16%;">${v(r.relation)}</td>
              <td style="${RBx}width:10%;">CNIC#</td>
              <td style="${RVx}">${v(r.cnic)}</td>
              <td style="${RBx}width:14%;">Profession</td>
              <td style="${RVx}width:14%;">${v(r.profession)}</td>
            </tr>
          </table>
          <!-- sub-row C: Address | Contact No -->
          <table style="${TBL}">
            <tr>
              <td style="${RBx}width:12%;">Address</td>
              <td style="${RVx}">${v(r.address)}</td>
              <td style="${RBx}width:14%;">Contact No</td>
              <td style="${RVx}width:18%;">${v(r.contact)}</td>
            </tr>
          </table>
        </td>
      </tr>`
    }).join("")

    // ── Family rows ──────────────────────────────────────────────────────────
    const famRows = family.slice(0, 5).map((f, i) => `
      <tr>
        <td style="${TD}text-align:center;width:4%;">${i + 1}</td>
        <td style="${TD}">${v(f.name)}</td>
        <td style="${TD}width:14%;">${v(f.relation)}</td>
        <td style="${TD}text-align:center;width:8%;">${v(f.age)}</td>
        <td style="${TD}width:16%;">${v(f.profession)}</td>
        <td style="${TD}">${v(f.address)}</td>
      </tr>`).join("")
    const famEmpty = family.length === 0
        ? `<tr><td style="${TD}height:14px;width:4%;"></td><td style="${TD}"></td><td style="${TD}width:14%;"></td><td style="${TD}width:8%;"></td><td style="${TD}width:16%;"></td><td style="${TD}"></td></tr>`
        : ""

    const photoHtml = g.photoUrl
        ? `<img src="${g.photoUrl}" style="max-width:100%;height:135px;object-fit:cover;display:block;"/>`
        : `<div style="width:100%;height:135px;display:flex;align-items:center;justify-content:center;font-size:55px;color:#aaa;">&#10005;</div>`

    return `<!doctype html><html><head><meta charset="utf-8">
<title>Form A – ${escHtml(String(g.parwestId ?? ""))}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:#fff;font-family:Arial,Helvetica,sans-serif;padding:8px 10px;}
  table{border-collapse:collapse;width:100%;}
  @media print{
    @page{size:A4 portrait;margin:5mm 7mm;}
    body{padding:0;}
    button{display:none!important;}
  }
</style></head><body>
${printBtn()}

<!-- ── Company Header ─────────────────────────────────────────────────── -->
<table style="margin-bottom:3px;border-collapse:collapse;">
  <tr>
    <td style="width:66px;padding-right:8px;vertical-align:middle;">
      <img src="${baseUrl}${LOGO}" style="width:60px;height:60px;object-fit:contain;" alt=""/>
    </td>
    <td style="vertical-align:middle;">
      <div style="font-size:17px;font-weight:900;text-transform:uppercase;">PARWEST PACIFIC SECURITY (PVT.)LTD.</div>
      <div style="font-size:9px;font-weight:600;margin-top:2px;">176, STREET NO. 4, CAVALRY GROUND LAHORE CANTT. &nbsp;(FORM &#39;A&#39;) &nbsp;MT-5153</div>
    </td>
  </tr>
</table>

<!-- ── Title Banner ───────────────────────────────────────────────────── -->
<div style="${B}text-align:center;padding:3px 4px;font-size:8px;font-weight:700;margin-bottom:0;line-height:1.5;background:#f0f0f0;">
  PARTICULAR OF GUARDS/SUPERVISOR TO BE PROVIDED TO PBA / PHANOMINATED AGENCY / ORGANIZATION<br/>
  FOR INDIVIDUALS DEPLOYED IN THE BANKING INDUSTRY/SPL BR &nbsp;( POLICE )&nbsp; VERIFICATION.
</div>

<!-- ══════════════════════════════════════════════════════════════════════ -->
<!-- PHOTO SECTION: 2-col outer table                                      -->
<!--   Left col  (~86%): 5 stacked sub-tables (one per row)               -->
<!--   Right col (~14%): photo box                                         -->
<!-- ══════════════════════════════════════════════════════════════════════ -->
<table style="border-collapse:collapse;width:100%;">
  <tr>
    <td style="vertical-align:top;padding:0;width:86%;">

      <!-- Row 1: Full Name | Father's Name -->
      <table style="${TBL}">
        <tr>
          <td style="${LB1}width:12%;">Full Name</td>
          <td style="${VL1}">${v(g.name as string)}</td>
          <td style="${LB1}width:14%;">Father&#39;s Name</td>
          <td style="${VL1}">${v(g.fatherName as string)}</td>
        </tr>
      </table>

      <!-- Row 2: Next Of Kin | CNIC# | Expiry Date -->
      <table style="${TBL}">
        <tr>
          <td style="${LBx}width:12%;">Next Of Kin</td>
          <td style="${VLx}width:14%;">${v(g.nextOfKin as string)}</td>
          <td style="${LBx}width:9%;">CNIC#</td>
          <td style="${VLx}">${v(g.cnic as string)}</td>
          <td style="${LBx}width:13%;">Expiry Date</td>
          <td style="${VLx}width:16%;">${fmtDate(g.cnicExpiryDate as string, "short")}</td>
        </tr>
      </table>

      <!-- Row 3: Passport# | Expiry Date -->
      <table style="${TBL}">
        <tr>
          <td style="${LBx}width:12%;">Passport#</td>
          <td style="${VLx}"></td>
          <td style="${LBx}width:14%;">Expiry Date</td>
          <td style="${VLx}"></td>
        </tr>
      </table>

      <!-- Row 4: Date Of Birth | Age | Contact # -->
      <table style="${TBL}">
        <tr>
          <td style="${LBx}width:14%;">Date Of Birth</td>
          <td style="${VLx}width:18%;">${fmtDate(g.dateOfBirth as string, "short")}</td>
          <td style="${LBx}width:8%;">Age</td>
          <td style="${VLx}width:14%;">${g.age ? `${escHtml(String(g.age))} Years` : "—"}</td>
          <td style="${LBx}width:11%;">Contact #</td>
          <td style="${VLx}">${v(g.phone as string)}</td>
        </tr>
      </table>

      <!-- Row 5: Religion | Cast | Sect | Education -->
      <table style="${TBL}">
        <tr>
          <td style="${LBx}width:10%;">Religion</td>
          <td style="${VLx}width:12%;">${v(g.religion as string)}</td>
          <td style="${LBx}width:8%;">Cast</td>
          <td style="${VLx}width:12%;">${v(g.cast as string)}</td>
          <td style="${LBx}width:8%;">Sect</td>
          <td style="${VLx}width:12%;">${v(g.sect as string)}</td>
          <td style="${LBx}width:12%;">Education</td>
          <td style="${VLx}">${v(g.education as string)}</td>
        </tr>
      </table>

    </td>
    <!-- Photo right column -->
    <td style="${B}border-left:0;width:14%;text-align:center;vertical-align:middle;padding:3px;">
      ${photoHtml}
    </td>
  </tr>
</table>

<!-- ══════════════════════════════════════════════════════════════════════ -->
<!-- FULL-WIDTH ROWS (below photo section)                                 -->
<!-- Each row is a separate sub-table; border-top:0 after first            -->
<!-- ══════════════════════════════════════════════════════════════════════ -->

<!-- Row 6: Passing Year | Institution -->
<table style="${TBL}">
  <tr>
    <td style="${LBx}width:14%;">Passing Year</td>
    <td style="${VLx}width:16%;">${v(g.passingYear as string)}</td>
    <td style="${LBx}width:13%;">Institution</td>
    <td style="${VLx}">${v(g.educationInstitute as string)}</td>
  </tr>
</table>

<!-- Row 7: Current Address -->
<table style="${TBL}">
  <tr>
    <td style="${LBx}width:16%;">Current Address</td>
    <td style="${VLx}">${v(g.addressCurrent as string)}</td>
  </tr>
</table>

<!-- Row 8: Permanent Address -->
<table style="${TBL}">
  <tr>
    <td style="${LBx}width:19%;">Permanent Address</td>
    <td style="${VLx}">${v(g.addressPermanent as string)}</td>
  </tr>
</table>

<!-- Row 9: Contact No (Current) | Contact No (Permanent) | Salary -->
<table style="${TBL}">
  <tr>
    <td style="${LBx}width:20%;">Contact No (Current)</td>
    <td style="${VLx}width:18%;">${v(g.currentAddressContact as string)}</td>
    <td style="${LBx}width:23%;">Contact No (Permanent)</td>
    <td style="${VLx}">${v(g.permanentAddressContact as string)}</td>
    <td style="${LBx}width:8%;">Salary</td>
    <td style="${VLx}width:8%;">${g.salary ? escHtml(String(g.salary)) : "—"}</td>
  </tr>
</table>

<!-- Row 10: Police Station -->
<table style="${TBL}">
  <tr>
    <td style="${LBx}width:14%;">Police Station</td>
    <td style="${VLx}">${v(g.policeStation as string)}</td>
  </tr>
</table>

<!-- Row 11: Enrollment Date | Termination Date -->
<table style="${TBL}">
  <tr>
    <td style="${LBx}width:16%;">Enrollment Date</td>
    <td style="${VLx}width:28%;">${fmtDate(g.joiningDate as string, "short")}</td>
    <td style="${LBx}width:17%;">Termination Date</td>
    <td style="${VLx}">-----</td>
  </tr>
</table>

<!-- Row 12: Introducer/Supervisor | CNIC# | Contact No -->
<table style="${TBL}">
  <tr>
    <td style="${LBx}width:20%;">Introducer/Supervisor</td>
    <td style="${VLx}width:28%;">${v(g.introducerName as string)}</td>
    <td style="${LBx}width:9%;">CNIC#</td>
    <td style="${VLx}"></td>
    <td style="${LBx}width:13%;">Contact No</td>
    <td style="${VLx}width:14%;">${v(g.introducerContact as string)}</td>
  </tr>
</table>

<!-- Row 13: Address -->
<table style="${TBL}">
  <tr>
    <td style="${LBx}width:9%;">Address</td>
    <td style="${VLx}">${v(g.introducerAddress as string)}</td>
  </tr>
</table>

<!-- ── Employment History ─────────────────────────────────────────────── -->
<div style="${SH}margin-top:3px;">Employement History Of Last 15 Years</div>
<table style="${TBL}">
  <tr>
    <th style="${TH}width:4%;">#.Sr</th>
    <th style="${TH}">Name Of Company</th>
    <th style="${TH}width:16%;">Service Duration</th>
    <th style="${TH}width:18%;">Date Of Enrollment</th>
    <th style="${TH}width:18%;">Date Of Discharge</th>
  </tr>
  ${empRows}${empEmpty}
</table>

<!-- ── Nearest Relatives ─────────────────────────────────────────────── -->
<div style="${SH}margin-top:3px;">Details Of Three (3) Nearest Relatives</div>
<table style="${TBL}">
  ${relRows || `
    <tr>
      <td style="${B}text-align:center;font-weight:700;font-size:9px;vertical-align:middle;width:4%;padding:2px;">1</td>
      <td style="${B}border-left:0;padding:0;vertical-align:top;">
        <table style="${TBL}"><tr>
          <td style="${LB1}width:12%;">Full Name</td><td style="${VL1}"></td>
          <td style="${LB1}width:14%;">Father&#39;s Name</td><td style="${VL1}"></td>
        </tr></table>
        <table style="${TBL}"><tr>
          <td style="${LBx}width:12%;">Relation</td><td style="${VLx}width:16%;"></td>
          <td style="${LBx}width:10%;">CNIC#</td><td style="${VLx}"></td>
          <td style="${LBx}width:14%;">Profession</td><td style="${VLx}width:14%;"></td>
        </tr></table>
        <table style="${TBL}"><tr>
          <td style="${LBx}width:12%;">Address</td><td style="${VLx}"></td>
          <td style="${LBx}width:14%;">Contact No</td><td style="${VLx}width:18%;"></td>
        </tr></table>
      </td>
    </tr>`}
</table>

<!-- ── Family Details ────────────────────────────────────────────────── -->
<div style="${SH}margin-top:3px;">Family Details</div>
<table style="${TBL}">
  <tr>
    <th style="${TH}width:4%;">#.Sr</th>
    <th style="${TH}">Name</th>
    <th style="${TH}width:14%;">Relation</th>
    <th style="${TH}width:8%;">Age</th>
    <th style="${TH}width:16%;">Profession</th>
    <th style="${TH}">Address</th>
  </tr>
  ${famRows}${famEmpty}
</table>

<!-- ── Footer ────────────────────────────────────────────────────────── -->
<div style="margin-top:6px;display:flex;justify-content:space-between;font-size:9.5px;">
  <span>Individual Signature : _____________________</span>
  <span>Date :&nbsp;<b>${fmtDate(g.joiningDate as string, "short")}</b></span>
</div>
<div style="${B}padding:3px 6px;font-size:9.5px;min-height:20px;margin-top:3px;">
  Recommended for deployment at :
</div>
<div style="margin-top:3px;font-size:8.5px;color:#444;">
  Enrolled By : ${v(g.enrolledBy as string)} &nbsp;&nbsp; ${fmtDate(g.createdAt as string, "short")}
</div>

</body></html>`
}

// ─── Form B ───────────────────────────────────────────────────────────────────

function generateFormB(g: Record<string, unknown>, baseUrl: string): string {
    const border = "border:1px solid #4a4a4a;"
    const thStyle = `background:#4a4a4a;color:#fff;font-weight:700;font-size:11px;padding:4px 6px;${border}`
    const tdStyle = `font-size:12px;padding:4px 6px;${border}`
    const td2Style = `font-size:12px;font-weight:600;padding:4px 6px;${border}`

    return `<!doctype html><html><head><meta charset="utf-8"><title>Form B – ${escHtml(String(g.parwestId ?? ""))}</title>
<style>
${HEADER_CSS}
body{padding:16px;}
table{border-collapse:collapse;width:100%;}
h2.section{background:#4a4a4a;color:#fff;padding:4px 8px;font-size:12px;margin:12px 0 4px;}
</style></head><body>
${printBtn()}
<div style="display:flex;align-items:center;gap:20px;padding:16px 20px 8px;border-bottom:2px solid #4a4a4a;">
  <img src="${baseUrl}${LOGO}" style="width:90px;height:90px;object-fit:contain;" alt="logo"/>
  <div>
    <div style="font-size:24px;font-weight:700;color:#4a4a4a;text-transform:uppercase;">${COMPANY}</div>
    <div style="font-size:14px;color:#555;text-transform:uppercase;">Sherdils Group</div>
    <div style="font-size:13px;color:#555;">${ADDRESS}</div>
  </div>
  <div style="margin-left:auto;font-size:18px;font-weight:700;color:#4a4a4a;">FORM 'B' &nbsp; ${v(g.parwestId as string)}</div>
</div>

<div style="text-align:center;font-size:13px;font-weight:700;margin:8px 0;padding:6px;border:1px solid #4a4a4a;">
  PERSONAL PARTICULARS OF GUARD / SUPERVISOR
</div>

<table>
  <tr>
    <td style="${thStyle}" width="130">Name</td>
    <td style="${td2Style}">${v(g.name as string)}</td>
    <td rowspan="7" style="${border}text-align:center;width:180px;padding:4px;">
      ${g.photoUrl ? `<img src="${g.photoUrl}" style="width:160px;height:190px;object-fit:cover;"/>` : '<div style="width:160px;height:190px;border:1px dashed #aaa;display:inline-flex;align-items:center;justify-content:center;font-size:11px;color:#999;">No Photo</div>'}
    </td>
  </tr>
  <tr>
    <td style="${thStyle}">Father's Name</td>
    <td style="${td2Style}">${v(g.fatherName as string)}</td>
  </tr>
  <tr>
    <td style="${thStyle}">CNIC #</td>
    <td style="${td2Style}">${v(g.cnic as string)}</td>
  </tr>
  <tr>
    <td style="${thStyle}">Date of Birth</td>
    <td style="${td2Style}">${fmtDate(g.dateOfBirth as string, "short")}</td>
  </tr>
  <tr>
    <td style="${thStyle}">Age</td>
    <td style="${td2Style}">${escHtml(String(g.age ?? "") || "—")} Years</td>
  </tr>
  <tr>
    <td style="${thStyle}">Designation</td>
    <td style="${td2Style}">${v(g.designation as string)}</td>
  </tr>
  <tr>
    <td style="${thStyle}">Date of Enrollment</td>
    <td style="${td2Style}">${fmtDate(g.joiningDate as string, "short")}</td>
  </tr>
</table>

<h2 class="section">EX-SERVICE DETAILS</h2>
<table>
  <tr>
    <td style="${thStyle}" width="180">Ex-Service Type</td>
    <td style="${td2Style}">${v(g.exServiceType as string)}</td>
    <td style="${thStyle}" width="160">Registration No.</td>
    <td style="${td2Style}">${v(g.exServiceRegistrationNo as string)}</td>
  </tr>
  <tr>
    <td style="${thStyle}">Rank</td>
    <td style="${td2Style}">${v(g.exServiceRank as string)}</td>
    <td style="${thStyle}">Regiment / Unit</td>
    <td style="${td2Style}">${v(g.exServiceUnit as string)} / ${v(g.exServiceRegiment as string)}</td>
  </tr>
  <tr>
    <td style="${thStyle}">Service Period</td>
    <td style="${td2Style}">${v(g.exServicePeriod as string)}</td>
    <td style="${thStyle}">Years / Months</td>
    <td style="${td2Style}">${escHtml(String(g.exServiceYears ?? "—"))} Yrs / ${escHtml(String(g.exServiceMonths ?? "—"))} Mos</td>
  </tr>
  <tr>
    <td style="${thStyle}">Date of Enrollment</td>
    <td style="${td2Style}">${fmtDate(g.dateOfEnrollment as string, "short")}</td>
    <td style="${thStyle}">Date of Discharge</td>
    <td style="${td2Style}">${fmtDate(g.dateOfDischarge as string, "short")}</td>
  </tr>
  <tr>
    <td style="${thStyle}">Remarks</td>
    <td style="${tdStyle}" colspan="3">${v(g.exServiceRemarks as string)}</td>
  </tr>
</table>

<h2 class="section">PHYSICAL PARTICULARS</h2>
<table>
  <tr>
    <td style="${thStyle}" width="150">Height</td>
    <td style="${td2Style}">${v(g.height as string)}</td>
    <td style="${thStyle}" width="150">Weight</td>
    <td style="${td2Style}">${v(g.weight as string)} Kg</td>
  </tr>
  <tr>
    <td style="${thStyle}">Eye Color</td>
    <td style="${td2Style}">${v(g.eyeColor as string)}</td>
    <td style="${thStyle}">Hair Color</td>
    <td style="${td2Style}">${v(g.hairColor as string)}</td>
  </tr>
  <tr>
    <td style="${thStyle}">Disability</td>
    <td style="${td2Style}">${v(g.disability as string)}</td>
    <td style="${thStyle}">Mark of Identification</td>
    <td style="${td2Style}">${v(g.identificationMark as string)}</td>
  </tr>
</table>

<div style="margin-top:30px;display:flex;justify-content:space-between;font-size:12px;border-top:1px solid #ccc;padding-top:10px;">
  <div>Date: <strong>${fmtDate(g.createdAt as string, "long")}</strong></div>
  <div>Guard Signature: ___________________________</div>
  <div>Enrolled By: <strong>${v(g.enrolledBy as string)}</strong></div>
</div>
</body></html>`
}

// ─── Employee Card ────────────────────────────────────────────────────────────

function generateEmployeeCard(g: Record<string, unknown>, baseUrl: string): string {
    const cnic = v(g.cnic as string, "")
    const digits = cnic.replace(/-/g, "")

    return `<!doctype html><html><head><meta charset="utf-8"><title>Employee Card – ${escHtml(String(g.parwestId ?? ""))}</title>
<style>
${HEADER_CSS}
body{display:flex;justify-content:center;align-items:center;min-height:100vh;background:#e5e7eb;padding:20px;}
.card-wrap{display:flex;gap:0;box-shadow:0 4px 24px rgba(0,0,0,.25);}
.card-side{width:340px;min-height:540px;background:linear-gradient(160deg,#1a3a5c 0%,#0f2744 60%,#0a1a2e 100%);color:#fff;padding:20px;position:relative;overflow:hidden;}
.card-side::before{content:'';position:absolute;top:0;left:0;right:0;bottom:0;background:url("${baseUrl}${LOGO}") no-repeat center center;opacity:0.05;background-size:60%;}
.card-back{width:340px;min-height:540px;background:linear-gradient(160deg,#1a3a5c 0%,#0f2744 60%,#0a1a2e 100%);color:#fff;padding:20px;border-left:2px solid rgba(255,255,255,0.2);}
.card-header{display:flex;align-items:center;gap:10px;margin-bottom:16px;}
.card-header img{width:50px;height:50px;object-fit:contain;}
.card-header h2{margin:0;font-size:13px;font-weight:700;text-transform:uppercase;line-height:1.3;}
.photo-box{width:130px;height:150px;border:2px solid rgba(255,255,255,0.5);margin:0 auto 16px;overflow:hidden;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;}
.photo-box img{width:100%;height:100%;object-fit:cover;}
.field{margin-bottom:10px;}
.field label{display:block;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,.6);margin-bottom:2px;}
.field .val{font-size:14px;font-weight:600;border-bottom:1px dashed rgba(255,255,255,0.3);padding-bottom:3px;}
.cnic-strip{display:flex;gap:0;margin-top:8px;background:rgba(255,255,255,.15);padding:8px 4px;border-radius:4px;}
.cnic-strip .dig{width:20px;text-align:center;font-size:14px;font-weight:700;}
.cnic-strip .sep{width:12px;text-align:center;font-size:14px;font-weight:700;color:rgba(255,255,255,.5);}
.back-top{border:1px solid rgba(255,255,255,.3);border-radius:4px;padding:10px;margin-bottom:16px;font-size:11px;text-align:center;}
.back-top h3{margin:0 0 4px;font-size:13px;}
.back-field{margin-bottom:10px;}
.back-field label{display:block;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,.6);margin-bottom:2px;}
.back-field .val{font-size:13px;font-weight:600;}
.sig-row{display:flex;justify-content:space-between;margin-top:24px;padding-top:12px;border-top:1px solid rgba(255,255,255,.3);font-size:10px;}
</style></head><body>
<div>
${printBtn()}
<div class="card-wrap">
  <div class="card-side">
    <div class="card-header">
      <img src="${baseUrl}${LOGO}" alt="logo"/>
      <h2>Parwest Pacific Security (Pvt) Ltd.<br/><span style="font-size:10px;font-weight:400;font-style:italic;">Sherdils Group</span></h2>
    </div>
    <div class="photo-box">
      ${g.photoUrl ? `<img src="${g.photoUrl}" alt="photo"/>` : `<span style="font-size:10px;color:rgba(255,255,255,.4);">No Photo</span>`}
    </div>
    <div class="field"><label>Name</label><div class="val">${v(g.name as string)}</div></div>
    <div class="field"><label>Father's Name</label><div class="val">${v(g.fatherName as string)}</div></div>
    <div class="field"><label>PPS No.</label><div class="val">${v(g.parwestId as string)}</div></div>
    <div class="field"><label>Designation</label><div class="val">${v(g.designation as string)}</div></div>
    <div class="field"><label>National I.D. No.</label>
      <div class="cnic-strip">
        ${digits.split("").map((d, i) => {
            if (i === 5 || i === 12) return `<div class="sep">-</div><div class="dig">${d}</div>`
            return `<div class="dig">${d}</div>`
        }).join("")}
      </div>
    </div>
  </div>
  <div class="card-back">
    <div class="back-top">
      <h3>If Found Please Return To:</h3>
      <p style="margin:0;">176, Street #4, Cavalry Ground, Lahore Cantt - Pakistan</p>
      <p style="margin:4px 0 0;">Tel: +92 (042) 36655166 &nbsp; E-mail: parwest@gmail.com</p>
    </div>
    <div class="back-field"><label>Age</label><div class="val">${g.age ? `${escHtml(String(g.age))} Years` : "—"}</div></div>
    <div class="back-field"><label>Blood Group</label><div class="val">${v(g.bloodGroup as string)}</div></div>
    <div class="back-field"><label>Permanent Address</label><div class="val">${v(g.addressPermanent as string)}</div></div>
    <div class="back-field"><label>Mark of Identification</label><div class="val">${v(g.identificationMark as string)}</div></div>
    <div class="back-field"><label>Color of Eyes</label><div class="val">${v(g.eyeColor as string)}</div></div>
    <div class="back-field"><label>Color of Hair</label><div class="val">${v(g.hairColor as string, "Black")}</div></div>
    <div class="sig-row">
      <div>Signature: ________________</div>
      <div>Stamp: ________________</div>
    </div>
  </div>
</div>
</div>
</body></html>`
}

// ─── Personal Verification ────────────────────────────────────────────────────

function generatePersonalVerification(g: Record<string, unknown>, _baseUrl: string): string {
    type Relative = { name?: string; fatherName?: string; relation?: string; profession?: string; cnic?: string; contact?: string; address?: string }
    const relatives = parseJson<Relative>(g.nearestRelativesJson as string).slice(0, 3)

    const relBlocks = relatives.length > 0 ? relatives.map((r, i) => `
      <tr>
        <td style="border:1px solid #000;padding:6px;font-weight:700;font-size:14px;width:40px;">${i + 1}</td>
        <td style="border:1px solid #000;padding:0;">
          <table style="border-collapse:collapse;width:100%;">
            <tr>
              <td style="padding:6px;border-bottom:1px solid #000;width:30%;font-size:13px;font-weight:700;">Name</td>
              <td style="padding:6px;border-bottom:1px solid #000;font-size:14px;border-left:1px solid #ddd;">${v(r.name)}</td>
              <td style="padding:6px;border-bottom:1px solid #000;width:30%;font-size:13px;font-weight:700;border-left:1px solid #000;">Father Name</td>
              <td style="padding:6px;border-bottom:1px solid #000;font-size:14px;border-left:1px solid #ddd;">${v(r.fatherName)}</td>
            </tr>
            <tr>
              <td style="padding:6px;border-bottom:1px solid #000;font-size:13px;font-weight:700;">CNIC No.</td>
              <td style="padding:6px;border-bottom:1px solid #000;font-size:14px;">${v(r.cnic)}</td>
              <td style="padding:6px;border-bottom:1px solid #000;font-size:13px;font-weight:700;border-left:1px solid #000;">Relation</td>
              <td style="padding:6px;border-bottom:1px solid #000;font-size:14px;">${v(r.relation)}</td>
            </tr>
            <tr>
              <td style="padding:6px;font-size:13px;font-weight:700;">Mobile No.</td>
              <td style="padding:6px;font-size:14px;">${v(r.contact)}</td>
              <td style="padding:6px;font-size:13px;font-weight:700;border-left:1px solid #000;">Address</td>
              <td style="padding:6px;font-size:14px;">${v(r.address)}</td>
            </tr>
          </table>
        </td>
      </tr>`).join("") : `<tr><td colspan="2" style="border:1px solid #000;padding:12px;text-align:center;color:#999;">No relatives recorded</td></tr>`

    return `<!doctype html><html><head><meta charset="utf-8"><title>Personal Verification – ${escHtml(String(g.parwestId ?? ""))}</title>
<style>
${HEADER_CSS}
body{padding:20px;max-width:900px;margin:0 auto;}
table{border-collapse:collapse;width:100%;}
</style></head><body>
${printBtn()}
<div style="text-align:center;margin-bottom:16px;">
  <h2 style="margin:0;font-size:18px;font-weight:700;text-transform:uppercase;">Personal Verification Guard's Guarantors</h2>
  <h3 style="margin:4px 0;font-size:14px;font-weight:400;">By ${COMPANY}</h3>
</div>

<table style="margin-bottom:12px;">
  <tr>
    <td style="border:1px solid #000;padding:6px;font-size:13px;font-weight:700;width:150px;">Guard Name</td>
    <td style="border:1px solid #000;padding:6px;font-size:14px;">${v(g.name as string)}</td>
    <td style="border:1px solid #000;padding:6px;font-size:13px;font-weight:700;width:150px;">PPS No.</td>
    <td style="border:1px solid #000;padding:6px;font-size:14px;">${v(g.parwestId as string)}</td>
  </tr>
</table>

<table style="margin-bottom:20px;">
  <tr>
    <th style="border:1px solid #000;background:#f0f0f0;padding:6px;font-size:13px;width:40px;">Sr.#</th>
    <th style="border:1px solid #000;background:#f0f0f0;padding:6px;font-size:13px;">Guarantors Particulars</th>
  </tr>
  ${relBlocks}
</table>

<table>
  <tr>
    <td style="border:1px solid #000;padding:8px;font-size:13px;">Police Verification: &nbsp; ✓ OK &nbsp;&nbsp; ✗ Not OK</td>
    <td style="border:1px solid #000;padding:8px;font-size:13px;">Guard Signature: ________________________</td>
  </tr>
  <tr>
    <td style="border:1px solid #000;padding:8px;font-size:13px;">PPS Representative: ________________________</td>
    <td style="border:1px solid #000;padding:8px;font-size:13px;">Supervisor: ________________________</td>
  </tr>
</table>
<div style="margin-top:12px;font-size:12px;color:#555;">Date: ${fmtDate(g.createdAt as string)}</div>
</body></html>`
}

// ─── Training Certificate ─────────────────────────────────────────────────────

function generateTrainingCertificate(g: Record<string, unknown>, _baseUrl: string): string {
    return `<!doctype html><html><head><meta charset="utf-8"><title>Training Certificate – ${escHtml(String(g.parwestId ?? ""))}</title>
<style>
${HEADER_CSS}
body{padding:20px;max-width:900px;margin:0 auto;}
.cert{border:3px solid #1a3a5c;padding:40px;background:#fff;position:relative;}
.cert::before{content:'';position:absolute;inset:8px;border:1px solid #1a3a5c;pointer-events:none;}
.watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);opacity:0.04;font-size:80px;font-weight:700;color:#1a3a5c;white-space:nowrap;pointer-events:none;}
table{border-collapse:collapse;width:100%;}
</style></head><body>
${printBtn()}
<div class="cert">
  <div class="watermark">${COMPANY}</div>
  <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;">
    <img src="${_baseUrl}${LOGO}" style="width:70px;height:70px;" alt="logo"/>
    <div>
      <div style="font-size:20px;font-weight:700;color:#1a3a5c;">${COMPANY}</div>
      <div style="font-size:12px;color:#555;">${ADDRESS}</div>
    </div>
    <div style="margin-left:auto;text-align:right;font-size:13px;font-weight:600;color:#1a3a5c;">
      Ref: ${v(g.parwestId as string)}<br/>
      Date: ${fmtDate(g.createdAt as string, "short")}
    </div>
  </div>

  <div style="text-align:center;margin:20px 0;">
    <h2 style="font-size:28px;font-weight:700;color:#1a3a5c;text-decoration:underline;text-transform:uppercase;margin:0;">Training Certificate</h2>
  </div>

  <p style="font-size:14px;text-align:center;margin:8px 0 24px;">This is to certify that the following guard has successfully completed the required training programme.</p>

  <table style="margin-bottom:20px;">
    <tr>
      <td style="border:1px solid #ccc;padding:8px;font-weight:700;font-size:13px;background:#f5f5f5;width:200px;">PPS Registration No.</td>
      <td style="border:1px solid #ccc;padding:8px;font-size:14px;">${v(g.parwestId as string)}</td>
    </tr>
    <tr>
      <td style="border:1px solid #ccc;padding:8px;font-weight:700;font-size:13px;background:#f5f5f5;">Guard Name</td>
      <td style="border:1px solid #ccc;padding:8px;font-size:14px;">${v(g.name as string)}</td>
    </tr>
    <tr>
      <td style="border:1px solid #ccc;padding:8px;font-weight:700;font-size:13px;background:#f5f5f5;">Father's Name</td>
      <td style="border:1px solid #ccc;padding:8px;font-size:14px;">${v(g.fatherName as string)}</td>
    </tr>
    <tr>
      <td style="border:1px solid #ccc;padding:8px;font-weight:700;font-size:13px;background:#f5f5f5;">CNIC #</td>
      <td style="border:1px solid #ccc;padding:8px;font-size:14px;">${v(g.cnic as string)}</td>
    </tr>
    <tr>
      <td style="border:1px solid #ccc;padding:8px;font-weight:700;font-size:13px;background:#f5f5f5;">Date of Enrollment</td>
      <td style="border:1px solid #ccc;padding:8px;font-size:14px;">${fmtDate(g.joiningDate as string, "short")}</td>
    </tr>
  </table>

  <div style="margin-top:40px;display:flex;justify-content:space-between;font-size:12px;">
    <div style="text-align:center;">
      <div style="border-top:1px solid #000;width:180px;padding-top:4px;">Training Officer</div>
    </div>
    <div style="text-align:center;">
      <div style="border-top:1px solid #000;width:180px;padding-top:4px;">HR Manager</div>
    </div>
    <div style="text-align:center;">
      <div style="border-top:1px solid #000;width:180px;padding-top:4px;">Managing Director</div>
    </div>
  </div>
</div>
</body></html>`
}

// ─── Character Certificate ────────────────────────────────────────────────────

function generateCharacterCertificate(g: Record<string, unknown>, baseUrl: string): string {
    return `<!doctype html><html><head><meta charset="utf-8"><title>Character Certificate – ${escHtml(String(g.parwestId ?? ""))}</title>
<style>
${HEADER_CSS}
body{padding:30px;max-width:800px;margin:0 auto;}
</style></head><body>
${printBtn()}
<table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
  <tr>
    <td>
      <h1 style="margin:0;font-size:26px;font-weight:700;">${COMPANY}</h1>
      <h2 style="margin:4px 0 0;font-size:15px;font-weight:400;">${ADDRESS}</h2>
      <h2 style="margin:2px 0 0;font-size:15px;font-weight:400;">Tel: ${PHONE} | Fax: ${FAX}</h2>
      <a style="font-size:15px;color:#000;">Email: ${EMAIL}</a>
    </td>
    <td style="text-align:right;width:130px;vertical-align:top;">
      <img src="${baseUrl}${LOGO}" style="width:110px;height:110px;object-fit:contain;" alt="logo"/>
    </td>
  </tr>
</table>

<div style="text-align:center;margin:40px 0 20px;">
  <h2 style="font-size:26px;font-weight:700;text-decoration:underline;text-transform:uppercase;margin:0;">Character Certificate</h2>
</div>

<div style="font-size:18px;line-height:32px;text-align:justify;margin:40px 0;">
  <p>It is certified that the Security Guard <strong>${v(g.parwestId as string)}</strong> is physically fit, reasonably
  intelligent / alert and has no criminal record at the time of enrollment in
  the verification of concerned Police Station.</p>
</div>

<div style="margin-top:120px;">
  <h3 style="margin:0;font-size:18px;font-weight:400;">Dated: <span style="text-decoration:underline;">${fmtDate(g.createdAt as string)}</span></h3>
</div>

<div style="margin-top:60px;display:flex;justify-content:space-between;font-size:13px;">
  <div>Guard Signature: ___________________________</div>
  <div style="text-align:center;">
    <div style="border-top:1px solid #000;width:180px;padding-top:4px;">HR Head / Authorized Signatory</div>
  </div>
</div>
</body></html>`
}

// ─── Guard Documents Checklist ────────────────────────────────────────────────

function generateChecklist(g: Record<string, unknown>, baseUrl: string): string {
    const items = [
        "Form A (PBA Verification)",
        "Form B (Personal Particulars)",
        "Affidavit / Iqrar Nama",
        "Residence Verification Letter",
        "CNIC Copy (Attested)",
        "Guard Background Verification",
        "Passport Size Photographs (x4)",
        "Guarantor No. 1 CNIC Copy",
        "Guarantor No. 2 CNIC Copy",
        "Guarantor No. 3 CNIC Copy",
        "NADRA Verisys Report",
        "Basic Training Certificate",
        "Refresher Training Certificate",
        "Anti-Terrorism Training Certificate",
        "Medical Fitness Certificate",
        "Character Certificate",
        "Guard Antecedents Verification",
        "Police Verification Letter",
        "Personal Verification Guard Guarantors",
        "Bank Account Details",
        "Previous Employer Reference",
        "Educational Certificate Copy",
        "Discharge Book (Ex-Service)",
        "Employee Card",
        "Guard Documents Checklist",
    ]

    const rows = items.map((item, i) => `
      <tr>
        <td style="border:0.5px solid #000;padding:5px 8px;text-align:center;font-size:12px;">${i + 1}</td>
        <td style="border:0.5px solid #000;padding:5px 8px;font-size:12px;">${item}</td>
        <td style="border:0.5px solid #000;padding:5px 8px;text-align:center;font-size:18px;">☐</td>
        <td style="border:0.5px solid #000;padding:5px 8px;text-align:center;font-size:18px;">☐</td>
        <td style="border:0.5px solid #000;padding:5px 8px;font-size:12px;">&nbsp;</td>
      </tr>`).join("")

    return `<!doctype html><html><head><meta charset="utf-8"><title>Guard Documents Checklist – ${escHtml(String(g.parwestId ?? ""))}</title>
<style>
${HEADER_CSS}
body{padding:20px;max-width:900px;margin:0 auto;}
table{border-collapse:collapse;width:100%;}
</style></head><body>
${printBtn()}
<div style="display:flex;align-items:center;gap:16px;margin-bottom:12px;">
  <img src="${baseUrl}${LOGO}" style="width:70px;height:70px;object-fit:contain;" alt="logo"/>
  <div>
    <h1 style="margin:0;font-size:20px;font-weight:700;">${COMPANY}</h1>
    <h2 style="margin:0;font-size:13px;font-weight:400;">${ADDRESS}</h2>
  </div>
</div>

<div style="text-align:center;font-size:16px;font-weight:700;margin:8px 0;background:#4a4a4a;color:#fff;padding:6px;">
  GUARD DOCUMENTS CHECKLIST
</div>

<table style="margin-bottom:10px;">
  <tr>
    <td style="border:0.5px solid #000;padding:6px;font-weight:700;font-size:13px;width:150px;">Guard Name</td>
    <td style="border:0.5px solid #000;padding:6px;font-size:13px;">${v(g.name as string)}</td>
    <td style="border:0.5px solid #000;padding:6px;font-weight:700;font-size:13px;width:160px;">Registration No.</td>
    <td style="border:0.5px solid #000;padding:6px;font-size:13px;">${v(g.parwestId as string)}</td>
  </tr>
  <tr>
    <td style="border:0.5px solid #000;padding:6px;font-weight:700;font-size:13px;">Date Prepared</td>
    <td style="border:0.5px solid #000;padding:6px;font-size:13px;" colspan="3">${fmtDate(g.createdAt as string)}</td>
  </tr>
</table>

<table>
  <tr>
    <th style="border:0.5px solid #000;background:#f0f0f0;padding:6px;font-size:12px;width:40px;">S.No.</th>
    <th style="border:0.5px solid #000;background:#f0f0f0;padding:6px;font-size:12px;">Name of Document</th>
    <th style="border:0.5px solid #000;background:#f0f0f0;padding:6px;font-size:12px;width:60px;text-align:center;">Held</th>
    <th style="border:0.5px solid #000;background:#f0f0f0;padding:6px;font-size:12px;width:70px;text-align:center;">Pending</th>
    <th style="border:0.5px solid #000;background:#f0f0f0;padding:6px;font-size:12px;width:140px;">Remarks</th>
  </tr>
  ${rows}
</table>

<div style="margin-top:20px;display:flex;justify-content:space-between;font-size:12px;">
  <div>Prepared By: _________________________</div>
  <div>Verified By: _________________________</div>
  <div>Date: ${fmtDate(g.createdAt as string, "short")}</div>
</div>
</body></html>`
}

// ─── Medical Certificate ──────────────────────────────────────────────────────

function generateMedicalCertificate(g: Record<string, unknown>, baseUrl: string): string {
    return `<!doctype html><html><head><meta charset="utf-8"><title>Medical Certificate – ${escHtml(String(g.parwestId ?? ""))}</title>
<style>
${HEADER_CSS}
body{padding:30px;max-width:800px;margin:0 auto;}
table{border-collapse:collapse;width:100%;}
</style></head><body>
${printBtn()}
<table style="margin-bottom:8px;">
  <tr>
    <td>
      <h1 style="margin:0;font-size:26px;font-weight:700;">${COMPANY}</h1>
      <h2 style="margin:4px 0 0;font-size:15px;font-weight:400;">${ADDRESS}</h2>
    </td>
    <td style="text-align:right;width:130px;vertical-align:top;">
      <img src="${baseUrl}${LOGO}" style="width:110px;height:110px;object-fit:contain;" alt="logo"/>
    </td>
  </tr>
</table>

<div style="background:#f5f5f5;border:1px solid #ddd;padding:12px;margin-bottom:16px;border-radius:4px;">
  <div style="font-size:16px;font-weight:700;">Dr. Major (R) Navid Ahmed, MBBS</div>
  <div style="font-size:13px;color:#555;">Medical Officer, Parwest Pacific Security (Pvt.) Ltd.</div>
</div>

<div style="text-align:center;margin:30px 0 20px;">
  <h3 style="font-size:18px;font-weight:700;text-transform:uppercase;margin:0;">To Whom It May Concern</h3>
  <h2 style="font-size:26px;font-weight:700;text-decoration:underline;text-transform:uppercase;margin:8px 0 0;">Medical Fitness Certificate</h2>
</div>

<p style="font-size:15px;text-align:justify;margin:16px 0;">
  This is to certify that I have examined the following person and found him/her medically fit for duty as a Security Guard with Parwest Pacific Security (Pvt.) Ltd.
</p>

<table style="margin:20px 0;">
  <tr>
    <td style="border:1px solid #ccc;padding:8px;font-weight:700;font-size:14px;background:#f9f9f9;width:200px;">Name</td>
    <td style="border:1px solid #ccc;padding:8px;font-size:15px;">${v(g.name as string)}</td>
  </tr>
  <tr>
    <td style="border:1px solid #ccc;padding:8px;font-weight:700;font-size:14px;background:#f9f9f9;">Father's Name</td>
    <td style="border:1px solid #ccc;padding:8px;font-size:15px;">${v(g.fatherName as string)}</td>
  </tr>
  <tr>
    <td style="border:1px solid #ccc;padding:8px;font-weight:700;font-size:14px;background:#f9f9f9;">CNIC #</td>
    <td style="border:1px solid #ccc;padding:8px;font-size:15px;">${v(g.cnic as string)}</td>
  </tr>
</table>

<p style="font-size:14px;margin:16px 0;">
  The above-named individual has been examined and found medically fit, with no significant physical or mental health issues that would prevent them from performing their duties effectively.
</p>

<div style="margin-top:60px;display:flex;justify-content:space-between;font-size:13px;">
  <div>Date: <strong>${fmtDate(g.createdAt as string)}</strong></div>
  <div style="text-align:center;">
    <div style="border-top:1px solid #000;width:200px;padding-top:4px;">Medical Officer (With Stamp)</div>
  </div>
</div>
</body></html>`
}

// ─── Guard Antecedents Verification ──────────────────────────────────────────

function generateAntecedents(g: Record<string, unknown>, baseUrl: string): string {
    return `<!doctype html><html><head><meta charset="utf-8"><title>Guard Antecedents Verification – ${escHtml(String(g.parwestId ?? ""))}</title>
<style>
${HEADER_CSS}
body{padding:30px;max-width:800px;margin:0 auto;}
</style></head><body>
${printBtn()}
<table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
  <tr>
    <td>
      <h1 style="margin:0;font-size:26px;font-weight:700;">${COMPANY}</h1>
      <h2 style="margin:4px 0 0;font-size:15px;font-weight:400;">${ADDRESS}</h2>
      <h2 style="margin:2px 0 0;font-size:14px;font-weight:400;">Tel: ${PHONE} | Fax: ${FAX}</h2>
      <a style="font-size:14px;color:#000;">Email: ${EMAIL}</a>
    </td>
    <td style="text-align:right;width:130px;vertical-align:top;">
      <img src="${baseUrl}${LOGO}" style="width:100px;height:100px;object-fit:contain;" alt="logo"/>
    </td>
  </tr>
</table>

<div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:16px;">
  <div><strong>Ref:</strong> PPS/HR/${v(g.parwestId as string)}</div>
  <div><strong>Date:</strong> ${fmtDate(g.createdAt as string)}</div>
</div>

<div style="font-size:14px;margin-bottom:12px;">
  <p><strong>To,</strong><br/>The Deputy Inspector General of Police (DPO),<br/>District _____________________________</p>
</div>

<div style="text-align:center;font-size:16px;font-weight:700;text-decoration:underline;margin:16px 0;">
  Subject: Verification of Antecedents
</div>

<p style="font-size:14px;line-height:24px;text-align:justify;">
  It is respectfully stated that the above referenced individual has applied for employment as a Security Guard with Parwest Pacific Security (Pvt.) Ltd. In accordance with the Private Security Agencies (Regulation) Act 2021, we request verification of the antecedents of the following person:
</p>

<div style="border:1px solid #000;padding:12px;margin:16px 0;background:#f9f9f9;">
  <table style="width:100%;border-collapse:collapse;">
    <tr>
      <td style="font-weight:700;font-size:13px;padding:4px;width:180px;">Name:</td>
      <td style="font-size:14px;padding:4px;border-bottom:1px dashed #ccc;">${v(g.name as string)}</td>
    </tr>
    <tr>
      <td style="font-weight:700;font-size:13px;padding:4px;">CNIC No.:</td>
      <td style="font-size:14px;padding:4px;border-bottom:1px dashed #ccc;">${v(g.cnic as string)}</td>
    </tr>
    <tr>
      <td style="font-weight:700;font-size:13px;padding:4px;">Address:</td>
      <td style="font-size:14px;padding:4px;border-bottom:1px dashed #ccc;">${v(g.addressCurrent as string)}</td>
    </tr>
    <tr>
      <td style="font-weight:700;font-size:13px;padding:4px;">Police Station:</td>
      <td style="font-size:14px;padding:4px;border-bottom:1px dashed #ccc;">${v(g.policeStation as string)}</td>
    </tr>
    <tr>
      <td style="font-weight:700;font-size:13px;padding:4px;">Contact No.:</td>
      <td style="font-size:14px;padding:4px;">${v(g.phone as string)}</td>
    </tr>
  </table>
</div>

<p style="font-size:14px;line-height:24px;text-align:justify;">
  It is requested that the antecedents of the above-mentioned individual be verified and the findings communicated to this office at the earliest convenience.
</p>

<p style="font-size:14px;line-height:24px;text-align:justify;">
  Your cooperation in this regard is highly appreciated.
</p>

<div style="margin-top:50px;display:flex;justify-content:space-between;font-size:13px;">
  <div>Date: <strong>${fmtDate(g.createdAt as string)}</strong></div>
  <div style="text-align:center;">
    <div style="border-top:1px solid #000;width:200px;padding-top:4px;">Head of HR / Authorized Signatory</div>
    <div style="font-size:11px;color:#555;">${COMPANY}</div>
  </div>
</div>
</body></html>`
}

// ─── Iqrar Nama ───────────────────────────────────────────────────────────────

function generateIqrarNama(g: Record<string, unknown>, _baseUrl: string): string {
    return `<!doctype html><html><head><meta charset="utf-8"><title>Iqrar Nama – ${escHtml(String(g.parwestId ?? ""))}</title>
<style>
${HEADER_CSS}
body{padding:20px;max-width:900px;margin:0 auto;}
table{border-collapse:collapse;width:100%;}
</style></head><body>
${printBtn()}
<div style="position:relative;min-height:600px;">
  <img src="/iqrarnama3.jpg" style="width:100%;position:absolute;top:0;left:0;z-index:0;" alt="iqrar nama background"/>
  <div style="position:relative;z-index:1;">
    <div style="position:absolute;top:72px;left:130px;font-size:14px;font-weight:600;">${fmtDate(g.createdAt as string, "short")}</div>
    <div style="position:absolute;top:72px;left:530px;font-size:14px;font-weight:600;">${v(g.parwestId as string)}</div>
    <div style="position:absolute;top:203px;left:90px;font-size:14px;font-weight:600;">${v(g.cnic as string)}</div>
    <div style="position:absolute;top:203px;left:290px;font-size:14px;font-weight:600;">${v(g.fatherName as string)}</div>
    <div style="position:absolute;top:203px;left:480px;font-size:14px;font-weight:600;">${v(g.name as string)}</div>
  </div>
</div>
</body></html>`
}

// ─── Document type → slug mapping ────────────────────────────────────────────

const DOC_GENERATORS: Record<string, (g: Record<string, unknown>, baseUrl: string) => string> = {
    "form-a": generateFormA,
    "form-b": generateFormB,
    "employee-card": generateEmployeeCard,
    "personal-verification": generatePersonalVerification,
    "training-certificate": generateTrainingCertificate,
    "character-certificate": generateCharacterCertificate,
    "checklist": generateChecklist,
    "medical-certificate": generateMedicalCertificate,
    "antecedents": generateAntecedents,
    "iqrar-nama": generateIqrarNama,
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; docType: string }> }
) {
    const session = await auth()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })
    if (!hasAction(session, "GUARDS", "VIEW")) return forbidden("Access denied.")

    const { id, docType } = await params
    const generator = DOC_GENERATORS[docType]
    if (!generator) return new NextResponse("Unknown document type", { status: 404 })

    const guard = await prisma.guard.findUnique({ where: { id } })
    if (!guard) return new NextResponse("Guard not found", { status: 404 })

    const origin = new URL(request.url).origin
    const html = generator(guard as unknown as Record<string, unknown>, origin)

    return new NextResponse(html, {
        status: 200,
        headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
        },
    })
}