# End-to-End Live Demonstration Script

## Intelligent Invoice Processing & Payment Tracker

This demonstration walkthrough showcases the full life-cycle of automated invoice processing, AI data extraction, fraud/duplicate guardrails, human-in-the-loop approvals, payment tracking, and analytics surveillance using safe synthetic test fixtures.

---

## Demonstration Overview

| Stage | Action / Workflow Step | Component | Expected Outcome | Screenshot to Capture |
| :--- | :--- | :--- | :--- | :--- |
| **Stage 1** | Inbound Invoice Email | Gmail | Email with synthetic PDF arrives under label `INVOICE_TO_PROCESS`. | **Screenshot 1**: Gmail inbox showing tagged invoice email and PDF attachment. |
| **Stage 2** | Ingestion & Storage | `GmailService` & `DriveService` | Attachment saved as `messageId_index_name.pdf` in `01_Raw_Invoices`. | **Screenshot 2**: Google Drive `01_Raw_Invoices` folder showing newly saved PDF. |
| **Stage 3** | AI Data Extraction | `GeminiService` (`gemini-2.5-flash`) | Gemini parses PDF and returns structured JSON with high confidence (> 0.90). | **Screenshot 3**: Apps Script execution log showing Gemini extraction JSON payload. |
| **Stage 4** | Sheets Database Insertion | `InvoiceExtractor` | Row appended to `Invoices` sheet with status `PENDING` / `UNPAID`. | **Screenshot 4**: `Invoices` Google Sheet showing row populated across 18 columns. |
| **Stage 5** | Duplicate Detection | `DuplicateDetector` | Re-uploading identical invoice is flagged; no duplicate row created. | **Screenshot 5**: Console log showing `Duplicate detected. Existing row: <row>`. |
| **Stage 6** | Pending Approval Email | `NotificationService` | Admin receives notification `Invoice Awaiting Approval: <ID>`. | **Screenshot 6**: Admin Gmail inbox displaying approval request email. |
| **Stage 7** | Human Approval Decision | `ApprovalService` | Manager approves invoice; status set to `APPROVED`; logged to `Approval_Log`. | **Screenshot 7**: `Approval_Log` sheet showing timestamped approval decision. |
| **Stage 8** | Upcoming Payment Alert | `NotificationService` | Trigger detects invoice due within 3 days; dispatches payment reminder. | **Screenshot 8**: Admin inbox displaying `Payment Due Soon: <ID>`. |
| **Stage 9** | Record Invoice Payment | `PaymentTracker` | Finance records wire reference; status set to `PAID`; logged to `Payment_Log`. | **Screenshot 9**: `Payment_Log` sheet showing payment reference and timestamp. |
| **Stage 10**| Overdue Alert (Test Case)| `NotificationService` | Unpaid invoice past due date receives escalation reminder on cycle (Day 1, 4, 7).| **Screenshot 10**: Admin email with subject `OVERDUE PAYMENT: <ID>`. |
| **Stage 11**| Analytics Dashboard | Looker Studio / HTML | Executive KPI scorecards and spending breakdown reflect updated numbers. | **Screenshot 11**: Full dashboard view showing 8 KPIs and 6 visual charts. |

---

## Step-by-Step Execution Guide for Presenters

### Step 1: Ingest New Synthetic Invoice
Run in Apps Script editor:
```javascript
processIncomingInvoices();
```
**Verify**:
- Log outputs `Gmail attachment retrieval completed`.
- `01_Raw_Invoices` Drive folder contains the PDF.
- `Invoices` sheet has a new record with `Approval_Status = PENDING`.
- Admin email receives the review alert.

### Step 2: Test Duplicate Guard
Rerun immediately:
```javascript
processIncomingInvoices();
```
**Verify**:
- Log outputs `Duplicate detected for file...`.
- No new row is inserted into Google Sheets.

### Step 3: Approve Invoice
Run in Apps Script editor:
```javascript
updateInvoiceApproval("INV-2026-001", "APPROVED", "Verified against purchase order PO-2026-881.");
```
**Verify**:
- `Invoices` sheet column N updates to `APPROVED`.
- `Approval_Log` records approver email and decision.
- Admin receives `Invoice APPROVED: INV-2026-001`.

### Step 4: Dispatch Scheduled Reminders
Run in Apps Script editor:
```javascript
processDailyNotifications();
```
**Verify**:
- Daily summary logs: `Notifications sent: 1`.
- Admin receives `Payment Due Soon: INV-2026-001`.
- `Notification_Log` records event `UPCOMING_INV-2026-001` with status `SENT`.

### Step 5: Disburse Payment
Run in Apps Script editor:
```javascript
recordInvoicePayment("INV-2026-001", "2026-11-23", "WIRE-REF-DEMO-001");
```
**Verify**:
- `Invoices` sheet column O updates to `PAID`.
- `Payment_Log` records amount, wire reference, and timestamp.

### Step 6: Present Executive Dashboard
Open `docs/dashboard.html` in browser or navigate to the Looker Studio report.
**Verify**:
- Total Invoices: reflects processed count.
- Approved & Paid metrics updated.
- Zero duplicate entries.
