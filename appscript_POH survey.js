/**
 * =========================================================================
 * GOOGLE APPS SCRIPT FOR SS2 / POH COACH SURVEY
 * File: appscript_POH survey.js
 * =========================================================================
 * 
 * Instructions for Deploying this Google Apps Script:
 * 1. Open Google Sheets (create a new Google Sheet named "SS2 POH Survey Database" or use existing).
 * 2. Click Extensions > Apps Script in the menu bar.
 * 3. Delete any default code in Code.gs, and paste this entire file content.
 * 4. Paste your Google Sheet ID into SPREADSHEET_ID below (or leave blank if container-bound).
 * 5. Click "Save" (Ctrl+S).
 * 6. Click "Deploy" > "New deployment".
 * 7. Click the gear icon next to "Select type" and choose "Web app".
 * 8. Enter Description: "SS2 POH Survey API v1".
 * 9. Execute as: "Me" (your email address).
 * 10. Who has access: "Anyone".
 * 11. Click "Deploy", review/grant Google permissions if asked.
 * 12. Copy the resulting "Web app URL" (ending in /exec).
 * 13. In the Coach Database web app, open the SS2/POH Survey screen and enter this URL into settings,
 *     or set it in app.js as POH_SURVEY_APPS_SCRIPT_URL.
 */

// --- CONFIGURATION ---
// Paste your Google Sheet ID here (the long alphanumeric string between /d/ and /edit in your sheet URL)
// Example: "1a2b3c4d5e6f7g8h9i0j..."
const SPREADSHEET_ID = ""; 

// Target Sheet Tab Name inside the spreadsheet
const SHEET_NAME = "SS2_POH_Survey";

// Complete 63 Survey Column Headers in exact order
const SURVEY_HEADERS = [
  "Email address",
  "Timestamp",
  "RAILWAY",
  "COACH TYPE",
  "COACH NUMBER",
  "PU",
  "DOM/DOC",
  "SS2/SS3 SHOP",
  "RD",
  "TARE",
  "KMPH",
  "CCTV MAKE / number of CCTV",
  "DUAL WATER FILLING",
  "TYPE OF TOILET",
  "PFS MAKE",
  "PROVISION OF BYPASS ARRANGEMENT IN FLUSHING",
  "EPPFS/PPFS WATER PRESSURIZER LOCATION",
  "NRV IN FO LINE",
  "WASHBASIN DRAIN OUT PIPE MOD.",
  "RFID",
  "TYPE OF WATER REFILLING",
  "PROVISION OF PAPIS & STATUS",
  "HASP/SMOKE SAMPLING POINTS  LAVOTORY",
  "PROVISION OF VENTURI ARRAGEMENT",
  "FIRE DETECTION SYSTEM/FDSS MAKE",
  "FIRE SUPPSSION SYSTEM TYPE",
  "BRAKE VALVE",
  "PROVISION OF BRAILLE SIGNAGE",
  "TYPE OF WINDOW",
  "DOG BOX IN POWER CAR & SLRD",
  "PROVISION OF ODOUR CONTROL SYSTEM",
  "PROVISION OF ANY SMART MIRROR",
  "N2 CYLINDER OPERATION PROTECTION",
  "EMERGENCY WINDOW HANDLE",
  "ACP COVER",
  "RUBBER WASHER BETWEEN S TRAP AND COMMODE CHUTE",
  "BRAKE SYSTEM MAKE & DV N0",
  "TYPE OF SPRING SECONDARY SUSPENSION",
  "AIR SPRING MAKE & CAPACITY",
  "LEVELING VALVE MAKE",
  "FIBA PIPE LINE MODIFICATION IN UF",
  "TPU IN PS",
  "TPU IN SS",
  "PROVISION OF FIBA PIPE LINE R1 TO R3",
  "FIBA DC MODIFICATION",
  "BOGIE FRAME IDENTIFICATION BASED ON PRIMARY VERTICAL BUMP STOP HEIGHT",
  "FIBA MAKE",
  "WIRE ROPE MOD. FOR QRV",
  "AIRBRAKE HOSE MOD.",
  "CBC MAKE",
  "PROVISION OF TRANSITION COUPLING FOR LWLRRM",
  "PROVISION OF TERTIARY LOCKING PIN FOR CBC",
  "PROJECTION OF BP(140MM),FP(200MM)METAL PIPES FROM HEADSTOCK",
  "SPEED SENSOR J.B. ORIENTATION",
  "SPEED SENSOR J.B. ROUTING",
  "SS JB PROTECTION COVER MODIFICATION",
  "PROVISION OF MIL GRADE CONNECTOR",
  "MINI PANTRY",
  "FDS VESDA BEDROLL COMPARTMENT MOD.",
  "DEFICIENCY IF ANY",
  "ANY NEW FEATURE",
  "REMARKS",
  "SS2/SS3 Date"
];

