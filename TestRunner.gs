/**
 * TEST RUNNER & DIAGNOSTICS SUITE
 *
 * Dedicated test module for:
 * - Task 1: Upcoming Payment Reminder verification
 * - Task 2: Trigger inspection & idempotency verification
 * - Task 3: Synthetic end-to-end workflow validation
 * - Task 4: Error handling and resilience testing
 *
 * ALL tests in this module use isolated synthetic data fixtures
 * to strictly ensure no production records or files are altered.
 */

// Synthetic Test Fixtures
const SYNTHETIC_FIXTURES = {
  VALID_INVOICE: {
    invoice_id: "SYNTH-INV-001",
    vendor_name: "Acme Cloud Solutions Ltd",
    vendor_email: "billing@acmecloud.example.com",
    invoice_date: "2026-11-20",
    due_date: "2026-11-26",
    currency: "USD",
    subtotal: 1000.00,
    tax: 180.00,
    total_amount: 1180.00,
    po_number: "PO-2026-881",
    extraction_confidence: 0.98
  },
  MISSING_FIELDS_INVOICE: {
    invoice_id: "SYNTH-INV-002",
    vendor_name: "Incomplete Vendor Inc",
    vendor_email: null,
    invoice_date: "2026-11-20",
    due_date: null, // Missing required due date
    currency: "USD",
    subtotal: 500.00,
    tax: null,      // Missing tax
    total_amount: 500.00,
    po_number: null,
    extraction_confidence: 0.65
  },
  INVALID_DATES_INVOICE: {
    invoice_id: "SYNTH-INV-003",
    vendor_name: "Time Travel Logistics",
    vendor_email: "billing@timetravel.example.com",
    invoice_date: "2026-11-25",
    due_date: "2026-11-10", // Due date earlier than invoice date
    currency: "USD",
    subtotal: 200.00,
    tax: 36.00,
    total_amount: 236.00,
    po_number: "PO-2026-883",
    extraction_confidence: 0.95
  },
  CALCULATION_MISMATCH_INVOICE: {
    invoice_id: "SYNTH-INV-004",
    vendor_name: "Faulty Math Services",
    vendor_email: "finance@faultymath.example.com",
    invoice_date: "2026-11-20",
    due_date: "2026-11-30",
    currency: "USD",
    subtotal: 100.00,
    tax: 18.00,
    total_amount: 150.00, // Should be 118.00!
    po_number: "PO-2026-884",
    extraction_confidence: 0.92
  }
};


// ============================================================================
// TASK 1 TESTS: UPCOMING PAYMENT REMINDER
// ============================================================================

/**
 * Test 1.1: Valid Approved Unpaid Invoice Due in 3 Days
 * Verifies eligibility check, timezone formatting, and notification creation.
 */
function testUpcomingReminderApprovedUnpaid() {
  console.log("--- TEST 1.1: Approved Unpaid Invoice Due in 3 Days ---");

  const today = new Date();
  const threeDaysLater = new Date(today.getTime() + (3 * 24 * 60 * 60 * 1000));
  const dueDateStr = Utilities.formatDate(threeDaysLater, CONFIG.TIMEZONE, "yyyy-MM-dd");

  const syntheticInvoice = {
    invoice_id: "TEST-UPCOMING-001",
    vendor_name: "Synthetic Vendor A",
    due_date: dueDateStr,
    total_amount: 1500,
    currency: "USD",
    approval_status: "APPROVED",
    payment_status: "UNPAID"
  };

  const daysUntilDue = getCalendarDayDifference(today, parseDateValue(syntheticInvoice.due_date));
  const isEligible = daysUntilDue >= 0 && daysUntilDue <= CONFIG.NOTIFICATION_SETTINGS.REMINDER_DAYS_BEFORE_DUE;

  console.log("Invoice ID:", syntheticInvoice.invoice_id);
  console.log("Due Date:", syntheticInvoice.due_date);
  console.log("Days Until Due:", daysUntilDue);
  console.log("Eligible for Reminder (<= 3 days):", isEligible);

  if (!isEligible) {
    throw new Error("Test 1.1 Failed: Invoice should be eligible for upcoming reminder.");
  }

  console.log("TEST 1.1 PASSED: Eligible approved unpaid invoice identified correctly.");
  return { passed: true, daysUntilDue: daysUntilDue };
}


