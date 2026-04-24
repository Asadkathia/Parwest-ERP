# Parwest ERP — Design Generation Prompt

> Paste this document into Claude Design (or v0, Lovable, Bolt) to generate the complete UI, tokens, and brandbook for the Parwest ERP system.

---

## ASSUMPTIONS

- **Product name is "Parwest ERP"** — derived from `package.json` name and all route/module naming conventions.
- **Industry is Private Security Guard Force Management** — inferred from the Guard, Deployment, CNIC, Parwest ID, ex-service (Army/Rangers/Police), shift-type (DAY/NIGHT), and patrol-capacity schema fields.
- **Market is Pakistan** — confirmed by CNIC format, NTN/STRN (Pakistani tax IDs), EOBI/CWF/ESSI deductions (Pakistani statutory payroll), PKR amounts formatted as crore/lakh/K, city names (Lahore, Karachi, Islamabad), and `sin1/Singapore` Vercel region suggesting APAC.
- **Aesthetic direction: Technical Precision** — the existing CSS already uses a deep navy sidebar (`#0b1224`) against a cool lavender-blue content area, cobalt brand blue (`#2f5bff`), and a border-forward card system with no decorative shadows. The data density (18-tab guard profiles, multi-step payroll finalization) demands a Bloomberg-but-humane approach, not a startup-minimal one.
- **No logo file found** — `public/` contains no logo asset. Logo lockups in the brandbook should be proposed from the product name.
- **Dark sidebar is already first-class** — the codebase uses `--sidebar-bg: #0b1224` as a top-level token. Dark/light theme toggle applies to the content area, not the sidebar.
- **Guard module is the flagship** — 70+ API routes, 18-tab profile, the most complex schema model, the most business-logic surface area.
- **Currency symbol is ₨ (Pakistani Rupee)** — confirmed by `formatShort()` utility outputting `₨` in the InsightsPanel component.
- **Pakistani number format** — millions expressed as lakh/crore (South Asian number system), confirmed from InsightsPanel formatShort utility.

---

## 1. PRODUCT CONTEXT

- **Product name:** Parwest ERP
- **One-line pitch:** Operational command center for a private security company — managing guard lifecycles, client deployments, payroll, and inventory across regional offices.
- **Industry:** Private Security Services / Guard Force Management (Pakistan)
- **Modules (from schema + routes):**
  1. Guards — lifecycle, prerequisites, verification, documents, attendance, payroll, insurance, training, residence
  2. Clients — onboarding, branch management, contracts, pricing, invoicing, advance payments
  3. Deployments — guard-to-branch assignments with shift, rate, and contract validation
  4. Payroll — salary calculation, loans, special duty, extra hours, finalization state machine, reserve ledger
  5. Store Inventory V2 — products, purchases, adjustments, inter-store demands, guard/client/employee assignments
  6. Invoicing — monthly invoice generation, line items, advance application, void/payment lifecycle
  7. Tickets — issue tracking with categories, priorities, statuses, comments
  8. Reports — guard/client/inventory reports, AI-powered prompt-based reports, scheduled reports
  9. Users & RBAC — role + per-user module permissions (CREATE/VIEW/UPDATE/DELETE/REQUISITION)
  10. Audit Log — entity-level change log with scope metadata
  11. Dashboard — role-aware KPI, insights engine, ops feed, coverage map, expiring renewals
  12. Settings — workflow rule presets, master data (designations, bank names, document types), insights config
- **Personas:** Super Admin, Regional Admin, Manager, Supervisor (primary daily user), Accountant
- **Flagship module:** Guards
- **Theme:** Light content area + dark navy sidebar (always dark) + full light/dark toggle for content
- **Density:** Comfortable default (48px table rows), compact toggle (32px rows) — Supervisor lives in the guards table all day
- **Locale:** Pakistan — PKR (₨), DD/MM/YYYY dates, CNIC format `XXXXX-XXXXXXX-X`, phone `+92 3XX XXXXXXX`, numbers in lakh/crore system

---

## 2. DESIGN DNA

- **Aesthetic direction:** Technical Precision — ultra-legible data tables, monospaced numerics, hairline grid system, deep-navy chrome with cobalt brand accent. Think Bloomberg Terminal made humane: every pixel earns its place, whitespace is structural not decorative.
- **Personality adjectives:** Authoritative, Precise, Trustworthy, Confident
- **Taste references:** Linear (keyboard-first interaction model), Ramp (clean financial data density), Stripe Dashboard (status lifecycle chips, audit trails), Retool (tabular data-first thinking), Vercel (sidebar chrome, deployment state chips)
- **Existing brand tokens to honour:**
  - Brand: `#2f5bff` (cobalt blue)
  - Brand-600: `#2649d4`
  - Background: `#eef2ff` (lavender-blue page wash)
  - Surface: `#ffffff`
  - Sidebar-bg: `#0b1224` (deep navy, always dark)
  - Sidebar-surface: `#111a32`
  - Text: `#0f172a`
  - Text-muted: `#64748b`
  - Success: `#16a34a`, Warning: `#d97706`, Danger: `#dc2626`
  - Radius scale: 10 / 14 / 18 / 24px
- **Cliché blocklist:** no purple-to-pink gradients, no glassmorphism, no rounded-full primary buttons, no emoji-as-icon, no stock illustrations, no "✨ AI" badges, no Material Design defaults, no Lorem Ipsum, no neumorphism, no 3D tilted card heroes, no hero sections, no confetti, no onboarding mascots

---

## 3. DELIVERABLES REQUIRED FROM CLAUDE DESIGN

Produce, in order, as separate named artifacts:

