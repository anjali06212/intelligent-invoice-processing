/**
 * Comprehensive Automated Local Test Suite
 *
 * Mocks the Google Apps Script environment and executes unit and integration tests
 * for all requirements in Tasks 1, 2, 3, and 4.
 */

const assert = require('assert');

// 1. Mock Apps Script Services
const mockScriptProperties = {
  GEMINI_API_KEY: 'test-secret-gemini-key'
};

const PropertiesService = {
  getScriptProperties: () => ({
    getProperty: (key) => mockScriptProperties[key] || null
  })
};

const mockSpreadsheetData = {
  Invoices: [
    [
      "Invoice_ID", "Vendor_Name", "Vendor_Email", "Invoice_Date", "Due_Date",
      "Currency", "Subtotal", "Tax", "Total_Amount", "PO_Number",
      "Invoice_File_URL", "Gmail_Message_ID", "Duplicate_Key",
      "Approval_Status", "Payment_Status", "Extraction_Confidence",
      "Processed_At", "Error_Message"
    ]
  ],
  Approval_Log: [
    ["Invoice_ID", "Vendor_Name", "Decision", "Approver_Email", "Reason", "Timestamp"]
  ],
  Payment_Log: [
    ["Invoice_ID", "Vendor_Name", "Amount", "Currency", "Payment_Date", "Reference", "Recorded_By", "Recorded_At"]
  ],
  Notification_Log: [
    ["Invoice_ID", "Notification_Type", "Recipient", "Notification_Date", "Status", "Idempotency_Key", "Error_Message"]
  ]
};

const SpreadsheetApp = {
  openById: (id) => ({
    getName: () => "Invoice Management Database",
    getSheetByName: (name) => {
      if (!mockSpreadsheetData[name]) return null;
      return {
        getName: () => name,
        getLastRow: () => mockSpreadsheetData[name].length,
        getLastColumn: () => mockSpreadsheetData[name][0].length,
        getRange: (startRow, startCol, numRows, numCols) => ({
          getValues: () => {
            const rows = [];
            for (let r = 0; r < numRows; r++) {
              const rowIdx = startRow - 1 + r;
              if (rowIdx < mockSpreadsheetData[name].length) {
                const row = mockSpreadsheetData[name][rowIdx];
                rows.push(row.slice(startCol - 1, startCol - 1 + numCols));
              } else {
                rows.push(new Array(numCols).fill(""));
              }
            }
            return rows;
          },
          setValue: (val) => {
            const r = startRow - 1;
            const c = startCol - 1;
            if (mockSpreadsheetData[name][r]) {
              mockSpreadsheetData[name][r][c] = val;
            }
          },
          setValues: (vals) => {
            for (let r = 0; r < vals.length; r++) {
              const rowIdx = startRow - 1 + r;
              if (!mockSpreadsheetData[name][rowIdx]) {
                mockSpreadsheetData[name][rowIdx] = [];
              }
              for (let c = 0; c < vals[r].length; c++) {
                mockSpreadsheetData[name][rowIdx][startCol - 1 + c] = vals[r][c];
              }
            }
          }
        }),
        appendRow: (row) => {
          mockSpreadsheetData[name].push([...row]);
        }
      };
    }
  }),
  flush: () => {}
};

const LockService = {
  getScriptLock: () => ({
    tryLock: (ms) => true,
    releaseLock: () => {}
  })
};

const Utilities = {
  formatDate: (date, tz, format) => {
    // Basic UTC/IST formatter for test assertions
    const d = new Date(date);
    // Add offset for IST (+5:30 = 330 mins) if needed
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const istDate = new Date(utc + (3600000 * 5.5));
    const year = istDate.getFullYear();
    const month = String(istDate.getMonth() + 1).padStart(2, '0');
    const day = String(istDate.getDate()).padStart(2, '0');
    if (format === 'yyyy-MM-dd') return `${year}-${month}-${day}`;
    if (format === 'dd MMM yyyy') {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return `${day} ${months[istDate.getMonth()]} ${year}`;
    }
    return `${year}-${month}-${day}`;
  },
  sleep: (ms) => {}
};

const sentEmails = [];
const MailApp = {
  sendEmail: (opts) => {
    sentEmails.push(opts);
  }
};

const Session = {
  getActiveUser: () => ({ getEmail: () => "admin@example.com" })
};