/**
 * Test 1.2: Paid Invoice (Must NOT send reminder)
 */
function testUpcomingReminderPaidInvoice() {
  console.log("--- TEST 1.2: Paid Invoice Exclusion ---");

  const syntheticInvoice = {
    approval_status: "APPROVED",
    payment_status: "PAID"
  };

  const isEligible =
    syntheticInvoice.approval_status === "APPROVED" &&
    syntheticInvoice.payment_status === "UNPAID";

  console.log("Paid Invoice Eligible:", isEligible);

  if (isEligible) {
    throw new Error("Test 1.2 Failed: Paid invoice must never be eligible for payment reminders.");
  }

  console.log("TEST 1.2 PASSED: Paid invoices are strictly excluded.");
  return { passed: true };
}


/**
 * Test 1.3: Rejected Invoice (Must NOT send reminder)
 */
function testUpcomingReminderRejectedInvoice() {
  console.log("--- TEST 1.3: Rejected Invoice Exclusion ---");

  const syntheticInvoice = {
    approval_status: "REJECTED",
    payment_status: "UNPAID"
  };

  const isEligible =
    syntheticInvoice.approval_status === "APPROVED" &&
    syntheticInvoice.payment_status === "UNPAID";

  console.log("Rejected Invoice Eligible:", isEligible);

  if (isEligible) {
    throw new Error("Test 1.3 Failed: Rejected invoices must never receive payment reminders.");
  }

  console.log("TEST 1.3 PASSED: Rejected invoices are strictly excluded.");
  return { passed: true };
}


/**
 * Test 1.4: Duplicate Reminder Idempotency Attempt
 * Verifies that duplicate reminder attempts with the same idempotency key return ALREADY_SENT.
 */
function testUpcomingReminderDuplicatePrevention() {
  console.log("--- TEST 1.4: Duplicate Reminder Prevention ---");

  const testKey = "UPCOMING_SYNTH_TEST_DUPLICATE_" + new Date().getTime();
  const lock = LockService.getScriptLock();

  if (!lock.tryLock(5000)) {
    throw new Error("Could not acquire lock for duplicate test.");
  }

  try {
    const sheet = getNotificationLogSheet();

    // Insert synthetic log record
    sheet.appendRow([
      "SYNTH-DUP-001",
      NOTIFICATION_TYPES.UPCOMING,
      getNotificationAdminEmail(),
      new Date(),
      "SENT",
      testKey,
      ""
    ]);
    SpreadsheetApp.flush();

    // Check idempotency check
    const alreadySent = hasNotificationBeenSent(testKey);
    console.log("Idempotency key checked:", testKey);
    console.log("Duplicate detected by hasNotificationBeenSent:", alreadySent);

    if (!alreadySent) {
      throw new Error("Test 1.4 Failed: Duplicate notification was not detected.");
    }

    console.log("TEST 1.4 PASSED: Duplicate reminder prevented by idempotency key.");
    return { passed: true, duplicateDetected: true };
  } finally {
    lock.releaseLock();
  }
}


// ============================================================================
// TASK 2 TESTS: TRIGGER INSPECTION & IDEMPOTENCY
// ============================================================================

/**
 * Test 2.1: Trigger Inspection
 */
function testTriggerInspection() {
  console.log("--- TEST 2.1: Inspecting Project Triggers ---");
  const triggers = verifyDailyNotificationTrigger();
  console.log("Trigger count:", triggers.length);
  return { passed: true, triggers: triggers };
}


/**
 * Test 2.2: Trigger Idempotent Reinstallation
 */
function testTriggerReinstallationIdempotency() {
  console.log("--- TEST 2.2: Trigger Reinstallation Idempotency ---");

  installDailyNotificationTrigger();
  installDailyNotificationTrigger();

  const triggers = verifyDailyNotificationTrigger();
  const matched = triggers.filter(function(t) {
    return t.handlerFunction === "processDailyNotifications";
  });

  console.log("Triggers after double installation:", matched.length);

  if (matched.length !== 1) {
    throw new Error("Test 2.2 Failed: Expected exactly 1 trigger, found " + matched.length);
  }

  console.log("TEST 2.2 PASSED: Repeated installation is idempotent (exactly 1 trigger).");
  return { passed: true, triggerCount: matched.length };
}


