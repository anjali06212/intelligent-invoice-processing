/**
 * INTELLIGENT INVOICE PROCESSING & PAYMENT TRACKER
 * Main Orchestration & System Controller
 *
 * Coordinates:
 * 1. Email ingestion and PDF retrieval (GmailService)
 * 2. Document storage and Drive organization (DriveService)
 * 3. AI document understanding and field extraction (GeminiService)
 * 4. Business rule validation & duplicate detection (DuplicateDetector)
 * 5. Database persistence and record locking (InvoiceExtractor)
 * 6. Multi-stage human approval workflow (ApprovalService)
 * 7. Payment status tracking & overdue monitoring (PaymentTracker)
 * 8. Automated alerts and daily notification dispatch (NotificationService)
 */

/**
 * Main ingestion entry point.
 * Fetches PDF invoices from Gmail, extracts structured data,
 * validates business rules, prevents duplicates, saves to Google Sheets,
 * and alerts the administrator for approval.
 *
 * @return {Object} Execution summary.
 */
function processIncomingInvoices() {
  console.log("========================================");
  console.log("STARTING INVOICE INGESTION PIPELINE");
  console.log("Timestamp:", Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd HH:mm:ss"));
  console.log("========================================");

  const summary = {
    attachmentsFound: 0,
    processed: 0,
    saved: 0,
    duplicates: 0,
    validationFailures: 0,
    approvalAlertsSent: 0,
    errors: []
  };

  // Step 1: Retrieve invoice attachments from Gmail
  let retrievalResult;
  try {
    retrievalResult = fetchInvoiceAttachments();
    summary.attachmentsFound = retrievalResult.saved;
    console.log("Gmail attachment retrieval completed. New PDFs:", retrievalResult.saved);
  } catch (error) {
    console.error("Gmail attachment retrieval failed:", error.message);
    summary.errors.push("Gmail retrieval error: " + error.message);
    return summary;
  }

  // Step 2: Retrieve raw folder files to process
  const rawFolder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDERS.RAW_INVOICES);
  const files = rawFolder.getFiles();

  while (files.hasNext()) {
    const file = files.next();
    const fileName = file.getName();
    const fileId = file.getId();

    // Check if filename conforms to messageId_index_name pattern
    const nameParts = fileName.split("_");
    const messageId = nameParts.length >= 2 ? nameParts[0] : "MANUAL_UPLOAD";

    try {
      summary.processed++;
      console.log("Processing invoice file:", fileName, "| ID:", fileId);

      const result = processInvoiceAndSave(fileId, messageId);

      if (result.success && result.status === "SAVED") {
        summary.saved++;
        console.log("Invoice saved to sheet. Invoice ID:", result.invoiceId, "Row:", result.spreadsheetRow);

        // Send approval notification immediately upon ingestion
        try {
          const notifResult = sendApprovalNotification(result.invoiceId);
          if (notifResult && notifResult.success) {
            summary.approvalAlertsSent++;
            console.log("Approval notification sent for:", result.invoiceId);
          }
        } catch (notifErr) {
          console.warn("Could not send immediate approval notification for " + result.invoiceId + ":", notifErr.message);
        }

      } else if (result.status === "DUPLICATE") {
        summary.duplicates++;
        console.log("Duplicate detected for file:", fileName, "Existing row:", result.matchingRow);
      } else if (result.status === "VALIDATION_FAILED") {
        summary.validationFailures++;
        console.warn("Validation failed for file:", fileName, "Errors:", JSON.stringify(result.errors));
      }
    } catch (error) {
      summary.errors.push({ file: fileName, error: error.message });
      console.error("Error processing invoice file " + fileName + ":", error.message);
    }
  }

  console.log("========================================");
  console.log("INVOICE INGESTION SUMMARY");
  console.log("Total processed:", summary.processed);
  console.log("Saved to Sheets:", summary.saved);
  console.log("Duplicates skipped:", summary.duplicates);
  console.log("Validation failures:", summary.validationFailures);
  console.log("Approval notifications sent:", summary.approvalAlertsSent);
  console.log("Errors:", summary.errors.length);
  console.log("========================================");

  return summary;
}


/**
 * Runs the daily end-to-end batch workflow:
 * Ingests new invoices and dispatches scheduled daily notifications.
 *
 * @return {Object} Batch execution summary.
 */
