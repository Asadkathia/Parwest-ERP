import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { forbidden } from "@/lib/api/response"
import { hasModuleAccess } from "@/lib/api/permissions"

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
// Renders the guard's actual Training/OjtTrainingCheck rows as a checklist of
// completed categories with completion dates. Falls back to a graceful "no
// trainings on record" notice if none exist.

type TrainingRowForCert = {
    id: string
    trainingType: string
    completedAt: Date
    instructor: string | null
    notes: string | null
    ojtChecks: Array<{
        completed: boolean
        completedAt: Date | null
        notes: string | null
        category: { name: string } | null
    }>
}

function generateTrainingCertificate(
    g: Record<string, unknown>,
    baseUrl: string,
    trainings: TrainingRowForCert[] = []
): string {
    // Aggregate distinct completed categories across all trainings (latest date wins).
    const completedMap = new Map<string, Date>()
    for (const t of trainings) {
        for (const c of t.ojtChecks) {
            if (!c.completed || !c.category?.name) continue
            const when = c.completedAt ?? t.completedAt
            const prev = completedMap.get(c.category.name)
            if (!prev || (when && when > prev)) completedMap.set(c.category.name, when)
        }
    }
    const completedItems = Array.from(completedMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))

    const sessionsRows = trainings.length > 0
        ? trainings.map((t, i) => `
            <tr>
              <td style="border:1px solid #ccc;padding:6px;text-align:center;font-size:12px;width:36px;">${i + 1}</td>
              <td style="border:1px solid #ccc;padding:6px;font-size:13px;">${escHtml(t.trainingType || "—")}</td>
              <td style="border:1px solid #ccc;padding:6px;font-size:13px;">${escHtml(t.instructor || "—")}</td>
              <td style="border:1px solid #ccc;padding:6px;font-size:13px;text-align:center;width:140px;">${fmtDate(t.completedAt, "short")}</td>
            </tr>`).join("")
        : `<tr><td colspan="4" style="border:1px solid #ccc;padding:14px;text-align:center;font-size:12px;color:#888;font-style:italic;">No training sessions on record.</td></tr>`

    const itemsRows = completedItems.length > 0
        ? completedItems.map(([name, when], i) => `
            <tr>
              <td style="border:1px solid #ccc;padding:6px;text-align:center;font-size:12px;width:36px;">${i + 1}</td>
              <td style="border:1px solid #ccc;padding:6px;font-size:13px;">${escHtml(name)}</td>
              <td style="border:1px solid #ccc;padding:6px;font-size:14px;text-align:center;width:60px;color:#15803d;">&#10004;</td>
              <td style="border:1px solid #ccc;padding:6px;font-size:13px;text-align:center;width:140px;">${fmtDate(when, "short")}</td>
            </tr>`).join("")
        : `<tr><td colspan="4" style="border:1px solid #ccc;padding:14px;text-align:center;font-size:12px;color:#888;font-style:italic;">No OJT items completed yet.</td></tr>`

    const photoBox = g.photoUrl
        ? `<img src="${escHtml(String(g.photoUrl))}" style="width:90px;height:110px;object-fit:cover;border:1px solid #ccc;" alt="photo"/>`
        : `<div style="width:90px;height:110px;border:1px dashed #aaa;display:flex;align-items:center;justify-content:center;font-size:10px;color:#999;">No Photo</div>`

    return `<!doctype html><html><head><meta charset="utf-8"><title>Training Certificate – ${escHtml(String(g.parwestId ?? ""))}</title>
<style>
${HEADER_CSS}
body{padding:20px;max-width:900px;margin:0 auto;}
.cert{border:3px solid #1a3a5c;padding:32px;background:#fff;position:relative;}
.cert::before{content:'';position:absolute;inset:8px;border:1px solid #1a3a5c;pointer-events:none;}
.watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);opacity:0.04;font-size:64px;font-weight:700;color:#1a3a5c;white-space:nowrap;pointer-events:none;}
table{border-collapse:collapse;width:100%;}
@page{size:A4 portrait;margin:10mm;}
</style></head><body>
${printBtn()}
<div class="cert">
  <div class="watermark">${escHtml(COMPANY)}</div>

  <div style="display:flex;align-items:center;gap:16px;margin-bottom:18px;">
    <img src="${baseUrl}${LOGO}" style="width:70px;height:70px;" alt="logo"/>
    <div style="flex:1;">
      <div style="font-size:18px;font-weight:700;color:#1a3a5c;">${escHtml(COMPANY)}</div>
      <div style="font-size:11px;color:#555;">${escHtml(ADDRESS)}</div>
    </div>
    <div style="text-align:right;font-size:12px;font-weight:600;color:#1a3a5c;">
      Ref: ${v(g.parwestId as string)}<br/>
      Date: ${fmtDate(new Date(), "short")}
    </div>
  </div>

  <div style="text-align:center;margin:14px 0 18px;">
    <h2 style="font-size:26px;font-weight:700;color:#1a3a5c;text-decoration:underline;text-transform:uppercase;margin:0;">Training Certificate</h2>
  </div>

  <p style="font-size:13px;text-align:center;margin:6px 0 20px;line-height:1.55;">
    This is to certify that the security personnel detailed below has successfully completed the
    On-Job Training (OJT) modules listed in this certificate, conducted under the supervision of
    ${escHtml(COMPANY)}.
  </p>

  <table style="margin-bottom:14px;">
    <tr>
      <td rowspan="5" style="border:1px solid #ccc;padding:6px;width:104px;text-align:center;vertical-align:middle;">${photoBox}</td>
      <td style="border:1px solid #ccc;padding:6px;font-weight:700;font-size:12px;background:#f5f5f5;width:160px;">PPS Registration No.</td>
      <td style="border:1px solid #ccc;padding:6px;font-size:13px;">${v(g.parwestId as string)}</td>
    </tr>
    <tr>
      <td style="border:1px solid #ccc;padding:6px;font-weight:700;font-size:12px;background:#f5f5f5;">Guard Name</td>
      <td style="border:1px solid #ccc;padding:6px;font-size:13px;">${v(g.name as string)}</td>
    </tr>
    <tr>
      <td style="border:1px solid #ccc;padding:6px;font-weight:700;font-size:12px;background:#f5f5f5;">Father&#39;s Name</td>
      <td style="border:1px solid #ccc;padding:6px;font-size:13px;">${v(g.fatherName as string)}</td>
    </tr>
    <tr>
      <td style="border:1px solid #ccc;padding:6px;font-weight:700;font-size:12px;background:#f5f5f5;">CNIC #</td>
      <td style="border:1px solid #ccc;padding:6px;font-size:13px;">${v(g.cnic as string)}</td>
    </tr>
    <tr>
      <td style="border:1px solid #ccc;padding:6px;font-weight:700;font-size:12px;background:#f5f5f5;">Designation / Enrollment</td>
      <td style="border:1px solid #ccc;padding:6px;font-size:13px;">${v(g.designation as string)} &nbsp;|&nbsp; ${fmtDate((g.dateOfEnrollment ?? g.joiningDate) as string, "short")}</td>
    </tr>
  </table>

  <h3 style="background:#4a4a4a;color:#fff;padding:5px 8px;font-size:12px;margin:14px 0 0;">Training Sessions</h3>
  <table>
    <tr>
      <th style="border:1px solid #ccc;background:#f0f0f0;padding:6px;font-size:12px;width:36px;">#</th>
      <th style="border:1px solid #ccc;background:#f0f0f0;padding:6px;font-size:12px;text-align:left;">Training Type</th>
      <th style="border:1px solid #ccc;background:#f0f0f0;padding:6px;font-size:12px;text-align:left;">Instructor</th>
      <th style="border:1px solid #ccc;background:#f0f0f0;padding:6px;font-size:12px;width:140px;">Date Completed</th>
    </tr>
    ${sessionsRows}
  </table>

  <h3 style="background:#4a4a4a;color:#fff;padding:5px 8px;font-size:12px;margin:14px 0 0;">Completed OJT Modules</h3>
  <table>
    <tr>
      <th style="border:1px solid #ccc;background:#f0f0f0;padding:6px;font-size:12px;width:36px;">#</th>
      <th style="border:1px solid #ccc;background:#f0f0f0;padding:6px;font-size:12px;text-align:left;">Module / Category</th>
      <th style="border:1px solid #ccc;background:#f0f0f0;padding:6px;font-size:12px;width:60px;">Status</th>
      <th style="border:1px solid #ccc;background:#f0f0f0;padding:6px;font-size:12px;width:140px;">Completed On</th>
    </tr>
    ${itemsRows}
  </table>

  <div style="margin-top:32px;display:flex;justify-content:space-between;font-size:11px;">
    <div style="text-align:center;">
      <div style="border-top:1px solid #000;width:170px;padding-top:4px;">Training Officer</div>
    </div>
    <div style="text-align:center;">
      <div style="border-top:1px solid #000;width:170px;padding-top:4px;">HR Manager</div>
    </div>
    <div style="text-align:center;">
      <div style="border-top:1px solid #000;width:170px;padding-top:4px;">Managing Director</div>
    </div>
  </div>
</div>
</body></html>`
}