const mockTriggers = [];
const ScriptApp = {
  getProjectTriggers: () => mockTriggers,
  deleteTrigger: (trigger) => {
    const idx = mockTriggers.indexOf(trigger);
    if (idx !== -1) mockTriggers.splice(idx, 1);
  },
  newTrigger: (functionName) => {
    let _days = 1;
    let _hour = 9;
    let _tz = "Asia/Kolkata";
    const builder = {
      timeBased: () => builder,
      everyDays: (n) => { _days = n; return builder; },
      atHour: (h) => { _hour = h; return builder; },
      inTimezone: (tz) => { _tz = tz; return builder; },
      create: () => {
        const trigger = {
          getHandlerFunction: () => functionName,
          getTriggerSource: () => "CLOCK",
          getEventType: () => "TIMED",
          getUniqueId: () => "trigger_" + Math.random().toString(36).substr(2, 9),
          days: _days,
          hour: _hour,
          timezone: _tz
        };
        mockTriggers.push(trigger);
        return trigger;
      }
    };
    return builder;
  }
};

// Expose globals for loaded modules
global.CONFIG = {
  SPREADSHEET_ID: "1PJuZp1RDdUE7Be7KwOg0T2xKTM8Qnw_ku8lCFpkBTjs",
  SHEET_NAME: "Invoices",
  APPROVAL_LOG_SHEET: "Approval_Log",
  PAYMENT_LOG_SHEET: "Payment_Log",
  NOTIFICATION_LOG_SHEET: "Notification_Log",
  EXPECTED_HEADERS: 18,
  TIMEZONE: "Asia/Kolkata",
  NOTIFICATION_SETTINGS: {
    ADMIN_EMAIL: "admin@example.com",
    REMINDER_DAYS_BEFORE_DUE: 3,
    OVERDUE_REMINDER_INTERVAL_DAYS: 3,
    SEND_OVERDUE_REMINDERS: true,
    DAILY_TRIGGER_HOUR: 9
  },
  DRIVE_FOLDERS: {
    RAW_INVOICES: "test_raw_folder",
    PROCESSED_INVOICES: "test_proc_folder",
    APPROVAL_RECORDS: "test_app_folder",
    REPORTS: "test_rep_folder"
  }
};

global.GEMINI_CONFIG = {
  MODEL: "gemini-2.5-flash",
  API_URL: "https://generativelanguage.googleapis.com/v1beta/models/",
  TEMPERATURE: 0.1,
  MAX_RETRIES: 3,
  INITIAL_RETRY_DELAY_MS: 10
};

global.VALIDATION_CONFIG = {
  MIN_CONFIDENCE: 0.70,
  AMOUNT_TOLERANCE: 0.01
};

const ContentService = {
  MimeType: {
    JSON: "application/json",
    TEXT: "text/plain"
  },
  createTextOutput: (text) => ({
    text: text,
    mimeType: "text/plain",
    setMimeType: function(mime) { this.mimeType = mime; return this; },
    getContent: function() { return this.text; }
  })
};

const HtmlService = {
  XFrameOptionsMode: {
    ALLOWALL: "ALLOWALL"
  },
  createHtmlOutputFromFile: (filename) => ({
    title: filename,
    setTitle: function(t) { this.title = t; return this; },
    addMetaTag: function(name, content) { return this; },
    setXFrameOptionsMode: function(mode) { return this; },
    getContent: function() { return "<html>" + filename + "</html>"; }
  })
};

global.ContentService = ContentService;
global.HtmlService = HtmlService;
global.PropertiesService = PropertiesService;
global.SpreadsheetApp = SpreadsheetApp;
global.LockService = LockService;
global.Utilities = Utilities;
global.MailApp = MailApp;
global.Session = Session;
global.ScriptApp = ScriptApp;

// Read and eval the code files
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadScript(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  vm.runInThisContext(code);
}

loadScript(path.join(__dirname, '../DuplicateDetector.gs'));
loadScript(path.join(__dirname, '../GeminiService.gs'));
loadScript(path.join(__dirname, '../ApprovalService.gs'));
loadScript(path.join(__dirname, '../PaymentTracker.gs'));
loadScript(path.join(__dirname, '../NotificationService.gs'));
loadScript(path.join(__dirname, '../DashboardService.gs'));

console.log("=================================================");
console.log("STARTING AUTOMATED TEST EXECUTION");
console.log("=================================================");

let testsPassed = 0;
let testsFailed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    testsFailed++;
  }
}

// ---------------------------------------------------------------------------
// TASK 1: UPCOMING PAYMENT REMINDER
// ---------------------------------------------------------------------------
console.log("\n--- TASK 1 TESTS: UPCOMING PAYMENT REMINDER ---");

runTest("1.1 Approved Unpaid Invoice Due in 3 Days sends reminder", () => {
  // Clear notification log
  mockSpreadsheetData.Notification_Log.splice(1);
  sentEmails.length = 0;

  // Set today as 2026-11-20, due date 2026-11-23
  const invoiceRow = [
    "INV-TASK1-001", "Vendor Alpha", "alpha@example.com",
    "2026-11-01", new Date("2026-11-23T00:00:00Z"), "USD",
    1000, 180, 1180, "PO-001", "http://drive/file", "msg123",
    "vendor alpha|inv-task1-001", "APPROVED", "UNPAID",
    0.95, new Date(), ""
  ];
  mockSpreadsheetData.Invoices.push(invoiceRow);

  const result = sendUpcomingPaymentReminder("INV-TASK1-001");
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.status, "SENT");
  assert.strictEqual(sentEmails.length, 1);
  assert.match(sentEmails[0].subject, /Payment Due Soon: INV-TASK1-001/);
});