function processDailyWorkflow() {
  console.log("Starting daily automated invoice workflow...");

  const ingestionSummary = processIncomingInvoices();
  const notificationSummary = processDailyNotifications();

  return {
    ingestion: ingestionSummary,
    notifications: notificationSummary,
    timestamp: new Date()
  };
}


/**
 * Comprehensive System Health & Connectivity Diagnostics.
 * Validates Spreadsheet, Drive, Gmail, Gemini and Notification configurations.
 *
 * @return {Object} Diagnostic report.
 */
function verifySystemHealth() {
  console.log("Starting comprehensive system health check...");

  const report = {
    timestamp: new Date().toISOString(),
    spreadsheet: { status: "UNKNOWN" },
    drive: { status: "UNKNOWN" },
    gmail: { status: "UNKNOWN" },
    gemini: { status: "UNKNOWN" },
    notifications: { status: "UNKNOWN" },
    overallHealthy: false
  };

  // 1. Spreadsheet Check
  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    report.spreadsheet = {
      status: "PASS",
      title: spreadsheet.getName(),
      sheetName: sheet.getName(),
      headerCount: headers.length,
      expectedHeaders: CONFIG.EXPECTED_HEADERS,
      headersMatch: headers.length === CONFIG.EXPECTED_HEADERS
    };
  } catch (err) {
    report.spreadsheet = { status: "FAIL", error: err.message };
  }

  // 2. Drive Check
  try {
    const folders = {};
    Object.keys(CONFIG.DRIVE_FOLDERS).forEach(function(key) {
      const folderId = CONFIG.DRIVE_FOLDERS[key];
      const folder = DriveApp.getFolderById(folderId);
      folders[key] = { id: folder.getId(), name: folder.getName(), accessible: true };
    });
    report.drive = { status: "PASS", folders: folders };
  } catch (err) {
    report.drive = { status: "FAIL", error: err.message };
  }

  // 3. Gmail Check
  try {
    const label = GmailApp.getUserLabelByName("INVOICE_TO_PROCESS");
    report.gmail = {
      status: label ? "PASS" : "FAIL",
      labelExists: label !== null,
      account: Session.getActiveUser().getEmail()
    };
  } catch (err) {
    report.gmail = { status: "FAIL", error: err.message };
  }

  // 4. Gemini Check
  try {
    const apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
    report.gemini = {
      status: apiKey ? "PASS" : "FAIL",
      apiKeyConfigured: Boolean(apiKey),
      model: GEMINI_CONFIG.MODEL
    };
  } catch (err) {
    report.gemini = { status: "FAIL", error: err.message };
  }

  // 5. Notification Check
  try {
    const adminEmail = getNotificationAdminEmail();
    const logSheet = getNotificationLogSheet();
    report.notifications = {
      status: "PASS",
      adminEmail: adminEmail,
      logSheetName: logSheet.getName(),
      reminderDaysBeforeDue: CONFIG.NOTIFICATION_SETTINGS.REMINDER_DAYS_BEFORE_DUE,
      overdueIntervalDays: CONFIG.NOTIFICATION_SETTINGS.OVERDUE_REMINDER_INTERVAL_DAYS
    };
  } catch (err) {
    report.notifications = { status: "FAIL", error: err.message };
  }

  report.overallHealthy =
    report.spreadsheet.status === "PASS" &&
    report.drive.status === "PASS" &&
    report.gmail.status === "PASS" &&
    report.gemini.status === "PASS" &&
    report.notifications.status === "PASS";

  console.log("System Health Report:", JSON.stringify(report, null, 2));
  return report;
}


/**
 * Initial system connection test.
 * Verifies access to the invoice database.
 */
function testSpreadsheetConnection() {
  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);

    if (!sheet) {
      throw new Error("Invoices sheet not found!");
    }

    const headers = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0];

    console.log("Spreadsheet:", spreadsheet.getName());
    console.log("Sheet:", sheet.getName());
    console.log("Number of headers:", headers.length);
    console.log("Headers:", headers);

    if (headers.length !== CONFIG.EXPECTED_HEADERS) {
      throw new Error("Expected 18 headers but found " + headers.length);
    }

    console.log("SUCCESS: Spreadsheet connection verified!");
    return true;

  } catch (error) {
    console.error("Connection failed:", error.message);
    throw error;
  }
}
