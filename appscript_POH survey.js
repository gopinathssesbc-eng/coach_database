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

// Base Survey Headers (63)
const BASE_SURVEY_HEADERS = [
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

// Carriage Alteration Instructions (CAI) Headers (51)
const CAI_HEADERS = [
  "CAI - Retrofitment of additional water filling arrangement in LHB type coaches",
  "CAI - Standardization of water filling assembly for LHB type AC and including power car and SCN EOG coaches to avoid the problem of spillage of water on platform",
  "CAI - Modification for shifting of EPPFS from underslung to onboard",
  "CAI - Modification of foot operated valve fitted inside and outside to pressmatic type in LWACCNE coaches and Amrit Bharat coaches",
  "CAI - Retrofitment of NRV- 1/4\" in between the isolating cock and air filter regulator lubricator (AFRL) unit of EPPFS in LHB coach for preventing water ingress from EPPFS to air brake pipeline",
  "CAI - Retrofitment of metallic Y Strainer in SS water inlet line for the water pressurization system of EPPFS of MCF Specs MMDTS 19027 Rev-1 to Rev-3",
  "CAI - Provision of isolation cock in plumbing lines of FRP modular toilet",
  "CAI - Provision of locking strip with Hexogonal Head Screw to avoid loosening of Roof Ventilator in RCF made coaches",
  "CAI - Provision of protection cover over Passenger Emergency Alarm Pull Box in LHB coaches",
  "CAI - Tail Lamp Bracket on End wall of LHB SLR, Power Car & LVPH",
  "CAI - Replacement of catch arrangement of backrest cum berth in LFAC coaches",
  "CAI - Standardization of 2 Amp circuit breaker in FSDS system for IR AC Coaches",
  "CAI - Segregation of positive and negative cables in separate conduits for FSDSsystems",
  "CAI - Power supply from SBC panel for FSDS System.",
  "CAI - Standardized location for fitment of automatic FSDS system in AC coaches. (Partition of Linen Cabinet for FSDS)",
  "CAI - Retrofitment/fitment of aspiration type Automatic Smoke/Fire Detection with Alarm System in IR AC Coaches.",
  "CAI - Locking arrangement of isolating cock of FDAS in LHB AC coaches",
  "CAI - 100% conversion from manual to automatic FDSS/FSDS in pantry cars, power cars and AC Coaches.",
  "CAI - Integration of FSDS with Braking System in AC Coaches",
  "CAI - Revised wiring scheme for WSP system of LHB Coaches",
  "CAI - Standardized installation of WSP junction box & Speed sensor cables in LHB coaches",
  "CAI - Implementation of CAI regarding lavatory wash basin drain outlet pipe laying for waste water",
  "CAI - Provision of wire rope mechanism for QRV of DV in LHB coaches",
  "CAI - Projection of BP and FP metal pipe from headstock as specified",
  "CAI - Modification of Wheelset Earthing Equipment - Provision of double threaded Stainless steel insert in front cover and brush holder assembly mounting arrangement",
  "CAI - Covering of gap above doorway partitiion frame for LHB GS coaches",
  "CAI - Relocation of Chlorine filter in IR DRDO BioDigester in LHB type coaches",
  "CAI - Provision of additional brake indicator inside the coaches fitted with hand brake arrangement",
  "CAI - Provision of additional dirt collector in BP line before FIBA",
  "CAI - Implementation of modified Pneumatic Piping arrangement to relocate ACP isolation cock / valve in order to make it accessible with in a hand-stretch distance",
  "CAI - Change of material of vestibule footplate to AISI304 in LHB Type Coaches (RCF Built)",
  "CAI - LHB coaches with provision of TPU rings in suspension arrangements.",
  "CAI - Material specification altered from MS to Stainless steel for Foot plates (ICF Built)",
  "CAI - Additional lifting pad blocks to be welded adjacent ot the existing lifting pad in underframe",
  "CAI - Modification of primary suspension of LWACCN coaches",
  "CAI - Installation of lookout glass for DETC/US observation window",
  "CAI - Closing of louvre of cab door in DTC of Vande Bharat, to prevent entry of outside air",
  "CAI - Provision of space for parking of Serving Trolley Arrangement except DTC coaches",
  "CAI - Replacement of valves in water pipeline (suction and supply line) USBRL Coaches",
  "CAI - Provision of mesh cover on the reservoir of the brake panel in LHB coaches",
  "CAI - Improvement in Reliability of Stiffener plate to prevent blanking",
  "CAI - Provision of locking arrangement in saloon sliding door of LHB 1st AC coach - swivel type lock",
  "CAI - Door handle set & latch indicators arrangement replacement work in all lavatory doors",
  "CAI - Ensuring provision of tertiary locking pin arrangement in AAR H type tight lock CBC with BDG",
  "CAI - Closing of holes around plumbing pipeline in Underframe for modular toilet and pantry equipments",
  "CAI - Retro fitment /fitment of Aspiration type Automatic FDAS in IR AC coaches to RDSO spec no. RDSO-2008-CG-04 (Rev. 5)",
  "CAI - Provision of additional foldable berth in Non-LHB (ICF) AC coaches",
  "CAI - SAE 100 R3 type hose pipes in place of SAE 100 R1 AT (less flexible) to be used",
  "CAI - Provision of Dog Box in guard room of LHB power car coaches",
  "CAI - Provision of FRP cover sheet to avoid passing of waste material outside of dust bin area between attachment wall and modular wall near outside wash basin area",
  "CAI - Modification in AEFG2 WSP system of Ms FTRTIPL make of LHB coaches"
];

// Complete Survey Column Headers (114 Total)
const SURVEY_HEADERS = BASE_SURVEY_HEADERS.concat(CAI_HEADERS);

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
      // Check CAI prefix fallback
      if (header.startsWith("CAI - ")) {
        const stripped = header.substring(6);
        if (payload[stripped] !== undefined && payload[stripped] !== null) {
          return String(payload[stripped]).trim();
        }
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
