
/**
 * Tests access to all configured Google Drive folders.
 */

function testDriveConnection() {

  const folders = CONFIG.DRIVE_FOLDERS;

  const folderNames = {
    RAW_INVOICES: "01_Raw_Invoices",
    PROCESSED_INVOICES: "02_Processed_Invoices",
    APPROVAL_RECORDS: "03_Approval_Records",
    REPORTS: "04_Reports"
  };

  try {

    Object.keys(folders).forEach(function(key) {

      const folderId = folders[key];

      const folder = DriveApp.getFolderById(folderId);

      console.log(
        "Accessible folder:",
        folderNames[key],
        "| ID:",
        folder.getId(),
        "| Name:",
        folder.getName()
      );

    });

    console.log("SUCCESS: All four Drive folders are accessible!");

    return true;

  } catch (error) {

    console.error("Drive connection failed:", error.message);

    throw error;

  }

}
