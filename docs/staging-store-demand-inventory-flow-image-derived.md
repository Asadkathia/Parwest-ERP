# Staging Store Inventory Flow (Image-Derived Deep Documentation)

Last updated: 2026-03-25  
Source: Provided staging screenshots (`staging-store.parwestgroup.com`)

## 1) Scope Covered
This document captures the complete visible flow across:
- Store/Warehouse master setup
- Inventory quantities view
- Demand Response operations (allocate, add transport, receive)
- Demand status progression and detail page
- Exported Demand PDF structure

It focuses on actual UI fields/tables/modals visible in screenshots and the observed workflow behavior.

---

## 2) Store/Warehouse Module

## 2.1 Stores List Screen (`/stores`)
### Sidebar context
- Group: `WAREHOUSES & STORES`
- Menu: `Stores`

### Top actions and controls
- `Create New` button
- DataTable controls:
  - `Show <n> entries`
  - `Search`
  - Pagination (`Previous`, page numbers, `Next`)

### Main table columns (observed)
1. `warehouse Name`
2. `Region Name`
3. `Prefix`
4. `Store`
5. `Landline`
6. `Mobile`
7. `Address`
8. `Edit`
9. `Delete`

### Row behavior
- `Edit` opens update modal
- `Delete` removes row

## 2.2 Create Store/Warehouse Modal (Add)
Modal title shown as `Add Vendor` in screenshot, but fields clearly correspond to store/warehouse setup.

### Fields (Create)
1. `Warehouse Name` (select; placeholder: `select wheare house`)
2. `Region Name`
3. `Prefix` (placeholder e.g. `Prefix (e.g., L for Lahore)`)
4. `Head Office`
5. `Landline`
6. `Mobile No`
7. `Address`
8. `Latitude`
9. `Longitude`

### Actions
- `Add`
- `Close`

## 2.3 Update Store/Warehouse Modal (Edit)
Modal title shown as `Update Vendor` in screenshot, same field model as store edit.

### Fields (Update)
1. `Warehouse Name`
2. `Region Name`
3. `Prefix`
4. `Head Office`
5. `Landline`
6. `Mobile No`
7. `Address`
8. `Latitude`
9. `Longitude`

### Actions
- `Update`
- `Close`

---

## 3) Inventory View Module
Screen: `/inventories/regular`

### Top filters
1. `Store` (select)
2. `Product` (select)
3. `Product Variant` (select)
4. `Clear Filters`

### Grid controls
- `Show <n> entries`
- `Export to Excel`
- `Search`
- Pagination

### Inventory table columns (full visible set)
1. `Sr#`
2. `Store`
3. `Product`
4. `Product Variant`
5. `Category`
6. `Total Qty`
7. `Available Qty`
8. `Assigned Qty`
9. `Reusable Qty`
10. `damaged Qty`
11. `condemned Qty`
12. `stolen Qty`

### Quantity model represented by UI
- Stock is split by condition/state buckets, not only total:
  - available
  - assigned
  - reusable
  - damaged
  - condemned
  - stolen

---

## 4) Demand Response Module (Receive/Respond Side)
Primary screen: `/demands_response`

### Sidebar context
- Group: `WAREHOUSES & STORES`
- Menu: `Demands`
  - `Send Request`
  - `Response Request`

## 4.1 Demand Response List Table
### Columns
1. `Sr#`
2. `From Store`
3. `To Warehouse`
4. `Status`
5. `Dated`
6. `Requested By`
7. `Responsed By`
8. `Canceled By`
9. `Canceled Reason`
10. `Canceled at`
11. `Rejected By`

(Expanded rows display additional detail fields below)

### Status badges seen
- `Pending`
- `Checked Out`
- `Completed`

## 4.2 Expand Row Details (on plus/minus icon)
Expanded detail block contains:
1. `Rejected Reason`
2. `Rejected at`
3. `Total Quantity`
4. `Request Remarks`
5. `Response Remarks`
6. `Action` (button/dropdown)

