
/**
 * NOTIFICATION SERVICE
 *
 * Admin-only invoice notifications.
 * Supports approval alerts, payment reminders,
 * overdue reminders, duplicate prevention and audit logging.
 */

const NOTIFICATION_TYPES = {
  APPROVAL_PENDING: "APPROVAL_PENDING",
  APPROVED: "INVOICE_APPROVED",
  REJECTED: "INVOICE_REJECTED",
  UPCOMING: "UPCOMING_PAYMENT",
  OVERDUE: "OVERDUE_PAYMENT"
};


/**
 * Returns the configured administrator email.
 */
function getNotificationAdminEmail() {
  const email = String(
    CONFIG.NOTIFICATION_SETTINGS.ADMIN_EMAIL || ""
  ).trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("A valid administrator email is required.");
  }

  return email;
}


/**
 * Returns and validates the notification log sheet.
 */
function getNotificationLogSheet() {
  const spreadsheet = SpreadsheetApp.openById(
    CONFIG.SPREADSHEET_ID
  );

  const sheet = spreadsheet.getSheetByName(
    CONFIG.NOTIFICATION_LOG_SHEET
  );

  if (!sheet) {
    throw new Error("Notification_Log sheet not found.");
  }

  const expectedHeaders = [
    "Invoice_ID",
    "Notification_Type",
    "Recipient",
    "Notification_Date",
    "Status",
    "Idempotency_Key",
    "Error_Message"
  ];

  const actualHeaders = sheet.getRange(
    1, 1, 1, expectedHeaders.length
  ).getValues()[0];

  expectedHeaders.forEach(function(header, index) {
    if (String(actualHeaders[index]).trim() !== header) {
      throw new Error(
        "Notification_Log header mismatch at column " +
        (index + 1) + ". Expected: " + header
      );
    }
  });

  return sheet;
}


/**
 * Retrieves an invoice by invoice ID.
 */
function getInvoiceForNotification(invoiceId) {
  if (!invoiceId) {
    throw new Error("Invoice ID is required.");
  }

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
    throw new Error("No invoices found.");
  }

  const data = sheet.getRange(
    2, 1, lastRow - 1, CONFIG.EXPECTED_HEADERS
  ).getValues();

  for (let i = 0; i < data.length; i++) {
    if (
      String(data[i][0]).trim() === String(invoiceId).trim()
    ) {
      return {
        rowNumber: i + 2,
        data: data[i]
      };
    }
  }

  throw new Error("Invoice not found: " + invoiceId);
}


/**
 * Checks whether a notification event has already been sent.
 */
function hasNotificationBeenSent(idempotencyKey) {
  const sheet = getNotificationLogSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return false;
  }

  const records = sheet.getRange(
    2, 1, lastRow - 1, 7
  ).getValues();

  return records.some(function(row) {
    return (
      String(row[5]).trim() === String(idempotencyKey).trim() &&
      ["SENT", "SENDING"].includes(
        String(row[4]).trim().toUpperCase()
      )
    );
  });
}


/**
 * Sends one notification and records its result.
 *
 * A SENDING record is created before sending to reduce
 * the chance of duplicate emails if an execution is interrupted.
 */
function sendLoggedNotification(
  invoiceId,
  notificationType,
  idempotencyKey,
  subject,
  body
) {
  const lock = LockService.getScriptLock();

  if (!lock.tryLock(10000)) {
    throw new Error("Could not obtain notification lock.");
  }

  let logRow = -1;
  const recipient = getNotificationAdminEmail();

  try {
    const sheet = getNotificationLogSheet();

    if (hasNotificationBeenSent(idempotencyKey)) {
      console.log(
        "Notification already sent or in progress:",
        idempotencyKey
      );

      return {
        success: false,
        status: "ALREADY_SENT"
      };
    }

    sheet.appendRow([
      invoiceId,
      notificationType,
      recipient,
      new Date(),
      "SENDING",
      idempotencyKey,
      ""
    ]);

    logRow = sheet.getLastRow();
    SpreadsheetApp.flush();

    try {
      MailApp.sendEmail({
        to: recipient,
        subject: subject,
        body: body,
        name: "Intelligent Invoice Processing"
      });

      sheet.getRange(logRow, 5).setValue("SENT");
      SpreadsheetApp.flush();

      console.log("Notification sent:", notificationType);
      console.log("Recipient:", recipient);
      console.log("Event key:", idempotencyKey);

      return {
        success: true,
        status: "SENT",
        recipient: recipient
      };

    } catch (error) {
      sheet.getRange(logRow, 5).setValue("FAILED");
      sheet.getRange(logRow, 7).setValue(
        String(error.message || error).substring(0, 1000)
      );

      SpreadsheetApp.flush();

      console.error(
        "Notification sending failed:",
        error.message
      );

      throw error;
    }

  } finally {
    lock.releaseLock();
  }
}