**A. `brandbook.html`**
Positioning, voice & tone matrix, do/don't gallery, proposed logo lockups (wordmark + icon mark using "P" or shield motif for a security company), color swatches with hex/HSL/OKLCH values, 12-step neutral ramp, type specimens (Inter or equivalent for UI, tabular-nums variant for data), spacing ruler (4px base), radius scale (10/14/18/24px), shadow scale (xs/sm/md — very low elevation), motion principles (instant feedback, <150ms transitions, no spring physics on data tables), accessibility charter.

**B. `tokens.json`**
DTCG-compliant. Light + dark namespaces. Every token: `$value`, `$type`, `$description`. Includes:
- Color: brand (9-step ramp), 12-step neutral (slate-based), semantic (success/warning/danger/info), surface (page/card/card-hover/input/sidebar/sidebar-item), text (primary/secondary/muted/inverse/brand/danger), 8-color data-viz palette with ramps
- Sidebar tokens: always-dark set (bg, surface, border, text, text-muted, active-item, hover-item)
- Font: family, size scale (11/12/13/14/16/18/20/24/28/32), weight (400/500/600/700), line-height, letter-spacing
- Spacing: 4px base, scale 0/1/2/3/4/5/6/8/10/12/16/20/24/32/40/48/64
- Radius: 10/14/18/24px + full
- Shadow: xs (0 1px 2px), sm (0 4px 16px), md (0 10px 24px) — all with `rgba(15,23,42,0.06/0.09)`
- Motion: duration-instant(0ms)/fast(100ms)/normal(150ms)/slow(250ms), easing-standard
- Z-index: base/dropdown/sticky/overlay/modal/toast
- Breakpoint: sm(640)/md(768)/lg(1024)/xl(1280)/2xl(1400)

**C. `tokens.css`**
`:root { --... }` for light mode. `[data-theme="dark"]` for dark content override. Separate `[data-sidebar]` block for always-dark sidebar. Zero hardcoded hex anywhere else.

**D. `components.html`**
Every component on one scrollable page. Each component block shows: anatomy diagram, all variants, all sizes, all 7 states (default / hover / focus / active / disabled / loading / error). Includes keyboard model notes. Components:

*Foundational:* Button (primary/secondary/ghost/danger/icon-only), Input (text/number/currency/date/search/CNIC-masked), Select, Combobox, Checkbox, Radio, Switch, Textarea, File upload (with preview), Slider, Tag, Chip (status/category), Badge (count/dot), Avatar (initials fallback), Tooltip, Popover, Dropdown menu, Context menu, Breadcrumb, Tabs (pill + underline variants), Accordion, Divider, Skeleton, Spinner, Progress bar.

*ERP-critical:* Data table (sortable headers, column filters, pinnable columns, row selection with bulk action bar, inline edit mode, sticky header, density toggle), Pivot summary row, Form layouts (1-col / 2-col / grouped sections / conditional fields), Stepper wizard (with step state indicators), Filter bar (pill filters + saved views), Command palette (⌘K, grouped results, keyboard navigation), Global search (top-level), Notification center (badge + flyout), Activity feed (timeline with actor/action/entity), Comment thread (with `@mention` autocomplete), Approval card (pending/approved/rejected states), KPI card (number + trend + sparkline), Chart card (wrapper with title/legend/export), Permission-gated shell (403 inline vs. page-level).

*Navigation:* Top bar (search + notifications + user menu), Sidebar (collapsed 64px / expanded 272px, dark-always), Sub-nav (horizontal secondary), Workspace/Region switcher, User menu (avatar + role chip + sign-out).

*Feedback:* Toast (success/warning/error/info, top-right stack), Banner (full-width page alert), Inline alert (within forms), Modal (sm/md/lg/full/drawer-right), Destructive confirm dialog, Empty state (icon + title + description + action), Error state (server error), 403 / 404 / 500 pages.

**E. One HTML artifact per screen (16 total) — see Section 5.**

---

## 4. COMPONENTS REQUIRED (summary)

All components listed in Section 3-D above. Every component must:
- Reference only `tokens.css` variables — no inline hex
- Show all 7 states rendered side by side
- Be WCAG 2.2 AA minimum (AAA on body text ≥14px)
- Demonstrate focus-visible ring using `--focus-ring` token
- Use tabular-nums (`font-variant-numeric: tabular-nums`) on every quantitative value

---

## 5. SCREENS REQUIRED (in order)

### Screen 1 — Login
Email + password form on split layout: left = brand panel (dark navy, Parwest logo, product name, one-line pitch), right = form. Show validation states. Include "Forgot password" link. No SSO/MFA fields needed (not in codebase).

### Screen 2 — Dashboard (Super Admin view)
- Top: Personalised greeting "Good morning, Asad" + "Super Admin" role chip + scope "All Regions" + Quick Actions dropdown (Docs Checklist / Invoicing / Bulk Loans / Admin Center) + AI Chat button
- KPI row (6 cards, xl:grid-cols-6): Active Guards, Deployed, Vacant Guards, Pending Approvals, Open Tickets, Payroll Cycle (with state chip: GLOBAL_FINALIZED in success, DRAFT in muted)
- AttentionStrip: horizontal scrollable banner of flagged items needing action (orange/red severity chips)
- InsightsPanel: two tabs (Efficiency / Anomalies), each shows insight rows with severity border-left (HIGH=red, MEDIUM=amber, LOW=slate), count badge, drill-down accordion with ₨ amounts
- Main 2-col grid (xl:grid-cols-[1fr_340px]):
  - Left: OpsFeed (activity timeline: "Usman Khan deployed at MCB Bank – Gulberg"), GuardClientMapCard (Pakistan outline map with regional office pins), FinancePulse (payroll month total, reserve balance, outstanding invoices)
  - Right sidebar: MyQueue (Guard Reviews 3, Pending Approvals 7, Overdue Docs 12), ExpiringRenewals (docs expiring within 30 days, contracts expiring within 60 days)