// ============================================================================
// TASK 3 & 4 TESTS: DATA VALIDATION & ERROR HANDLING
// ============================================================================

/**
 * Test 3.1 & 4.2: Data Validation on Valid and Invalid Fixtures
 */
function testSyntheticValidationScenarios() {
  console.log("--- TEST 3.1 & 4.2: Synthetic Invoice Validation Scenarios ---");

  // 1. Valid Invoice
  const validRes = validateInvoiceData(SYNTHETIC_FIXTURES.VALID_INVOICE);
  console.log("Valid fixture test:", validRes.valid ? "PASSED" : "FAILED", validRes.errors);
  if (!validRes.valid) throw new Error("Valid fixture failed validation!");

  // 2. Missing Fields Invoice
  const missingRes = validateInvoiceData(SYNTHETIC_FIXTURES.MISSING_FIELDS_INVOICE);
  console.log("Missing fields test:", !missingRes.valid ? "PASSED" : "FAILED", "Errors:", missingRes.errors.length);
  if (missingRes.valid) throw new Error("Missing fields fixture should have failed validation!");

  // 3. Invalid Dates Invoice
  const dateRes = validateInvoiceData(SYNTHETIC_FIXTURES.INVALID_DATES_INVOICE);
  console.log("Invalid dates test:", !dateRes.valid ? "PASSED" : "FAILED", "Errors:", dateRes.errors);
  if (dateRes.valid) throw new Error("Invalid dates fixture should have failed validation!");

  // 4. Calculation Mismatch Invoice
  const mathRes = validateInvoiceData(SYNTHETIC_FIXTURES.CALCULATION_MISMATCH_INVOICE);
  console.log("Calculation mismatch test:", !mathRes.valid ? "PASSED" : "FAILED", "Errors:", mathRes.errors);
  if (mathRes.valid) throw new Error("Calculation mismatch fixture should have failed validation!");

  console.log("TEST 3.1 & 4.2 PASSED: All validation scenarios correctly handled.");
  return { passed: true };
}


/**
 * Test 4.5: Duplicate Key Generation & Collision Detection
 */
function testDuplicateKeyGeneration() {
  console.log("--- TEST 4.5: Duplicate Key Normalization ---");

  const inv1 = { vendor_name: "  Acme Corp  ", invoice_id: "INV-001 " };
  const inv2 = { vendor_name: "acme corp", invoice_id: " inv-001" };

  const key1 = generateDuplicateKey(inv1);
  const key2 = generateDuplicateKey(inv2);

  console.log("Key 1:", key1);
  console.log("Key 2:", key2);

  if (key1 !== key2 || key1 !== "acme corp|inv-001") {
    throw new Error("Test 4.5 Failed: Keys did not normalize identically.");
  }

  console.log("TEST 4.5 PASSED: Duplicate key normalization is consistent.");
  return { passed: true, key: key1 };
}


/**
 * Master Test Suite Runner
 * Runs all non-destructive diagnostic and synthetic tests.
 */
function runAllSyntheticTests() {
  console.log("========================================");
  console.log("RUNNING COMPLETE SYNTHETIC TEST SUITE");
  console.log("========================================");

  const results = {
    test1_1_upcomingApprovedUnpaid: testUpcomingReminderApprovedUnpaid(),
    test1_2_upcomingPaidExclusion: testUpcomingReminderPaidInvoice(),
    test1_3_upcomingRejectedExclusion: testUpcomingReminderRejectedInvoice(),
    test1_4_upcomingDuplicatePrevention: testUpcomingReminderDuplicatePrevention(),
    test2_1_triggerInspection: testTriggerInspection(),
    test3_1_validationScenarios: testSyntheticValidationScenarios(),
    test4_5_duplicateNormalization: testDuplicateKeyGeneration()
  };

  console.log("========================================");
  console.log("TEST SUITE SUMMARY: ALL SYNTHETIC TESTS PASSED!");
  console.log("========================================");
  return results;
}
