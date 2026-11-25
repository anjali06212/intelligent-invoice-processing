
/**
 * GMAIL SERVICE
 * Finds labelled invoice emails and saves PDF attachments to Drive.
 */

/**
 * Tests Gmail access and checks for the invoice label.
 */
function testGmailConnection() {

  const labelName = "INVOICE_TO_PROCESS";

  const label = GmailApp.getUserLabelByName(labelName);

  if (!label) {
    throw new Error("Gmail label not found: " + labelName);
  }

  console.log("Gmail account:", Session.getActiveUser().getEmail());
  console.log("Label found:", label.getName());
  console.log("SUCCESS: Gmail connection verified!");

  return true;
}


/**
 * Retrieves PDF attachments from labelled invoice emails.
 * Saves them in the configured Raw Invoices Drive folder.
 */
function fetchInvoiceAttachments() {

  const labelName = "INVOICE_TO_PROCESS";

  const label = GmailApp.getUserLabelByName(labelName);

  if (!label) {
    throw new Error("Gmail label not found: " + labelName);
  }

  const rawFolder = DriveApp.getFolderById(
    CONFIG.DRIVE_FOLDERS.RAW_INVOICES
  );

  const threads = label.getThreads(0, 50);

  let savedCount = 0;
  let skippedCount = 0;
  let nonPdfCount = 0;

  console.log("Invoice email threads found:", threads.length);

  threads.forEach(function(thread) {

    const messages = thread.getMessages();

    messages.forEach(function(message) {

      const messageId = message.getId();
      const subject = message.getSubject();

      const attachments = message.getAttachments({
        includeInlineImages: false,
        includeAttachments: true
      });

      console.log("Processing email:", subject);
      console.log("Gmail Message ID:", messageId);
      console.log("Attachments found:", attachments.length);

      attachments.forEach(function(attachment, index) {

        const originalName = attachment.getName() || "attachment";

        const contentType = attachment.getContentType();

        const isPdf =
          contentType === "application/pdf" ||
          originalName.toLowerCase().endsWith(".pdf");

        if (!isPdf) {
          nonPdfCount++;
          console.log("Skipped non-PDF attachment:", originalName);
          return;
        }

        const safeName = originalName.replace(
          /[^a-zA-Z0-9._-]/g,
          "_"
        );

        const fileName =
          messageId + "_" + (index + 1) + "_" + safeName;

        // Prevent duplicate files when the function is rerun.
        const existingFiles = rawFolder.getFilesByName(fileName);

        if (existingFiles.hasNext()) {
          skippedCount++;
          console.log("Already saved:", fileName);
          return;
        }

        const blob = attachment.copyBlob();
        blob.setName(fileName);

        const savedFile = rawFolder.createFile(blob);

        savedCount++;

        console.log("PDF saved successfully!");
        console.log("File name:", savedFile.getName());
        console.log("Drive File ID:", savedFile.getId());
        console.log("Drive URL:", savedFile.getUrl());

      });

    });

  });

  console.log("--------------------------------");
  console.log("GMAIL ATTACHMENT RETRIEVAL SUMMARY");
  console.log("New PDFs saved:", savedCount);
  console.log("Already saved:", skippedCount);
  console.log("Non-PDF attachments skipped:", nonPdfCount);
  console.log("Threads checked:", threads.length);
  console.log("--------------------------------");

  return {
    saved: savedCount,
    skipped: skippedCount,
    nonPdf: nonPdfCount,
    threads: threads.length
  };

}

function diagnoseGmailSearch() {

  const labelName = "INVOICE_TO_PROCESS";

  console.log(
    "Active account:",
    Session.getActiveUser().getEmail()
  );

  // Test 1: Find the Gmail label
  const label = GmailApp.getUserLabelByName(labelName);

  console.log("Label exists:", label !== null);

  if (label) {
    const labelThreads = label.getThreads(0, 50);
    console.log(
      "Threads returned by label:",
      labelThreads.length
    );
  }

  // Test 2: Search Gmail directly
  const query = "in:anywhere label:INVOICE_TO_PROCESS";
  const searchThreads = GmailApp.search(query, 0, 50);

  console.log(
    "Threads returned by Gmail search:",
    searchThreads.length
  );

  searchThreads.forEach(function(thread) {

    console.log("Subject:", thread.getFirstMessageSubject());
    console.log("Message count:", thread.getMessageCount());

  });

  console.log("GMAIL DIAGNOSTIC COMPLETED");

}

function diagnoseInvoiceEmail() {

  const queries = [
    "label:INVOICE_TO_PROCESS",
    "in:anywhere label:INVOICE_TO_PROCESS",
    'subject:"Invoice INV-2026-001"',
    "in:anywhere subject:INV-2026-001",
    "newer_than:1d"
  ];

  queries.forEach(function(query) {

    const results = GmailApp.search(query, 0, 20);

    console.log("Query:", query);
    console.log("Results:", results.length);

    results.forEach(function(thread) {
      console.log(
        "Subject:",
        thread.getFirstMessageSubject()
      );
    });

  });

  const labels = GmailApp.getUserLabels();

  console.log("Available labels:");

  labels.forEach(function(label) {
    console.log(label.getName());
  });

  console.log("DIAGNOSTIC COMPLETED");

}