runTest("1.2 Paid Invoice does NOT send upcoming reminder", () => {
  const invoiceRow = [
    "INV-TASK1-002", "Vendor Beta", "beta@example.com",
    "2026-11-01", new Date("2026-11-23T00:00:00Z"), "USD",
    500, 50, 550, "PO-002", "http://drive/file2", "msg124",
    "vendor beta|inv-task1-002", "APPROVED", "PAID",
    0.95, new Date(), ""
  ];
  mockSpreadsheetData.Invoices.push(invoiceRow);

  assert.throws(() => {
    sendUpcomingPaymentReminder("INV-TASK1-002");
  }, /Upcoming reminders require an approved unpaid invoice/);
});

runTest("1.3 Rejected Invoice does NOT send upcoming reminder", () => {
  const invoiceRow = [
    "INV-TASK1-003", "Vendor Gamma", "gamma@example.com",
    "2026-11-01", new Date("2026-11-23T00:00:00Z"), "USD",
    300, 30, 330, "PO-003", "http://drive/file3", "msg125",
    "vendor gamma|inv-task1-003", "REJECTED", "UNPAID",
    0.95, new Date(), ""
  ];
  mockSpreadsheetData.Invoices.push(invoiceRow);

  assert.throws(() => {
    sendUpcomingPaymentReminder("INV-TASK1-003");
  }, /Upcoming reminders require an approved unpaid invoice/);
});

runTest("1.4 Duplicate reminder attempt returns ALREADY_SENT", () => {
  const emailCountBefore = sentEmails.length;
  const result = sendUpcomingPaymentReminder("INV-TASK1-001");
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.status, "ALREADY_SENT");
  assert.strictEqual(sentEmails.length, emailCountBefore, "No new email should be sent for duplicate reminder");
});

runTest("1.5 Missed Trigger Resilience: Invoice due in 2 days within window (<= 3 days) sends reminder once", () => {
  // Simulating trigger running when daysUntilDue = 2 (e.g. trigger failed on day 3)
  const today = new Date("2026-11-21T03:30:00Z"); // 9 AM IST
  const dueDate = new Date("2026-11-23T00:00:00Z");
  const daysUntilDue = getCalendarDayDifference(today, dueDate);
  assert.strictEqual(daysUntilDue, 2);

  // An approved unpaid invoice due in 2 days
  const invoiceRow = [
    "INV-TASK1-MISSED", "Vendor Delta", "delta@example.com",
    "2026-11-01", dueDate, "USD",
    800, 80, 880, "PO-004", "http://drive/file4", "msg126",
    "vendor delta|inv-task1-missed", "APPROVED", "UNPAID",
    0.95, new Date(), ""
  ];
  mockSpreadsheetData.Invoices.push(invoiceRow);

  // Check window condition
  const inWindow = daysUntilDue >= 0 && daysUntilDue <= CONFIG.NOTIFICATION_SETTINGS.REMINDER_DAYS_BEFORE_DUE;
  assert.strictEqual(inWindow, true, "2 days until due should be within reminder window");

  const notifResult = sendUpcomingPaymentReminder("INV-TASK1-MISSED");
  assert.strictEqual(notifResult.success, true);
  assert.strictEqual(notifResult.status, "SENT");

  // Re-running again on day 1 should be protected by idempotency
  const dupCheck = sendUpcomingPaymentReminder("INV-TASK1-MISSED");
  assert.strictEqual(dupCheck.success, false);
  assert.strictEqual(dupCheck.status, "ALREADY_SENT");
});

// ---------------------------------------------------------------------------
// TASK 2: DAILY NOTIFICATION TRIGGER
// ---------------------------------------------------------------------------
console.log("\n--- TASK 2 TESTS: DAILY NOTIFICATION TRIGGER ---");

runTest("2.1 installDailyNotificationTrigger creates exactly one trigger", () => {
  mockTriggers.length = 0;
  installDailyNotificationTrigger();
  assert.strictEqual(mockTriggers.length, 1);
  assert.strictEqual(mockTriggers[0].getHandlerFunction(), "processDailyNotifications");
  assert.strictEqual(mockTriggers[0].hour, 9);
  assert.strictEqual(mockTriggers[0].timezone, "Asia/Kolkata");
});

runTest("2.2 Repeated installation is idempotent (does not duplicate triggers)", () => {
  installDailyNotificationTrigger();
  installDailyNotificationTrigger();
  assert.strictEqual(mockTriggers.length, 1);
});