### Screen 3 — Guards List (Supervisor daily view)
- SectionTitle: "Guards" / "Manage guard profiles and deployments" + Add Guard button
- 3 StatCards: Total Guards (brand), Active (success), Inactive (warning) + Pending (muted)
- Filter bar: Search by name/Parwest ID/CNIC, Status filter (All/Active/Inactive/Pending/Terminated), Region filter, Regional Office filter, Show count select
- Data table columns: PARWEST ID (monospace, sortable), NAME (with avatar initials), CNIC (masked format XXXXX-XXXXXXX-X), DESIGNATION, SHIFT, REGION / OFFICE, STATUS (lifecycle chip: PENDING=yellow, ACTIVE=green, INACTIVE=slate, TERMINATED=red), ACTIONS (View / Edit dropdown)
- Density toggle (comfortable 48px / compact 32px) — show both states in artifact
- Bulk selection bar (appears on row select): "3 guards selected" + Bulk Export / Change Status
- Empty state: "No guards found" + icon + "Add your first guard" action

### Screen 4 — Guard Profile Detail (18-tab layout)
- Back link + "Edit Guard" button (permission-gated)
- Header card (2-col: lg:grid-cols-[1fr_320px]):
  - Left: Name (28px bold), Parwest ID (monospace muted), age approval badge (AlertTriangle + "Age Approval Pending" in amber), GuardProfileHealth bar (% complete), GuardLifecycleProgress steps (PENDING → ACTIVE → DEPLOYED → INACTIVE → TERMINATED), StatusEditor inline chip selector, MentalHealthBadge
  - Right: Profile photo card (200×176px, initials fallback)
- KPI strip (5 tiles): PRESENT DAYS, ABSENT DAYS, TOTAL OT HRS, VERIFICATION (%/total), ACTIVE DEPLOYMENTS
- Tab navigation (18 tabs, horizontal scrollable on mobile):
  1. **General Information** — personal details grid: Name, Parwest ID, CNIC, DOB, Age, Father Name, Religion, Marital Status, Education, Blood Group, Height, Weight, Permanent Address, Current Address, Emergency Contact, Identification Mark, ex-service details (Type, Rank, Regiment, Unit, Service Period)
  2. **Profile** — extended profile: Mother Name, Nationality, Next of Kin, Sect, Cast, Police Station, CNIC Issue/Expiry, Joining Date, Joining Age, Enrolled By, Introducer
  3. **Attachments** — document upload cards per document type (CNIC front/back, police certificate, character certificate, medical, photo)
  4. **Attendance** — monthly calendar heatmap (PRESENT=green, ABSENT=red, LEAVE=amber, DOUBLE_DUTY=blue, EXTRA=purple) + attendance table (DATE, STATUS, SHIFT, CLIENT, HOURS, OVERTIME, TYPE, NOTE)
  5. **Paid Salaries** — salary history table (MONTH, BASIC, NET SALARY, STATUS chip, RESERVE, DEDUCTIONS, PAYMENT METHOD)
  6. **Deployment History** — table (CLIENT, BRANCH, SHIFT, DESIGNATION, DEPLOYED ON, END DATE, STATUS chip, DEPLOYED BY)
  7. **Courses** — refresher course cards (COURSE NAME, LEVEL, INSTRUCTOR, LOCATION, ISSUE DATE, file attachment badge)
  8. **Verification** — prerequisite document grid (DOCUMENT TYPE, VERIFICATION STATUS chip, UPLOADED BY, UPLOADED AT, EXPIRY DATE, COMMENTS, upload action)
  9. **Pledged Documents** — held documents table (DOCUMENT TYPE, RECEIVED BY, RECEIVED AT, STATUS, RETURN TYPE, EXPECTED RETURN, action)
  10. **Bank Details** — bank info card: Bank Name, Account Number, Account Type, IBAN, Branch Code + multiple bank accounts accordion
  11. **Residence History** — timeline cards (ADDRESS, STATUS chip, SUPERVISOR, ASSIGNED AT, ASSIGNED BY, VACATED AT, REASON, NOTES)
  12. **On-Job Trainings** — training records list (TYPE, COMPLETED AT, INSTRUCTOR, NOTES)
  13. **Store Inventory** — assigned items table (PRODUCT, SKU, VARIATION, CONDITION, ASSIGNED AT, ASSIGNED BY, STATUS chip, QUANTITY)
  14. **Service History** — CNIC-keyed timeline (EVENT, FROM STATUS, TO STATUS, DESCRIPTION, REGION, OFFICE, CHANGED BY, DATE)
  15. **Insurance** — insurance enrollments list (CLIENT INSURANCE, HEALTH ID, STATUS chip, CREATED BY, CREATED AT)
  16. **Status History** — chronological status changes (FROM, TO, REASON, CHANGED BY, CHANGE TYPE chip, DATE)
  17. **PBA Documents** — PBA (Police Bureau of Attestation) document records
  18. **Nearest Relatives / Family** — family members grid

### Screen 5 — Guard Create/Edit Form (multi-step)
Stepper: Personal Info → Service Details → Address & Contact → Bank & Finance → Documents → Review

**Step 1 — Personal Information:**
- Parwest ID (auto-generated, read-only), Full Name*, CNIC* (masked input), Phone, Email, Date of Birth (with age auto-calculated + age-approval flag if out of range 18-45), Father Name, Mother Name, Religion, Marital Status, Education (passing year, institution), Nationality, Blood Group, Height (cm), Weight (kg), Eye Color, Hair Color, Disability (text), Identification Mark
- Profile photo upload (crop to square)

**Step 2 — Service Details:**
- Is Ex-Service toggle — reveals: Service Type (ARMY/POLICE/RANGERS/MUJAHID/OTHER/CIVILIAN), Rank, Regiment, Unit, Registration No., Service Period (years + months), Date of Enrollment, Date of Discharge, Remarks
- Designation (combobox from GuardDesignationType), Salary, Regional Office (scoped), Region
- Joining Date, Enrolled By, Profile Introducer (Name, CNIC, Address, Contact)