/**
 * Sends an approval-pending notification.
 */
function sendApprovalNotification(invoiceId) {
  const result = getInvoiceForNotification(invoiceId);
  const invoice = result.data;

  if (String(invoice[13]).trim().toUpperCase() !== "PENDING") {
    throw new Error("Invoice is not awaiting approval.");
  }

  const subject = "Invoice Awaiting Approval: " + invoice[0];

  const body =
    "A new invoice is awaiting your approval.\n\n" +
    "Invoice ID: " + invoice[0] + "\n" +
    "Vendor: " + invoice[1] + "\n" +
    "Amount: " + invoice[5] + " " + invoice[8] + "\n" +
    "Invoice Date: " + invoice[3] + "\n" +
    "Due Date: " + invoice[4] + "\n" +
    "Invoice File: " + invoice[10] + "\n\n" +
    "Please review the invoice in the Invoice Management Database.";

  return sendLoggedNotification(
    invoice[0],
    NOTIFICATION_TYPES.APPROVAL_PENDING,
    "APPROVAL_PENDING_" + invoice[0],
    subject,
    body
  );
}


/**
 * Sends an approval or rejection decision notification.
 */
function sendApprovalDecisionNotification(
  invoiceId,
  action,
  reason
) {
  const result = getInvoiceForNotification(invoiceId);
  const invoice = result.data;

  action = String(action).trim().toUpperCase();

  if (!["APPROVED", "REJECTED"].includes(action)) {
    throw new Error("Invalid approval decision.");
  }

  if (
    String(invoice[13]).trim().toUpperCase() !== action
  ) {
    throw new Error(
      "Invoice status does not match the requested decision."
    );
  }

  const notificationType = action === "APPROVED"
    ? NOTIFICATION_TYPES.APPROVED
    : NOTIFICATION_TYPES.REJECTED;

  const subject =
    "Invoice " + action + ": " + invoice[0];

  const body =
    "An invoice approval decision has been recorded.\n\n" +
    "Invoice ID: " + invoice[0] + "\n" +
    "Vendor: " + invoice[1] + "\n" +
    "Amount: " + invoice[5] + " " + invoice[8] + "\n" +
    "Decision: " + action + "\n" +
    "Reason: " + (reason || "No reason provided") + "\n\n" +
    "This is an automated notification.";

  return sendLoggedNotification(
    invoice[0],
    notificationType,
    notificationType + "_" + invoice[0],
    subject,
    body
  );
}


/**
 * Sends an upcoming payment reminder.
 */
function sendUpcomingPaymentReminder(invoiceId) {
  const result = getInvoiceForNotification(invoiceId);
  const invoice = result.data;

  const approvalStatus = String(invoice[13]).trim().toUpperCase();
  const paymentStatus = String(invoice[14]).trim().toUpperCase();

  if (
    approvalStatus !== "APPROVED" ||
    paymentStatus !== "UNPAID"
  ) {
    throw new Error(
      "Upcoming reminders require an approved unpaid invoice."
    );
  }

  const dueDate = parseDateValue(invoice[4]);

  if (!dueDate) {
    throw new Error("Invoice due date is invalid.");
  }

  const dueDateText = Utilities.formatDate(
    dueDate,
    CONFIG.TIMEZONE,
    "dd MMM yyyy"
  );

  const subject = "Payment Due Soon: " + invoice[0];

  const body =
    "An approved invoice is approaching its payment due date.\n\n" +
    "Invoice ID: " + invoice[0] + "\n" +
    "Vendor: " + invoice[1] + "\n" +
    "Amount: " + invoice[5] + " " + invoice[8] + "\n" +
    "Due Date: " + dueDateText + "\n" +
    "Payment Status: UNPAID\n\n" +
    "Please arrange payment before the due date.";

  return sendLoggedNotification(
    invoice[0],
    NOTIFICATION_TYPES.UPCOMING,
    "UPCOMING_" + invoice[0],
    subject,
    body
  );
}


