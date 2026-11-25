
/**
 * GEMINI SERVICE
 * Handles Gemini API communication and invoice PDF extraction.
 *
 * Features:
 * 1. Secure API key retrieval from Script Properties.
 * 2. Gemini API connection testing.
 * 3. PDF invoice data extraction.
 * 4. Automatic retry for temporary API failures.
 * 5. JSON response validation.
 */


/**
 * Gemini configuration.
 */
const GEMINI_CONFIG = {
  MODEL: "gemini-2.5-flash",
  API_URL: "https://generativelanguage.googleapis.com/v1beta/models/",
  TEMPERATURE: 0.1,
  MAX_RETRIES: 3,
  INITIAL_RETRY_DELAY_MS: 2000
};


/**
 * Retrieves the Gemini API key securely.
 *
 * @return {string} Gemini API key.
 */
function getGeminiApiKey() {
  const apiKey = PropertiesService
    .getScriptProperties()
    .getProperty("GEMINI_API_KEY");

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is missing from Apps Script Script Properties."
    );
  }

  return apiKey;
}


/**
 * Builds the Gemini API endpoint.
 *
 * @return {string} Gemini API URL.
 */
function getGeminiApiUrl() {
  return GEMINI_CONFIG.API_URL +
    GEMINI_CONFIG.MODEL +
    ":generateContent";
}


/**
 * Sends a request to Gemini with automatic retry handling.
 *
 * Retries temporary errors:
 * 429 - Too many requests
 * 500 - Internal server error
 * 502 - Bad gateway
 * 503 - Service unavailable
 * 504 - Gateway timeout
 *
 * @param {Object} payload Gemini request payload.
 * @return {Object} Parsed Gemini API response.
 */
