# Dashboard Architecture & Technical Documentation

## Intelligent Invoice Processing & Payment Tracker — Executive Finance Dashboard

The **Intelligent Invoice Processing & Payment Tracker** dashboard is a live, cloud-native web application built on Google Apps Script and Google Sheets. Designed for senior executives, finance managers, and academic evaluation panels, it delivers unified visibility across the entire accounts payable lifecycle.

---

## 1. System Architecture

```
┌───────────────────────────────────────────────────────────┐
│              Google Sheets Database Layer                 │
│  - Invoices (18 columns)                                  │
│  - Approval_Log (Audit ledger)                            │
│  - Payment_Log (Audit ledger)                             │
└─────────────────────────────┬─────────────────────────────┘
                              │ Batch Reads (getValues)
                              ▼
┌───────────────────────────────────────────────────────────┐
│          Google Apps Script Backend API Layer             │
│                 (DashboardService.gs)                     │
│  - doGet(e) [HTML / JSON API]                             │
│  - doPost(e) [Action Handlers: approve, reject, pay]      │
│  - getDashboardData() [Aggregations & Analytics Engine]   │
│  - Concurrency Locking (LockService)                      │
└──────────────┬─────────────────────────────▲──────────────┘
               │ HTML Delivery               │ google.script.run
               │ / JSON API                  │ / Fetch POST
               ▼                             │
┌────────────────────────────────────────────┴──────────────┐
│            Dashboard Frontend Web Application             │
│                      (Dashboard.html)                     │
│  - 6 Modular Sections (Overview, Invoices, Approvals,     │
│    Payments, Overdue/Upcoming, Analytics)                 │
│  - Chart.js Dynamic Visualizations                        │
│  - Client-side Instant Filter & Search Engine             │
│  - Modals (Invoice Details, Approval/Reject, Record Pay)  │
└───────────────────────────────────────────────────────────┘
```

---

## 2. Navigation Sections & Component Breakdown

The dashboard is structured into six dedicated operational sections:

### Section 1: Overview
- **10 KPI Scorecards**:
  1. *Total Invoices*: Total volume of all recorded invoices.
  2. *Total Invoice Value*: Sum of invoice amounts strictly excluding `REJECTED` invoices.
  3. *Pending Approvals*: Invoices awaiting managerial decision.
  4. *Approved Invoices*: Invoices with formal sign-off.
  5. *Rejected Invoices*: Count and total value of rejected vendor submissions.
  6. *Paid Invoices*: Settled invoices with recorded disbursement references.
  7. *Approved Unpaid Invoices*: Active accounts payable backlog.
  8. *Overdue Invoices*: Approved unpaid liabilities past due date ($Due\_Date < Today$).
  9. *Total Paid Amount*: Reconciled cash disbursements.
  10. *Outstanding Amount*: Total approved unpaid liability.
- **Visualizations**:
  - Monthly invoice value by payment status (Stacked Bar Chart).
  - Approval status distribution (Doughnut Chart).
  - Payment status distribution (Doughnut Chart).
  - Vendor-wise approved invoice value (Horizontal Bar Chart).
- **Executive Narrative**: Auto-generated surveillance summary of active cashflow.

### Section 2: Invoices
- **Directory Table**: Full dataset with all 18 attributes (Invoice ID, Vendor, Invoice Date, Due Date, Total Amount in INR, Approval Status, Payment Status, Extraction Confidence, and Document Link).
- **Search & Filter Controls**:
  - Free-text search across Invoice ID, Vendor Name, and PO Number.
  - Dropdown filters for Vendor, Approval Status (`APPROVED`, `PENDING`, `REJECTED`), and Payment Status (`PAID`, `UNPAID`).
- **Interactive Capabilities**:
  - Column header sorting (Ascending/Descending).
  - Dynamic pagination (5, 10, 25, 50 rows per page).
  - Invoice Details Modal with complete metadata breakdown.
  - Direct PDF link opening stored Google Drive files.
  - CSV Export of filtered records.

### Section 3: Approvals
- **Pending Approvals Queue**: Action table listing all invoices with status `PENDING`.
- **Human-in-the-Loop Actions**:
  - *Approve*: Sets status to `APPROVED`, sends notification, appends to audit ledger.
  - *Reject*: Enforces mandatory rejection reason, sets status to `REJECTED`, appends to audit ledger.
