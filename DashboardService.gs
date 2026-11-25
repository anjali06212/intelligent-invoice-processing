/**
 * DASHBOARD SERVICE & WEB APP CONTROLLER
 * Intelligent Invoice Processing & Payment Tracker
 *
 * Backend services powering the live executive finance dashboard:
 * 1. Batch data extraction from Google Sheets (Invoices, Approval_Log, Payment_Log)
 * 2. Real-time KPI aggregation and financial analytics
 * 3. Monthly, vendor, status, and confidence statistics
 * 4. Human-in-the-loop approval & payment action endpoints
 * 5. Web App routing (doGet, doPost) serving both HTML UI and JSON API
 */

/**
 * Web App HTTP GET Handler.
 * - Browser requests: Serves the unified responsive HTML dashboard.
 * - API requests (?action=api or ?format=json): Returns live JSON payload.
 *
 * @param {Object} e HTTP event parameter.
 * @return {HtmlOutput|TextOutput}
 */
function doGet(e) {
  try {
    const isApiRequest = e && e.parameter && (e.parameter.action === "api" || e.parameter.format === "json");

    if (isApiRequest) {
      const data = getDashboardData();
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        data: data
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Serve live dashboard HTML
    const htmlOutput = HtmlService.createHtmlOutputFromFile("Dashboard")
      .setTitle("Intelligent Invoice Processing & Payment Tracker")
      .addMetaTag("viewport", "width=device-width, initial-scale=1.0")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

    return htmlOutput;

  } catch (error) {
    console.error("doGet error:", error.message);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}


/**
 * Web App HTTP POST Handler.
 * Supports dashboard action requests (approvals, rejections, payment recording).
 *
 * @param {Object} e HTTP event parameter.
 * @return {TextOutput} JSON response.
 */
function doPost(e) {
  try {
    let payload = {};
    if (e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        payload = e.parameter || {};
      }
    } else if (e.parameter) {
      payload = e.parameter;
    }

    const action = String(payload.action || "").trim();

    if (action === "approve") {
      const result = approveInvoiceFromDashboard(payload.invoiceId, payload.reason);
      return ContentService.createTextOutput(JSON.stringify({ success: true, result: result }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "reject") {
      const result = rejectInvoiceFromDashboard(payload.invoiceId, payload.reason);
      return ContentService.createTextOutput(JSON.stringify({ success: true, result: result }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "recordPayment") {
      const result = recordPaymentFromDashboard(payload.invoiceId, payload.paymentDate, payload.paymentReference);
      return ContentService.createTextOutput(JSON.stringify({ success: true, result: result }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "getData") {
      const data = getDashboardData();
      return ContentService.createTextOutput(JSON.stringify({ success: true, data: data }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    throw new Error("Invalid or unsupported POST action: " + action);

  } catch (error) {
    console.error("doPost error:", error.message);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}


/**
 * Primary Data Aggregator for the Live Dashboard.
 * Efficiently loads Invoices, Approval_Log, and Payment_Log in 3 batch reads.
 * Computes all 10 KPIs, visual analytics, obligations, and vendor rankings.
 *
 * @return {Object} Comprehensive dashboard data package.
 */
function getDashboardData() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const invoiceSheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);

  if (!invoiceSheet) {
    throw new Error("Invoices sheet not found: " + CONFIG.SHEET_NAME);
  }

  const today = new Date();
  const todayStr = Utilities.formatDate(today, CONFIG.TIMEZONE, "yyyy-MM-dd");

  // 1. Read all invoices
  const lastInvoiceRow = invoiceSheet.getLastRow();
  let rawInvoices = [];

  if (lastInvoiceRow >= 2) {
    rawInvoices = invoiceSheet.getRange(2, 1, lastInvoiceRow - 1, CONFIG.EXPECTED_HEADERS).getValues();
  }

  // 2. Read Approval Log
  const approvalLogSheet = spreadsheet.getSheetByName(CONFIG.APPROVAL_LOG_SHEET);
  let rawApprovals = [];
  if (approvalLogSheet && approvalLogSheet.getLastRow() >= 2) {
    rawApprovals = approvalLogSheet.getRange(2, 1, approvalLogSheet.getLastRow() - 1, 6).getValues();
  }

  // 3. Read Payment Log
  const paymentLogSheet = spreadsheet.getSheetByName(CONFIG.PAYMENT_LOG_SHEET);
  let rawPayments = [];
  if (paymentLogSheet && paymentLogSheet.getLastRow() >= 2) {
    rawPayments = paymentLogSheet.getRange(2, 1, paymentLogSheet.getLastRow() - 1, 8).getValues();
  }

  // Structure approval audit entries
  const approvalHistory = rawApprovals.map(function(row) {
    return {
      invoiceId: String(row[0] || ""),
      vendorName: String(row[1] || ""),
      action: String(row[2] || "").trim().toUpperCase(),
      approverEmail: String(row[3] || ""),
      reason: String(row[4] || ""),
      timestamp: formatDateOutput(row[5], true)
    };
  }).reverse(); // Most recent first

  // Structure payment audit entries
  const paymentHistory = rawPayments.map(function(row) {
    return {
      invoiceId: String(row[0] || ""),
      vendorName: String(row[1] || ""),
      amount: Number(row[2] || 0),
      currency: String(row[3] || "INR"),
      paymentDate: formatDateOutput(row[4], false),
      paymentReference: String(row[5] || ""),
      recordedBy: String(row[6] || ""),
      recordedAt: formatDateOutput(row[7], true)
    };
  }).reverse(); // Most recent first

  // KPI Counters and Accumulators
  let totalRecordedCount = 0;
  let totalRecordedAmount = 0;
  let totalApprovedCount = 0;
  let totalApprovedAmount = 0;
  let pendingCount = 0;
  let pendingAmount = 0;
  let rejectedCount = 0;
  let rejectedAmount = 0;
  let paidCount = 0;
  let paidAmount = 0;
  let approvedUnpaidCount = 0;
  let approvedUnpaidAmount = 0;
  let overdueCount = 0;
  let overdueAmount = 0;
  let confidenceSum = 0;

  // Monthly buckets: "YYYY-MM" -> { month, paid, outstanding, rejected, total, count }
  const monthlyMap = {};

  // Vendor buckets: vendorName -> { vendor, approvedAmount, paidAmount, outstandingAmount, invoiceCount }
  const vendorMap = {};

  // Upcoming Obligations
  const obligations = {
    dueToday: { count: 0, amount: 0, invoices: [] },
    dueWithin3Days: { count: 0, amount: 0, invoices: [] },
    dueWithin7Days: { count: 0, amount: 0, invoices: [] },
    dueWithin30Days: { count: 0, amount: 0, invoices: [] },
    dueLater: { count: 0, amount: 0, invoices: [] }
  };

  const overdueList = [];
  const processedInvoices = [];
  const lowConfidenceList = [];

  rawInvoices.forEach(function(row, idx) {
    const invoiceId = String(row[0] || "").trim();
    if (!invoiceId) return; // Skip empty row

    totalRecordedCount++;

    const vendorName = String(row[1] || "Unknown Vendor").trim();
    const vendorEmail = String(row[2] || "").trim();
    const invoiceDateRaw = row[3];
    const dueDateRaw = row[4];
    const currency = String(row[5] || "INR").trim();
    const subtotal = Number(row[6] || 0);
    const tax = Number(row[7] || 0);
    const totalAmount = Number(row[8] || 0);
    const poNumber = String(row[9] || "").trim();
    const invoiceFileUrl = String(row[10] || "").trim();
    const gmailMessageId = String(row[11] || "").trim();
    const duplicateKey = String(row[12] || "").trim();
    const approvalStatus = String(row[13] || "PENDING").trim().toUpperCase();
    const paymentStatus = String(row[14] || "UNPAID").trim().toUpperCase();
    const confidence = Number(row[15] !== "" && !isNaN(row[15]) ? row[15] : 0.85);
    const processedAtRaw = row[16];
    const errorMessage = String(row[17] || "").trim();

    totalRecordedAmount += totalAmount;
    confidenceSum += confidence;

    // Dates normalization
    const invoiceDateObj = parseDateValue(invoiceDateRaw);
    const dueDateObj = parseDateValue(dueDateRaw);
    const invoiceDateStr = formatDateOutput(invoiceDateObj, false);
    const dueDateStr = formatDateOutput(dueDateObj, false);

    // Days difference calculation
    let daysUntilDue = null;
    let isOverdue = false;
    let daysOverdue = 0;

    if (dueDateObj) {
      daysUntilDue = getCalendarDayDifference(today, dueDateObj);
      if (approvalStatus === "APPROVED" && paymentStatus === "UNPAID" && daysUntilDue < 0) {
        isOverdue = true;
        daysOverdue = Math.abs(daysUntilDue);
      }
    }

    // Flag low confidence
    if (confidence < 0.85) {
      lowConfidenceList.push({
        invoiceId: invoiceId,
        vendorName: vendorName,
        confidence: confidence,
        totalAmount: totalAmount
      });
    }

    // Monthly bucket grouping
    const monthKey = invoiceDateStr ? invoiceDateStr.substring(0, 7) : "Undated";
    if (!monthlyMap[monthKey]) {
      monthlyMap[monthKey] = {
        month: monthKey,
        paid: 0,
        outstanding: 0,
        rejected: 0,
        total: 0,
        count: 0
      };
    }
    monthlyMap[monthKey].count++;
    monthlyMap[monthKey].total += totalAmount;

    // Vendor bucket grouping
    if (!vendorMap[vendorName]) {
      vendorMap[vendorName] = {
        vendorName: vendorName,
        approvedSpend: 0,
        paidAmount: 0,
        outstandingAmount: 0,
        totalRecorded: 0,
        invoiceCount: 0
      };
    }
    vendorMap[vendorName].invoiceCount++;
    vendorMap[vendorName].totalRecorded += totalAmount;

    // Status-specific counters & rules
    if (approvalStatus === "PENDING") {
      pendingCount++;
      pendingAmount += totalAmount;
    } else if (approvalStatus === "APPROVED") {
      totalApprovedCount++;
      totalApprovedAmount += totalAmount;
      vendorMap[vendorName].approvedSpend += totalAmount;

      if (paymentStatus === "PAID") {
        paidCount++;
        paidAmount += totalAmount;
        monthlyMap[monthKey].paid += totalAmount;
        vendorMap[vendorName].paidAmount += totalAmount;
      } else {
        // APPROVED and UNPAID
        approvedUnpaidCount++;
        approvedUnpaidAmount += totalAmount;
        monthlyMap[monthKey].outstanding += totalAmount;
        vendorMap[vendorName].outstandingAmount += totalAmount;

        // Check if Overdue
        if (isOverdue) {
          overdueCount++;
          overdueAmount += totalAmount;
          overdueList.push({
            invoiceId: invoiceId,
            vendorName: vendorName,
            invoiceDate: invoiceDateStr,
            dueDate: dueDateStr,
            amount: totalAmount,
            currency: currency,
            daysOverdue: daysOverdue,
            paymentStatus: paymentStatus,
            invoiceFileUrl: invoiceFileUrl
          });
        }

        // Upcoming Obligations Buckets (only future or today)
        if (daysUntilDue !== null && daysUntilDue >= 0) {
          const obligationItem = {
            invoiceId: invoiceId,
            vendorName: vendorName,
            dueDate: dueDateStr,
            daysUntilDue: daysUntilDue,
            amount: totalAmount,
            currency: currency
          };

          if (daysUntilDue === 0) {
            obligations.dueToday.count++;
            obligations.dueToday.amount += totalAmount;
            obligations.dueToday.invoices.push(obligationItem);
          } else if (daysUntilDue <= 3) {
            obligations.dueWithin3Days.count++;
            obligations.dueWithin3Days.amount += totalAmount;
            obligations.dueWithin3Days.invoices.push(obligationItem);
          } else if (daysUntilDue <= 7) {
            obligations.dueWithin7Days.count++;
            obligations.dueWithin7Days.amount += totalAmount;
            obligations.dueWithin7Days.invoices.push(obligationItem);
          } else if (daysUntilDue <= 30) {
            obligations.dueWithin30Days.count++;
            obligations.dueWithin30Days.amount += totalAmount;
            obligations.dueWithin30Days.invoices.push(obligationItem);
          } else {
            obligations.dueLater.count++;
            obligations.dueLater.amount += totalAmount;
            obligations.dueLater.invoices.push(obligationItem);
          }
        }
      }

    } else if (approvalStatus === "REJECTED") {
      rejectedCount++;
      rejectedAmount += totalAmount;
      monthlyMap[monthKey].rejected += totalAmount;
    }

    // Normalized row for frontend table
    processedInvoices.push({
      rowNumber: idx + 2,
      invoiceId: invoiceId,
      vendorName: vendorName,
      vendorEmail: vendorEmail,
      invoiceDate: invoiceDateStr,
      dueDate: dueDateStr,
      currency: currency,
      subtotal: subtotal,
      tax: tax,
      totalAmount: totalAmount,
      poNumber: poNumber,
      invoiceFileUrl: invoiceFileUrl,
      gmailMessageId: gmailMessageId,
      duplicateKey: duplicateKey,
      approvalStatus: approvalStatus,
      paymentStatus: paymentStatus,
      extractionConfidence: confidence,
      processedAt: formatDateOutput(processedAtRaw, true),
      errorMessage: errorMessage,
      daysUntilDue: daysUntilDue,
      isOverdue: isOverdue,
      daysOverdue: daysOverdue
    });
  });

  // Calculate actual total paid from Payment_Log for cross-reconciliation
  let actualLogPaidAmount = 0;
  rawPayments.forEach(function(r) {
    actualLogPaidAmount += Number(r[2] || 0);
  });

  // Format monthly statistics sorted chronologically
  const monthlyStats = Object.keys(monthlyMap).sort().map(function(key) {
    return monthlyMap[key];
  });

  // Format vendor statistics sorted descending by approved spend
  const vendorStats = Object.keys(vendorMap).map(function(key) {
    const v = vendorMap[key];
    const totalApp = totalApprovedAmount > 0 ? totalApprovedAmount : 1;
    v.shareOfApprovedSpend = Math.round((v.approvedSpend / totalApp) * 1000) / 10;
    return v;
  }).sort(function(a, b) {
    return b.approvedSpend - a.approvedSpend;
  });

  // Average confidence
  const avgConfidence = totalRecordedCount > 0
    ? Math.round((confidenceSum / totalRecordedCount) * 100) / 100
    : 0;

  // Confidence distribution
  const confidenceDistribution = {
    high: 0,    // >= 0.90
    medium: 0,  // 0.75 - 0.89
    low: 0      // < 0.75
  };

  processedInvoices.forEach(function(inv) {
    if (inv.extractionConfidence >= 0.90) confidenceDistribution.high++;
    else if (inv.extractionConfidence >= 0.75) confidenceDistribution.medium++;
    else confidenceDistribution.low++;
  });

  // Sort overdue invoices descending by days overdue (most urgent first)
  overdueList.sort(function(a, b) {
    return b.daysOverdue - a.daysOverdue;
  });

  // Construct operational notices & alerts
  const alerts = [];
  if (overdueCount > 0) {
    alerts.push({
      type: "DANGER",
      title: overdueCount + " Overdue Invoice" + (overdueCount > 1 ? "s" : ""),
      message: "Immediate action required: Total overdue liability is ₹" + overdueAmount.toLocaleString("en-IN") + ".",
      count: overdueCount
    });
  }
  if (pendingCount > 0) {
    alerts.push({
      type: "WARNING",
      title: pendingCount + " Invoice" + (pendingCount > 1 ? "s" : "") + " Awaiting Approval",
      message: "Pending manager sign-off: Total pending value is ₹" + pendingAmount.toLocaleString("en-IN") + ".",
      count: pendingCount
    });
  }
  if (obligations.dueWithin3Days.count > 0) {
    alerts.push({
      type: "INFO",
      title: obligations.dueWithin3Days.count + " Payment" + (obligations.dueWithin3Days.count > 1 ? "s" : "") + " Due Soon",
      message: "Liabilities due in 3 days or less: ₹" + obligations.dueWithin3Days.amount.toLocaleString("en-IN") + ".",
      count: obligations.dueWithin3Days.count
    });
  }

  return {
    kpis: {
      totalInvoices: totalRecordedCount,
      totalRecordedValue: totalRecordedAmount,
      totalInvoiceValue: totalApprovedAmount + pendingAmount, // Total valid (excluding rejected)
      approvedInvoiceValue: totalApprovedAmount,
      pendingApprovals: pendingCount,
      pendingAmount: pendingAmount,
      approvedInvoices: totalApprovedCount,
      rejectedInvoices: rejectedCount,
      rejectedAmount: rejectedAmount,
      paidInvoices: paidCount,
      totalPaidAmount: paidAmount,
      reconciledLogPaidAmount: actualLogPaidAmount,
      approvedUnpaidInvoices: approvedUnpaidCount,
      outstandingAmount: approvedUnpaidAmount,
      overdueInvoices: overdueCount,
      overdueAmount: overdueAmount,
      averageConfidence: avgConfidence
    },
    invoices: processedInvoices,
    approvalHistory: approvalHistory,
    paymentHistory: paymentHistory,
    monthlyStats: monthlyStats,
    vendorStats: vendorStats,
    overdueList: overdueList,
    upcomingObligations: obligations,
    confidenceStats: {
      averageConfidence: avgConfidence,
      distribution: confidenceDistribution,
      lowConfidenceInvoices: lowConfidenceList
    },
    alerts: alerts,
    metadata: {
      generatedAt: new Date().toISOString(),
      timezone: CONFIG.TIMEZONE,
      todayStr: todayStr,
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      currency: "INR"
    }
  };
}


/**
 * Helper to safely format dates into ISO string (YYYY-MM-DD) or human-readable format.
 *
 * @param {Date|string} dateVal
 * @param {boolean} includeTime
 * @return {string}
 */
function formatDateOutput(dateVal, includeTime) {
  if (!dateVal) return "";
  const d = parseDateValue(dateVal);
  if (!d) return String(dateVal);

  const format = includeTime ? "dd MMM yyyy, HH:mm" : "yyyy-MM-dd";
  try {
    return Utilities.formatDate(d, CONFIG.TIMEZONE, format);
  } catch (err) {
    return String(dateVal);
  }
}


/**
 * Approves an invoice from the dashboard UI.
 * Reuses the existing updateInvoiceApproval function to preserve validation, locking, and audit logs.
 *
 * @param {string} invoiceId
 * @param {string} reason
 * @return {Object}
 */
function approveInvoiceFromDashboard(invoiceId, reason) {
  if (!invoiceId) throw new Error("Invoice ID is required.");
  const note = String(reason || "Approved via Executive Dashboard").trim();
  return updateInvoiceApproval(invoiceId, "APPROVED", note);
}


/**
 * Rejects an invoice from the dashboard UI.
 * Reuses updateInvoiceApproval with strict rejection reason validation.
 *
 * @param {string} invoiceId
 * @param {string} reason
 * @return {Object}
 */
function rejectInvoiceFromDashboard(invoiceId, reason) {
  if (!invoiceId) throw new Error("Invoice ID is required.");
  const trimmedReason = String(reason || "").trim();
  if (!trimmedReason) {
    throw new Error("A rejection reason is strictly required.");
  }
  return updateInvoiceApproval(invoiceId, "REJECTED", trimmedReason);
}


/**
 * Records an invoice payment from the dashboard UI.
 * Reuses recordInvoicePayment to enforce validation, locking, and Payment_Log audit integrity.
 *
 * @param {string} invoiceId
 * @param {string} paymentDate
 * @param {string} paymentReference
 * @return {Object}
 */
function recordPaymentFromDashboard(invoiceId, paymentDate, paymentReference) {
  if (!invoiceId) throw new Error("Invoice ID is required.");
  if (!paymentDate) throw new Error("Payment date is required.");
  if (!paymentReference) throw new Error("Payment reference is required.");

  return recordInvoicePayment(invoiceId, paymentDate, paymentReference);
}