/**
 * Sends a recurring overdue payment reminder.
 *
 * Reminder schedule:
 * Day 1 overdue, day 4, day 7, day 10, etc.
 */
function sendOverduePaymentReminder(invoiceId, daysOverdue) {
  const result = getInvoiceForNotification(invoiceId);
  const invoice = result.data;

  if (
    String(invoice[13]).trim().toUpperCase() !== "APPROVED" ||
    String(invoice[14]).trim().toUpperCase() !== "UNPAID"
  ) {
    throw new Error(
      "Overdue reminders require an approved unpaid invoice."
    );
  }

  const interval = Number(
    CONFIG.NOTIFICATION_SETTINGS.OVERDUE_REMINDER_INTERVAL_DAYS
  );

  if (!Number.isInteger(interval) || interval < 1) {
    throw new Error("Invalid overdue reminder interval.");
  }

  if (!Number.isInteger(daysOverdue) || daysOverdue < 1) {
    throw new Error("Days overdue must be a positive integer.");
  }

  const reminderNumber = Math.floor(
    (daysOverdue - 1) / interval
  );

  const eventKey =
    "OVERDUE_" + invoice[0] + "_CYCLE_" + reminderNumber;

  const dueDate = parseDateValue(invoice[4]);

  if (!dueDate) {
    throw new Error("Invoice due date is invalid.");
  }

  const dueDateText = Utilities.formatDate(
    dueDate,
    CONFIG.TIMEZONE,
    "dd MMM yyyy"
  );

  const subject = "OVERDUE PAYMENT: " + invoice[0];

  const body =
    "An approved invoice is overdue and remains unpaid.\n\n" +
    "Invoice ID: " + invoice[0] + "\n" +
    "Vendor: " + invoice[1] + "\n" +
    "Amount: " + invoice[5] + " " + invoice[8] + "\n" +
    "Due Date: " + dueDateText + "\n" +
    "Days Overdue: " + daysOverdue + "\n" +
    "Payment Status: UNPAID\n\n" +
    "Please review and arrange payment.";

  return sendLoggedNotification(
    invoice[0],
    NOTIFICATION_TYPES.OVERDUE,
    eventKey,
    subject,
    body
  );
}


/**
 * Calculates whole calendar days between two dates.
 */
function getCalendarDayDifference(dateA, dateB) {
  const a = Utilities.formatDate(
    dateA, CONFIG.TIMEZONE, "yyyy-MM-dd"
  );

  const b = Utilities.formatDate(
    dateB, CONFIG.TIMEZONE, "yyyy-MM-dd"
  );

  const partsA = a.split("-").map(Number);
  const partsB = b.split("-").map(Number);

  const utcA = Date.UTC(partsA[0], partsA[1] - 1, partsA[2]);
  const utcB = Date.UTC(partsB[0], partsB[1] - 1, partsB[2]);

  return Math.round((utcB - utcA) / 86400000);
}


/**
 * Daily notification processor.
 *
 * Sends:
 * - One pending approval notification per invoice.
 * - One upcoming payment reminder 3 days before due date.
 * - Overdue reminders on day 1, day 4, day 7, etc.
 */