runTest("2.3 verifyDailyNotificationTrigger reports trigger details", () => {
  const verified = verifyDailyNotificationTrigger();
  assert.strictEqual(verified.length, 1);
  assert.strictEqual(verified[0].handlerFunction, "processDailyNotifications");
});

// ---------------------------------------------------------------------------
// TASK 3: END-TO-END WORKFLOW SIMULATION WITH SYNTHETIC INVOICES
// ---------------------------------------------------------------------------
console.log("\n--- TASK 3 TESTS: END-TO-END WORKFLOW SCENARIOS ---");

runTest("3.1 Valid invoice data passes validation", () => {
  const invoice = {
    invoice_id: "SYNTH-001",
    vendor_name: "Acme Corporation",
    vendor_email: "billing@acme.com",
    invoice_date: "2026-11-01",
    due_date: "2026-11-20",
    currency: "USD",
    subtotal: 1000,
    tax: 180,
    total_amount: 1180,
    po_number: "PO-100",
    extraction_confidence: 0.95
  };
  const val = validateInvoiceData(invoice);
  assert.strictEqual(val.valid, true);
  assert.strictEqual(val.errors.length, 0);
});

runTest("3.2 Duplicate invoice detection identifies identical vendor and invoice ID", () => {
  const key = generateDuplicateKey({ vendor_name: "Acme Corporation", invoice_id: "SYNTH-001" });
  assert.strictEqual(key, "acme corporation|synth-001");

  // Check against sheet where duplicate exists
  mockSpreadsheetData.Invoices.push([
    "SYNTH-001", "Acme Corporation", "billing@acme.com",
    "2026-11-01", "2026-11-20", "USD", 1000, 180, 1180, "PO-100",
    "url", "msg", key, "PENDING", "UNPAID", 0.95, new Date(), ""
  ]);

  const dupResult = checkDuplicateInvoice(key);
  assert.strictEqual(dupResult.isDuplicate, true);
});

runTest("3.3 Invoice with missing information fails validation", () => {
  const invoice = {
    invoice_id: "SYNTH-MISSING",
    vendor_name: "Missing Corp",
    vendor_email: null,
    invoice_date: "2026-11-01",
    due_date: null, // Missing!
    currency: "USD",
    subtotal: 100,
    tax: null,      // Missing!
    total_amount: 100,
    po_number: null,
    extraction_confidence: 0.8
  };
  const val = validateInvoiceData(invoice);
  assert.strictEqual(val.valid, false);
  assert.ok(val.errors.some(e => e.includes("due_date")));
  assert.ok(val.errors.some(e => e.includes("tax")));
});

runTest("3.4 Rejected invoice flow records rejection audit and updates status", () => {
  const invoiceId = "SYNTH-REJECT-001";
  mockSpreadsheetData.Invoices.push([
    invoiceId, "Rejected Vendor", "reject@example.com",
    "2026-11-01", "2026-11-20", "USD", 200, 20, 220, "PO-200",
    "url", "msg", "rejected vendor|synth-reject-001", "PENDING", "UNPAID", 0.9, new Date(), ""
  ]);

  const appResult = updateInvoiceApproval(invoiceId, "REJECTED", "Price calculation discrepancy");
  assert.strictEqual(appResult.success, true);
  assert.strictEqual(appResult.action, "REJECTED");

  // Check audit log
  const auditLogs = mockSpreadsheetData.Approval_Log;
  const logged = auditLogs.find(r => r[0] === invoiceId);
  assert.ok(logged, "Rejection must be logged in Approval_Log");
  assert.strictEqual(logged[2], "REJECTED");
  assert.strictEqual(logged[4], "Price calculation discrepancy");
});

runTest("3.5 Approved and Paid invoice flow records approval, payment and audit logs", () => {
  const invoiceId = "SYNTH-PAID-001";
  mockSpreadsheetData.Invoices.push([
    invoiceId, "Paid Vendor", "paid@example.com",
    "2026-11-01", "2026-11-20", "USD", 500, 50, 550, "PO-300",
    "url", "msg", "paid vendor|synth-paid-001", "PENDING", "UNPAID", 0.95, new Date(), ""
  ]);

  // Step 1: Approve
  const approveResult = updateInvoiceApproval(invoiceId, "APPROVED", "Approved by finance manager");
  assert.strictEqual(approveResult.success, true);
  assert.strictEqual(approveResult.action, "APPROVED");

  // Step 2: Record Payment
  const payResult = recordInvoicePayment(invoiceId, "2026-11-23", "WIRE-REF-9999");
  assert.strictEqual(payResult.success, true);
  assert.strictEqual(payResult.paymentStatus, "PAID");

  // Check Payment_Log
  const payLogs = mockSpreadsheetData.Payment_Log;
  const payEntry = payLogs.find(r => r[0] === invoiceId);
  assert.ok(payEntry, "Payment must be recorded in Payment_Log");
  assert.strictEqual(payEntry[5], "WIRE-REF-9999");
});