**Step 3 — Address & Contact:**
- Permanent Address*, Current Address, Current Address Contact, Permanent Address Contact, Emergency Contact, Additional Contact Numbers, Police Station
- Nearest Relatives repeater (Name, Relation, Phone, Address)

**Step 4 — Bank & Finance:**
- Bank Name (combobox from GuardBankName list), Account Number, Account Type, IBAN, Branch Code
- Additional bank accounts (repeater with same fields)

**Step 5 — Documents:**
- Document type checklist (from GuardDocumentType active list, VERIFICATION category)
- Each row: upload file button + status select (PENDING/VERIFIED/REJECTED) + expiry date

**Step 6 — Review:**
- Summary of all entered data in read-only grouped layout
- Submit button — creates guard with PENDING lifecycle status

### Screen 6 — Deployments List
- SectionTitle: "Deployments" + Deploy Guard button (permission-gated)
- 3 StatCards: Total (brand), Active (success), Ended (muted)
- Filter bar: Search (guard name/Parwest ID/client name), Status (All/Active/Ended), Shift (All/Day/Night/Both), Region, Date range
- Data table columns: GUARD (name + Parwest ID pill), CLIENT (name + type badge), BRANCH (name + city), SHIFT (DAY=blue/NIGHT=indigo/BOTH=purple chip), DESIGNATION, RATE (₨ tabular), DEPLOYED ON (DD/MM/YYYY), END DATE, STATUS (ACTIVE=green/INACTIVE=slate), ACTIONS
- Row click → deployment detail

### Screen 7 — Deployment Create Form
- Section: "Select Guard" — search combobox (Parwest ID / name), shows guard status chip (must be ACTIVE — validated via workflow rule)
- Section: "Select Client" — client combobox, shows type badge and active branch count
- Section: "Select Branch" — branch select (filtered by client), shows city + contract validity warning if `requireBranchContract` rule fires
- Section: "Deployment Details" — Designation (combobox), Shift Type (DAY/NIGHT/BOTH radio), Deployment Date (date picker), Deployment Type (REGULAR/OVERTIME), Deployment Nature (PERMANENT/TEMPORARY), Is Extra Guard toggle
- Section: "Rates" — Rate (₨ number input), Salary, Overtime rate, Extra Hours rate, Post Allowance; Shift start/end times for day and night
- Section: "Notes" — textarea
- Workflow validation banners (before submit, inline):
  - `singleActivePerGuard`: "Guard already has an active deployment at [client]"
  - `requireActiveGuardStatus`: "Guard must be ACTIVE to deploy"
  - `requireBranchContract`: "Selected branch has no active contract"

### Screen 8 — Clients List
- SectionTitle: "Clients" + Add Client button
- 3 StatCards: Total (brand), Active (success), Blacklisted (danger)
- Filter bar: Search, Status, Type (BANK/MANUFACTURER/etc.), Region, Show count
- Data table columns: LOGO (32px square or initials), NAME (link), TYPE (chip), CITY, STATUS (ACTIVE=green/INACTIVE=slate/BLACKLISTED=red), BRANCHES (count badge), ACTIVE GUARDS (count, monospace), ENROLLED (date), MANAGER, ACTIONS

### Screen 9 — Client Detail (9-tab layout)
- Header: Client logo (200×176 or placeholder), client name, type badge, status chip, region/office breadcrumb
- 8 quick-stat tiles: BRANCHES, DAY DUTY GUARDS, NIGHT DUTY GUARDS, LOCATION SUPERVISORS, CPO, GUARD-LESS BRANCHES (accent), TOTAL ACTIVE GUARDS, TOTAL DEPLOYMENTS
- Tabs: General Information / Assigned Guards / Extra Guards / Branches / Pricing / Attachments / Inventory / Client Invoicing / Contact Information

**General Information tab** (full detail grid):
- CLIENT DETAILS: Name, Type, Email, Status chip, City, Postal Code, Enrollment Date, Region, Regional Office, Assigned Manager, Branchless toggle, Head Office Address, Operational Provinces, NTN, STRN
- CONTACT INFORMATION: Contact Person, Contact Designation, Primary Phone, Additional Numbers, Assigned Supervisor
- INTRODUCER INFORMATION: Introducer Name, Contact Number, CNIC, Address
- GUARD CAPACITY: Day Guards, Night Guards, Day Supervisors, Night Supervisors, CPO Capacity
- CONTRACT DETAILS: Contract Start/End, Rate Period Start/End, Contract Price, Day Guard Designation, Day Guard Ex-Service, Additional Day Guards, Night Guard Designation, Night Guard Ex-Service, Additional Night Guards

**Assigned Guards tab:** Table — PARWEST ID, GUARD NAME, BRANCH, DESIGNATION, SHIFT, DEPLOYED ON, END DATE, TYPE chip, STATUS chip. Filters: status (All/Active/Previous), date, branch, search.

**Branches tab:** Table — BRANCH NAME (link), CITY, ADDRESS, CONTACT PERSON, ACTIVE DEPLOYMENTS count. Add Branch button.