function callGeminiWithRetry(payload) {
  const apiKey = getGeminiApiKey();
  const url = getGeminiApiUrl();

  const retryableStatusCodes = [
    429,
    500,
    502,
    503,
    504
  ];

  let response;
  let statusCode;
  let responseBody;

  for (
    let attempt = 1;
    attempt <= GEMINI_CONFIG.MAX_RETRIES;
    attempt++
  ) {
    console.log(
      "Gemini API request attempt:",
      attempt,
      "of",
      GEMINI_CONFIG.MAX_RETRIES
    );

    try {
      response = UrlFetchApp.fetch(url, {
        method: "post",
        contentType: "application/json",
        headers: {
          "x-goog-api-key": apiKey
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });

      statusCode = response.getResponseCode();
      responseBody = response.getContentText();

      console.log("Gemini HTTP status:", statusCode);

      // Successful response.
      if (statusCode === 200) {
        try {
          return JSON.parse(responseBody);
        } catch (parseError) {
          throw new Error(
            "Gemini returned an invalid JSON response: " +
            parseError.message
          );
        }
      }

      // Do not retry permanent errors.
      if (retryableStatusCodes.indexOf(statusCode) === -1) {
        console.error("Gemini API error:", responseBody);

        throw new Error(
          "Gemini API request failed. HTTP status: " +
          statusCode +
          ". Response: " +
          responseBody
        );
      }

      console.warn(
        "Temporary Gemini API failure:",
        statusCode
      );

      // Wait before retrying.
      if (attempt < GEMINI_CONFIG.MAX_RETRIES) {
        const delay =
          GEMINI_CONFIG.INITIAL_RETRY_DELAY_MS *
          Math.pow(2, attempt - 1);

        console.log(
          "Retrying Gemini API after",
          delay,
          "milliseconds."
        );

        Utilities.sleep(delay);
      }

    } catch (error) {
      // Preserve errors that should not be retried.
      if (
        error.message.indexOf("HTTP status:") !== -1 ||
        error.message.indexOf("invalid JSON response") !== -1
      ) {
        throw error;
      }

      // Retry unexpected network/request errors.
      console.error(
        "Gemini request error on attempt " + attempt + ":",
        error.message
      );

      if (attempt === GEMINI_CONFIG.MAX_RETRIES) {
        throw error;
      }

      const delay =
        GEMINI_CONFIG.INITIAL_RETRY_DELAY_MS *
        Math.pow(2, attempt - 1);

      Utilities.sleep(delay);
    }
  }

  throw new Error(
    "Gemini API failed after " +
    GEMINI_CONFIG.MAX_RETRIES +
    " attempts. Last HTTP status: " +
    statusCode +
    ". Response: " +
    responseBody
  );
}


/**
 * Tests secure access to the Gemini API.
 *
 * @return {string} Gemini response.
 */
function testGeminiConnection() {
  const payload = {
    contents: [{
      parts: [{
        text: "Reply with exactly: Gemini connection successful."
      }]
    }],
    generationConfig: {
      temperature: GEMINI_CONFIG.TEMPERATURE
    }
  };

  const result = callGeminiWithRetry(payload);

  const reply =
    result.candidates &&
    result.candidates[0] &&
    result.candidates[0].content &&
    result.candidates[0].content.parts &&
    result.candidates[0].content.parts[0]
      ? result.candidates[0].content.parts[0].text
      : null;

  if (!reply) {
    throw new Error(
      "Gemini connection test returned no usable text."
    );
  }

  console.log("Gemini response:", reply);
  console.log("SUCCESS: Gemini API connection verified!");

  return reply;
}


/**
 * Extracts structured invoice information from a PDF in Google Drive.
 *
 * @param {string} fileId Google Drive PDF file ID.
 * @return {Object} Extracted invoice data.
 */
function extractInvoiceData(fileId) {
  if (!fileId) {
    throw new Error("A Google Drive file ID is required.");
  }

  // Retrieve the PDF from Google Drive.
  const file = DriveApp.getFileById(fileId);
  const pdfBlob = file.getBlob();

  if (pdfBlob.getContentType() !== "application/pdf") {
    throw new Error("The supplied Drive file is not a PDF.");
  }

  const pdfBytes = pdfBlob.getBytes();

  if (pdfBytes.length === 0) {
    throw new Error("The supplied PDF file is empty.");
  }

  const base64Pdf = Utilities.base64Encode(pdfBytes);

  console.log("Invoice PDF loaded:", file.getName());
  console.log("PDF size (bytes):", pdfBytes.length);

  // Invoice extraction instructions.
  const prompt = `
You are an invoice data extraction assistant.

Read the attached invoice PDF and extract the requested information.

Return ONLY a valid JSON object with these exact keys:

{
  "invoice_id": "string or null",
  "vendor_name": "string or null",
  "vendor_email": "string or null",
  "invoice_date": "YYYY-MM-DD or null",
  "due_date": "YYYY-MM-DD or null",
  "currency": "three-letter currency code or null",
  "subtotal": "number or null",
  "tax": "number or null",
  "total_amount": "number or null",
  "po_number": "string or null",
  "extraction_confidence": "number between 0 and 1"
}

Rules:
1. Extract only information actually present in the document.
2. Do not invent missing values. Use null when a value is unavailable.
3. Convert dates into YYYY-MM-DD format.
4. Return monetary amounts as numbers, without currency symbols.
5. Use the three-letter currency code when identifiable.
6. The tax field should represent the total tax amount.
7. Do not calculate or guess missing invoice values.
8. Set extraction_confidence to an overall estimate between 0 and 1.
9. Return JSON only. Do not include Markdown or explanations.
`;

  // Construct Gemini request.
  const payload = {
    contents: [{
      parts: [
        {
          inline_data: {
            mime_type: "application/pdf",
            data: base64Pdf
          }
        },
        {
          text: prompt
        }
      ]
    }],
    generationConfig: {
      temperature: GEMINI_CONFIG.TEMPERATURE,
      responseMimeType: "application/json"
    }
  };

  // Call Gemini with retry handling.
  const result = callGeminiWithRetry(payload);

  // Check whether Gemini returned a usable candidate.
  if (
    !result.candidates ||
    !result.candidates[0] ||
    !result.candidates[0].content ||
    !result.candidates[0].content.parts
  ) {
    const reason =
      result.promptFeedback &&
      result.promptFeedback.blockReason
        ? result.promptFeedback.blockReason
        : "No usable candidate returned.";

    throw new Error(
      "Gemini returned no usable extraction result. " + reason
    );
  }

  // Combine response text.
  const extractedText = result.candidates[0]
    .content
    .parts
    .map(function(part) {
      return part.text || "";
    })
    .join("")
    .trim();

  if (!extractedText) {
    throw new Error("Gemini returned an empty extraction response.");
  }

  // Parse structured JSON.
  let invoiceData;

  try {
    invoiceData = JSON.parse(extractedText);
  } catch (error) {
    console.error("Invalid extraction JSON:", extractedText);

    throw new Error(
      "Could not parse Gemini invoice JSON: " +
      error.message
    );
  }

  // Verify the expected fields exist.
  const requiredKeys = [
    "invoice_id",
    "vendor_name",
    "vendor_email",
    "invoice_date",
    "due_date",
    "currency",
    "subtotal",
    "tax",
    "total_amount",
    "po_number",
    "extraction_confidence"
  ];

  requiredKeys.forEach(function(key) {
    if (
      !Object.prototype.hasOwnProperty.call(invoiceData, key)
    ) {
      throw new Error(
        "Missing extraction field: " + key
      );
    }
  });

  console.log("INVOICE EXTRACTION SUCCESSFUL");
  console.log("Extracted invoice data:");
  console.log(JSON.stringify(invoiceData, null, 2));

  return invoiceData;
}