runTest("3.6 Approved but Unpaid invoice flow appears in getApprovedUnpaidInvoices", () => {
  const invoiceId = "SYNTH-UNPAID-001";
  mockSpreadsheetData.Invoices.push([
    invoiceId, "Unpaid Vendor", "unpaid@example.com",
    "2026-11-01", "2026-11-30", "USD", 750, 75, 825, "PO-400",
    "url", "msg", "unpaid vendor|synth-unpaid-001", "PENDING", "UNPAID", 0.95, new Date(), ""
  ]);

  updateInvoiceApproval(invoiceId, "APPROVED", "Approved for standard 30-day payment");

  const unpaidList = getApprovedUnpaidInvoices();
  assert.ok(unpaidList.some(inv => inv.invoiceId === invoiceId));
});

// ---------------------------------------------------------------------------
// TASK 4: ERROR HANDLING SCENARIOS
// ---------------------------------------------------------------------------
console.log("\n--- TASK 4 TESTS: ERROR HANDLING & RESILIENCE ---");

runTest("4.1 Invalid date ordering (due date earlier than invoice date) is rejected", () => {
  const val = validateInvoiceData({
    invoice_id: "ERR-DATE-001",
    vendor_name: "Time Vendor",
    vendor_email: "v@example.com",
    invoice_date: "2026-11-25",
    due_date: "2026-11-10",
    currency: "USD",
    subtotal: 100,
    tax: 10,
    total_amount: 110,
    po_number: "PO-1",
    extraction_confidence: 0.95
  });
  assert.strictEqual(val.valid, false);
  assert.ok(val.errors.some(e => e.includes("Due date cannot be earlier than invoice date")));
});

runTest("4.2 Non-ISO date format is rejected", () => {
  const val = validateInvoiceData({
    invoice_id: "ERR-DATE-002",
    vendor_name: "Format Vendor",
    vendor_email: "v@example.com",
    invoice_date: "11/25/2026", // Invalid non-ISO
    due_date: "2026-12-05",
    currency: "USD",
    subtotal: 100,
    tax: 10,
    total_amount: 110,
    po_number: "PO-2",
    extraction_confidence: 0.95
  });
  assert.strictEqual(val.valid, false);
  assert.ok(val.errors.some(e => e.includes("Invoice date is not a valid YYYY-MM-DD date")));
});

runTest("4.3 Calculation mismatch (subtotal + tax != total) is rejected", () => {
  const val = validateInvoiceData({
    invoice_id: "ERR-MATH-001",
    vendor_name: "Math Vendor",
    vendor_email: "v@example.com",
    invoice_date: "2026-11-01",
    due_date: "2026-11-20",
    currency: "USD",
    subtotal: 100,
    tax: 18,
    total_amount: 150, // Should be 118!
    po_number: "PO-3",
    extraction_confidence: 0.95
  });
  assert.strictEqual(val.valid, false);
  assert.ok(val.errors.some(e => e.includes("Total amount mismatch")));
});

runTest("4.4 Missing Gemini API key throws descriptive error without leaking secrets", () => {
  const originalKey = mockScriptProperties.GEMINI_API_KEY;
  mockScriptProperties.GEMINI_API_KEY = null;
  try {
    assert.throws(() => {
      getGeminiApiKey();
    }, /GEMINI_API_KEY is missing from Apps Script Script Properties/);
  } finally {
    mockScriptProperties.GEMINI_API_KEY = originalKey;
  }
});

runTest("4.5 Rejection without a mandatory reason throws descriptive error", () => {
  assert.throws(() => {
    updateInvoiceApproval("SYNTH-UNPAID-001", "REJECTED", "");
  }, /A rejection reason is required/);
});

runTest("4.6 Marking unapproved invoice as paid throws descriptive error", () => {
  const pendingId = "SYNTH-PENDING-PAY";
  mockSpreadsheetData.Invoices.push([
    pendingId, "Pending Vendor", "pending@example.com",
    "2026-11-01", "2026-11-20", "USD", 100, 10, 110, "PO-5",
    "url", "msg", "pending vendor|synth-pending-pay", "PENDING", "UNPAID", 0.9, new Date(), ""
  ]);

  assert.throws(() => {
    recordInvoicePayment(pendingId, "2026-11-23", "REF-123");
  }, /Only approved invoices can be marked as paid/);
});

runTest("4.7 parseDateValue safely handles strings and Date objects without crashing", () => {
  const dStr = parseDateValue("2026-11-25");
  assert.ok(dStr instanceof Date);
  assert.strictEqual(dStr.getUTCFullYear(), 2026);
  assert.strictEqual(dStr.getUTCMonth(), 10);
  assert.strictEqual(dStr.getUTCDate(), 25);

  const dObj = parseDateValue(new Date("2026-11-25T00:00:00Z"));
  assert.ok(dObj instanceof Date);

  const dInvalid = parseDateValue("not-a-date");
  assert.strictEqual(dInvalid, null);

  const dNull = parseDateValue(null);
  assert.strictEqual(dNull, null);
});