// ─── Character Certificate ────────────────────────────────────────────────────

function generateCharacterCertificate(g: Record<string, unknown>, baseUrl: string): string {
    const today = new Date()
    const place = process.env.PARWEST_LETTERHEAD_PLACE || "Lahore"
    const enrollmentDate = (g.dateOfEnrollment ?? g.joiningDate) as string | Date | null | undefined
    const photoBox = g.photoUrl
        ? `<img src="${escHtml(String(g.photoUrl))}" style="width:96px;height:118px;object-fit:cover;border:1px solid #999;" alt="photo"/>`
        : `<div style="width:96px;height:118px;border:1px dashed #aaa;display:flex;align-items:center;justify-content:center;font-size:10px;color:#999;">No Photo</div>`

    return `<!doctype html><html><head><meta charset="utf-8"><title>Character Certificate – ${escHtml(String(g.parwestId ?? ""))}</title>
<style>
${HEADER_CSS}
body{padding:30px;max-width:820px;margin:0 auto;color:#111;}
@page{size:A4 portrait;margin:14mm;}
.lh-line{border-top:2px solid #1a3a5c;border-bottom:1px solid #1a3a5c;height:6px;margin:6px 0 14px;}
</style></head><body>
${printBtn()}

<!-- Letterhead -->
<table style="width:100%;border-collapse:collapse;margin-bottom:0;">
  <tr>
    <td style="vertical-align:middle;width:120px;padding-right:14px;">
      <img src="${baseUrl}${LOGO}" style="width:108px;height:108px;object-fit:contain;" alt="logo"/>
    </td>
    <td style="vertical-align:middle;">
      <h1 style="margin:0;font-size:26px;font-weight:800;color:#1a3a5c;text-transform:uppercase;letter-spacing:0.4px;">${escHtml(COMPANY)}</h1>
      <div style="margin:3px 0 0;font-size:12px;color:#444;">${escHtml(ADDRESS)}</div>
      <div style="margin:2px 0 0;font-size:12px;color:#444;">Tel: ${escHtml(PHONE)} &nbsp;|&nbsp; Fax: ${escHtml(FAX)} &nbsp;|&nbsp; Email: ${escHtml(EMAIL)}</div>
    </td>
  </tr>
</table>
<div class="lh-line"></div>

<!-- Reference / date row -->
<div style="display:flex;justify-content:space-between;font-size:12px;margin:6px 0 18px;">
  <div><strong>Ref:</strong> PPS/HR/CC/${v(g.parwestId as string)}</div>
  <div><strong>Date:</strong> ${fmtDate(today)}</div>
</div>

<!-- Title -->
<div style="text-align:center;margin:20px 0 10px;">
  <h2 style="font-size:24px;font-weight:800;text-decoration:underline;text-transform:uppercase;margin:0;letter-spacing:0.6px;">Character Certificate</h2>
  <div style="font-size:11px;color:#666;margin-top:4px;text-transform:uppercase;letter-spacing:1px;">To Whom It May Concern</div>
</div>

<!-- Identity block with photo -->
<table style="width:100%;border-collapse:collapse;margin:18px 0 8px;">
  <tr>
    <td style="vertical-align:top;padding-right:14px;">
      <table style="border-collapse:collapse;width:100%;font-size:13px;">
        <tr>
          <td style="padding:4px 6px;font-weight:700;width:42%;">Name</td>
          <td style="padding:4px 6px;">${v(g.name as string)}</td>
        </tr>
        <tr>
          <td style="padding:4px 6px;font-weight:700;">Father&#39;s Name</td>
          <td style="padding:4px 6px;">${v(g.fatherName as string)}</td>
        </tr>
        <tr>
          <td style="padding:4px 6px;font-weight:700;">CNIC No.</td>
          <td style="padding:4px 6px;">${v(g.cnic as string)}</td>
        </tr>
        <tr>
          <td style="padding:4px 6px;font-weight:700;">PPS Registration No.</td>
          <td style="padding:4px 6px;">${v(g.parwestId as string)}</td>
        </tr>
        <tr>
          <td style="padding:4px 6px;font-weight:700;">Designation</td>
          <td style="padding:4px 6px;">${v(g.designation as string)}</td>
        </tr>
        <tr>
          <td style="padding:4px 6px;font-weight:700;">Date of Enrollment</td>
          <td style="padding:4px 6px;">${fmtDate(enrollmentDate)}</td>
        </tr>
      </table>
    </td>
    <td style="vertical-align:top;width:110px;text-align:center;">${photoBox}</td>
  </tr>
</table>

<!-- Attestation paragraph -->
<div style="font-size:14px;line-height:1.85;text-align:justify;margin:22px 0 24px;">
  <p style="margin:0 0 12px;">
    This is to certify that <strong>${v(g.name as string)}</strong> S/o <strong>${v(g.fatherName as string)}</strong>,
    holder of CNIC No. <strong>${v(g.cnic as string)}</strong>, has been enrolled with
    ${escHtml(COMPANY)} bearing PPS Registration No. <strong>${v(g.parwestId as string)}</strong>
    with effect from ${fmtDate(enrollmentDate)}.
  </p>
  <p style="margin:0 0 12px;">
    During the period of his association with this company, his character and conduct have been found
    to be <strong>satisfactory</strong>. He is physically fit, reasonably intelligent and alert, and to the best
    of our knowledge has <strong>no criminal record</strong> as confirmed by the verification of the concerned
    Police Station and through references provided at the time of enrollment.
  </p>
  <p style="margin:0;">
    This certificate is issued on his request for record purposes and may be used for any lawful
    employment, verification or regulatory requirement.
  </p>
</div>

<!-- Place / Date / Signature -->
<table style="width:100%;border-collapse:collapse;margin-top:46px;font-size:12px;">
  <tr>
    <td style="vertical-align:bottom;width:50%;">
      <div><strong>Place:</strong> ${escHtml(place)}</div>
      <div style="margin-top:6px;"><strong>Date:</strong> ${fmtDate(today)}</div>
    </td>
    <td style="vertical-align:bottom;text-align:center;width:50%;">
      <div style="height:48px;"></div>
      <div style="border-top:1px solid #000;width:240px;margin:0 auto;padding-top:4px;font-weight:700;">
        Head of HR / Authorized Signatory
      </div>
      <div style="font-size:11px;color:#555;margin-top:2px;">${escHtml(COMPANY)}</div>
      <div style="font-size:10px;color:#777;margin-top:1px;">(Company Seal &amp; Stamp)</div>
    </td>
  </tr>
</table>
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
    // Doctor / clinic identity is configured via env (no Setting model exists yet).
    // Falls back to company-default values that the user can override later via env or
    // a future settings table.
    const doctorName = process.env.PARWEST_MEDICAL_DOCTOR_NAME || "Dr. Major (R) Navid Ahmed, MBBS"
    const doctorTitle = process.env.PARWEST_MEDICAL_DOCTOR_TITLE || "Medical Officer"
    const clinicName = process.env.PARWEST_MEDICAL_CLINIC_NAME || COMPANY
    const clinicLicense = process.env.PARWEST_MEDICAL_LICENSE || ""
    const today = new Date()

    const photoBox = g.photoUrl
        ? `<img src="${escHtml(String(g.photoUrl))}" style="width:96px;height:118px;object-fit:cover;border:1px solid #999;" alt="photo"/>`
        : `<div style="width:96px;height:118px;border:1px dashed #aaa;display:flex;align-items:center;justify-content:center;font-size:10px;color:#999;">No Photo</div>`

    const heightVal = v(g.height as string)
    const weightStr = (g.weight as string | null | undefined)?.toString().trim()
    const weightVal = weightStr ? `${escHtml(weightStr)} Kg` : "—"
    const ageVal = g.age ? `${escHtml(String(g.age))} Years` : "—"
    const bloodVal = v(g.bloodGroup as string)
    const eyeVal = v(g.eyeColor as string)
    const disabilityVal = v(g.disability as string, "None reported")
    const idMarkVal = v(g.identificationMark as string)

    return `<!doctype html><html><head><meta charset="utf-8"><title>Medical Certificate – ${escHtml(String(g.parwestId ?? ""))}</title>
<style>
${HEADER_CSS}
body{padding:30px;max-width:820px;margin:0 auto;color:#111;}
@page{size:A4 portrait;margin:14mm;}
table{border-collapse:collapse;width:100%;}
.lh-line{border-top:2px solid #1a3a5c;border-bottom:1px solid #1a3a5c;height:6px;margin:6px 0 14px;}
</style></head><body>
${printBtn()}

<!-- Letterhead -->
<table style="margin-bottom:0;">
  <tr>
    <td style="vertical-align:middle;width:120px;padding-right:14px;">
      <img src="${baseUrl}${LOGO}" style="width:108px;height:108px;object-fit:contain;" alt="logo"/>
    </td>
    <td style="vertical-align:middle;">
      <h1 style="margin:0;font-size:24px;font-weight:800;color:#1a3a5c;text-transform:uppercase;">${escHtml(COMPANY)}</h1>
      <div style="margin:3px 0 0;font-size:12px;color:#444;">${escHtml(ADDRESS)}</div>
      <div style="margin:2px 0 0;font-size:12px;color:#444;">Tel: ${escHtml(PHONE)} &nbsp;|&nbsp; Email: ${escHtml(EMAIL)}</div>
    </td>
  </tr>
</table>
<div class="lh-line"></div>

<!-- Doctor / clinic banner -->
<div style="background:#f5f5f5;border:1px solid #ddd;padding:10px 14px;margin-bottom:14px;border-radius:4px;">
  <div style="font-size:15px;font-weight:700;">${escHtml(doctorName)}</div>
  <div style="font-size:12px;color:#555;">${escHtml(doctorTitle)}, ${escHtml(clinicName)}${clinicLicense ? ` &nbsp;|&nbsp; Lic: ${escHtml(clinicLicense)}` : ""}</div>
</div>

<!-- Reference / date row -->
<div style="display:flex;justify-content:space-between;font-size:12px;margin:6px 0 10px;">
  <div><strong>Ref:</strong> PPS/MED/${v(g.parwestId as string)}</div>
  <div><strong>Date of Examination:</strong> ${fmtDate(today)}</div>
</div>

<!-- Title -->
<div style="text-align:center;margin:14px 0 12px;">
  <h3 style="font-size:14px;font-weight:700;text-transform:uppercase;margin:0;letter-spacing:1.5px;">To Whom It May Concern</h3>
  <h2 style="font-size:24px;font-weight:800;text-decoration:underline;text-transform:uppercase;margin:6px 0 0;letter-spacing:0.6px;">Medical Fitness Certificate</h2>
</div>

<!-- Intro paragraph -->
<p style="font-size:13.5px;line-height:1.7;text-align:justify;margin:14px 0;">
  This is to certify that I have personally examined the below-named individual on the date stated
  above. Based on physical examination and review of the routine clinical findings, the individual
  is found <strong>medically fit</strong> to perform the duties of a Security Guard with ${escHtml(COMPANY)}.
</p>

<!-- Identity + photo -->
<table style="margin:12px 0 6px;">
  <tr>
    <td style="vertical-align:top;padding-right:14px;">
      <table style="border-collapse:collapse;width:100%;">
        <tr>
          <td style="border:1px solid #ccc;padding:6px;font-weight:700;font-size:12px;background:#f9f9f9;width:42%;">Name</td>
          <td style="border:1px solid #ccc;padding:6px;font-size:13px;">${v(g.name as string)}</td>
        </tr>
        <tr>
          <td style="border:1px solid #ccc;padding:6px;font-weight:700;font-size:12px;background:#f9f9f9;">Father&#39;s Name</td>
          <td style="border:1px solid #ccc;padding:6px;font-size:13px;">${v(g.fatherName as string)}</td>
        </tr>
        <tr>
          <td style="border:1px solid #ccc;padding:6px;font-weight:700;font-size:12px;background:#f9f9f9;">CNIC #</td>
          <td style="border:1px solid #ccc;padding:6px;font-size:13px;">${v(g.cnic as string)}</td>
        </tr>
        <tr>
          <td style="border:1px solid #ccc;padding:6px;font-weight:700;font-size:12px;background:#f9f9f9;">PPS Registration No.</td>
          <td style="border:1px solid #ccc;padding:6px;font-size:13px;">${v(g.parwestId as string)}</td>
        </tr>
        <tr>
          <td style="border:1px solid #ccc;padding:6px;font-weight:700;font-size:12px;background:#f9f9f9;">Designation</td>
          <td style="border:1px solid #ccc;padding:6px;font-size:13px;">${v(g.designation as string)}</td>
        </tr>
      </table>
    </td>
    <td style="vertical-align:top;width:110px;text-align:center;">${photoBox}</td>
  </tr>
</table>

<!-- Clinical findings -->
<h3 style="background:#4a4a4a;color:#fff;padding:5px 8px;font-size:12px;margin:14px 0 0;">Clinical Findings</h3>
<table>
  <tr>
    <td style="border:1px solid #ccc;padding:6px;font-weight:700;font-size:12px;background:#f9f9f9;width:24%;">Age</td>
    <td style="border:1px solid #ccc;padding:6px;font-size:13px;width:26%;">${ageVal}</td>
    <td style="border:1px solid #ccc;padding:6px;font-weight:700;font-size:12px;background:#f9f9f9;width:24%;">Blood Group</td>
    <td style="border:1px solid #ccc;padding:6px;font-size:13px;">${bloodVal}</td>
  </tr>
  <tr>
    <td style="border:1px solid #ccc;padding:6px;font-weight:700;font-size:12px;background:#f9f9f9;">Height</td>
    <td style="border:1px solid #ccc;padding:6px;font-size:13px;">${heightVal}</td>
    <td style="border:1px solid #ccc;padding:6px;font-weight:700;font-size:12px;background:#f9f9f9;">Weight</td>
    <td style="border:1px solid #ccc;padding:6px;font-size:13px;">${weightVal}</td>
  </tr>
  <tr>
    <td style="border:1px solid #ccc;padding:6px;font-weight:700;font-size:12px;background:#f9f9f9;">Eye Colour</td>
    <td style="border:1px solid #ccc;padding:6px;font-size:13px;">${eyeVal}</td>
    <td style="border:1px solid #ccc;padding:6px;font-weight:700;font-size:12px;background:#f9f9f9;">Identification Mark</td>
    <td style="border:1px solid #ccc;padding:6px;font-size:13px;">${idMarkVal}</td>
  </tr>
  <tr>
    <td style="border:1px solid #ccc;padding:6px;font-weight:700;font-size:12px;background:#f9f9f9;">Disability</td>
    <td colspan="3" style="border:1px solid #ccc;padding:6px;font-size:13px;">${disabilityVal}</td>
  </tr>
  <tr>
    <td style="border:1px solid #ccc;padding:6px;font-weight:700;font-size:12px;background:#f9f9f9;">Overall Assessment</td>
    <td colspan="3" style="border:1px solid #ccc;padding:6px;font-size:13px;color:#15803d;font-weight:700;">FIT FOR DUTY</td>
  </tr>
</table>

<p style="font-size:12.5px;line-height:1.7;text-align:justify;margin:14px 0;">
  No significant physical or mental health condition was observed at the time of examination that
  would prevent the individual from performing the duties of a Security Guard. This certificate is
  issued for record / regulatory purposes.
</p>

<!-- Sig block -->
<table style="margin-top:42px;">
  <tr>
    <td style="vertical-align:bottom;width:50%;font-size:12px;">
      <div><strong>Date:</strong> ${fmtDate(today)}</div>
    </td>
    <td style="vertical-align:bottom;text-align:center;width:50%;">
      <div style="height:48px;"></div>
      <div style="border-top:1px solid #000;width:240px;margin:0 auto;padding-top:4px;font-weight:700;font-size:12px;">
        ${escHtml(doctorName)}
      </div>
      <div style="font-size:11px;color:#555;margin-top:2px;">${escHtml(doctorTitle)}</div>
      <div style="font-size:10px;color:#777;margin-top:1px;">(Doctor&#39;s Stamp &amp; Signature)</div>
    </td>
  </tr>
</table>
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

// ─── PBA SA-05 / SA-10 / SA-11 ───────────────────────────────────────────────
// Server-side equivalents of the legacy client-side templates that lived in
// PBADocumentsTab.tsx. Centralising them here means: audit-logged, no popup
// blockers, proper Content-Disposition for download, consistent escaping.

type RelativeRef = {
    name?: string
    fatherName?: string
    relation?: string
    profession?: string
    cnic?: string
    contact?: string
    address?: string
}

function generateSA05(g: Record<string, unknown>, _baseUrl: string): string {
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<title>PBA SA-05 — ${escHtml(String(g.name ?? ""))}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:Arial,sans-serif;font-size:11px;color:#000;background:#fff;}
  .page{max-width:800px;margin:0 auto;padding:20px 24px;position:relative;}
  .pba-ref{position:absolute;top:14px;right:24px;font-weight:bold;font-size:11px;border:1px solid #000;padding:2px 8px;}
  table{width:100%;border-collapse:collapse;}
  td,th{border:1px solid #333;padding:5px 9px;vertical-align:top;}
  .header-cell{text-align:center;font-weight:bold;padding:7px;}
  .lbl{width:46%;}
  .blue{color:#1d4ed8;}
  .red{color:#dc2626;}
  .sec{font-weight:bold;background:#1a1a1a;color:#fff;padding:5px 9px;font-size:11px;margin-top:10px;}
  .gap{height:10px;border:none;}
  .guard-id{text-align:right;margin-top:6px;font-size:11px;font-weight:bold;}
  @page{size:A4 portrait;margin:10mm;}
  @media print{button{display:none!important;}}
</style></head><body>
${printBtn()}
<div class="page">
  <div class="pba-ref">PBA-SA-05</div>
  <table>
    <tr><td colspan="2" class="header-cell" style="font-size:13px;border-bottom:none;padding:10px 8px;">PARTICULARS &amp; DOCUMENTS OF GUARDS / SUPERVISORS</td></tr>
    <tr><td colspan="2" class="header-cell" style="border-top:none;padding:5px 8px;">FOR PBA RECORDS PURPOSES</td></tr>
    <tr><td class="lbl" style="font-weight:bold;">EMPLOYER SECURITY AGENCY</td><td class="blue" style="font-weight:bold;">${escHtml(COMPANY)}</td></tr>
    <tr><td colspan="2" style="border:none;" class="gap"></td></tr>
    <tr><td class="lbl">CNIC Number</td><td class="blue">${v(g.cnic as string)}</td></tr>
    <tr><td>Name</td><td class="blue">${v(g.name as string)}</td></tr>
    <tr><td>Father&#39;s Name</td><td class="blue">${v(g.fatherName as string)}</td></tr>
    <tr><td>Date of Birth</td><td class="blue">${fmtDate(g.dateOfBirth as string, "short")}</td></tr>
    <tr><td colspan="2" style="border:none;" class="gap"></td></tr>
  </table>

  <div class="sec">Training Particulars (For Guards Training)</div>
  <table>
    <tr><td class="lbl">Name of Training Institute</td><td class="blue">APSAA Training School</td></tr>
    <tr><td>Training Period (Specific dates &nbsp; from - to)</td><td><span class="red">One week mandatory training</span> &nbsp;&nbsp;&nbsp;&nbsp; To</td></tr>
    <tr><td>Name of Firing Range where last Firing Session Taken</td><td class="blue">APSAA Training School</td></tr>
    <tr><td>Date of Firing Session:</td><td></td></tr>
  </table>

  <div class="sec">Medical Fitness Status</div>
  <table>
    <tr><td class="lbl">Hospital / Clinic / Doctor Name</td><td></td></tr>
    <tr><td>Checkup Date</td><td></td></tr>
    <tr><td>Checkup Status (Fit / Unfit)</td><td></td></tr>
    <tr><td>Comments</td><td></td></tr>
    <tr><td colspan="2" style="border:none;" class="gap"></td></tr>
  </table>

  <table style="margin-top:10px;">
    <tr><td class="lbl" style="font-weight:bold;">Attachments:</td><td></td></tr>
    <tr><td>CNIC Photocopy (both sides)</td><td class="blue">Attached</td></tr>
    <tr><td>Photograph (Not more than 6 months old)</td><td class="blue">Attached</td></tr>
    <tr><td colspan="2" style="height:64px;padding:8px 9px;vertical-align:bottom;">Signature &amp; Stamp of Security Agency</td></tr>
  </table>

  <div class="guard-id">${v(g.parwestId as string)}</div>
</div>
</body></html>`
}

function generateSA10(g: Record<string, unknown>, _baseUrl: string): string {
    const rels = parseJson<RelativeRef>(g.nearestRelativesJson as string)
    const ref1 = rels[0] ?? {}
    const ref2 = rels[1] ?? {}

    const refBlock = (ref: RelativeRef, num: string) => `
    <tr><td class="lbl">Name of ${num} Reference</td><td class="blue">${v(ref.name)}</td></tr>
    <tr><td>CNIC Number</td><td class="blue">${v(ref.cnic)}</td></tr>
    <tr><td>Relationship</td><td class="blue">${v(ref.relation)}</td></tr>
    <tr><td>Address</td><td class="blue" style="min-height:36px;">${v(ref.address)}</td></tr>
    <tr><td colspan="2" style="border:none;height:4px;"></td></tr>
    <tr><td>Phone Number</td><td class="blue">${v(ref.contact)}</td></tr>`

    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<title>PBA SA-10 — ${escHtml(String(g.name ?? ""))}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:Arial,sans-serif;font-size:10.5px;color:#000;background:#fff;}
  .page{max-width:800px;margin:0 auto;padding:20px 24px;position:relative;}
  .pba-ref{position:absolute;top:14px;right:24px;font-weight:bold;font-size:11px;border:1px solid #000;padding:2px 8px;}
  table{width:100%;border-collapse:collapse;margin-bottom:3px;}
  td{border:1px solid #333;padding:4px 9px;vertical-align:top;}
  .header-cell{text-align:center;font-weight:bold;padding:6px 8px;}
  .lbl{width:42%;}
  .blue{color:#1d4ed8;}
  .sec-hdr{font-weight:bold;background:#1a1a1a;color:#fff;padding:5px 9px;font-size:11px;margin-top:6px;}
  .conf-text{font-size:10.5px;padding:8px 9px;line-height:1.5;border:1px solid #333;border-top:none;}
  .sig-row{display:flex;gap:24px;padding:18px 9px 8px;font-size:10.5px;border:1px solid #333;border-top:none;}
  .sig-line{flex:1;border-bottom:1px solid #000;padding-bottom:2px;}
  .guard-id{text-align:right;margin-top:6px;font-size:11px;font-weight:bold;}
  @page{size:A4 portrait;margin:10mm;}
  @media print{button{display:none!important;}}
</style></head><body>
${printBtn()}
<div class="page">
  <div class="pba-ref">PBA-SA-10</div>
  <table>
    <tr><td colspan="2" class="header-cell" style="font-size:11.5px;padding:8px;">PARTICULARS OF EX-SERVICEMEN (ARMED / PARA MILITARY FORCES) GUARDS / SUPERVISORS</td></tr>
    <tr><td class="lbl" style="font-weight:bold;">EMPLOYER SECURITY AGENCY</td><td style="font-weight:bold;">${escHtml(COMPANY)}</td></tr>
    <tr><td colspan="2" style="border:none;height:6px;"></td></tr>
    <tr><td>CNIC Number</td><td class="blue">${v(g.cnic as string)}</td></tr>
    <tr><td>Name</td><td class="blue">${v(g.name as string)}</td></tr>
    <tr><td>Joining Date</td><td class="blue">${fmtDate(g.joiningDate as string, "short")}</td></tr>
    <tr><td>Permanent Address</td><td class="blue" style="min-height:40px;">${v(g.addressPermanent as string)}</td></tr>
    <tr><td colspan="2" style="border:none;height:4px;"></td></tr>
    <tr><td>Phone Numbers</td><td class="blue">${v(g.phone as string)}</td></tr>
    <tr><td>Residential Address</td><td class="blue" style="min-height:40px;">${v((g.addressCurrent as string) || (g.addressPermanent as string))}</td></tr>
    <tr><td colspan="2" style="border:none;height:4px;"></td></tr>
    <tr><td>Phone Numbers</td><td class="blue">${v(g.phone as string)}</td></tr>
  </table>

  <table>${refBlock(ref1, "1st")}</table>
  <table>${refBlock(ref2, "2nd")}</table>

  <table>
    <tr><td class="lbl">Name of Armed Forces Unit Served</td><td class="blue">${v(g.exServiceUnit as string)}</td></tr>
    <tr><td>Joining Date &amp; Departure Date</td><td class="blue">${v(g.exServicePeriod as string)}</td></tr>
    <tr><td>Last Employer (other than Armed Forces)</td><td></td></tr>
    <tr><td>Joining Date &amp; Departure Date</td><td></td></tr>
    <tr><td>2nd Last Employer (other than Armed Forces)</td><td></td></tr>
    <tr><td>Joining Date &amp; Departure Date</td><td></td></tr>
  </table>

  <div class="sec-hdr">CONFIRMATION OF VERIFICATION OF CREDENTIALS</div>
  <div class="conf-text">
    We hereby confirm that verification of the above particulars have been completed by us from concerned/
    relevant departments/authorities/organizations/persons.
  </div>
  <div class="sig-row">
    <div style="font-weight:bold;min-width:220px;">COMPANY AUTHORIZED SIGNATURE</div>
    <div style="flex:1;">
      <div>Name <span class="sig-line">&nbsp;</span></div>
      <div style="margin-top:10px;">Date <span class="sig-line">&nbsp;</span></div>
    </div>
  </div>

  <div class="guard-id">${v(g.parwestId as string)}</div>
</div>
</body></html>`
}

function generateSA11(g: Record<string, unknown>, _baseUrl: string): string {
    const rels = parseJson<RelativeRef>(g.nearestRelativesJson as string)
    const ref1 = rels[0] ?? {}
    const ref2 = rels[1] ?? {}

    const refRow = (ref: RelativeRef, num: string) => `
    <tr><td class="lbl">Name of ${num} Reference</td><td class="blue">${v(ref.name)}</td></tr>
    <tr><td>CNIC Number</td><td class="blue">${v(ref.cnic)}</td></tr>
    <tr><td>Relationship</td><td class="blue">${v(ref.relation)}</td></tr>
    <tr><td>Address</td><td class="blue">${v(ref.address)}</td></tr>
    <tr><td>Phone Number</td><td class="blue">${v(ref.contact)}</td></tr>`

    const verifRef = (ref: RelativeRef, num: string) => `
    <tr><td>${num} REFERENCE</td><td>${ref.name
        ? `<span class="blue">${v(ref.name)}</span>&emsp;<span class="blue">${v(ref.relation)}</span>&emsp;Through personal telephonic verification`
        : "—"
      }</td></tr>`

    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<title>PBA SA-11 — ${escHtml(String(g.name ?? ""))}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:Arial,sans-serif;font-size:10.5px;color:#000;background:#fff;}
  .page{max-width:800px;margin:0 auto;padding:20px 24px;position:relative;}
  .pba-ref{position:absolute;top:14px;right:24px;font-weight:bold;font-size:11px;border:1px solid #000;padding:2px 8px;}
  table{width:100%;border-collapse:collapse;margin-bottom:4px;}
  td{border:1px solid #333;padding:4px 9px;vertical-align:top;}
  .header-cell{text-align:center;font-weight:bold;padding:6px;}
  .lbl{width:42%;}
  .blue{color:#1d4ed8;}
  .sec-hdr{font-weight:bold;border:1px solid #333;border-bottom:none;padding:4px 9px;background:#f0f0f0;font-size:11px;margin-top:6px;}
  .note{font-size:9px;font-style:italic;padding:3px 9px;}
  .guard-id{text-align:right;margin-top:6px;font-size:11px;font-weight:bold;}
  @page{size:A4 portrait;margin:10mm;}
  @media print{button{display:none!important;}}
</style></head><body>
${printBtn()}
<div class="page">
  <div class="pba-ref">PBA-SA-11</div>
  <table>
    <tr><td colspan="2" class="header-cell" style="font-size:12px;border-bottom:none;padding:9px 8px;">VERIFICATION STATUS OF PARTICULARS OF GUARDS / SUPERVISORS</td></tr>
    <tr><td colspan="2" class="header-cell" style="border-top:none;padding:5px 8px;">FOR PBA RECORDS</td></tr>
    <tr><td class="lbl" style="font-weight:bold;">EMPLOYER SECURITY AGENCY</td><td style="font-weight:bold;">${escHtml(COMPANY).toUpperCase()}</td></tr>
    <tr><td>CNIC Number</td><td class="blue">${v(g.cnic as string)}</td></tr>
    <tr><td>Name</td><td class="blue">${v(g.name as string)}</td></tr>
    <tr><td>Joining Date</td><td class="blue">${fmtDate(g.joiningDate as string, "short")}</td></tr>
    <tr><td>Permanent Address</td><td class="blue">${v(g.addressPermanent as string)}</td></tr>
    <tr><td>Phone Numbers</td><td class="blue">${v(g.phone as string)}</td></tr>
    <tr><td>Residential Address</td><td class="blue">${v((g.addressCurrent as string) || (g.addressPermanent as string))}</td></tr>
    <tr><td>Phone Numbers</td><td class="blue">${v(g.phone as string)}</td></tr>
  </table>

  <table>${refRow(ref1, "1st")}</table>
  <table>${refRow(ref2, "2nd")}</table>

  <table>
    <tr><td class="lbl">Name of Last Employer</td><td class="blue">No Employed Before</td></tr>
    <tr><td>Joining Date &amp; Departure Date</td><td>-</td></tr>
    <tr><td>Employment Document Submitted</td><td>-</td></tr>
    <tr><td>Name of 2nd Last Employer</td><td class="blue">No Employed Before</td></tr>
    <tr><td>Joining Date &amp; Departure Date</td><td>-</td></tr>
    <tr><td>Employment Document Submitted</td><td>-</td></tr>
    <tr><td>Name of 3rd Last Employer</td><td class="blue">No Employed Before</td></tr>
    <tr><td>Joining Date &amp; Departure Date</td><td>-</td></tr>
    <tr><td>Employment Document Submitted</td><td>-</td></tr>
    <tr><td colspan="2" class="note">(Where incumbent has had more than three employers in last 15 years, provide further information on extra sheet)</td></tr>
  </table>

  <div class="sec-hdr">VERIFICATION STATUS:</div>
  <table>
    <tr><td class="lbl">CNIC</td><td class="blue">Through NADRA Verisys</td></tr>
    <tr><td>PERMANENT ADDRESS &amp; PHONE</td><td class="blue">Through Home Town Police Verification</td></tr>
    <tr><td>RESIDENTIAL ADDRESS &amp; PHONE</td><td class="blue">Same as Above</td></tr>
    ${verifRef(ref1, "1ST")}
    ${verifRef(ref2, "2ND")}
    <tr><td>LAST EMPLOYMENT</td><td class="blue">No Employed Before</td></tr>
    <tr><td>2ND LAST EMPLOYMENT</td><td class="blue">No Employed Before</td></tr>
    <tr><td>3RD LAST EMPLOYMENT</td><td class="blue">No Employed Before</td></tr>
    <tr><td>COMPANY SIGNATURE &amp; STAMP</td><td style="height:54px;"></td></tr>
  </table>

  <div class="guard-id">${v(g.parwestId as string)}</div>
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
    // PBA forms (formerly client-side in PBADocumentsTab.tsx)
    "sa05": generateSA05,
    "sa10": generateSA10,
    "sa11": generateSA11,
}

// Filename slug used in Content-Disposition for downloads.
const DOC_FILENAMES: Record<string, string> = {
    "form-a": "Form-A",
    "form-b": "Form-B",
    "employee-card": "Employee-Card",
    "personal-verification": "Personal-Verification",
    "training-certificate": "Training-Certificate",
    "character-certificate": "Character-Certificate",
    "checklist": "Documents-Checklist",
    "medical-certificate": "Medical-Certificate",
    "antecedents": "Antecedents-Verification",
    "iqrar-nama": "Iqrar-Nama",
    "sa05": "PBA-SA-05",
    "sa10": "PBA-SA-10",
    "sa11": "PBA-SA-11",
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; docType: string }> }
) {
    const session = await auth()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })
    // Match the gate that lets the user reach /guards/[id] in the first place
    // (module-level GUARDS access via middleware). The granular GUARDS:VIEW
    // action key is not consistently granted to all roles that legitimately
    // browse guard profiles, which 403'd the View/Download links and rendered
    // the JSON envelope as text in a new tab (Ticket 29).
    if (!hasModuleAccess(session, "GUARDS")) return forbidden("Access denied.")

    const { id, docType } = await params
    const generator = DOC_GENERATORS[docType]
    if (!generator) return new NextResponse("Unknown document type", { status: 404 })

    const guard = await prisma.guard.findUnique({ where: { id } })
    if (!guard) return new NextResponse("Guard not found", { status: 404 })

    const origin = new URL(request.url).origin

    // Training Certificate needs Training + OjtTrainingCheck rows so the
    // checklist reflects what's actually been completed for this guard.
    let html: string
    if (docType === "training-certificate") {
        const trainings = await prisma.training.findMany({
            where: { guardId: id },
            orderBy: { completedAt: "desc" },
            include: {
                ojtChecks: {
                    include: { category: { select: { name: true } } },
                },
            },
        })
        html = generateTrainingCertificate(
            guard as unknown as Record<string, unknown>,
            origin,
            trainings as unknown as TrainingRowForCert[]
        )
    } else {
        html = generator(guard as unknown as Record<string, unknown>, origin)
    }

    // ?action=download → attachment, anything else → inline (default = view).
    const action = (new URL(request.url).searchParams.get("action") || "view").toLowerCase()
    const isDownload = action === "download"
    const filenameBase = DOC_FILENAMES[docType] || docType
    const filename = `${filenameBase}-${(guard as { parwestId?: string }).parwestId || id}.html`
    const disposition = isDownload
        ? `attachment; filename="${filename}"`
        : `inline; filename="${filename}"`

    return new NextResponse(html, {
        status: 200,
        headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Disposition": disposition,
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    })
}