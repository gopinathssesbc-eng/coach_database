/**
 * Instructions for deploying this to Google Sheets:
 * 1. Open your Coach Database Google Sheet.
 * 2. Click Extensions > Apps Script.
 * 3. Delete any code in the script editor and paste this entire code.
 * 4. Save the project (Ctrl+S).
 * 5. Click Deploy > New deployment.
 * 6. Select type: "Web app".
 * 7. Description: "Coach Database API v1" (or similar).
 * 8. Execute as: "Me" (your email).
 * 9. Who has access: "Anyone".
 * 10. Click Deploy and authorize the app if prompted.
 * 11. Copy the "Web app URL" provided and paste it into app.js in your frontend project.
 */

// This function handles GET requests to the Web App
function doGet(e) {
  const isTrainSearch = !!e.parameter.train;
  const isCoachSearch = !!e.parameter.coachNumber;
  const isGetTrains = !!e.parameter.getTrains;
  const isDateSearch = !!e.parameter.date;
  
  if (!isTrainSearch && !isCoachSearch && !isGetTrains && !isDateSearch) {
    return createJsonResponse({
      status: 'error',
      message: 'No Search Parameter provided.'
    });
  }

  try {
    const sheetName = e.parameter.sheetName;
    const targetSheetName = sheetName ? sheetName : "Imported Database";
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(targetSheetName);
    
    if (!sheet) {
      return createJsonResponse({
        status: 'error',
        message: 'Sheet "' + targetSheetName + '" not found.'
      });
    }

    const data = sheet.getDataRange().getValues();
    
    // Check if there is enough data
    if (data.length < 1) {
      return createJsonResponse({
        status: 'error',
        message: 'Not enough data in the sheet.'
      });
    }

    let headers;
    let startIndex;
    
    if (targetSheetName === "Imported Database") {
      headers = data[1]; // Headers on 2nd row
      startIndex = 2;    // Data starts on 3rd row
    } else {
      headers = data[0]; // Standard sheet headers on 1st row
      startIndex = 1;    // Data starts on 2nd row
    }
    
    // If requesting all trains, extract unique train codes and return immediately
    if (isGetTrains) {
      const trainSet = {};
      for (let i = 2; i < data.length; i++) {
        const colO = String(data[i][14]).trim();
        if (colO.startsWith('RK')) {
          const match = colO.match(/^RK([A-Z]+)/i);
          if (match && match[1]) {
            trainSet[match[1]] = true;
          }
        }
      }
      return createJsonResponse({
        status: 'success',
        data: Object.keys(trainSet)
      });
    }
    
    let foundMatches = [];

    // Loop through rows starting from startIndex
    for (let i = startIndex; i < data.length; i++) {
      const row = data[i];
      
      if (isCoachSearch) {
        const coachNumber = String(row[0]).trim(); // Col1 (index 0)
        if (coachNumber === String(e.parameter.coachNumber).trim()) {
          foundMatches.push(row);
        }
      } else if (isTrainSearch) {
        const colO = String(row[14]).trim(); // Column O (index 14)
        const targetPrefix = 'RK' + String(e.parameter.train).trim();
        // Check if Col O starts with RK + Train Code (e.g., RKCAPE)
        if (colO.startsWith(targetPrefix)) {
          foundMatches.push(row);
        }
      } else if (isDateSearch && targetSheetName === "DOWNLOAD status modified") {
        const dateColIndex = 9; // Download Date is index 9
        const rowDateStr = String(row[dateColIndex]).trim();
        let formattedRowDate = rowDateStr;
        
        if (row[dateColIndex] instanceof Date) {
            const d = row[dateColIndex];
            formattedRowDate = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
        } else if (rowDateStr) {
            const d = new Date(rowDateStr);
            if (!isNaN(d.getTime())) {
                formattedRowDate = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
            }
        }

        if (formattedRowDate === String(e.parameter.date).trim()) {
          foundMatches.push(row);
        }
      }
    }

    if (foundMatches.length > 0) {
      const resultsArray = [];
      
      let importedDbData = null;
      let impHeaders = null;
      let downloadStatusData = null;
      let dlHeaders = null;
      
      if (targetSheetName === "DOWNLOAD status modified") {
        const importedSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Imported Database");
        if (importedSheet) {
          importedDbData = importedSheet.getDataRange().getValues();
          if (importedDbData.length > 1) {
            impHeaders = importedDbData[1]; // Headers on 2nd row for Imported Database
          }
        }
      } else if (targetSheetName === "Imported Database") {
        const dlSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DOWNLOAD status modified");
        if (dlSheet) {
          downloadStatusData = dlSheet.getDataRange().getValues();
          if (downloadStatusData.length > 0) {
            dlHeaders = downloadStatusData[0]; // Headers on 1st row
          }
        }
      }
      
      let impCoachIdx = 0;
      let impRlyIdx = 1;
      let impTypeWspdIdx = -1;
      let impWspMakeIdx = -1;
      
      if (impHeaders) {
          const findIdx = (texts) => {
              for(let i=0; i<impHeaders.length; i++) {
                 const h = String(impHeaders[i]).toLowerCase();
                 if(texts.some(t => h.includes(t))) return i;
              }
              return -1;
          };
          const cIdx = findIdx(['coach no', 'coach num']);
          if (cIdx !== -1) impCoachIdx = cIdx;
          const rIdx = findIdx(['rly', 'railway']);
          if (rIdx !== -1) impRlyIdx = rIdx;
          impTypeWspdIdx = findIdx(['type of wspd']);
          
          const exactWspIdx = impHeaders.findIndex(h => {
              const str = String(h).toLowerCase().trim();
              return str === 'wsp' || str === 'wsp make' || str === 'make';
          });
          
          if (exactWspIdx !== -1) {
              impWspMakeIdx = exactWspIdx;
          } else {
              impWspMakeIdx = 23; // Fallback to Column X
          }
      }
      
      let dlCoachIdx = 0;
      let dlWheelCondIdx = -1;
      if (dlHeaders) {
          const findDlIdx = (texts) => {
              for(let i=0; i<dlHeaders.length; i++) {
                 const h = String(dlHeaders[i]).toLowerCase();
                 if(texts.some(t => h.includes(t))) return i;
              }
              return -1;
          };
          const cIdx = findDlIdx(['coach no', 'coach num']);
          if (cIdx !== -1) dlCoachIdx = cIdx;
          dlWheelCondIdx = findDlIdx(['wheel condition']);
      }
      
      let sourceCoachIdx = 0;
      for(let i=0; i<headers.length; i++) {
         const h = String(headers[i]).toLowerCase();
         if(h.includes('coach no') || h.includes('coach num')) {
            sourceCoachIdx = i;
            break;
         }
      }
      
      for (let k = 0; k < foundMatches.length; k++) {
        const matchRow = foundMatches[k];
        const resultObj = {};
        
        // Loop through columns. We include all columns now.
        for (let j = 0; j < headers.length; j++) {
          if (headers[j]) {
            resultObj[headers[j]] = matchRow[j];
          }
        }
        
        // Look up RLY, Type of WSPD, WSP Make from Imported Database
        if (importedDbData) {
          const coachNumber = String(matchRow[sourceCoachIdx]).trim();
          let foundRly = '-';
          let foundTypeOfWspd = '-';
          let foundWspMake = '-';
          
          for (let d = 2; d < importedDbData.length; d++) {
             if (String(importedDbData[d][impCoachIdx]).trim() === coachNumber) {
                foundRly = importedDbData[d][impRlyIdx];
                if (impTypeWspdIdx !== -1) foundTypeOfWspd = importedDbData[d][impTypeWspdIdx];
                if (impWspMakeIdx !== -1) foundWspMake = importedDbData[d][impWspMakeIdx];
                break;
             }
          }
          resultObj['RLY'] = foundRly;
          resultObj['Type of WSPD'] = foundTypeOfWspd;
          resultObj['WSP Make'] = foundWspMake;
        }
        
        // Look up Wheel Condition from DOWNLOAD status modified
        if (downloadStatusData && dlWheelCondIdx !== -1) {
           const coachNumber = String(matchRow[sourceCoachIdx]).trim();
           let foundWheelCondition = '-';
           
           // Search backwards to get the most recent entry
           for (let d = downloadStatusData.length - 1; d > 0; d--) {
              if (String(downloadStatusData[d][dlCoachIdx]).trim() === coachNumber) {
                 const cond = downloadStatusData[d][dlWheelCondIdx];
                 if (cond && String(cond).trim() !== '') {
                     foundWheelCondition = cond;
                     break;
                 }
              }
           }
           resultObj['Wheel Condition'] = foundWheelCondition;
        }
        
        // Add explicit properties for columns to avoid header typos
        resultObj['_colO'] = matchRow[14]; // Rake String
        resultObj['_colP'] = matchRow[15]; // Left Date (Departure)
        resultObj['_colQ'] = matchRow[16]; // Arrival Date
        resultObj['_colS'] = matchRow[18]; // Indication
        resultObj['_rawRow'] = matchRow;   // Full unmapped array for column index access
        resultObj['_headers'] = headers;   // Headers array for index-to-name mapping
        
        resultsArray.push(resultObj);
      }
      
      return createJsonResponse({
        status: 'success',
        data: resultsArray
      });
    } else {
      return createJsonResponse({
        status: 'error',
        message: 'Coach not found'
      });
    }
    
  } catch (error) {
    return createJsonResponse({
      status: 'error',
      message: 'Server error: ' + error.toString()
    });
  }
}