- **Approval Decision Audit Log**: Immutable chronological ledger loaded live from the `Approval_Log` worksheet showing Invoice ID, Vendor, Decision, Approver Email, Reason, and Timestamp.

### Section 4: Payments
- **Payment Metrics**: Reconciled cash paid vs outstanding approved liabilities.
- **Action Queue**: Lists approved unpaid invoices ready for disbursement.
- **Payment Recording Modal**: Allows finance staff to record the payment date and mandatory transaction reference (NEFT, UPI, Wire Reference). Invokes backend `recordInvoicePayment()` to prevent race conditions.
- **Payment Disbursement Audit Log**: Ledger loaded live from `Payment_Log` showing Invoice ID, Amount, Currency, Payment Date, Reference Number, Recorded By, and Recorded At.

### Section 5: Overdue & Upcoming
- **Overdue Invoices Surveillance**: Prominently highlights approved unpaid invoices past due date, calculating exact days overdue and requiring escalation.
- **Upcoming Payment Obligations Matrix**: Categorizes approved liabilities into 5 time horizons:
  1. *Due Today* ($\text{daysUntilDue} = 0$)
  2. *Due in 1–3 Days* ($1 \le \text{daysUntilDue} \le 3$)
  3. *Due in 4–7 Days* ($4 \le \text{daysUntilDue} \le 7$)
  4. *Due in 8–30 Days* ($8 \le \text{daysUntilDue} \le 30$)
  5. *Due in > 30 Days* ($\text{daysUntilDue} > 30$)

### Section 6: Analytics
- **Vendor Concentration Table**: Ranks vendors by approved invoice value, invoice count, and percentage share of approved spend.
- **Gemini AI Extraction Analytics**:
  - Average extraction confidence score.
  - Distribution breakdown (High $\ge 90\%$, Medium $75-89\%$, Low $< 75\%$).
  - Quality assurance notes and review lists.
- **Monthly Trajectory Chart**: Multi-bar visualization comparing Paid, Outstanding, and Rejected amounts across billing cycles.

---

## 3. Data Validation & Business Rules

All dashboard calculations strictly mirror the backend business logic:
- **Rule 1 (Exclusion of Rejected Invoices)**: Rejected invoices do not contribute to Total Invoice Value, Outstanding Amount, Upcoming Obligations, or Overdue Amount.
- **Rule 2 (Paid Invoice Definition)**: Invoices are paid if and only if `Payment_Status = "PAID"`.
- **Rule 3 (Outstanding Liabilities)**: Liabilities are outstanding if and only if `Approval_Status = "APPROVED"` AND `Payment_Status = "UNPAID"`.
- **Rule 4 (Overdue Liabilities)**: Invoices are overdue if and only if `Approval_Status = "APPROVED"` AND `Payment_Status = "UNPAID"` AND `Due_Date < Today`.
- **Rule 5 (Currency Standards)**: All currency amounts formatted in Indian Rupees (`₹11,800.00`).
- **Rule 6 (Timezone Integrity)**: Calculated against `Asia/Kolkata` using UTC date math to avoid off-by-one errors.
- **Rule 7 (Missing Values)**: Handled gracefully without misleading conversions to zero.

---

## 4. Backend API Functions (`DashboardService.gs`)

1. `doGet(e)`: Serves the Web App HTML or returns JSON (`?action=api`).
2. `doPost(e)`: Handles action requests (`approve`, `reject`, `recordPayment`, `getData`).
3. `getDashboardData()`: Primary aggregator executing 3 batch reads across `Invoices`, `Approval_Log`, and `Payment_Log`.
4. `approveInvoiceFromDashboard(invoiceId, reason)`: Invokes `updateInvoiceApproval` with audit logging.
5. `rejectInvoiceFromDashboard(invoiceId, reason)`: Validates mandatory reason and invokes `updateInvoiceApproval`.
6. `recordPaymentFromDashboard(invoiceId, paymentDate, paymentReference)`: Enforces reference validation and invokes `recordInvoicePayment`.
