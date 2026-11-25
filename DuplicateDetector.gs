
/**
 * DUPLICATE DETECTOR
 * Validates extracted invoice data and identifies duplicate invoices.
 */

const VALIDATION_CONFIG = {
  MIN_CONFIDENCE: 0.70,
  AMOUNT_TOLERANCE: 0.01
};


/**
 * Generates a consistent duplicate key.
 * Uses normalized vendor name and invoice ID.
 *
 * @param {Object} invoice Invoice extraction result.
 * @return {string} Normalized duplicate key.
 */
function generateDuplicateKey(invoice) {
  if (!invoice.vendor_name || !invoice.invoice_id) {
    throw new Error(
      "Vendor name and invoice ID are required for duplicate detection."
    );
  }

  const vendor = String(invoice.vendor_name)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  const invoiceId = String(invoice.invoice_id)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

  return vendor + "|" + invoiceId;
}


/**
 * Validates the extracted invoice data.
 *
 * @param {Object} invoice Extracted invoice information.
 * @return {Object} Validation result with errors and warnings.
 */
function validateInvoiceData(invoice) {
  const errors = [];
  const warnings = [];

  if (!invoice || typeof invoice !== "object") {
    return {
      valid: false,
      errors: ["Invoice data is missing or invalid."],
      warnings: []
    };
  }

  // Required fields.
  const requiredFields = [
    "invoice_id",
    "vendor_name",
    "invoice_date",
    "due_date",
    "currency",
    "subtotal",
    "tax",
    "total_amount"
  ];

  requiredFields.forEach(function(field) {
    const value = invoice[field];

    if (
      value === null ||
      value === undefined ||
      String(value).trim() === ""
    ) {
      errors.push("Missing required field: " + field);
    }
  });

  // Stop dependent checks if required information is missing.
  if (errors.length > 0) {
    return {
      valid: false,
      errors: errors,
      warnings: warnings
    };
  }

  // Validate dates.
  const invoiceDate = parseISODate(invoice.invoice_date);
  const dueDate = parseISODate(invoice.due_date);

  if (!invoiceDate) {
    errors.push("Invoice date is not a valid YYYY-MM-DD date.");
  }

  if (!dueDate) {
    errors.push("Due date is not a valid YYYY-MM-DD date.");
  }

  if (invoiceDate && dueDate && dueDate < invoiceDate) {
    errors.push("Due date cannot be earlier than invoice date.");
  }

  // Validate currency format.
  if (!/^[A-Z]{3}$/.test(String(invoice.currency).trim())) {
    errors.push("Currency must be a three-letter uppercase code.");
  }

  // Validate monetary values.
  const subtotal = Number(invoice.subtotal);
  const tax = Number(invoice.tax);
  const total = Number(invoice.total_amount);

  [
    { name: "Subtotal", value: subtotal },
    { name: "Tax", value: tax },
    { name: "Total amount", value: total }
  ].forEach(function(item) {
    if (!Number.isFinite(item.value)) {
      errors.push(item.name + " must be a valid number.");
    } else if (item.value < 0) {
      errors.push(item.name + " cannot be negative.");
    }
  });

  // Check whether subtotal + tax equals total.
  if (
    Number.isFinite(subtotal) &&
    Number.isFinite(tax) &&
    Number.isFinite(total)
  ) {
    const calculatedTotal = subtotal + tax;

    if (
      Math.abs(calculatedTotal - total) >
      VALIDATION_CONFIG.AMOUNT_TOLERANCE
    ) {
      errors.push(
        "Total amount mismatch. Subtotal + tax = " +
        calculatedTotal + ", but extracted total = " + total + "."
      );
    }
  }

  // Check extraction confidence.
  const confidence = Number(invoice.extraction_confidence);

  if (
    !Number.isFinite(confidence) ||
    confidence < 0 ||
    confidence > 1
  ) {
    errors.push("Extraction confidence must be between 0 and 1.");
  } else if (confidence < VALIDATION_CONFIG.MIN_CONFIDENCE) {
    warnings.push(
      "Extraction confidence is below the configured threshold."
    );
  }

  return {
    valid: errors.length === 0,
    errors: errors,
    warnings: warnings
  };
}


/**
 * Parses and strictly validates an ISO date.
 *
 * @param {string} value Date in YYYY-MM-DD format.
 * @return {Date|null}
 */
function parseISODate(value) {
  if (typeof value !== "string") {
    return null;
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}


/**
 * Safely normalizes and parses a Date object or date string.
 *
 * @param {Date|string} dateVal Date object or YYYY-MM-DD string.
 * @return {Date|null} Parsed Date object or null if invalid.
 */
function parseDateValue(dateVal) {
  if (!dateVal) {
    return null;
  }

  if (dateVal instanceof Date) {
    return isNaN(dateVal.getTime()) ? null : dateVal;
  }

  if (typeof dateVal === "string") {
    const trimmed = dateVal.trim();
    const isoParsed = parseISODate(trimmed);
    if (isoParsed) {
      return isoParsed;
    }
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}


/**
 * Checks whether an invoice already exists in the Invoices sheet.
 *
 * Duplicate key is stored in column M (13).
 *
 * @param {string} duplicateKey Generated duplicate key.
 * @return {Object} Duplicate detection result.
 */
function checkDuplicateInvoice(duplicateKey) {
  if (!duplicateKey) {
    throw new Error("Duplicate key is required.");
  }

  const spreadsheet = SpreadsheetApp.openById(
    CONFIG.SPREADSHEET_ID
  );

  const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    throw new Error("Invoices sheet not found.");
  }

  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return {
      isDuplicate: false,
      matchingRow: null,
      duplicateKey: duplicateKey
    };
  }

  const duplicateKeys = sheet
    .getRange(2, 13, lastRow - 1, 1)
    .getValues();

  for (let i = 0; i < duplicateKeys.length; i++) {
    if (
      String(duplicateKeys[i][0]).trim() === duplicateKey
    ) {
      return {
        isDuplicate: true,
        matchingRow: i + 2,
        duplicateKey: duplicateKey
      };
    }
  }

  return {
    isDuplicate: false,
    matchingRow: null,
    duplicateKey: duplicateKey
  };
}
