/**
 * APPROVAL SERVICE
 * Handles invoice approvals and rejections.
 * Maintains an audit log of every decision.
 */

function getApprovalLogSheet() {
  const spreadsheet = SpreadsheetApp.openById(
    CONFIG.SPREADSHEET_ID
  );

  const sheet = spreadsheet.getSheetByName(
    CONFIG.APPROVAL_LOG_SHEET
  );

  if (!sheet) {
    throw new Error("Approval_Log sheet not found.");
  }

  return sheet;
}


/**
 * Retrieves all invoices awaiting approval.
 */
function getPendingInvoices() {
  const spreadsheet = SpreadsheetApp.openById(
    CONFIG.SPREADSHEET_ID
  );

  const sheet = spreadsheet.getSheetByName(
    CONFIG.SHEET_NAME
  );

  if (!sheet) {
    throw new Error("Invoices sheet not found.");
  }

  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  const data = sheet.getRange(
    2, 1, lastRow - 1, CONFIG.EXPECTED_HEADERS
  ).getValues();

  const pendingInvoices = [];

  data.forEach(function(row, index) {
    if (String(row[13]).trim().toUpperCase() === "PENDING") {
      pendingInvoices.push({
        rowNumber: index + 2,
        invoiceId: row[0],
        vendorName: row[1],
        totalAmount: row[8],
        currency: row[5],
        dueDate: row[4],
        approvalStatus: row[13],
        paymentStatus: row[14]
      });
    }
  });

  return pendingInvoices;
}


/**
 * Approves or rejects an invoice.
 */

/**
 * Updates an invoice approval decision and sends
 * an admin notification after the decision is recorded.
 */
function updateInvoiceApproval(invoiceId, action, reason) {
  if (!invoiceId || !action) {
    throw new Error("Invoice ID and action are required.");
  }

  action = String(action).trim().toUpperCase();

  if (!["APPROVED", "REJECTED"].includes(action)) {
    throw new Error("Action must be APPROVED or REJECTED.");
  }

  if (action === "REJECTED" && !String(reason || "").trim()) {
    throw new Error("A rejection reason is required.");
  }

  const lock = LockService.getScriptLock();

  if (!lock.tryLock(10000)) {
    throw new Error("Could not obtain approval lock.");
  }

  let result;

  try {
    const spreadsheet = SpreadsheetApp.openById(
      CONFIG.SPREADSHEET_ID
    );

    const invoiceSheet = spreadsheet.getSheetByName(
      CONFIG.SHEET_NAME
    );

    const logSheet = getApprovalLogSheet();

    if (!invoiceSheet) {
      throw new Error("Invoices sheet not found.");
    }

    const lastRow = invoiceSheet.getLastRow();

    if (lastRow < 2) {
      throw new Error("No invoices found.");
    }

    const invoiceData = invoiceSheet.getRange(
      2, 1, lastRow - 1, CONFIG.EXPECTED_HEADERS
    ).getValues();

    let matchingRow = -1;
    let invoice = null;

    for (let i = 0; i < invoiceData.length; i++) {
      if (
        String(invoiceData[i][0]).trim() ===
        String(invoiceId).trim()
      ) {
        matchingRow = i + 2;
        invoice = invoiceData[i];
        break;
      }
    }

    if (matchingRow === -1) {
      throw new Error("Invoice not found: " + invoiceId);
    }

    const currentStatus = String(invoice[13])
      .trim().toUpperCase();

    if (currentStatus !== "PENDING") {
      throw new Error(
        "Invoice cannot be processed. Current status: " +
        currentStatus
      );
    }

    const approverEmail =
      Session.getActiveUser().getEmail() || "UNKNOWN";

    const timestamp = new Date();

    // Update invoice approval status.
    invoiceSheet.getRange(matchingRow, 14).setValue(action);

    // Record approval history.
    logSheet.appendRow([
      invoice[0],
      invoice[1],
      action,
      approverEmail,
      String(reason || ""),
      timestamp
    ]);

    SpreadsheetApp.flush();

    result = {
      success: true,
      invoiceId: invoiceId,
      action: action,
      approver: approverEmail,
      timestamp: timestamp
    };

    console.log("APPROVAL STATUS UPDATED");
    console.log("Invoice ID:", invoiceId);
    console.log("Action:", action);
    console.log("Approver:", approverEmail);

  } finally {
    lock.releaseLock();
  }

  // Send notification only after releasing the approval lock.
  // A notification failure must not undo the approval.
  try {
    const notificationResult =
      sendApprovalDecisionNotification(
        invoiceId,
        action,
        reason
      );

    result.notificationStatus = notificationResult.status;

  } catch (error) {
    console.error(
      "Approval notification failed:",
      error.message
    );

    result.notificationStatus = "FAILED";
    result.notificationError = error.message;
  }

  return result;
}