// ---------------------------------------------------------------------------
// TASK 5: LIVE DASHBOARD SERVICE & BUSINESS RULE VERIFICATION
// ---------------------------------------------------------------------------
console.log("\n--- TASK 5 TESTS: LIVE DASHBOARD SERVICE & ANALYTICS ---");

function setupBaselineSpreadsheetData() {
  // Reset sheets to clean baseline matching expected test dataset
  mockSpreadsheetData.Invoices = [
    [
      "Invoice_ID", "Vendor_Name", "Vendor_Email", "Invoice_Date", "Due_Date",
      "Currency", "Subtotal", "Tax", "Total_Amount", "PO_Number",
      "Invoice_File_URL", "Gmail_Message_ID", "Duplicate_Key",
      "Approval_Status", "Payment_Status", "Extraction_Confidence",
      "Processed_At", "Error_Message"
    ],
    // 1. INV-2026-001 (Approved, Paid)
    [
      "INV-2026-001", "ABC TECH SOLUTIONS PVT. LTD.", "billing@abctech.example.com",
      "2026-11-01", "2026-11-15", "INR", 10000, 1800, 11800, "PO-2026-001",
      "https://drive.google.com/file/d/1nuWe1WSCNroV_YT1D1WNA7THTWrVk5fB/view",
      "msg1", "abc tech solutions pvt. ltd.|inv-2026-001", "APPROVED", "PAID",
      0.96, new Date("2026-11-23T10:15:00Z"), ""
    ],
    // 2. INV-2026-002 (Approved, Paid)
    [
      "INV-2026-002", "XYZ LOGISTICS CORP.", "finance@xyzcorp.example.com",
      "2026-11-05", "2026-11-20", "INR", 15000, 2700, 17700, "PO-2026-002",
      "https://drive.google.com/file/d/1nuWe1WSCNroV_YT1D1WNA7THTWrVk5fB/view",
      "msg2", "xyz logistics corp.|inv-2026-002", "APPROVED", "PAID",
      0.95, new Date("2026-11-23T11:30:00Z"), ""
    ],
    // 3. INV-2026-003 (Approved, Unpaid, Overdue)
    [
      "INV-2026-003", "LMN OFFICE SUPPLIES PVT. LTD.", "accounts@lmnoffice.example.com",
      "2026-11-10", "2026-11-20", "INR", 6355.93, 1144.07, 7500, "PO-2026-003",
      "https://drive.google.com/file/d/1nuWe1WSCNroV_YT1D1WNA7THTWrVk5fB/view",
      "msg3", "lmn office supplies pvt. ltd.|inv-2026-003", "APPROVED", "UNPAID",
      0.94, new Date("2026-11-23T12:00:00Z"), ""
    ],
    // 4. INV-2026-004 (Approved, Paid)
    [
      "INV-2026-004", "GLOBAL CLOUD HOSTING SERVICES", "invoices@globalcloud.example.com",
      "2026-11-12", "2026-11-26", "INR", 2144.07, 385.93, 2530, "PO-2026-004",
      "https://drive.google.com/file/d/1nuWe1WSCNroV_YT1D1WNA7THTWrVk5fB/view",
      "msg4", "global cloud hosting services|inv-2026-004", "APPROVED", "PAID",
      0.92, new Date("2026-11-23T12:15:00Z"), ""
    ],
    // 5. INV-2026-005 (Approved, Paid)
    [
      "INV-2026-005", "FASTTRACK IT CONSULTING", "billing@fasttrack.example.com",
      "2026-11-14", "2026-11-28", "INR", 6355.93, 1144.07, 7500, "PO-2026-005",
      "https://drive.google.com/file/d/1nuWe1WSCNroV_YT1D1WNA7THTWrVk5fB/view",
      "msg5", "fasttrack it consulting|inv-2026-005", "APPROVED", "PAID",
      0.97, new Date("2026-11-23T12:45:00Z"), ""
    ],
    // 6. INV-2026-006 (Rejected, Unpaid)
    [
      "INV-2026-006", "GreenLeaf Office Solutions Pvt. Ltd.", "support@greenleaf.example.com",
      "2026-11-16", "2026-11-30", "INR", 4000, 720, 4720, "PO-2026-006",
      "https://drive.google.com/file/d/1nuWe1WSCNroV_YT1D1WNA7THTWrVk5fB/view",
      "msg6", "greenleaf office solutions pvt. ltd.|inv-2026-006", "REJECTED", "UNPAID",
      0.88, new Date("2026-11-23T13:00:00Z"), ""
    ]
  ];

  mockSpreadsheetData.Approval_Log = [
    ["Invoice_ID", "Vendor_Name", "Decision", "Approver_Email", "Reason", "Timestamp"],
    ["INV-2026-001", "ABC TECH SOLUTIONS PVT. LTD.", "APPROVED", "anjalids989@gmail.com", "Verified successfully during initial setup.", new Date("2026-11-23T10:20:00Z")],
    ["INV-2026-002", "XYZ LOGISTICS CORP.", "APPROVED", "anjalids989@gmail.com", "Freight charges confirmed.", new Date("2026-11-23T11:35:00Z")],
    ["INV-2026-003", "LMN OFFICE SUPPLIES PVT. LTD.", "APPROVED", "anjalids989@gmail.com", "Office supplies received in good order.", new Date("2026-11-23T12:05:00Z")],
    ["INV-2026-004", "GLOBAL CLOUD HOSTING SERVICES", "APPROVED", "anjalids989@gmail.com", "Monthly cloud subscription verified.", new Date("2026-11-23T12:20:00Z")],
    ["INV-2026-005", "FASTTRACK IT CONSULTING", "APPROVED", "anjalids989@gmail.com", "Verified against consulting timesheets.", new Date("2026-11-23T12:50:00Z")],
    ["INV-2026-006", "GreenLeaf Office Solutions Pvt. Ltd.", "REJECTED", "anjalids989@gmail.com", "Discrepancy in unit pricing against agreed quotation.", new Date("2026-11-23T13:05:00Z")]
  ];

  mockSpreadsheetData.Payment_Log = [
    ["Invoice_ID", "Vendor_Name", "Amount", "Currency", "Payment_Date", "Reference", "Recorded_By", "Recorded_At"],
    ["INV-2026-001", "ABC TECH SOLUTIONS PVT. LTD.", 11800, "INR", "2026-11-23", "TEST-PAY-2026-001", "anjalids989@gmail.com", new Date("2026-11-23T10:25:00Z")],
    ["INV-2026-002", "XYZ LOGISTICS CORP.", 17700, "INR", "2026-11-23", "TEST-PAY-2026-002", "anjalids989@gmail.com", new Date("2026-11-23T11:40:00Z")],
    ["INV-2026-004", "GLOBAL CLOUD HOSTING SERVICES", 2530, "INR", "2026-11-23", "UPI-2026-004", "anjalids989@gmail.com", new Date("2026-11-23T12:25:00Z")],
    ["INV-2026-005", "FASTTRACK IT CONSULTING", 7500, "INR", "2026-11-23", "NEFT-2026-005", "anjalids989@gmail.com", new Date("2026-11-23T12:55:00Z")]
  ];
}

