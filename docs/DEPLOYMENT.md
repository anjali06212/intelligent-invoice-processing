# Deployment & Operations Guide

## Intelligent Invoice Processing & Payment Tracker

This document provides exact deployment instructions, trigger setup, Script Properties configuration, and operations management.

---

## 1. Prerequisites

- Google Account: `anjalids989@gmail.com`
- Node.js & Clasp CLI installed:
  ```powershell
  npm install -g @google/clasp
  ```
- Target Apps Script Project ID: `1K8B-jzGbeSapoSXZ6rg6vZsrclj0RfUWNI-rFUi5mRWhv671kZLh8zD7`
- Target Google Spreadsheet ID: `1PJuZp1RDdUE7Be7KwOg0T2xKTM8Qnw_ku8lCFpkBTjs`

---

## 2. Configuration & Script Properties Setup

The Gemini API key must be saved in Apps Script Script Properties. Never place keys in source code.

### Setting Script Properties via Apps Script IDE:
1. Open the project in browser: [script.google.com/d/1K8B-jzGbeSapoSXZ6rg6vZsrclj0RfUWNI-rFUi5mRWhv671kZLh8zD7/edit](https://script.google.com/d/1K8B-jzGbeSapoSXZ6rg6vZsrclj0RfUWNI-rFUi5mRWhv671kZLh8zD7/edit)
2. In the left navigation, click **Project Settings** (gear icon).
3. Scroll down to **Script Properties**.
4. Click **Add script property**:
   - **Property**: `GEMINI_API_KEY`
   - **Value**: `<YOUR_GEMINI_API_KEY>`
5. Click **Save script properties**.

---

## 3. Deployment Steps via Clasp

### Step 1: Verify Authentication
Check that clasp is logged in as the project owner:
```powershell
clasp show-authorized-user
```
Expected output:
```
You are logged in as anjalids989@gmail.com.
```

### Step 2: Review File Status
Review tracked files before pushing:
```powershell
clasp status
```
Expected tracked files:
- `Config.gs`
- `appsscript.json`
- `ApprovalService.gs`
- `DuplicateDetector.gs`
- `GmailService.gs`
- `GeminiService.gs`
- `DriveService.gs`
- `InvoiceExtractor.gs`
- `PaymentTracker.gs`
- `NotificationService.gs`
- `Main.gs`
- `TestRunner.gs`

### Step 3: Push Source Files to Google Apps Script
```powershell
clasp push
```

### Step 4: Verify Deployment Version
Create an immutable deployment version:
```powershell
clasp version "Production Release 1.0.0 - Enhanced Payment Reminders & Unified Orchestration"
```

---

## 4. Trigger Installation & Verification

### Step 1: Install Daily 9 AM IST Notification Trigger
In the Apps Script IDE:
1. Select function `installDailyNotificationTrigger` from the function dropdown.
2. Click **Run**.
3. Authorize permissions when prompted (Mail, Spreadsheet, Drive).
4. Verify execution log displays:
   ```
   Daily notification trigger installed successfully.
   ```

### Step 2: Verify Trigger Configuration
Select function `verifyDailyNotificationTrigger` and click **Run**.
Verify log output:
```json
[
  {
    "handlerFunction": "processDailyNotifications",
    "triggerSource": "CLOCK",
    "eventType": "TIMED"
  }
]
```

---

## 5. Daily Operations & Health Monitoring

### System Health Diagnostic
Run `verifySystemHealth()` in `Main.gs` anytime to perform an automated health audit of:
- Spreadsheet accessibility & column header structure (18 columns)
- Drive folder accessibility across all 4 configured folders
- Gmail label availability (`INVOICE_TO_PROCESS`)
- Gemini API key existence
- Notification settings validity
