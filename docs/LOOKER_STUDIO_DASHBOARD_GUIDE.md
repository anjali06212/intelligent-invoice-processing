# Looker Studio Invoice Analytics Dashboard Specification & Setup Guide

This guide provides the complete blueprint for deploying the **Intelligent Invoice Processing & Payment Tracker Analytics Dashboard** in Looker Studio (formerly Google Data Studio) connected directly to the live Google Sheets database.

---

## 1. Data Source Configuration

- **Connector**: Google Sheets
- **Spreadsheet ID**: `1PJuZp1RDdUE7Be7KwOg0T2xKTM8Qnw_ku8lCFpkBTjs`
- **Worksheet**: `Invoices`
- **Options**:
  - [x] Use first row as headers
  - [x] Include hidden and filtered cells

---

## 2. Field Schema & Data Types

| Field Name | Type | Looker Studio Type | Role |
| :--- | :--- | :--- | :--- |
| `Invoice_ID` | Text | Text | Dimension |
| `Vendor_Name` | Text | Text | Dimension |
| `Vendor_Email` | Text | Text / Email | Dimension |
| `Invoice_Date` | Date (YYYY-MM-DD) | Date (YYYYMMDD) | Dimension |
| `Due_Date` | Date (YYYY-MM-DD) | Date (YYYYMMDD) | Dimension |
| `Currency` | Text | Text | Dimension |
| `Subtotal` | Currency/Number | Numeric (Currency USD/INR) | Metric |
| `Tax` | Currency/Number | Numeric (Currency USD/INR) | Metric |
| `Total_Amount` | Currency/Number | Numeric (Currency USD/INR) | Metric |
| `PO_Number` | Text | Text | Dimension |
| `Invoice_File_URL` | URL | URL | Dimension / Link |
| `Gmail_Message_ID` | Text | Text | Dimension |
| `Duplicate_Key` | Text | Text | Dimension |
| `Approval_Status` | Text | Text (`PENDING`, `APPROVED`, `REJECTED`) | Dimension |
| `Payment_Status` | Text | Text (`UNPAID`, `PAID`) | Dimension |
| `Extraction_Confidence` | Number (0.0-1.0) | Numeric (Percent) | Metric |
| `Processed_At` | Date & Time | Date Time | Dimension |
| `Error_Message` | Text | Text | Dimension |

---

## 3. Looker Studio Calculated Fields

Add the following Calculated Fields in Looker Studio Data Source Editor:

### 1. `Paid Amount`
Calculates the total monetary value of approved invoices that have been paid:
```sql
CASE
  WHEN Approval_Status = "APPROVED" AND Payment_Status = "PAID" THEN Total_Amount
  ELSE 0
END
```

### 2. `Outstanding Amount`
Calculates approved liabilities that remain unpaid:
```sql
CASE
  WHEN Approval_Status = "APPROVED" AND Payment_Status = "UNPAID" THEN Total_Amount
  ELSE 0
END
```

### 3. `Pending Approval Amount`
Calculates total value of invoices awaiting managerial sign-off:
```sql
CASE
  WHEN Approval_Status = "PENDING" THEN Total_Amount
  ELSE 0
END
```

### 4. `Is Overdue`
Binary flag indicating whether an approved unpaid invoice has passed its due date:
```sql
CASE
  WHEN Approval_Status = "APPROVED" AND Payment_Status = "UNPAID" AND Due_Date < CURRENT_DATE() THEN 1
  ELSE 0
END
```

### 5. `Overdue Amount`
Monetary value of overdue invoices:
```sql
CASE
  WHEN Approval_Status = "APPROVED" AND Payment_Status = "UNPAID" AND Due_Date < CURRENT_DATE() THEN Total_Amount
  ELSE 0
END
```

### 6. `Due Status Category`
Categorizes invoices into payment timeliness buckets:
```sql
CASE
  WHEN Payment_Status = "PAID" THEN "Paid"
  WHEN Approval_Status = "REJECTED" THEN "Rejected"
  WHEN Approval_Status = "PENDING" THEN "Awaiting Approval"
  WHEN Due_Date < CURRENT_DATE() THEN "Overdue"
  WHEN Due_Date <= DATE_ADD(CURRENT_DATE(), INTERVAL 3 DAY) THEN "Due in <= 3 Days"
  ELSE "Upcoming (> 3 Days)"
END
```

---

## 4. Dashboard Visual Layout & Components

### A. Top KPI Scorecards (8 Cards)

1. **Total Invoices**:
   - Metric: `Record Count` (Aggregation: `COUNT`)
   - Description: Total volume of processed invoices.

