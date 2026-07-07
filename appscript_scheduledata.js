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
  const action = e.parameter.action;
  const coachNumber = e.parameter.coachNumber;
  const coachNumbersStr = e.parameter.coachNumbers;
  
  if (!action && !coachNumber && !coachNumbersStr) {
    return createJsonResponse({
      status: 'error',
      message: 'No action or coach number(s) provided.'
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
    
    if (action === 'getDueCoaches') {
      const selectedDateStr = e.parameter.date;
      if (!selectedDateStr) {
        return createJsonResponse({ status: 'error', message: 'No date provided.' });
      }
      const selectedDate = new Date(selectedDateStr);
      selectedDate.setHours(0, 0, 0, 0);

      const findIdx = (headerName) => {
        const lowerName = headerName.toLowerCase();
        for (let j = 0; j < headers.length; j++) {
           if (String(headers[j]).toLowerCase().includes(lowerName)) return j;
        }
        return -1;
      };

      const pitDate1Idx = findIdx('next pit check date 1');
      const pitDate2Idx = findIdx('next pit check date 2');
      const d2Idx = findIdx('d 2');
      const d3Idx = findIdx('d 3');
      const rlyIdx = 0; // Column A
      const typeIdx = 1; // Column B
      const trainNoIdx = 4; // Column E
      const coachNoIdx = 8; // Column I

      const dueCoaches = [];
      
      for (let i = 2; i < data.length; i++) {
         const row = data[i];
         if (!row[coachNoIdx]) continue;
         
         let pit1Match = false;
         let pit2Match = false;
         
         if (pitDate1Idx !== -1 && row[pitDate1Idx]) {
            let p1 = new Date(row[pitDate1Idx]);
            if (!isNaN(p1)) {
              p1.setHours(0,0,0,0);
              if (p1.getTime() === selectedDate.getTime()) pit1Match = true;
            }
         }
         
         if (pitDate2Idx !== -1 && row[pitDate2Idx]) {
            let p2 = new Date(row[pitDate2Idx]);
            if (!isNaN(p2)) {
              p2.setHours(0,0,0,0);
              if (p2.getTime() === selectedDate.getTime()) pit2Match = true;
            }
         }
         
         if (pit1Match || pit2Match) {
             let d2Match = false;
             let d3Match = false;
             let d2DateStr = '-';
             let d3DateStr = '-';
             
             if (d2Idx !== -1 && row[d2Idx]) {
                 let d2Date = new Date(row[d2Idx]);
                 if (!isNaN(d2Date)) {
                     d2Date.setHours(0,0,0,0);
                     if (d2Date.getTime() <= selectedDate.getTime()) d2Match = true;
                     d2DateStr = d2Date.getFullYear() + '-' + String(d2Date.getMonth()+1).padStart(2,'0') + '-' + String(d2Date.getDate()).padStart(2,'0');
                 }
             }
             
             if (d3Idx !== -1 && row[d3Idx]) {
                 let d3Date = new Date(row[d3Idx]);
                 if (!isNaN(d3Date)) {
                     d3Date.setHours(0,0,0,0);
                     if (d3Date.getTime() <= selectedDate.getTime()) d3Match = true;
                     d3DateStr = d3Date.getFullYear() + '-' + String(d3Date.getMonth()+1).padStart(2,'0') + '-' + String(d3Date.getDate()).padStart(2,'0');
                 }
             }
             
             if (d2Match || d3Match) {
                 dueCoaches.push({
                     rly: row[rlyIdx] || '-',
                     type: row[typeIdx] || '-',
                     coachNo: row[coachNoIdx] || '-',
                     trainNo: row[trainNoIdx] || '-',
                     d2Date: d2DateStr,
                     d3Date: d3DateStr,
                     isD2Due: d2Match,
                     isD3Due: d3Match
                 });
             }
         }
      }
      
      return createJsonResponse({
        status: 'success',
        data: dueCoaches
      });
    }
    
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
