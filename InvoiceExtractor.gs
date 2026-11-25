
/**
 * INVOICE EXTRACTOR AND DATABASE INSERTION
 *
 * Connects Gemini extraction, invoice validation,
 * duplicate detection and Google Sheets.
 */


/**
 * Processes an invoice PDF and saves valid data to Google Sheets.
 *
 * @param {string} fileId Google Drive PDF file ID.
 * @param {string} messageId Gmail message ID.
 * @return {Object} Processing result.
 */
function processInvoiceAndSave(fileId, messageId) {
  if (!fileId || !messageId) {
    throw new Error("Both Drive file ID and Gmail message ID are required.");
  }

  console.log("Starting invoice processing...");

  // 1. Extract invoice data using Gemini.
  const invoice = extractInvoiceData(fileId);

  // 2. Validate extracted information.
  const validation = validateInvoiceData(invoice);

  if (!validation.valid) {
    console.error("Invoice validation failed:", validation.errors);

    return {
      success: false,
      status: "VALIDATION_FAILED",
      errors: validation.errors
    };
  }

  // 3. Generate duplicate key.
  const duplicateKey = generateDuplicateKey(invoice);

  // 4. Open the invoice database.
  const spreadsheet = SpreadsheetApp.openById(
    CONFIG.SPREADSHEET_ID
  );

  const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    throw new Error("Invoices sheet not found.");
  }

  // 5. Prevent simultaneous processing from inserting duplicates.
  const lock = LockService.getScriptLock();

  if (!lock.tryLock(10000)) {
    throw new Error("Could not obtain processing lock. Try again later.");
  }

  try {
    // Recheck duplicates while holding the lock.
    const duplicateResult = checkDuplicateInvoice(duplicateKey);

    if (duplicateResult.isDuplicate) {
      console.log(
        "Duplicate invoice detected. Existing row:",
        duplicateResult.matchingRow
      );

      return {
        success: false,
        status: "DUPLICATE",
        matchingRow: duplicateResult.matchingRow,
        duplicateKey: duplicateKey
      };
    }

    // 6. Retrieve the Drive file URL.
    const invoiceFile = DriveApp.getFileById(fileId);
    const invoiceFileUrl = invoiceFile.getUrl();

    // 7. Prepare values in the exact spreadsheet column order.
    const row = [
      invoice.invoice_id,                 // A: Invoice_ID
      invoice.vendor_name,                // B: Vendor_Name
      invoice.vendor_email || "",         // C: Vendor_Email
      invoice.invoice_date,               // D: Invoice_Date
      invoice.due_date,                   // E: Due_Date
      invoice.currency,                   // F: Currency
      Number(invoice.subtotal),           // G: Subtotal
      Number(invoice.tax),                // H: Tax
      Number(invoice.total_amount),       // I: Total_Amount
      invoice.po_number || "",            // J: PO_Number
      invoiceFileUrl,                     // K: Invoice_File_URL
      messageId,                          // L: Gmail_Message_ID
      duplicateKey,                       // M: Duplicate_Key
      "PENDING",                          // N: Approval_Status
      "UNPAID",                           // O: Payment_Status
      Number(invoice.extraction_confidence), // P: Extraction_Confidence
      new Date(),                         // Q: Processed_At
      ""                                   // R: Error_Message
    ];

    // 8. Insert the record.
    const nextRow = sheet.getLastRow() + 1;

    sheet.getRange(nextRow, 1, 1, row.length).setValues([row]);

    SpreadsheetApp.flush();

    console.log("INVOICE SAVED SUCCESSFULLY");
    console.log("Spreadsheet row:", nextRow);
    console.log("Invoice ID:", invoice.invoice_id);
    console.log("Vendor:", invoice.vendor_name);
    console.log("Approval status: PENDING");
    console.log("Payment status: UNPAID");

    return {
      success: true,
      status: "SAVED",
      invoiceId: invoice.invoice_id,
      spreadsheetRow: nextRow,
      duplicateKey: duplicateKey
    };

  } finally {
    lock.releaseLock();
  }
}
