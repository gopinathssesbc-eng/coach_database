/**
 * Instructions for deploying this to Google Sheets:
 * 1. Open your Schedule Database Google Sheet.
 * 2. Click Extensions > Apps Script.
 * 3. Delete any code in the script editor and paste this entire code.
 * 4. Save the project (Ctrl+S).
 * 5. Click Deploy > New deployment.
 * 6. Select type: "Web app".
 * 7. Description: "Schedule Database API" (or similar).
 * 8. Execute as: "Me" (your email).
 * 9. Who has access: "Anyone".
 * 10. Click Deploy and authorize the app if prompted.
 * 11. Copy the "Web app URL" provided and paste it into app.js in your frontend project as SCHEDULE_APP_SCRIPT_URL.
 */

const SHEET_NAME = "all rake schedule";

function doGet(e) {
  const coachNumber = e.parameter.coachNumber;
  const coachNumbersStr = e.parameter.coachNumbers;
  
  if (!coachNumber && !coachNumbersStr) {
    return createJsonResponse({
      status: 'error',
      message: 'No coach number(s) provided.'
    });
  }

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      return createJsonResponse({
        status: 'error',
        message: 'Sheet "' + SHEET_NAME + '" not found.'
      });
    }

    const data = sheet.getDataRange().getValues();
    
    if (data.length < 3) {
      return createJsonResponse({
        status: 'error',
        message: 'Not enough data in the sheet.'
      });
    }

    const headers = data[1]; // Row 2 headers
    
    const parseRow = (row, index) => {
      const resultObj = {};
      for (let j = 0; j < headers.length; j++) {
        if (headers[j]) {
          resultObj[headers[j]] = row[j];
        }
      }
      resultObj['COACH NO.'] = row[8];
      resultObj['D 2'] = row[12];
      resultObj['D 3'] = row[13];
      resultObj['L1'] = row[19];
      resultObj['R8'] = row[20];
      resultObj['L2'] = row[21];
      resultObj['R7'] = row[22];
      resultObj['L3'] = row[23];
      resultObj['R6'] = row[24];
      resultObj['L4'] = row[25];
      resultObj['R5'] = row[26];
      resultObj['stiffener plate PP end'] = row[27];
      resultObj['stiffener plate NPP end'] = row[28];
      resultObj['ATTENTION GIVEN IF ANY'] = row[30];
      
      resultObj['_rowIndex'] = index + 1;
      resultObj['_rawRow'] = row;
      return resultObj;
    };

    if (coachNumbersStr) {
      const coachNumbers = coachNumbersStr.split(',').map(s => String(s).trim());
      const results = [];
      for (let i = 2; i < data.length; i++) {
        const rowCoachNo = String(data[i][8]).trim();
        if (coachNumbers.includes(rowCoachNo)) {
          results.push(parseRow(data[i], i));
        }
      }
      return createJsonResponse({
        status: 'success',
        data: results
      });
    } else {
      let foundRowIndex = -1;
      let matchRow = null;
      for (let i = 2; i < data.length; i++) {
        const rowCoachNo = String(data[i][8]).trim();
        if (rowCoachNo === String(coachNumber).trim()) {
          foundRowIndex = i;
          matchRow = data[i];
          break;
        }
      }

      if (foundRowIndex !== -1) {
        return createJsonResponse({
          status: 'success',
          data: parseRow(matchRow, foundRowIndex)
        });
      } else {
        return createJsonResponse({
          status: 'error',
          message: 'Coach not found'
        });
      }
    }

    
  } catch (error) {
    return createJsonResponse({
      status: 'error',
      message: 'Server error: ' + error.toString()
    });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    
    if (body.action === 'updateSchedule') {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
      
      if (!sheet) {
        return createJsonResponse({ status: 'error', message: 'Sheet not found' });
      }
      
      const rowIndex = body.rowIndex;
      
      if (!rowIndex) {
        return createJsonResponse({ status: 'error', message: 'Row index not provided' });
      }

      // Columns map (1-based index for getRange)
      // M: 13, N: 14, T: 20, U: 21, V: 22, W: 23, X: 24, Y: 25, Z: 26, AA: 27, AB: 28, AC: 29, AE: 31
      
      if (body.d2 !== undefined) sheet.getRange(rowIndex, 13).setValue(body.d2);
      if (body.d3 !== undefined) sheet.getRange(rowIndex, 14).setValue(body.d3);
      
      if (body.l1 !== undefined) sheet.getRange(rowIndex, 20).setValue(body.l1);
      if (body.r8 !== undefined) sheet.getRange(rowIndex, 21).setValue(body.r8);
      if (body.l2 !== undefined) sheet.getRange(rowIndex, 22).setValue(body.l2);
      if (body.r7 !== undefined) sheet.getRange(rowIndex, 23).setValue(body.r7);
      if (body.l3 !== undefined) sheet.getRange(rowIndex, 24).setValue(body.l3);
      if (body.r6 !== undefined) sheet.getRange(rowIndex, 25).setValue(body.r6);
      if (body.l4 !== undefined) sheet.getRange(rowIndex, 26).setValue(body.l4);
      if (body.r5 !== undefined) sheet.getRange(rowIndex, 27).setValue(body.r5);
      
      if (body.ppEnd !== undefined) sheet.getRange(rowIndex, 28).setValue(body.ppEnd);
      if (body.nppEnd !== undefined) sheet.getRange(rowIndex, 29).setValue(body.nppEnd);
      
      if (body.remarks !== undefined) sheet.getRange(rowIndex, 31).setValue(body.remarks);
      
      return createJsonResponse({ status: 'success' });
    }
    
    return createJsonResponse({ status: 'error', message: 'Unknown action' });
      
  } catch (error) {
    return createJsonResponse({ status: 'error', message: error.toString() });
  }
}

function createJsonResponse(responseObject) {
  return ContentService.createTextOutput(JSON.stringify(responseObject))
    .setMimeType(ContentService.MimeType.JSON);
}