function processDailyNotifications() {
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

  const summary = {
    checked: 0,
    sent: 0,
    skipped: 0,
    failed: 0
  };

  if (lastRow < 2) {
    console.log("No invoices to process.");
    return summary;
  }

  const data = sheet.getRange(
    2, 1, lastRow - 1, CONFIG.EXPECTED_HEADERS
  ).getValues();

  const today = new Date();

  data.forEach(function(invoice) {
    summary.checked++;

    const invoiceId = invoice[0];

    try {
      const approvalStatus = String(invoice[13])
        .trim().toUpperCase();

      const paymentStatus = String(invoice[14])
        .trim().toUpperCase();

      if (approvalStatus === "PENDING") {
        const result = sendApprovalNotification(invoiceId);
        result.success ? summary.sent++ : summary.skipped++;
        return;
      }

      if (
        approvalStatus !== "APPROVED" ||
        paymentStatus !== "UNPAID"
      ) {
        summary.skipped++;
        return;
      }

      const dueDate = parseDateValue(invoice[4]);

      if (!dueDate) {
        console.warn("Invalid due date:", invoiceId);
        summary.failed++;
        return;
      }

      const daysUntilDue = getCalendarDayDifference(
        today,
        dueDate
      );

      // Reliable upcoming payment reminder check:
      // Checks if invoice is within reminder window (0 <= daysUntilDue <= REMINDER_DAYS_BEFORE_DUE).
      // Idempotency key (UPCOMING_<invoiceId>) ensures it is sent exactly once even if the daily trigger
      // was delayed, missed, or the invoice was approved within the reminder window.
      if (
        daysUntilDue >= 0 &&
        daysUntilDue <= Number(
          CONFIG.NOTIFICATION_SETTINGS.REMINDER_DAYS_BEFORE_DUE
        )
      ) {
        const result = sendUpcomingPaymentReminder(invoiceId);
        result.success ? summary.sent++ : summary.skipped++;
        return;
      }

      if (
        daysUntilDue < 0 &&
        CONFIG.NOTIFICATION_SETTINGS.SEND_OVERDUE_REMINDERS
      ) {
        const daysOverdue = Math.abs(daysUntilDue);
        const interval = Number(
          CONFIG.NOTIFICATION_SETTINGS.OVERDUE_REMINDER_INTERVAL_DAYS
        );

        if ((daysOverdue - 1) % interval === 0) {
          const result = sendOverduePaymentReminder(
            invoiceId,
            daysOverdue
          );

          result.success ? summary.sent++ : summary.skipped++;
          return;
        }
      }

      summary.skipped++;

    } catch (error) {
      summary.failed++;
      console.error(
        "Notification error for invoice " + invoiceId + ":",
        error.message
      );
    }
  });

  console.log("DAILY NOTIFICATION SUMMARY");
  console.log("Invoices checked:", summary.checked);
  console.log("Notifications sent:", summary.sent);
  console.log("Notifications skipped:", summary.skipped);
  console.log("Failures:", summary.failed);

  return summary;
}


/**
 * Creates one daily trigger.
 * Removes existing triggers for this function first.
 */
function installDailyNotificationTrigger() {
  const functionName = "processDailyNotifications";

  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === functionName) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger(functionName)
    .timeBased()
    .everyDays(1)
    .atHour(
      CONFIG.NOTIFICATION_SETTINGS.DAILY_TRIGGER_HOUR
    )
    .inTimezone(CONFIG.TIMEZONE)
    .create();

  console.log(
    "Daily notification trigger installed successfully."
  );

  return true;
}


/**
 * Removes the daily notification trigger.
 */
function removeDailyNotificationTrigger() {
  const functionName = "processDailyNotifications";
  let removed = 0;

  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === functionName) {
      ScriptApp.deleteTrigger(trigger);
      removed++;
    }
  });

  console.log("Daily triggers removed:", removed);

  return removed;
}


/**
 * Inspects and returns existing project triggers for processDailyNotifications.
 * Provides verification evidence of trigger configuration.
 *
 * @return {Array<Object>} Trigger details.
 */
function verifyDailyNotificationTrigger() {
  const functionName = "processDailyNotifications";
  const projectTriggers = ScriptApp.getProjectTriggers();
  const matchedTriggers = [];

  projectTriggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === functionName) {
      matchedTriggers.push({
        handlerFunction: trigger.getHandlerFunction(),
        triggerSource: trigger.getTriggerSource().toString(),
        eventType: trigger.getEventType().toString(),
        uniqueId: trigger.getUniqueId()
      });
    }
  });

  console.log("--------------------------------");
  console.log("TRIGGER VERIFICATION EVIDENCE");
  console.log("Function name:", functionName);
  console.log("Total matching triggers:", matchedTriggers.length);
  console.log("Expected triggers: 1");
  console.log("Configured hour:", CONFIG.NOTIFICATION_SETTINGS.DAILY_TRIGGER_HOUR, "AM");
  console.log("Configured timezone:", CONFIG.TIMEZONE);
  console.log("Trigger details:", JSON.stringify(matchedTriggers, null, 2));
  console.log("--------------------------------");

  return matchedTriggers;
}
