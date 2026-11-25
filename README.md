# Intelligent Invoice Processing & Payment Tracker

An automated invoice management system built using **Google Apps Script, Gmail, Google Drive, Google Sheets, Gemini AI, and Chart.js**. The application streamlines invoice collection, data extraction, duplicate detection, approval workflows, payment tracking, and financial monitoring through an interactive web dashboard.

## Live Dashboard

**[Open the Intelligent Invoice Processing Dashboard](https://script.google.com/macros/s/AKfycby15IDo1SQagPTrXSsUohyhaajUEo-VsJqQGLLuTcKGWBEaBIctVUI9cYR3L7ZXjJ3xlg/exec)**

The deployed web application provides a centralized interface for monitoring invoices, managing approvals, recording payments, and analyzing accounts payable.

## Dashboard Preview

### Executive Overview

The dashboard provides real-time visibility into invoice volumes, financial liabilities, approval status, paid amounts, outstanding balances, overdue invoices, and vendor-wise analytics.

<img width="1917" height="892" alt="image" src="https://github.com/user-attachments/assets/4ff4222c-d17a-4061-9686-149b46619b1d" />

### Financial Analytics

Visualizes payment status distribution, monthly invoice values, approval distribution, and vendor-wise approved invoice amounts.

<img width="1588" height="550" alt="image" src="https://github.com/user-attachments/assets/8f39f7c6-281a-41d1-89f6-b9de1c700e54" />

## Key Features

- **Automated Invoice Monitoring:** Retrieves invoice emails and attachments from Gmail.
- **Google Drive Integration:** Stores incoming invoice PDFs in organized Drive folders.
- **AI-Powered Data Extraction:** Uses Gemini 2.5 Flash to extract invoice details from PDF documents.
- **Data Validation:** Validates extracted invoice fields and identifies incomplete or inconsistent records.
- **Duplicate Detection:** Identifies potential duplicate invoices using invoice data and duplicate keys.
- **Approval Workflow:** Supports invoice approval and rejection with recorded decisions and rejection reasons.
- **Payment Tracking:** Records payment dates, amounts, references, and payment status.
- **Automated Notifications:** Sends upcoming due-date and overdue payment reminders.
- **Interactive Dashboard:** Displays KPIs, invoice records, approval queues, payment information, and financial analytics.
- **Search and Filtering:** Supports invoice lookup, filtering, sorting, and pagination.
- **CSV Export:** Exports invoice records for reporting and further analysis.
- **Audit Logging:** Maintains approval, payment, and notification histories.

## System Architecture

```text
             Gmail Inbox
                  |
                  v
        Invoice Email Monitoring
                  |
                  v
          Attachment Retrieval
                  |
                  v
           Google Drive Storage
                  |
                  v
          Gemini AI Extraction
                  |
                  v
         Data Validation
                  |
                  v
          Duplicate Detection
                  |
                  v
          Google Sheets Database
                  |
          +-------+--------+
          |                |
          v                v
    Approval Workflow   Notifications
          |
          v
     Payment Tracking
          |
          v
    Dashboard & Analytics
```

## Technology Stack

| Component | Technology |
|---|---|
| Backend | Google Apps Script |
| AI / Data Extraction | Gemini 2.5 Flash |
| Email Integration | GmailApp |
| File Storage | Google Drive |
| Database | Google Sheets |
| Frontend | HTML, CSS, JavaScript |
| Data Visualization | Chart.js |
| Version Control | Git and GitHub |
| Development Tools | Google Antigravity, clasp |

## Project Structure

```text
Intelligent-Invoice-Processing/
│
├── Config.gs
├── GmailService.gs
├── DriveService.gs
├── GeminiService.gs
├── InvoiceExtractor.gs
├── DuplicateDetector.gs
├── ApprovalService.gs
├── PaymentTracker.gs
├── NotificationService.gs
├── Main.gs
├── DashboardService.gs
├── Dashboard.html
├── TestRunner.gs
│
├── tests/
│   └── test-suite.js
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DASHBOARD.md
│   ├── DASHBOARD_DEPLOYMENT.md
│   ├── DASHBOARD_TESTING.md
│   ├── DEMO_SCRIPT.md
│   ├── DEPLOYMENT.md
│   ├── LOOKER_STUDIO_DASHBOARD_GUIDE.md
│   └── TESTING.md
│
├── .claspignore
├── .gitignore
├── appsscript.json
└── README.md
```

## Testing and Validation

The project includes automated tests and live workflow validation.

| Test Area | Result |
|---|---|
| Upcoming payment reminders | Passed |
| Notification trigger management | Passed |
| End-to-end invoice workflow | Passed |
| Error handling and resilience | Passed |
| Dashboard functionality | Passed |
| **Total automated tests** | **26 Passed, 0 Failed** |

Additional live validation included:

- Invoice approval and rejection.
- Approval audit-log generation.
- Payment recording and payment-log generation.
- Dashboard KPI updates after workflow actions.
- CSV export.
- Invoice PDF access.
- Database connectivity and system health checks.

## Security and Configuration

- Gemini API credentials are stored in Google Apps Script Script Properties.
- Local clasp configuration and environment files are excluded from Git tracking.
- Invoice processing and approval actions use server-side validation.
- Approval and payment operations use locking to reduce concurrent update conflicts.
- Access to the deployed application is restricted to authorized users.

## Important Notes

- The project uses synthetic invoice records for demonstration and testing.
- Payment tracking records payment metadata only. It does not initiate bank transfers or process actual financial transactions.
- Gemini AI performs invoice data extraction; extracted information is validated before further processing.
- Google Apps Script services require appropriate Google account permissions and authorization.

## Future Enhancements

- Integration with accounting and ERP platforms.
- Advanced invoice anomaly detection.
- More comprehensive vendor performance analytics.
- Configurable approval hierarchies.
- Enhanced financial forecasting and reporting.

## Author

**Anjali D S**

B.Tech Computer Science and Engineering (Artificial Intelligence)

[GitHub](https://github.com/anjali06212/) | [LinkedIn](https://www.linkedin.com/in/anjali-d-s-504209323/)

---

*Built to simplify invoice management through automation, AI-powered extraction, and financial visibility.*
