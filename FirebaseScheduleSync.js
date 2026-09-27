/**
 * FIREBASE SCHEDULE SYNC SCRIPT
 * 
 * Instructions:
 * 1. Open your "SCH data base" Google Sheet.
 * 2. Click Extensions > Apps Script.
 * 3. Add a NEW file by clicking the "+" next to Files and choosing "Script". Name it "FirebaseScheduleSync".
 * 4. Paste this entire code into FirebaseScheduleSync.gs.
 * 5. Save the project (Ctrl+S).
 * 6. To do the first bulk upload, select the `bulkSyncScheduleToFirebase` function at the top menu and click "Run". 
 * 7. To make it automatic, go to Triggers (alarm clock icon).
 * 8. Click "Add Trigger".
 *    - Choose function to run: `bulkSyncScheduleToFirebase`
 *    - Choose deployment: `Head`
 *    - Select event source: `Time-driven`
 *    - Select type of time based trigger: `Minutes timer`
 *    - Select minute interval: `Every minute` (or Every 5 minutes)
 * 9. Click Save. 
 */

var FIREBASE_SYNC_URL = "https://coachdatawebapp-default-rtdb.firebaseio.com";
var FIREBASE_SCH_SHEET_NAME = "all rake schedule";

function fb_formatVal(val) {
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    return val.getFullYear() + '-' + String(val.getMonth() + 1).padStart(2, '0') + '-' + String(val.getDate()).padStart(2, '0');
  }
  return val;
}

function fb_sanitizeKey(key) {
  if (!key) return "Empty_Key";
  return String(key).replace(/[\.\#\$\/\[\]]/g, "");
}

function bulkSyncScheduleToFirebase() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FIREBASE_SCH_SHEET_NAME);
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  if (data.length < 3) return;

  const headers = data[1]; // Row 2 headers
  const firebaseData = { coaches: {} };

  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    const coachNo = String(row[8]).trim();
    if (!coachNo) continue;

    const resultObj = {};
    for (let j = 0; j < headers.length; j++) {
      if (headers[j]) {
        resultObj[fb_sanitizeKey(headers[j])] = fb_formatVal(row[j]);
      }
    }
    
    // Explicit standard fields expected by frontend
    const safeCoachNo = fb_sanitizeKey(coachNo);
    resultObj['COACH NO'] = safeCoachNo;
    resultObj['D 2'] = fb_formatVal(row[12]);
    resultObj['D 3'] = fb_formatVal(row[13]);
    resultObj['L1'] = fb_formatVal(row[19]);
    resultObj['R8'] = fb_formatVal(row[20]);
    resultObj['L2'] = fb_formatVal(row[21]);
    resultObj['R7'] = fb_formatVal(row[22]);
    resultObj['L3'] = fb_formatVal(row[23]);
    resultObj['R6'] = fb_formatVal(row[24]);
    resultObj['L4'] = fb_formatVal(row[25]);
    resultObj['R5'] = fb_formatVal(row[26]);
    resultObj['stiffener plate PP end'] = fb_formatVal(row[27]);
    resultObj['stiffener plate NPP end'] = fb_formatVal(row[28]);
    resultObj['CBC Make'] = fb_formatVal(row[29]);
    resultObj['ATTENTION GIVEN IF ANY'] = fb_formatVal(row[30]);
    resultObj['Staff Token Number'] = fb_formatVal(row[37]);
    
    // Additional fields for due computation locally on the frontend
    resultObj['_pit1'] = fb_formatVal(row[fb_findIdx(headers, 'next pit check date 1')]);
    resultObj['_pit2'] = fb_formatVal(row[fb_findIdx(headers, 'next pit check date 2')]);
    resultObj['_d2'] = fb_formatVal(row[fb_findIdx(headers, 'd2 due')]);
    resultObj['_d3'] = fb_formatVal(row[fb_findIdx(headers, 'd3 due')]);
    resultObj['_rly'] = row[0] || '-';
    resultObj['_type'] = row[1] || '-';
    resultObj['_trainNo'] = row[4] || '-';
    resultObj['_rowIndex'] = i + 1;
    resultObj['_rawRow'] = row.map(fb_formatVal);

    firebaseData.coaches[safeCoachNo] = resultObj;
  }

  const options = {
    method: 'put',
    contentType: 'application/json',
    payload: JSON.stringify(firebaseData)
  };
  
  UrlFetchApp.fetch(FIREBASE_SYNC_URL + "/schedule.json", options);
}

function fb_findIdx(headers, headerName) {
  const lowerName = headerName.toLowerCase();
  for (let j = 0; j < headers.length; j++) {
    if (String(headers[j]).toLowerCase().includes(lowerName)) return j;
  }
  return -1;
}