runTest("5.1 getDashboardData calculates expected baseline KPIs exactly", () => {
  setupBaselineSpreadsheetData();
  const data = getDashboardData();
  const kpis = data.kpis;

  console.log("Calculated KPIs:", JSON.stringify(kpis, null, 2));

  assert.strictEqual(kpis.totalInvoices, 6, "Total invoices must be 6");
  assert.strictEqual(kpis.approvedInvoices, 5, "Approved invoices must be 5");
  assert.strictEqual(kpis.pendingApprovals, 0, "Pending approvals must be 0");
  assert.strictEqual(kpis.rejectedInvoices, 1, "Rejected invoices must be 1");
  assert.strictEqual(kpis.paidInvoices, 4, "Paid invoices must be 4");
  assert.strictEqual(kpis.approvedUnpaidInvoices, 1, "Approved unpaid invoices must be 1");
  assert.strictEqual(kpis.overdueInvoices, 1, "Overdue invoices must be 1");
  assert.strictEqual(kpis.totalInvoiceValue, 47030, "Total invoice value excluding rejected must be 47,030");
  assert.strictEqual(kpis.totalPaidAmount, 39530, "Total paid amount must be 39,530");
  assert.strictEqual(kpis.outstandingAmount, 7500, "Outstanding approved amount must be 7,500");
  assert.strictEqual(kpis.rejectedAmount, 4720, "Rejected invoice amount must be 4,720");
});

runTest("5.2 Overdue invoice identification and exclusion of paid/rejected invoices", () => {
  setupBaselineSpreadsheetData();
  const data = getDashboardData();

  // Exactly 1 overdue invoice: INV-2026-003, LMN OFFICE SUPPLIES, 7500
  assert.strictEqual(data.overdueList.length, 1, "Exactly one overdue invoice expected");
  const overdueInv = data.overdueList[0];
  assert.strictEqual(overdueInv.invoiceId, "INV-2026-003");
  assert.strictEqual(overdueInv.vendorName, "LMN OFFICE SUPPLIES PVT. LTD.");
  assert.strictEqual(overdueInv.amount, 7500);

  // INV-2026-005 is PAID -> must NOT appear in outstanding or overdue
  const paidInv = data.invoices.find(i => i.invoiceId === "INV-2026-005");
  assert.strictEqual(paidInv.paymentStatus, "PAID");
  assert.strictEqual(paidInv.isOverdue, false);

  // INV-2026-006 is REJECTED -> must NOT contribute to outstanding or approved amounts
  const rejectedInv = data.invoices.find(i => i.invoiceId === "INV-2026-006");
  assert.strictEqual(rejectedInv.approvalStatus, "REJECTED");
  assert.strictEqual(data.kpis.approvedInvoiceValue, 47030);
});