**Client Invoicing tab:** Filter controls (month, branch, guard type), Invoice table (INVOICE #, MONTH, AMOUNT ₨, STATUS chip, DUE DATE, PAID AMOUNT, actions: View/Void).

### Screen 10 — Payroll State Dashboard (Finalization Workflow)
- SectionTitle: "Payroll State — April 2026" + month picker
- Workflow state progress bar (5 stages): DRAFT → CALCULATED → REGIONAL_LOCKED → GLOBAL_FINALIZED → PAID
- Stats row: Total Payrolls, Net Payable (₨), Total Reserve (₨), On Hold count
- Regional locking section: table of regional offices with their lock status (LOCKED chip + locked-at timestamp + locked-by name + unlock button for Super Admin)
- Global finalization actions: "Lock All Regions" → "Finalize Globally" → "Mark Paid" — each as staged confirm-dialog buttons
- Emergency actions (Super Admin only): "Emergency Release" for individual hold records
- Payroll records table: GUARD (name + Parwest ID), OFFICE, BASIC SALARY (₨), NET SALARY (₨), RESERVE (₨), LOANS (₨), DEDUCTIONS (₨), STATE chip (DRAFT/CALCULATED/REGIONAL_LOCKED/GLOBAL_FINALIZED/PAID/HOLD/EMERGENCY_RELEASED), PAYMENT STATUS chip

### Screen 11 — Payroll Loans List
- SectionTitle: "Loans" + Add Loan / Bulk Add buttons
- Filter: Month picker, Status (All/Pending/Finalized), Region, Search
- Data table: GUARD (name + Parwest ID), MONTH, AMOUNT (₨ tabular), STATUS chip (PENDING=yellow/FINALIZED=green), DEPLOYMENT DAYS, SUPERVISOR, SLIP NO., PAYMENT DATE, PAYMENT METHOD chip, ACTIONS
- Bulk finalize workflow: select rows → "Finalize Selected Loans" → confirm with total amount + affected count

### Screen 12 — Store Inventory Products
- SectionTitle: "Products" + Create Product button
- Filter bar: Search (name/SKU), Category, Brand, Status, Reorder alert toggle
- Data table: SKU (monospace), NAME, CATEGORY (chip), BRAND, UNIT, STOCK (ON HAND / HELD / ISSUED as 3-part chip), REORDER LEVEL, STATUS, ACTIONS
- Row expanding: shows per-store balance breakdown
- Stock level indicator: green if onHand > reorderLevel, amber if at reorder level, red if below

### Screen 13 — Store Inventory Demand Flow
**Demand List:**
- SectionTitle: "Demands" + Create Demand button
- Filter: Status (All/DRAFT/SENT/APPROVED/REJECTED/PARTIALLY_FULFILLED/FULFILLED/CANCELLED), From Store, Date range
- Table: REQUEST NO. (monospace), FROM STORE, TO STORE, STATUS chip (DRAFT=slate/SENT=blue/APPROVED=green/REJECTED=red/PARTIALLY_FULFILLED=amber/FULFILLED=emerald/CANCELLED=muted), REQUIRED BY, REQUESTED BY, LINE ITEMS count, ACTIONS

**Demand Detail:**
- Header: Request No., status chip, stores (from → to with arrow), requiredBy, requestedBy
- Line items table: PRODUCT (name + SKU), REQUESTED QTY, APPROVED QTY (editable if APPROVED state), FULFILLED QTY, UNIT
- Actions sidebar: Approve / Reject / Respond (for receiving store) — each with confirm dialog
- Response section: shows fulfillment responses from responding stores (STORE, RESPONDER, STATUS chip, DATE, quantities)

### Screen 14 — Workflow Rules Settings
- SectionTitle: "Workflow Rules" / "Configure system validation behavior"
- Preset selector (3 cards): Balanced (recommended, default) / Strict (maximum guardrails) / Relaxed (minimal constraints) — each with description, selected state outline
- Rule table (14 rows): RULE NAME (descriptive label), CATEGORY (deployments/inventoryDemand), ENABLED toggle, DESCRIPTION
  - deployments.singleActivePerGuard — "One active deployment per guard at a time"
  - deployments.blockInactiveUpdate — "Prevent editing ended deployments"
  - deployments.lockAfterEnd — "Lock deployment record after end date"
  - deployments.requireActiveGuardStatus — "Guard must be ACTIVE to deploy"
  - deployments.requireGuardOfficeConsistency — "Guard and branch must share the same regional office"
  - deployments.requireEndDate — "End date required when ending a deployment"
  - deployments.disallowEndDateBeforeDeploymentDate — "End date cannot precede deployment date"
  - deployments.disallowFutureEndDate — "End date cannot be in the future"
  - deployments.requireBranchContract — "Branch must have an active contract"
  - deployments.requireClientHasBranches — "Client must have at least one branch"
  - inventoryDemand.requirePendingInitialStatus — "New demands start in PENDING state"
  - inventoryDemand.enforceTransitionMap — "Status changes must follow valid transition paths"
  - inventoryDemand.blockCoreEditsAfterTerminal — "Prevent editing fulfilled/cancelled demands"
  - inventoryDemand.requireSufficientStockForFulfillment — "Block fulfillment if stock insufficient"
- Save Changes button — shows "Custom (unsaved)" chip when rules diverge from any preset

### Screen 15 — Audit Log
- SectionTitle: "Audit Log"
- Filter bar: Module (All/GUARDS/CLIENTS/PAYROLL/INVENTORY/TICKETS/USERS), Event type (CREATED/UPDATED/DELETED), User (search combobox), Date range
- Data table (dense, compact-only): TIMESTAMP (DD/MM/YYYY HH:mm, monospace), USER (name + role chip), EVENT (chip: CREATED=emerald/UPDATED=blue/DELETED=red), MODULE, DESCRIPTION (truncated 60 chars), ENTITY TYPE, IP ADDRESS
- Row expand → full JSON diff view (before/after values in two-column layout with changed fields highlighted in amber)
- Export as CSV button

### Screen 16 — RBAC Matrix (Roles × Modules × Permissions)
- SectionTitle: "Role Permissions"
- Column headers: Module name (10+ modules), each with 5 permission sub-columns (C/V/U/D/R for CREATE/VIEW/UPDATE/DELETE/REQUISITION)
- Row headers: Role names (Admin, Regional Manager, Supervisor, Accountant, etc.)
- Cells: filled checkbox for granted, empty for denied
- Inline toggle — clicking a cell opens a confirm popover and immediately saves
- SuperAdmin note banner: "Super Admin (Admin role with no permissions) has unrestricted access to all modules"
- Add Role button → modal with role name + description + permission matrix

---

## 6. DATA MODEL CONTEXT (so screens use real fields)

```
Guard {
  parwestId       String  -- unique, format: RO-XXXXX (e.g., LHR-00247)
  name            String
  cnic            String  -- Pakistani NIC: XXXXX-XXXXXXX-X
  phone           String  -- +92 3XX XXXXXXX
  email           String?
  dateOfBirth     Date?
  age             Int?
  fatherName      String?
  maritalStatus   String? -- SINGLE | MARRIED | DIVORCED | WIDOWED
  education       String?
  designation     String? -- Security Guard | Supervisor | CPO | ASO | LSO
  salary          Float?  -- monthly base ₨
  status          String  -- PENDING | ACTIVE | PRESENT | DEFAULT | INACTIVE | TERMINATED
  lifecycleStatus String  -- PENDING | ACTIVE | INACTIVE | TERMINATED (source of truth)
  terminationReason String? -- RESIGNED | FIRED | ABSCONDED | DECEASED | OTHER
  ageApprovalStatus String? -- PENDING | APPROVED | REJECTED
  isExService     Boolean
  exServiceType   String? -- ARMY | POLICE | RANGERS | MUJAHID | OTHER | CIVILIAN
  exServiceRank   String?
  regionId, regionalOfficeId
  joiningDate     Date?
  bloodGroup      String?
  height, weight  String?
}

Client {
  name            String
  type            String  -- BANK | MANUFACTURER | HOSPITAL | EDUCATION | RETAIL | OTHER
  email           String?
  status          String  -- ACTIVE | INACTIVE | BLACKLISTED
  isBranchless    Boolean
  city            String?
  headOfficeAddress String?
  contactPerson   String?
  phone           String?
  ntn             String? -- National Tax Number
  strn            String? -- Sales Tax Registration
  contractStart, contractEnd    Date?
  contractPrice   Float?  -- monthly ₨
  assignedManagerId String?
  regionId, regionalOfficeId
}

Branch {
  name            String
  code            String? -- e.g., "MCB-GULBERG-01"
  clientId
  city, province  String?
  address         String?
  contactPerson   String?
  contactPhone    String?
  dayGuardCapacity, nightGuardCapacity   Int?
  daySupervisorCapacity, nightSupervisorCapacity Int?
  cpoCapacity     Int?
  contractStart, contractEnd  Date?
  isLockerBranch  Boolean
}

Deployment {
  guardId, clientId, branchId
  designation     String  -- Security Guard | Supervisor | CPO
  shiftType       String  -- DAY | NIGHT | BOTH
  deploymentDate  Date
  rate            Float?  -- daily or monthly ₨
  salary, overtime, extraHours, postAllowance Float?
  status          String  -- ACTIVE | INACTIVE
  deploymentType  String  -- REGULAR | OVERTIME
  deploymentNature String -- PERMANENT | TEMPORARY
  isExtraGuard    Boolean
  endDate         Date?
  endReason       String?
  deployedByName, revokedByName String?
}

Payroll {
  guardId, month, year
  baseSalary      Float   -- ₨
  deploymentDays  Int
  loans, otherDeductions Float
  eobi, essi, cwf Float   -- statutory deductions
  overtimeHours, overtimeAmount Float
  specialDutyHours, specialDutyAmount Float
  netSalary, netBeforeReserve Float
  reservePct, reserveAmount Float
  paymentStatus   String  -- PENDING | PAID | UNPAID
  state           String  -- DRAFT | CALCULATED | REGIONAL_LOCKED | GLOBAL_FINALIZED | PAID | HOLD | EMERGENCY_RELEASED
  paymentMethod   String? -- BANK | CASH | MOBILE
}

Invoice {
  invoiceNumber   String  -- unique, e.g., "INV-2026-04-0042"
  clientId, branchId
  month           Date
  amount, subtotal Float   -- ₨
  taxRate, taxAmount Float?
  paidAmount      Float
  status          InvoiceStatus -- DRAFT | PENDING | ADVANCE_PAID | PARTIAL_PAID | PAID | UNPAID | OVERDUE | VOID
  dueDate, paidAt Date?
  lineItems       InvoiceLineItem[] -- kind: GUARD_SALARY | SPECIAL_DUTY | MANUAL
}

StoreInventoryProduct {
  sku             String  -- unique
  name            String
  categoryId      -- hierarchical category (Weapon / Uniform / Equipment / Ammunition)
  brandId, unitId
  serialRequired  Boolean
  minStockLevel, maxStockLevel, reorderLevel Int?
  warrantyMonths  Int?
  licenseNumber   String?
  -- balance per store: quantityOnHand, quantityHeld, quantityIssued, avgUnitCost
}

StoreInventoryDemand {
  requestNo       String  -- unique
  status          -- DRAFT | SENT | APPROVED | REJECTED | PARTIALLY_FULFILLED | FULFILLED | CANCELLED
  fromStoreId, toStoreId
  requiredBy      Date?
  requestedById, approvedById
  lines           -- product, requestedQty, approvedQty, fulfilledQty
  responses       StoreInventoryDemandResponse[]
}

Ticket {
  ticketNumber    Int     -- autoincrement
  subject         String
  description     String?
  senderId, assignedToId
  categoryId, priorityId, statusId
  comments        TicketComment[]
}

AuditLog {
  event           String  -- CREATED | UPDATED | DELETED | STATUS_CHANGED | etc.
  module          String  -- GUARDS | CLIENTS | PAYROLL | INVENTORY | TICKETS | USERS
  userId, ipAddress
  targetEntityType, targetEntityId
  targetRegionId, targetRegionalOfficeId
  description     String?
  createdAt       DateTime
}

User {
  name, email
  roleId          -- Role.name: Admin | Regional Manager | Supervisor | Accountant | ...
  status          String  -- ACTIVE | INACTIVE
  regionId?       -- scoped if manager role
  regionalOfficeId?
  permissions     UserPermission[] -- per-module overrides
  lastLoginAt     DateTime?
}

RegionalOffice {
  name, seriesCode  -- e.g., "Lahore" / "L"
  officeHead, phone, address
  latitude, longitude
  reservePct      Float?  -- payroll reserve override
}
```

---

## 7. WORKFLOWS & STATES (so flows feel real)

**1. Guard Lifecycle — from enrollment to termination**
- Trigger: Admin or Manager enrolls a new guard via the Create Guard form
- States: `PENDING` (form submitted) → `ACTIVE` (approved, documents verified) → `INACTIVE` (suspended) → `TERMINATED` (removed from service)
- Deployments gate: A guard in `ACTIVE` state can be deployed; if workflow rule `requireActiveGuardStatus` is enabled, the deployment API will reject any attempt to deploy a PENDING or INACTIVE guard
- Termination requires a reason: `RESIGNED | FIRED | ABSCONDED | DECEASED | OTHER`
- Age exception: If guard age is outside 18–45 range, `ageApprovalRequired = true` and status shows "Age Approval Pending" badge; a Super Admin must approve or reject via GuardAgeApproval before activation
- Actors: Manager (enroll, activate), Supervisor (daily attendance), Super Admin (terminate, age approve)

**2. Deployment Lifecycle — placing a guard at a client site**
- Trigger: Manager creates a new deployment from Guards > Deploy or Deployments > New
- Validation (workflow rules): Guard must be ACTIVE; guard's regional office must match (if `requireGuardOfficeConsistency`); client must have branches; branch must have an active contract (if `requireBranchContract`)
- States: `ACTIVE` (live deployment, guard is PRESENT at site) → `INACTIVE` (ended, with endDate + endReason)
- Ending: Manager or Admin opens "End Deployment" form — endDate (cannot be before deploymentDate, cannot be future) + endReason
- Audit: `deployedByName` and `revokedByName` stored as snapshots; full audit trail in GuardStatusHistory and AuditLog
- Guard status side-effect: When all deployments end, guard.status flips from PRESENT → DEFAULT (still ACTIVE lifecycle)

**3. Payroll Monthly Cycle — from calculation to payment**
- Trigger: Payroll Officer (Manager/Accountant) initiates calculation for a month
- States: `DRAFT` → `CALCULATED` (system computes netSalary from deploymentDays × rate + overtime + specialDuty − loans − deductions − eobi − cwf − essi − reserve) → `REGIONAL_LOCKED` (Regional Admin locks their office; prevents edits) → `GLOBAL_FINALIZED` (Super Admin approves; all regions locked) → `PAID` (payments disbursed; paymentStatus PENDING → PAID) | `HOLD` (flagged by Super Admin; holdReason recorded) | `EMERGENCY_RELEASED` (override by Super Admin with emergencyReleaseReason)
- Reserve: 30% of net held in PayrollReserveLedger; released on clearance/termination
- Bulk finalization: PayrollSalaryFinalizationHistory records each finalize batch with scope (REGION | GLOBAL), count, totalNetPayable, totalReserve
- Actors: Manager (calculate), Regional Admin (regional lock), Super Admin (global finalize, hold, emergency release), Accountant (mark paid)

**4. Store Inventory Demand — inter-store stock transfer request**
- Trigger: Store operator creates a demand request from their store to HQ or another store
- States: `DRAFT` → `SENT` (submitted for approval) → `APPROVED` (quantities approved by HQ) | `REJECTED` (with reason) → `PARTIALLY_FULFILLED` (some items dispatched) → `FULFILLED` (all dispatched) | `CANCELLED`
- Fulfillment: responding store creates DemandResponse with line quantities; stock movements recorded as DEMAND_OUT (from) and DEMAND_IN (to)
- Workflow rules: `requirePendingInitialStatus`, `enforceTransitionMap` (block invalid state jumps), `blockCoreEditsAfterTerminal`, `requireSufficientStockForFulfillment`
- Actors: Store Operator (create/send), Inventory Manager (approve/reject), Responding Store (fulfill)

**5. Invoice Generation & Payment Lifecycle**
- Trigger: Accountant runs monthly invoice generation (`/api/invoices/generate-monthly`) for a client/branch
- States: `DRAFT` → `PENDING` (sent to client) → `ADVANCE_PAID` (advance payment applied) | `PARTIAL_PAID` → `PAID` (fully settled) | `UNPAID` (past due) | `OVERDUE` (past dueDate) → `VOID` (cancelled with voidReason)
- Line items: auto-generated from Payroll records (GUARD_SALARY) + PayrollSpecialDuty (SPECIAL_DUTY) + manual entries (MANUAL)
- Advance application: ClientAdvancePayment.appliedAmount tracked via InvoiceAdvanceApplication join table
- Export: invoice as Excel file for client delivery

---

## 8. RULES

- **One tokens file, cited everywhere.** All colors in components and screens reference `var(--...)` from `tokens.css`. No hardcoded hex anywhere outside the tokens file.
- **Real data only.** No Lorem Ipsum. Use realistic Pakistani names (e.g., Muhammad Usman Khan, Fatima Zafar), CNIC values (42201-1234567-9), client names (MCB Bank, Engro Chemicals, Shaukat Khanum Hospital), cities (Lahore, Karachi, Faisalabad, Islamabad, Rawalpindi, Peshawar), currency in ₨, Parwest IDs (LHR-00247, KHI-00892), deployment dates in DD/MM/YYYY.
- **Tabular numerals on every quantitative cell.** All salary, balance, count, and rate values must use `font-variant-numeric: tabular-nums` so columns align vertically.
- **Keyboard-first.** Every primary flow completable without a mouse. Tab order must be logical. Forms support Enter to advance step. Data tables support J/K for row navigation, / for search focus, Space for row select.
- **WCAG 2.2 AA minimum, AAA for body text ≥14px.** Focus ring visible on every interactive element. Color is never the sole signal — status chips always include a text label, never just a colored dot.
- **Dark mode first-class, not inverted.** Content area dark mode must have independent surface layers, not simply CSS `invert()`. Sidebar is always dark regardless of content area theme.
- **Density toggle demonstrated on the guards list.** Comfortable = 48px row height, 14px body. Compact = 32px row height, 12px body. Density preference persisted to localStorage.
- **Copy craft:** Verb-first button labels ≤3 words: "Deploy Guard", "End Deployment", "Lock Region", "Generate Invoice". Error formula: what happened + why + what to do — e.g., "Guard cannot be deployed — their lifecycle status is INACTIVE. Change the guard's status to ACTIVE before deploying." Empty state formula: what this is + why it's empty + primary action — e.g., "No guards deployed here · This client has no active deployments · Deploy a Guard".
- **Every component ships all 7 states** rendered side by side in `components.html`.
- **Pakistani number format** for amounts ≥1,000: `₨ 12K` / `₨ 4.2L` (lakh) / `₨ 1.8Cr` (crore). Full unformatted value in tooltip on hover.
- **Status chips** must follow the established semantic: green = active/success, amber/yellow = pending/warning, red = danger/terminated/rejected, slate/gray = inactive/ended, blue = in-progress/sent, emerald = fulfilled/paid.

---

## 9. SELF-AUDIT (the downstream agent must return this checked)

- [ ] All token values match across `tokens.json`, `tokens.css`, `brandbook.html`, `components.html`, and all screen artifacts
- [ ] Light + dark content themes both pass WCAG AA contrast ratios (minimum 4.5:1 for normal text, 3:1 for large text)
- [ ] Data-viz 8-color palette verified colorblind-safe for Deuteranopia and Protanopia
- [ ] Every component shows all 7 states (default / hover / focus / active / disabled / loading / error)
- [ ] No hardcoded hex colors outside `tokens.css`
- [ ] No clichés from the blocklist (gradients, glassmorphism, rounded-full CTAs, emoji icons, stock illustrations, AI badges, Lorem Ipsum, neumorphism, 3D card heroes)
- [ ] Keyboard shortcuts documented in command palette screen
- [ ] Density toggle demonstrated on Guards List (Screen 3) — both comfortable and compact states shown
- [ ] Every screen uses realistic Pakistani domain data (names, CNICs, ₨ amounts, city names, Parwest IDs)
- [ ] Guard Profile Detail (Screen 4) uses actual 18-tab set from the codebase
- [ ] Guard Create Form (Screen 5) uses actual field groups from the Guard schema
- [ ] Deployment Create Form (Screen 7) shows workflow rule validation banners
- [ ] Payroll State Dashboard (Screen 10) shows all 7 payroll state machine values
- [ ] Store Inventory Demand (Screen 13) shows the full 7-status enum lifecycle
- [ ] Audit Log (Screen 15) shows the expandable JSON diff row pattern
- [ ] RBAC Matrix (Screen 16) shows the 5-permission column model (C/V/U/D/R)
- [ ] Sidebar is always dark regardless of content area theme
- [ ] Mobile companion screens included (at minimum: Guards List, Dashboard KPIs, Deployment Create — optimized for Supervisor field use on 390px viewport)
- [ ] Edge states page covers: empty list / server error / 403 permission denied / 404 not found / 500 internal error / offline / insufficient-permissions-to-create — each with distinct icon, title, description, and appropriate action

---

## APPENDIX — MODULE → PERMISSION MAPPING (for RBAC screen)

| Module | Roles with VIEW | Roles with CREATE | Notes |
|--------|----------------|-------------------|-------|
| GUARDS | All roles | Admin, Manager | Supervisor has VIEW + UPDATE; no CREATE |
| CLIENTS | Admin, Manager | Admin, Manager | Accountant VIEW only |
| DEPLOYMENTS | All roles | Admin, Manager | Semantically under GUARDS module in permissions |
| PAYROLL | Admin, Manager, Accountant, Supervisor | Admin, Manager | Accountant: VIEW + mark paid; no create |
| INVENTORY | Admin, Manager | Admin, Manager | Supervisor: REQUISITIONS only |
| TICKETING | All roles | All roles | Any user can create a ticket |
| USERS | Admin | Admin | Super Admin only for delete |
| AUDIT | Admin | — | Read-only, Admin only |
| REPORTS | Admin, Accountant, Manager | — | AI reports: Admin + Accountant |
| SETTINGS | Admin | Admin | Workflow rules: Super Admin only |

---

## APPENDIX — INSIGHT CATEGORIES (for Dashboard screen)

**Efficiency insights (Sparkles tab):**
- Guards without active deployment ("Vacant Guards" count)
- Guards with attendance gaps (>3 consecutive absences)
- Branches below capacity (guard count < required capacity)
- Invoices overdue > 30 days
- Salary slips not generated for finalized payrolls

**Anomaly insights (AlertTriangle tab):**
- Guards deployed outside their regional office scope
- Payroll amounts significantly above/below guard's base salary
- Duplicate CNIC detected across guard records
- Loans finalized without corresponding salary deduction
- Audit log spikes (>50 events from one user in 1 hour)

Each insight row: severity border (HIGH=red-500, MEDIUM=amber-500, LOW=slate-300), count badge, ₨ amount (if financial), expandable drill-down list of affected entity links, "Investigate all →" link, computed-in Xms footer, mute button.