### Action menu options (observed)
- `Reject`
- `Allocate`
- `Show Details`
- `Add Transport` (appears after checkout stage)

---

## 5) Allocation Flow (Demand Response)
Triggered from Action -> `Allocate` for pending demand.

### Allocation page title
- `Add Responded Demands`

### Allocation table (visible fields)
From first allocation screenshot:
1. `Sr#`
2. `Product Name`
3. `Product Code`
4. `To Avail Qty`
5. `To Reusable Qty`
6. `From Avail Qty`
7. `From Reusable Qty`
8. `Required Qty`
9. `New Fulfill Qty` (input)
10. `Reusable Fulfill Qty` (input)
11. `Note` (input/textarea per line)

From second screenshot (horizontal crop of same table):
- Confirms columns for line-level fulfillment inputs and note:
  - `New Fulfill Qty`
  - `Reusable Fulfill Qty`
  - `Note`

### Form-level field
- `Response Remarks` (textarea)

### Submit action
- `Add Response`

### Outcome after Add Response
- Demand status transitions from `Pending` to `Checked Out`.
- Row details show updated `Response Remarks`.
- Fulfillment totals reflect allocated values.
- Supports partial fulfillment (not all required quantity allocated).

---

## 6) Transport Flow (Post-Checkout)
Triggered from Demand Response row Action -> `Add Transport`.

URL pattern observed: `/demand/response-demand/transports/add-transport/{id}`

### Shared field
- `Transportation Type` (drives conditional form schema)

## 6.1 Transportation Type = `self`
Fields:
1. `Transportation Type`
2. `Driver Name`
3. `Driver Phone`
4. `Vehicle Number`

Action: `Submit`

## 6.2 Transportation Type = `Courier`
Fields:
1. `Transportation Type`
2. `Courier Company Name`
3. `Courier By`
4. `Date & Time`
5. `Courier Tracking ID`

Action: `Submit`

### Behavioral note
Transport entry is a distinct post-allocation step in the lifecycle, not embedded inside allocation form.

---

## 7) Receive Confirmation Flow (Sender-Side Completion)
Shown as modal `Receive Demand` on send-side journey (`/demands_send` context).

### Modal columns / line fields
1. `Product`
2. `Code`
3. `Variant`
4. `Requested Qty`
5. `Fulfilled New Qty`
6. `Fulfilled Reusable Qty`
7. `Received New Qty` (editable)
8. `Received Reusable Qty` (editable)
9. `Remarks` (per-line)

### Action
- `Confirm Receive`

### Effect
- Confirms physical receipt and closes remaining operational loop.
- Demand can move to final completion.

---

## 8) End-to-End Demand Lifecycle (Observed)
Primary lifecycle across send/response modules:

1. **Store creates demand** to warehouse (request contains product lines and required quantities).
2. **Warehouse user opens Response Request**, selects pending row action.
3. **Allocate**:
   - Enter line-wise `New Fulfill Qty` and/or `Reusable Fulfill Qty`.
   - Add notes/response remarks.
   - Submit via `Add Response`.
4. Status becomes **Checked Out**.
5. **Add Transport** from response action menu.
6. Sender-side **Confirm Receive** with received qty by condition.
7. Status reaches **Completed**.

### Partial completion behavior
- If allocated qty < required qty for one or more lines:
  - Request remains partially fulfilled in quantity math.
  - Details page and report fields expose required vs fulfilled vs shortfall.

---

## 9) Demand Details Page (`showdatatable/{id}`)
A dedicated detail/audit page for one demand response.

### 9.1 Timeline/Stepper
Observed stages in top timeline:
1. `Pending`
2. `Checked_out`
3. `In_transit`
4. `Completed`

Includes timestamps under each stage.