/**
 * Get active spreadsheet object (either bound or standalone via ID)
 */
function getTargetSpreadsheet(optionalSheetId) {
  const id = optionalSheetId || SPREADSHEET_ID;
  if (id && String(id).trim() !== "") {
    return SpreadsheetApp.openById(String(id).trim());
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Get or create the survey sheet and ensure headers exist
 */
function getOrCreateSurveySheet(doc) {
  let sheet = doc.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = doc.insertSheet(SHEET_NAME);
  }

  // If sheet is empty or has no headers, insert header row
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(SURVEY_HEADERS);
    // Format header row
    const headerRange = sheet.getRange(1, 1, 1, SURVEY_HEADERS.length);
    headerRange.setBackground("#be185d");
    headerRange.setFontColor("#ffffff");
    headerRange.setFontWeight("bold");
    headerRange.setWrap(true);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Handle POST request - Save new SS2 / POH Survey record
 */
function doPost(e) {
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        payload = e.parameter || {};
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    const doc = getTargetSpreadsheet(payload.spreadsheetId);
    if (!doc) {
      return createJsonResponse({
        status: 'error',
        message: 'Could not access spreadsheet. Please verify SPREADSHEET_ID.'
      });
    }

    const sheet = getOrCreateSurveySheet(doc);

    // Build row values matching SURVEY_HEADERS
    const rowValues = SURVEY_HEADERS.map((header) => {
      // Auto-timestamp if not present
      if (header === "Timestamp") {
        return payload["Timestamp"] || payload["timestamp"] || Utilities.formatDate(new Date(), "Asia/Kolkata", "dd-MM-yyyy HH:mm:ss");
      }
      // Check direct header match
      if (payload[header] !== undefined && payload[header] !== null) {
        return String(payload[header]).trim();
      }
      // Check case-insensitive match
      const lowerHeader = header.toLowerCase().trim();
      for (const k of Object.keys(payload)) {
        if (k.toLowerCase().trim() === lowerHeader && payload[k] !== undefined && payload[k] !== null) {
          return String(payload[k]).trim();
        }
      }
      return "";
    });

    sheet.appendRow(rowValues);
    const newRowIndex = sheet.getLastRow();

    return createJsonResponse({
      status: 'success',
      message: 'SS2 / POH Survey recorded successfully.',
      rowIndex: newRowIndex,
      coachNumber: payload["COACH NUMBER"] || payload["coachNumber"] || "",
      timestamp: rowValues[1]
    });

  } catch (error) {
    return createJsonResponse({
      status: 'error',
      message: 'Failed to record survey: ' + error.toString()
    });
  }
}

/**
 * Handle GET request - Check status or query recent surveys
 */
function doGet(e) {
  try {
    const coachNo = e.parameter.coachNumber || e.parameter.coach;
    const action = e.parameter.action;

    const doc = getTargetSpreadsheet(e.parameter.spreadsheetId);
    if (!doc) {
      return createJsonResponse({
        status: 'error',
        message: 'Could not access spreadsheet. Please verify SPREADSHEET_ID.'
      });
    }

    const sheet = doc.getSheetByName(SHEET_NAME);
    if (!sheet) {
      return createJsonResponse({
        status: 'success',
        message: 'Sheet ready for first entry',
        data: []
      });
    }

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return createJsonResponse({
        status: 'success',
        message: 'No survey records logged yet',
        data: []
      });
    }

    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const records = [];

    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const record = { _rowIndex: i + 1 };
      for (let j = 0; j < headers.length; j++) {
        record[headers[j]] = row[j];
      }

      if (coachNo) {
        const rowCoach = String(record["COACH NUMBER"] || "").trim();
        if (rowCoach === String(coachNo).trim()) {
          records.push(record);
        }
      } else {
        records.push(record);
      }
    }

    return createJsonResponse({
      status: 'success',
      count: records.length,
      data: records
    });

  } catch (error) {
    return createJsonResponse({
      status: 'error',
      message: 'GET query failed: ' + error.toString()
    });
  }
}

/**
 * Standard CORS-enabled JSON response helper
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