// Helper function to format the JSON response and handle CORS
function createJsonResponse(responseObject) {
  return ContentService.createTextOutput(JSON.stringify(responseObject))
    .setMimeType(ContentService.MimeType.JSON);
}



function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    
    if (body.action === 'addWspEntry') {
      var doc = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = doc.getSheetByName('DOWNLOAD status modified');
      
      if (!sheet) {
        // Create if it doesn't exist to prevent crashes
        sheet = doc.insertSheet('DOWNLOAD status modified');
        sheet.appendRow([
          'COACH NO', 'RAKE', 'TRAIN NO', 'COACH TYPE', 'CI', 'LEFT DATE', 
          'ARRIVAL DATE', 'ARRIVAL T NO', 'WSP MAKE', 'Download Date', 'Month', 
          'PS status', 'wsp code', 'Self test dump valve', 'Sensor gap', 
          'downloading obseravtion', 'OTHER OBSERVATION', 'Wheel condition', 
          'defect category', 'ATTENTION IF ANY', 'FOLLO UP REMARKS', 
          'DEFECT DESCRIPTION', 'ITEM REQUIRED / USED', 'CHECKLIST SUBMITTED',
          'Data Entry By'
        ]);
      }
      
      sheet.appendRow([
        body.coachNumber || '', // 1. COACH NO
        '', // 2. RAKE (auto)
        '', // 3. TRAIN NO (auto)
        '', // 4. COACH TYPE (auto)
        '', // 5. CI (auto)
        '', // 6. LEFT DATE (auto)
        '', // 7. ARRIVAL DATE (auto)
        '', // 8. ARRIVAL T NO (auto)
        '', // 9. WSP MAKE (auto)
        body.downloadDate || '', // 10. Download Date
        body.month || '', // 11. Month
        body.psStatus || '', // 12. PS status
        body.wspCode || '', // 13. wsp code
        body.dumpValve || '', // 14. Self test dump valve
        body.sensorGap || '', // 15. Sensor gap
        body.observation || '', // 16. downloading obseravtion
        body.otherObservation || '', // 17. OTHER OBSERVATION
        body.wheelCondition || '', // 18. Wheel condition
        body.defectCategory || '', // 19. defect category
        body.attention || '', // 20. ATTENTION IF ANY
        body.followUp || '', // 21. FOLLO UP REMARKS
        body.description || '', // 22. DEFECT DESCRIPTION
        body.itemRequired || '', // 23. ITEM REQUIRED / USED
        body.checklistSubmitted || '', // 24. CHECKLIST SUBMITTED
        body.dataEntryBy || '' // 25. Data Entry By
      ]);
      
      return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Unknown action' }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