runTest("5.3 approveInvoiceFromDashboard and rejectInvoiceFromDashboard action handlers", () => {
  setupBaselineSpreadsheetData();

  // Add a pending invoice
  mockSpreadsheetData.Invoices.push([
    "INV-PENDING-ACTION", "Pending Vendor Inc", "pending@vendor.com",
    "2026-11-20", "2026-12-05", "INR", 1000, 180, 1180, "PO-P1",
    "https://drive/p1", "msgP1", "pending vendor inc|inv-pending-action",
    "PENDING", "UNPAID", 0.95, new Date(), ""
  ]);

  // Test approval
  const appResult = approveInvoiceFromDashboard("INV-PENDING-ACTION", "Approved via Dashboard UI Test");
  assert.strictEqual(appResult.success, true);
  assert.strictEqual(appResult.action, "APPROVED");

  // Verify status in sheet
  const updatedRow = mockSpreadsheetData.Invoices.find(r => r[0] === "INV-PENDING-ACTION");
  assert.strictEqual(updatedRow[13], "APPROVED");

  // Add another pending invoice for rejection
  mockSpreadsheetData.Invoices.push([
    "INV-REJECT-ACTION", "Reject Vendor Inc", "reject@vendor.com",
    "2026-11-20", "2026-12-05", "INR", 2000, 360, 2360, "PO-R1",
    "https://drive/r1", "msgR1", "reject vendor inc|inv-reject-action",
    "PENDING", "UNPAID", 0.95, new Date(), ""
  ]);

  // Rejection with empty reason must fail
  assert.throws(() => {
    rejectInvoiceFromDashboard("INV-REJECT-ACTION", "   ");
  }, /A rejection reason is strictly required/);

  // Rejection with valid reason
  const rejResult = rejectInvoiceFromDashboard("INV-REJECT-ACTION", "Pricing terms mismatched quotation.");
  assert.strictEqual(rejResult.success, true);
  assert.strictEqual(rejResult.action, "REJECTED");

  const rejRow = mockSpreadsheetData.Invoices.find(r => r[0] === "INV-REJECT-ACTION");
  assert.strictEqual(rejRow[13], "REJECTED");
});

runTest("5.4 recordPaymentFromDashboard action handler", () => {
  setupBaselineSpreadsheetData();

  // INV-2026-003 is APPROVED and UNPAID
  const payResult = recordPaymentFromDashboard("INV-2026-003", "2026-11-25", "WIRE-DASHBOARD-TEST-99");
  assert.strictEqual(payResult.success, true);
  assert.strictEqual(payResult.paymentStatus, "PAID");
  assert.strictEqual(payResult.paymentReference, "WIRE-DASHBOARD-TEST-99");

  // Check sheet updated
  const row = mockSpreadsheetData.Invoices.find(r => r[0] === "INV-2026-003");
  assert.strictEqual(row[14], "PAID");

  // Check Payment_Log updated
  const log = mockSpreadsheetData.Payment_Log.find(r => r[0] === "INV-2026-003" && r[5] === "WIRE-DASHBOARD-TEST-99");
  assert.ok(log, "Payment record must exist in Payment_Log");
  assert.strictEqual(log[2], 7500);
});

runTest("5.5 Web App doGet and doPost API routing", () => {
  setupBaselineSpreadsheetData();

  // Test doGet API route
  const apiRes = doGet({ parameter: { action: "api" } });
  assert.strictEqual(apiRes.mimeType, "application/json");
  const parsed = JSON.parse(apiRes.getContent());
  assert.strictEqual(parsed.success, true);
  assert.strictEqual(parsed.data.kpis.totalInvoices, 6);

  // Test doGet HTML view route
  const htmlRes = doGet({});
  assert.ok(htmlRes.title.includes("Intelligent Invoice Processing"));

  // Test doPost getData route
  const postRes = doPost({ postData: { contents: JSON.stringify({ action: "getData" }) } });
  assert.strictEqual(postRes.mimeType, "application/json");
  const postData = JSON.parse(postRes.getContent());
  assert.strictEqual(postData.success, true);
  assert.strictEqual(postData.data.kpis.totalInvoiceValue, 47030);
});

console.log("\n=================================================");
console.log(`TEST SUMMARY: ${testsPassed} PASSED, ${testsFailed} FAILED`);
console.log("=================================================");

if (testsFailed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
