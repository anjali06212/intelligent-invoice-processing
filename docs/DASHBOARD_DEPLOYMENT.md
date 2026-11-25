# Dashboard Deployment & Web App Operations Guide

## Intelligent Invoice Processing & Payment Tracker

This guide details the deployment procedure for publishing the live finance dashboard as a Google Apps Script Web App and synchronizing codebase files via clasp.

---

## 1. File Inventory for Deployment

The dashboard module consists of:
- `DashboardService.gs`: Backend API controller, aggregations, and Web App endpoints (`doGet`, `doPost`).
- `Dashboard.html`: Single-page responsive enterprise frontend application.
- `Config.gs`: Database and folder configuration constants.
- `ApprovalService.gs`: Approval workflow engine.
- `PaymentTracker.gs`: Payment recording and overdue engine.
- `DuplicateDetector.gs`: Date normalizer and validation engine.

All files are tracked by clasp and verified against `.claspignore`.

---

## 2. Synchronization via Clasp

### Step 1: Check Current Tracked Files
Verify that all source files and `Dashboard.html` are recognized:
```powershell
clasp status
```

Expected output:
```
Tracked files:
└─ ApprovalService.gs
└─ appsscript.json
└─ Config.gs
└─ Dashboard.html
└─ DashboardService.gs
└─ DriveService.gs
└─ DuplicateDetector.gs
└─ GeminiService.gs
└─ GmailService.gs
└─ InvoiceExtractor.gs
└─ Main.gs
└─ NotificationService.gs
└─ PaymentTracker.gs
└─ TestRunner.gs
```

### Step 2: Push Local Files to Google Apps Script
```powershell
clasp push
```

---

## 3. Web App Deployment in Google Apps Script

To deploy the dashboard as a live web application:

1. Open the project in the Apps Script editor:
   [https://script.google.com/d/1K8B-jzGbeSapoSXZ6rg6vZsrclj0RfUWNI-rFUi5mRWhv671kZLh8zD7/edit](https://script.google.com/d/1K8B-jzGbeSapoSXZ6rg6vZsrclj0RfUWNI-rFUi5mRWhv671kZLh8zD7/edit)

2. Click **Deploy** > **Manage deployments** at the top right.

3. Edit the existing deployment (`AKfycbzTeQxQOr_1FAb7Lj2bzWKtUikDRHDccLQwdzXe4WTT`) OR click **New deployment**:
   - **Type**: `Web app`
   - **Description**: `Production Dashboard v1.0 - Live Finance Operations`
   - **Execute as**: `Me (anjalids989@gmail.com)`
   - **Who has access**:
     - For internal/authorized use: `Only myself` or `Anyone within organization`
     - For demonstration/evaluation: `Anyone` (with Google account or public depending on evaluation setting)

4. Click **Deploy**.

5. Copy the generated Web App URL:
   `https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec`

---

## 4. Local Execution & Browser Demonstration

To preview the dashboard locally without internet or Google account authorization:
1. Double-click or open [docs/dashboard.html](docs/dashboard.html) in any web browser (Chrome, Edge, Firefox, Safari).
2. The dashboard will automatically initialize with the verified baseline dataset matching the live spreadsheet.
3. Test all 6 navigation tabs, interactive charts, search, filters, pagination, and modals.

---

## 5. Architectural Distinction of Dashboard Assets

- **`Dashboard.html`**: The production Apps Script Web App template. Rendered dynamically by `doGet()` in Google Apps Script, communicating with the backend over `google.script.run` and `ContentService`.
- **`docs/dashboard.html`**: The standalone local demonstration copy. Contains the identical UI and logic, with resilient offline fallback to the baseline dataset for reliable offline presentations.
- **`docs/LOOKER_STUDIO_DASHBOARD_GUIDE.md`**: An alternative Business Intelligence reporting specification for Google Looker Studio.
