# Intelligent Invoice Processing & Payment Tracker

An enterprise-grade, cloud-native automation solution for accounts payable, automated invoice extraction, fraud prevention, managerial approval workflows, payment lifecycle tracking, and financial analytics built on Google Workspace, Google Apps Script V8, and Google Gemini Multimodal AI.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Business Problem](#2-business-problem)
3. [Project Objectives](#3-project-objectives)
4. [Features](#4-features)
5. [Technology Stack](#5-technology-stack)
6. [System Architecture](#6-system-architecture)
7. [End-to-End Workflow](#7-end-to-end-workflow)
8. [Project Directory Structure](#8-project-directory-structure)
9. [Google Cloud and Apps Script Setup](#9-google-cloud-and-apps-script-setup)
10. [Spreadsheet Configuration](#10-spreadsheet-configuration)
11. [Drive Folder Configuration](#11-drive-folder-configuration)
12. [Gmail Label Configuration](#12-gmail-label-configuration)
13. [Gemini API Configuration](#13-gemini-api-configuration)
14. [Script Properties Setup](#14-script-properties-setup)
15. [Deployment Instructions](#15-deployment-instructions)
16. [Trigger Installation & Verification](#16-trigger-installation--verification)
17. [Testing Instructions](#17-testing-instructions)
18. [Error Handling & Resilience](#18-error-handling--resilience)
19. [Security Considerations](#19-security-considerations)
20. [Known Limitations](#20-known-limitations)
21. [Future Enhancements](#21-future-enhancements)

---

## 1. Project Overview

The **Intelligent Invoice Processing & Payment Tracker** automates the end-to-end invoice lifecycle. It ingests vendor invoices directly from Gmail emails, archives the original PDF documents securely into Google Drive, extracts structured invoice line items and header metadata using Gemini 2.5 Flash, validates dates and calculations, prevents fraudulent duplicate submissions, routes invoices through managerial approval, tracks payment status with wire audit logging, and dispatches automated reminder notifications before and after due dates.

---

## 2. Business Problem

Traditional manual accounts payable workflows suffer from major operational challenges:
- **High Labor Costs & Human Error**: Manual data entry of line items, tax numbers, and dates frequently introduces typos and math discrepancies.
- **Duplicate Payments**: Organizations lose significant capital paying the same invoice multiple times due to uncoordinated email submissions.
- **Missed Deadlines & Penalties**: Late payment penalties accumulate because invoices remain lost in email inboxes without clear due-date surveillance.
- **Lack of Auditability**: Inability to trace who approved an invoice, when payment occurred, and what reference number was issued.
- **Poor Cashflow Visibility**: Financial leaders lack real-time visibility into pending, approved, and overdue liabilities.

---

## 3. Project Objectives

1. **Zero-Touch Ingestion**: Automatically detect and download PDF invoices from designated Gmail threads without human intervention.
2. **Accurate Multimodal AI Extraction**: Leverage Google Gemini 2.5 Flash to accurately extract key invoice fields with high confidence.
3. **Automated Fraud & Duplicate Guardrails**: Compute deterministic vendor/invoice signatures and enforce strict mathematical validation ($Subtotal + Tax = Total$).
4. **Structured Audit Logs**: Maintain independent audit logs for approvals, payments, and notifications.
5. **Proactive Cashflow Notifications**: Notify the administrator exactly 3 days prior to due dates, and dispatch recurring overdue reminders on a scheduled cycle.
6. **Executive Analytics**: Deliver KPI surveillance tracking total spending, approval ratios, and cash disbursement status.

---

## 4. Features

- **Automated Gmail Ingestion**: Monitors `INVOICE_TO_PROCESS` label, filters non-PDFs, and avoids re-ingestion.
- **Structured Google Drive Hierarchy**: Automatically archives files into organized Drive directories.
- **Gemini 2.5 Flash Vision Extraction**: Zero-shot multimodal extraction producing standardized JSON data.
- **Strict Data Validation Engine**: Verifies ISO 8601 dates, currency formats, positive amounts, and math balance.
- **Concurrency-Safe Duplicate Detection**: Uses Google Apps Script `ScriptLock` to eliminate race conditions.
- **Approval Decision Workflow**: Supports `APPROVED` and `REJECTED` state transitions with mandatory rejection reasoning.
- **Payment Lifecycle Tracking**: Restricts payments strictly to approved unpaid invoices with payment reference auditing.
- **Idempotent Notification Engine**: Dual-phase logging (`SENDING` -> `SENT`/`FAILED`) ensures zero email duplication.
- **Missed-Trigger Resilience**: Due date window calculation ($0 \le \text{daysUntilDue} \le 3$) prevents missed reminders.
- **Live Executive Web Dashboard**: Unified, responsive multi-section web application (Overview, Invoices directory, Approvals queue & audit, Payment tracking & audit, Overdue & Upcoming matrix, Financial Analytics) with Chart.js visualizations, live Google Sheets connection, and human-in-the-loop actions.
- **Looker Studio BI Reporting Blueprint**: Alternative BI reporting configuration for Looker Studio.

---

## 5. Technology Stack

- **Runtime**: Google Apps Script V8 Modern ECMAScript (JavaScript ES6+)
- **Cloud Infrastructure**: Google Workspace (Gmail, Drive, Sheets, Cloud Logging)
- **Generative AI Model**: Google Gemini 2.5 Flash (`gemini-2.5-flash` via Google AI Studio REST API)
- **Deployment & CLI**: Google Clasp CLI (`@google/clasp`)
- **Testing**: Node.js automated test runner & in-container Apps Script test suite
- **Analytics & BI**: Looker Studio & TailwindCSS/Chart.js

---

## 6. System Architecture

```
Gmail Inbound (INVOICE_TO_PROCESS)
       │
       ▼
GmailService.gs ──> DriveService.gs (01_Raw_Invoices)
                           │
                           ▼
                   GeminiService.gs (gemini-2.5-flash)
                           │
                           ▼
                 DuplicateDetector.gs (Validation & Duplicate Key)
                           │
                           ▼
                  InvoiceExtractor.gs (ScriptLock + Invoices Sheet)
                           │
                           ▼
                 ApprovalService.gs (Approval_Log + Decision Workflow)
                           │
                           ▼
                 PaymentTracker.gs (Payment_Log + Overdue Engine)
                           │
                           ▼
               NotificationService.gs (Notification_Log + 9 AM IST Trigger)
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for full architectural specifications and diagrams.

---

## 7. End-to-End Workflow

1. **Email Arrival**: Vendor sends invoice PDF to Gmail. Thread is labeled `INVOICE_TO_PROCESS`.
2. **Extraction & Archive**: `fetchInvoiceAttachments()` moves PDF to Drive raw invoices folder.
3. **AI Vision Parse**: `extractInvoiceData()` passes Base64 PDF to Gemini 2.5 Flash, receiving validated JSON.
4. **Validation Check**: `validateInvoiceData()` checks mandatory keys, dates, and mathematical consistency.
5. **Duplicate Check**: Computes key `vendor|invoice_id`; verifies absence from column 13 of `Invoices`.
6. **Sheet Insertion**: Appends record with `Approval_Status = PENDING` and `Payment_Status = UNPAID`.
7. **Approval Alert**: Email dispatched to admin alerting them to review the invoice.
8. **Manager Decision**: Manager executes `updateInvoiceApproval(id, 'APPROVED'|'REJECTED', reason)`.
9. **Scheduled Daily Processing (9 AM IST)**:
   - Invoices due in $\le 3$ days receive upcoming payment reminders.
   - Overdue invoices receive recurring reminder cycle emails (Day 1, 4, 7, etc.).
10. **Payment Recording**: Manager records disbursement via `recordInvoicePayment(id, date, reference)`.

---

## 8. Project Directory Structure

```
Intelligent-Invoice-Processing/
├── .clasp.json                   # Clasp script and parent spreadsheet binding
├── .claspignore                  # Deployment filter (ignores tests, docs, samples)
├── appsscript.json               # Apps Script manifest (Asia/Kolkata timezone, V8 runtime)
├── Config.gs                     # Global constants, folder IDs, and notification settings
├── GmailService.gs               # Gmail search, thread inspection, attachment fetching
├── DriveService.gs               # Drive folder hierarchy validation and utilities
├── GeminiService.gs              # Gemini API communication, retries, and PDF parsing
├── DuplicateDetector.gs          # Data validation, ISO date parsing, and duplicate keys
├── InvoiceExtractor.gs           # Database persistence with ScriptLock protection
├── ApprovalService.gs            # Approval decision engine and audit logging
├── PaymentTracker.gs             # Payment disbursement recording and overdue engine
├── NotificationService.gs        # Email alert engine, idempotency, and daily trigger
├── DashboardService.gs           # Executive dashboard backend, aggregations, and Web App API
├── Dashboard.html                # Live multi-section responsive finance dashboard web app
├── Main.gs                       # System controller, health checker, and batch pipeline
├── TestRunner.gs                 # Production-safe synthetic test suite for Apps Script
├── docs/
│   ├── ARCHITECTURE.md           # In-depth architectural design and data flow
│   ├── DASHBOARD.md              # Live dashboard architecture, components, and schema
│   ├── DASHBOARD_TESTING.md      # Dashboard testing results, KPI baseline, and test matrix
│   ├── DASHBOARD_DEPLOYMENT.md   # Web App deployment steps, permissions, and local testing
│   ├── TESTING.md                # Test execution matrix and evidence report
│   ├── DEPLOYMENT.md             # Clasp commands, configuration, and setup guide
│   ├── DEMO_SCRIPT.md            # Live presentation script with screenshot guide
│   ├── LOOKER_STUDIO_DASHBOARD_GUIDE.md # Alternative BI Looker Studio reporting guide
│   └── dashboard.html            # Standalone interactive executive analytics dashboard
└── tests/
    └── test-suite.js             # Automated Node.js unit and integration test suite (26 tests)
```

---

## 9. Google Cloud and Apps Script Setup

- **Apps Script Project ID**: `1K8B-jzGbeSapoSXZ6rg6vZsrclj0RfUWNI-rFUi5mRWhv671kZLh8zD7`
- **Spreadsheet ID**: `1PJuZp1RDdUE7Be7KwOg0T2xKTM8Qnw_ku8lCFpkBTjs`
- **Configured Timezone**: `Asia/Kolkata`
- **Runtime**: V8 Modern Engine

---

## 10. Spreadsheet Configuration

The database contains 4 interconnected sheets:
1. **`Invoices` (18 columns)**:
   - A: `Invoice_ID` | B: `Vendor_Name` | C: `Vendor_Email` | D: `Invoice_Date` | E: `Due_Date`
   - F: `Currency` | G: `Subtotal` | H: `Tax` | I: `Total_Amount` | J: `PO_Number`
   - K: `Invoice_File_URL` | L: `Gmail_Message_ID` | M: `Duplicate_Key`
   - N: `Approval_Status` | O: `Payment_Status` | P: `Extraction_Confidence`
   - Q: `Processed_At` | R: `Error_Message`
2. **`Approval_Log`**: `Invoice_ID`, `Vendor_Name`, `Decision`, `Approver_Email`, `Reason`, `Timestamp`
3. **`Payment_Log`**: `Invoice_ID`, `Vendor_Name`, `Amount`, `Currency`, `Payment_Date`, `Reference`, `Recorded_By`, `Recorded_At`
4. **`Notification_Log`**: `Invoice_ID`, `Notification_Type`, `Recipient`, `Notification_Date`, `Status`, `Idempotency_Key`, `Error_Message`

---

## 11. Drive Folder Configuration

- **01_Raw_Invoices**: `1nuWe1WSCNroV_YT1D1WNA7THTWrVk5fB`
- **02_Processed_Invoices**: `1tTZ5OWiGoRqUHXFPgxTn11X54ZFPK7wL`
- **03_Approval_Records**: `1mqtBXnBjKTkGIb45tErjrJbIJvaNom9n`
- **04_Reports**: `1rFecjahJXJLfnkSjDCThDiGKMunAMA2Z`

---

## 12. Gmail Label Configuration

- Label Name: `INVOICE_TO_PROCESS`
- Dedicated filter: Filter vendor emails with attachments and apply label `INVOICE_TO_PROCESS`.

---

## 13. Gemini API Configuration

- **Model**: `gemini-2.5-flash`
- **Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`
- **Temperature**: `0.1` (deterministic extraction)
- **Response Format**: `application/json`
- **Exponential Backoff Retries**: Retries up to 3 times on HTTP 429, 500, 502, 503, 504.

---

## 14. Script Properties Setup

The Gemini API key is securely retrieved at runtime via `PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY")`.
To configure in Apps Script:
1. Go to **Project Settings** > **Script Properties**.
2. Add Property: `GEMINI_API_KEY` with your API key.
3. Save.

---

## 15. Deployment Instructions

Always inspect and obtain approval before pushing:
```powershell
# 1. Review status
clasp status

# 2. Push to Google Apps Script
clasp push

# 3. Create deployment version
clasp version "v1.0.0 Production Release"
```
See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for full commands.

---

## 16. Trigger Installation & Verification

To install the daily 9 AM IST trigger:
1. Run `installDailyNotificationTrigger()` from `NotificationService.gs`.
2. Verify configuration with `verifyDailyNotificationTrigger()`.
3. Ensures exactly one time-based trigger exists running daily at 9:00 AM IST.

---

## 17. Testing Instructions

### Local Test Execution:
```powershell
node tests/test-suite.js
```
Runs 21 unit/integration tests across all four core tasks.

### Apps Script In-Container Test Execution:
Run `runAllSyntheticTests()` from `TestRunner.gs`. All tests use isolated synthetic fixtures.

See [docs/TESTING.md](docs/TESTING.md) for complete matrix.

---

## 18. Error Handling & Resilience

- **Retry Transient Failures**: Only retries HTTP 429 and 5xx server errors; permanent 4xx errors fail immediately.
- **Validation Guardrails**: Mathematical validation prevents calculation errors from entering the database.
- **Date Safety**: `parseDateValue()` handles Date objects, strings, and nulls safely without `TypeError`.
- **Concurrency Locks**: `LockService.getScriptLock()` prevents race conditions across multi-user environments.

---

## 19. Security Considerations

- **Credential Isolation**: Zero API keys or secrets in source code.
- **Admin Email Lockdown**: All email dispatches route strictly to the configured administrator (`anjalids989@gmail.com`).
- **No Direct Payments**: The tracker is informational and auditable; it never interfaces with direct payment gateways.

---

## 20. Known Limitations

- **Looker Studio Publishing**: Requires manual configuration in the Looker Studio web UI due to Google API permission models.
- **File Format**: Only PDF invoice attachments are parsed; images and Word documents are filtered out.
- **Trigger Execution Window**: Google time-driven triggers execute within a 1-hour window of the designated hour (e.g., 9:00 AM - 10:00 AM).

---

## 21. Future Enhancements

- Multi-currency conversion via live exchange rates.
- Line-item table extraction into a dedicated line items relational sheet.
- Interactive Web App approval portal using HTMLService.
- Slack / Microsoft Teams webhook notifications for managerial approvals.