2. **Total Invoice Value**:
   - Metric: `Total_Amount` (Aggregation: `SUM`)
   - Filter: Exclude rejected (`Approval_Status != "REJECTED"`)

3. **Pending Approvals**:
   - Metric: `Record Count`
   - Filter: `Approval_Status = "PENDING"`

4. **Approved Invoices**:
   - Metric: `Record Count`
   - Filter: `Approval_Status = "APPROVED"`

5. **Paid Invoices**:
   - Metric: `Record Count`
   - Filter: `Payment_Status = "PAID"`

6. **Unpaid Invoices**:
   - Metric: `Record Count`
   - Filter: `Approval_Status = "APPROVED" AND Payment_Status = "UNPAID"`

7. **Overdue Invoices**:
   - Metric: `Is Overdue` (Aggregation: `SUM`)
   - Description: Invoices past due date needing immediate escalation.

8. **Total Paid Amount**:
   - Metric: `Paid Amount` (Aggregation: `SUM`)
   - Description: Total actual cash disbursed.

---

### B. Core Analytics Charts (6 Charts)

#### Chart 1: Monthly Invoice Spending
- **Type**: Time Series / Column Chart
- **Dimension**: `Invoice_Date` (Granularity: `Year Month`)
- **Metric**: `Total_Amount` (SUM)
- **Breakdown Dimension**: `Payment_Status`
- **Filter**: Exclude `Approval_Status = "REJECTED"`
- **Sort**: `Invoice_Date` Ascending

#### Chart 2: Invoice Count by Approval Status
- **Type**: Donut / Pie Chart
- **Dimension**: `Approval_Status` (`PENDING`, `APPROVED`, `REJECTED`)
- **Metric**: `Record Count`
- **Colors**:
  - `APPROVED`: Emerald Green (#10B981)
  - `PENDING`: Amber (#F59E0B)
  - `REJECTED`: Rose Red (#EF4444)

#### Chart 3: Invoice Count by Payment Status
- **Type**: Donut / Pie Chart
- **Dimension**: `Payment_Status` (`PAID`, `UNPAID`)
- **Metric**: `Record Count`
- **Filter**: `Approval_Status = "APPROVED"`
- **Colors**:
  - `PAID`: Indigo (#6366F1)
  - `UNPAID`: Coral (#F97316)

#### Chart 4: Vendor-wise Invoice Spending
- **Type**: Horizontal Bar Chart
- **Dimension**: `Vendor_Name`
- **Metric**: `Total_Amount` (SUM)
- **Filter**: `Approval_Status = "APPROVED"`
- **Sort**: `Total_Amount` Descending (Top 10 Vendors)

#### Chart 5: Overdue Invoice Distribution
- **Type**: Table with Heatmap Bars
- **Dimensions**: `Invoice_ID`, `Vendor_Name`, `Due_Date`
- **Metrics**: `Overdue Amount`, `Extraction_Confidence`
- **Filter**: `Is Overdue = 1`
- **Sort**: `Due_Date` Ascending (Most overdue first)

#### Chart 6: Upcoming Payment Obligations
- **Type**: Stacked Bar Chart / Timeline
- **Dimension**: `Due_Date` (Granularity: Day/Week)
- **Metric**: `Outstanding Amount`
- **Filter**: `Approval_Status = "APPROVED" AND Payment_Status = "UNPAID" AND Due_Date >= CURRENT_DATE()`
- **Sort**: `Due_Date` Ascending

---

## 5. Step-by-Step Manual Setup in Looker Studio

Follow these steps to deploy this dashboard in your Google account in under 5 minutes:

1. Navigate to [lookerstudio.google.com](https://lookerstudio.google.com).
2. Click **Create** > **Report**.
3. Select the **Google Sheets** connector.
4. Select spreadsheet: `1PJuZp1RDdUE7Be7KwOg0T2xKTM8Qnw_ku8lCFpkBTjs` and worksheet: `Invoices`. Click **Add**.
5. Click **Resource** > **Manage added data sources** > **Edit**.
6. Click **Add a Field** and paste the Calculated Field formulas from Section 3 above (`Paid Amount`, `Outstanding Amount`, `Is Overdue`, etc.). Click **Save** and **Done**.
7. Drag and configure the 8 KPI scorecards onto the top header band according to Section 4.A.
8. Add the 6 charts onto the canvas according to Section 4.B.
9. Add a **Date Range Control** at the top right set to `Invoice_Date`.
10. Click **View** to interact with the dashboard.