### 9.2 Summary table fields
- `From Store`
- `To Store`
- `Requested By`
- `Responsed By`
- `Total Required Qty`
- `Total Fulfill Qty`
- `Total Received Qty`
- `Total ShortFall Qty`
- `Date`
- Status indicator (visible near summary)

### 9.3 Demand Responded Details table
Columns observed:
1. `Sr#`
2. `Product`
3. `Product Code`
4. `To Inventory - Available Quantity`
5. `To Inventory - Reusable Quantity`
6. `From Inventory - Available Quantity`
7. `From Inventory - Reusable Quantity`
8. `Required Quantity`

### 9.4 Transportation Details table
Columns observed:
1. `Transportation Type`
2. `Driver Name`
3. `Driver Phone`
4. `Vehicle Number`
5. `Courier Company`
6. `Tracking ID`
7. `Courier By`
8. `Date`

### 9.5 Export
- `Export PDF` button on detail page.

---

## 10) Demand PDF Output Schema (Export)
PDF title observed: `Demand Request Summary`

## 10.1 Header / information block
- `Date`
- `From` store
- `To Warehouse`
- `Requested By`
- `Status`
- `Request Remarks`
- `Response Remarks`
- `Responsed By`

## 10.2 Demand Item Details table
Columns observed:
1. `Sr.no`
2. `Product`
3. `Variant Code`
4. `Required Qty`
5. `Allocated Item (New)`
6. `Allocated Item (Reusable)`
7. `Allocated Item (Total)`
8. `Note`

## 10.3 Transportation Details table
Columns observed:
1. `Transportation Type`
2. `Driver Name`
3. `Driver Phone`
4. `Vehicle Number`
5. `Courier Company`
6. `Tracking ID`
7. `Courier By`
8. `Date`

---

## 11) Key Workflow Rules Derived from Screens
1. Demand direction is operationally **Store -> Warehouse**.
2. `Allocate` is the fulfillment planning operation at response side.
3. `Checked Out` indicates response allocation submitted.
4. Transport must be added after checkout to reach transit stage.
5. Receiver confirmation finalizes fulfillment and completion.
6. Fulfillment supports mixed stock classes (`new` and `reusable`).
7. Partial fulfillment is first-class and explicitly surfaced in totals/shortfall.

---

## 12) Meta-Field Master Index (Quick Reference)

## Store/Warehouse meta-fields
- Warehouse Name, Region Name, Prefix, Head Office, Landline, Mobile No, Address, Latitude, Longitude

## Inventory quantity meta-fields
- Total Qty, Available Qty, Assigned Qty, Reusable Qty, Damaged Qty, Condemned Qty, Stolen Qty

## Demand header meta-fields
- From Store, To Warehouse, Status, Dated, Requested By, Responsed By, Canceled By, Canceled Reason, Canceled At, Rejected By, Rejected Reason, Rejected At

## Demand line allocation meta-fields
- To Avail Qty, To Reusable Qty, From Avail Qty, From Reusable Qty, Required Qty, New Fulfill Qty, Reusable Fulfill Qty, Note

## Receive confirmation meta-fields
- Fulfilled New Qty, Fulfilled Reusable Qty, Received New Qty, Received Reusable Qty, line remarks

## Transportation meta-fields
- Transportation Type, Driver Name, Driver Phone, Vehicle Number, Courier Company Name, Courier By, Date & Time, Courier Tracking ID

## Demand totals meta-fields
- Total Quantity / Total Required Qty, Total Fulfill Qty, Total Received Qty, Total ShortFall Qty

---

## 13) Implementation Mapping Notes for ERP V2
For strict staging parity in ERP V2, ensure:
- Store and warehouse master forms preserve all geo/contact fields.
- Inventory grid keeps all condition-state quantity buckets.
- Demand response supports:
  - row action states
  - allocate modal with new/reusable split
  - transport step after checkout
  - receive confirmation modal with received qty split
- Details page has timeline + summary + line detail + transport + PDF export.
- Partial fulfillment and shortfall are computed and visible at line + header level.
