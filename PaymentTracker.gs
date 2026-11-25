/**
 * PAYMENT TRACKER
 * Retrieves approved invoices awaiting payment.
 */

function getApprovedUnpaidInvoices() {
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

  const unpaidInvoices = [];

  data.forEach(function(row, index) {
    const approvalStatus = String(row[13])
      .trim()
      .toUpperCase();

    const paymentStatus = String(row[14])
      .trim()
      .toUpperCase();

    if (
      approvalStatus === "APPROVED" &&
      paymentStatus === "UNPAID"
    ) {
      unpaidInvoices.push({
        rowNumber: index + 2,
        invoiceId: row[0],
        vendorName: row[1],
        totalAmount: row[8],
        currency: row[5],
        dueDate: row[4],
        approvalStatus: approvalStatus,
        paymentStatus: paymentStatus
      });
    }
  });

  console.log(
    "Approved unpaid invoices found:",
    unpaidInvoices.length
  );

  return unpaidInvoices;
}

/**
 * RECORD INVOICE PAYMENT
 *
 * Records payment details, updates the invoice payment
 * status and maintains a separate payment audit log.
 *
 * Requirements:
 * - Invoice must be APPROVED.
 * - Invoice must currently be UNPAID.
 * - Payment date must be valid.
 * - Payment reference is mandatory.
 */

function recordInvoicePayment(
  invoiceId,
  paymentDate,
  paymentReference
) {
  if (!invoiceId || !paymentDate || !paymentReference) {
    throw new Error(
      "Invoice ID, payment date and payment reference are required."
    );
  }

  // Validate payment date.
  const dateString = String(paymentDate).trim();
  const dateMatch = dateString.match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (!dateMatch) {
    throw new Error("Payment date must use YYYY-MM-DD format.");
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);

  const parsedDate = new Date(
    Date.UTC(year, month - 1, day)
  );

  if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month - 1 ||
    parsedDate.getUTCDate() !== day
  ) {
    throw new Error("Invalid payment date.");
  }

  const reference = String(paymentReference).trim();

  if (!reference) {
    throw new Error("Payment reference cannot be empty.");
  }

  const lock = LockService.getScriptLock();

  if (!lock.tryLock(10000)) {
    throw new Error("Could not obtain payment processing lock.");
  }

  try {
    const spreadsheet = SpreadsheetApp.openById(
      CONFIG.SPREADSHEET_ID
    );

    const invoiceSheet = spreadsheet.getSheetByName(
      CONFIG.SHEET_NAME
    );

    const paymentLogSheet = spreadsheet.getSheetByName(
      CONFIG.PAYMENT_LOG_SHEET
    );

    if (!invoiceSheet) {
      throw new Error("Invoices sheet not found.");
    }

    if (!paymentLogSheet) {
      throw new Error("Payment_Log sheet not found.");
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

    const approvalStatus = String(invoice[13])
      .trim()
      .toUpperCase();

    const paymentStatus = String(invoice[14])
      .trim()
      .toUpperCase();

    if (approvalStatus !== "APPROVED") {
      throw new Error(
        "Only approved invoices can be marked as paid."
      );
    }

    if (paymentStatus !== "UNPAID") {
      throw new Error(
        "Invoice is not unpaid. Current status: " +
        paymentStatus
      );
    }

    const recordedBy =
      Session.getActiveUser().getEmail() || "UNKNOWN";

    const recordedAt = new Date();

    // Record payment details in the audit log.
    paymentLogSheet.appendRow([
      invoice[0],
      invoice[1],
      invoice[8],
      invoice[5],
      parsedDate,
      reference,
      recordedBy,
      recordedAt
    ]);

    // Update payment status in the Invoices sheet.
    invoiceSheet.getRange(matchingRow, 15).setValue("PAID");

    SpreadsheetApp.flush();

    console.log("PAYMENT RECORDED SUCCESSFULLY");
    console.log("Invoice ID:", invoiceId);
    console.log("Payment amount:", invoice[5], invoice[8]);
    console.log("Payment date:", dateString);
    console.log("Payment reference:", reference);
    console.log("Recorded by:", recordedBy);

    return {
      success: true,
      invoiceId: invoiceId,
      paymentStatus: "PAID",
      paymentDate: dateString,
      paymentReference: reference
    };

  } finally {
    lock.releaseLock();
  }
}


/**
 * Identifies approved invoices that are unpaid
 * and have passed their due dates.
 */
function getOverdueInvoices() {
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

  // Compare calendar dates using the configured timezone.
  const todayString = Utilities.formatDate(
    new Date(),
    CONFIG.TIMEZONE,
    "yyyy-MM-dd"
  );

  const overdueInvoices = [];

  data.forEach(function(row, index) {
    const approvalStatus = String(row[13])
      .trim().toUpperCase();

    const paymentStatus = String(row[14])
      .trim().toUpperCase();

    if (
      approvalStatus !== "APPROVED" ||
      paymentStatus !== "UNPAID"
    ) {
      return;
    }

    const dueDate = parseDateValue(row[4]);

    if (!dueDate) {
      console.warn(
        "Invalid due date for invoice:",
        row[0]
      );
      return;
    }

    const dueDateString = Utilities.formatDate(
      dueDate,
      CONFIG.TIMEZONE,
      "yyyy-MM-dd"
    );

    if (dueDateString < todayString) {
      overdueInvoices.push({
        rowNumber: index + 2,
        invoiceId: row[0],
        vendorName: row[1],
        totalAmount: row[8],
        currency: row[5],
        dueDate: dueDateString,
        approvalStatus: approvalStatus,
        paymentStatus: paymentStatus
      });
    }
  });

  console.log(
    "Overdue invoices found:",
    overdueInvoices.length
  );

  return overdueInvoices;
}