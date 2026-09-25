/**
 * Instructions for deploying this to Google Sheets:
 * 1. Open your Coach Database Google Sheet.
 * 2. Click Extensions > Apps Script.
 * 3. Delete any code in the script editor and paste this entire code.
 * 4. Save the project (Ctrl+S).
 * 5. Click Deploy > New deployment.
 * 6. Select type: "Web app".
 * 7. Description: "Coach Database API v2 (Optimized)"
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
  const isPendingWorkSearch = !!e.parameter.pendingWork;
  const isLogVisit = !!e.parameter.logVisit;
  const isGetAnalytics = !!e.parameter.getAnalytics;
  
  if (!isTrainSearch && !isCoachSearch && !isGetTrains && !isDateSearch && !isPendingWorkSearch && !isLogVisit && !isGetAnalytics) {
    return createJsonResponse({
      status: 'error',
      message: 'No Search Parameter provided.'
    });
  }

  // --- Handle Analytics Logging ---
  if (isLogVisit) {
    try {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Analytics");
      if (!sheet) return createJsonResponse({status: 'error', message: 'Analytics sheet not found'});
      
      // If empty, set headers
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(["Timestamp", "Date", "Session ID", "Device Type", "Browser"]);
      }
      
      const timestamp = new Date();
      const dateStr = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), "yyyy-MM-dd");
      
      sheet.appendRow([
        timestamp, 
        dateStr, 
        e.parameter.sessionId || "Unknown", 
        e.parameter.device || "Unknown",
        e.parameter.browser || "Unknown"
      ]);
      
      return createJsonResponse({status: 'success'});
    } catch (err) {
      return createJsonResponse({status: 'error', message: err.toString()});
    }
  }

  // --- Fetch Analytics for Admin Page ---
  if (isGetAnalytics) {
    try {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Analytics");
      if (!sheet) return createJsonResponse({status: 'error', message: 'Analytics sheet not found'});
      
      const data = sheet.getDataRange().getValues();
      if (data.length <= 1) return createJsonResponse({status: 'success', data: {dailyVisits: 0, activeUsers: 0, devices: {mobile: 0, desktop: 0}}});
      
      const rows = data.slice(1);
      const todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
      
      let dailyVisitors = 0;
      let mobileCount = 0;
      let desktopCount = 0;
      let recentSessions = new Set();
      const tenMinutesAgo = new Date(new Date().getTime() - 10 * 60000);
      
      rows.forEach(row => {
        const rowDateRaw = row[1];
        let rowDate = "";
        try {
          if (rowDateRaw instanceof Date) {
            rowDate = Utilities.formatDate(rowDateRaw, Session.getScriptTimeZone(), "yyyy-MM-dd");
          } else {
            rowDate = Utilities.formatDate(new Date(rowDateRaw), Session.getScriptTimeZone(), "yyyy-MM-dd");
          }
        } catch (e) {
          rowDate = String(rowDateRaw);
        }
        
        const sessionId = row[2];
        const device = row[3];
        const timestamp = new Date(row[0]);
        
        if (rowDate === todayStr) {
          dailyVisitors++; 
          if (String(device).toLowerCase().includes('mobile')) mobileCount++;
          else desktopCount++;
          
          if (timestamp >= tenMinutesAgo) {
            recentSessions.add(sessionId);
          }
        }
      });
      
      const responseData = {
        dailyVisits: dailyVisitors, 
        activeUsers: recentSessions.size, 
        devices: { mobile: mobileCount, desktop: desktopCount }
      };
      
      return createJsonResponse({status: 'success', data: responseData});
    } catch (err) {
      return createJsonResponse({status: 'error', message: err.toString()});
    }
  }

  try {
    const sheetName = e.parameter.sheetName;
    const targetSheetName = sheetName ? sheetName : "Imported Database";
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(targetSheetName);
    
    if (!sheet) {
      return createJsonResponse({ status: 'error', message: 'Sheet "' + targetSheetName + '" not found.' });
    }

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    if (lastRow < 1 || lastCol < 1) {
      return createJsonResponse({ status: 'error', message: 'Not enough data in the sheet.' });
    }

    let headers;
    let startIndex;
    
    if (targetSheetName === "Imported Database") {
      headers = sheet.getRange(2, 1, 1, lastCol).getValues()[0]; 
      startIndex = 2;    
    } else {
      headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0]; 
      startIndex = 1;    
    }
    
    // If requesting all trains, extract unique train codes and return immediately
    if (isGetTrains) {
      const trainSet = {};
      if (lastRow >= 3) {
        const colOData = sheet.getRange(3, 15, lastRow - 2, 1).getValues();
        for (let i = 0; i < colOData.length; i++) {
          const colO = String(colOData[i][0]).trim();
          if (colO.startsWith('RK')) {
            const match = colO.match(/^RK([A-Z]+)/i);
            if (match && match[1]) {
              trainSet[match[1]] = true;
            }
          }
        }
      }
      return createJsonResponse({ status: 'success', data: Object.keys(trainSet) });
    }
    
    let foundMatches = [];

    // --- OPTIMIZED COACH SEARCH USING TEXTFINDER ---
    if (isCoachSearch) {
      const coachNumber = String(e.parameter.coachNumber).trim();
      // Search only in Column A
      const tf = sheet.getRange("A:A").createTextFinder(coachNumber).matchEntireCell(true);
      const results = tf.findAll();
      
      for (let j = 0; j < results.length; j++) {
        const rIdx = results[j].getRow();
        if (rIdx > startIndex) {
          const rowData = sheet.getRange(rIdx, 1, 1, lastCol).getValues()[0];
          foundMatches.push({ data: rowData, rowIndex: rIdx });
        }
      }
    } 
    // --- BULK SEARCHES (TRAIN, DATE, PENDING) LOAD ALL DATA ---
    else {
      const data = sheet.getDataRange().getValues();
      for (let i = startIndex; i < data.length; i++) {
        const row = data[i];
        
        if (isTrainSearch) {
          const colO = String(row[14]).trim(); // Column O (index 14)
          const targetPrefix = 'RK' + String(e.parameter.train).trim();
          if (colO.startsWith(targetPrefix)) {
            foundMatches.push({ data: row, rowIndex: i + 1 });
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
            foundMatches.push({ data: row, rowIndex: i + 1 });
          }
        } else if (isPendingWorkSearch && targetSheetName === "DOWNLOAD status modified") {
          const colZ = String(row[25]).trim().toLowerCase();
          if (colZ === 'yes') {
            foundMatches.push({ data: row, rowIndex: i + 1 });
          }
        }
      }
    }

    if (foundMatches.length > 0) {
      const resultsArray = [];
      
      let importedDbData = null;
      let impHeaders = null;
      let downloadStatusData = null;
      let dlHeaders = null;
      let dlSheet = null;
      
      // Load secondary sheets headers (and data if bulk search)
      if (targetSheetName === "DOWNLOAD status modified") {
        const importedSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Imported Database");
        if (importedSheet) {
          const impLastCol = importedSheet.getLastColumn();
          if (impLastCol > 0) {
             impHeaders = importedSheet.getRange(2, 1, 1, impLastCol).getValues()[0];
             if (!isCoachSearch) { // For bulk searches, pre-load all data to avoid loop queries
                importedDbData = importedSheet.getDataRange().getValues();
             }
          }
        }
      } else if (targetSheetName === "Imported Database") {
        dlSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DOWNLOAD status modified");
        if (dlSheet) {
          const dlLastCol = dlSheet.getLastColumn();
          if (dlLastCol > 0) {
             dlHeaders = dlSheet.getRange(1, 1, 1, dlLastCol).getValues()[0];
             if (!isCoachSearch) {
                downloadStatusData = dlSheet.getDataRange().getValues();
             }
          }
        }
      }
      
      let impCoachIdx = 0;
      let impRlyIdx = 1;
      let impTypeWspdIdx = -1;
      let impWspMakeIdx = -1;
      let impLeftDateIdx = -1;
      let impArrivalDateIdx = -1;
      let impTrainNoIdx = 17; // Column R
      
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
          impLeftDateIdx = findIdx(['left date', 'left']);
          impArrivalDateIdx = findIdx(['arrival date', 'arrival']);
          
          const tIdx = findIdx(['status']); 
          if (tIdx !== -1) impTrainNoIdx = tIdx;
          
          const exactWspIdx = impHeaders.findIndex(h => {
              const str = String(h).toLowerCase().trim();
              return str === 'wsp';
          });
          
          if (exactWspIdx !== -1) {
              impWspMakeIdx = exactWspIdx;
          } else {
              impWspMakeIdx = 23; // Fallback to Column X
          }
      }
      
      let dlCoachIdx = 0;
      let dlWheelCondIdx = -1;
      let dlDateIdx = -1;
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
          dlDateIdx = findDlIdx(['download date']);
      }
      
      let sourceCoachIdx = 0;
      for(let i=0; i<headers.length; i++) {
         const h = String(headers[i]).toLowerCase();
         if(h.includes('coach no') || h.includes('coach num')) {
            sourceCoachIdx = i;
            break;
         }
      }
      
      const formatVal = (val) => {
        if (val instanceof Date) {
          if (isNaN(val.getTime())) return '';
          return val.getFullYear() + '-' + String(val.getMonth() + 1).padStart(2, '0') + '-' + String(val.getDate()).padStart(2, '0');
        }
        return val;
      };

      for (let k = 0; k < foundMatches.length; k++) {
        const matchRow = foundMatches[k].data;
        const rowIndex = foundMatches[k].rowIndex;
        const resultObj = {};
        
        // Populate standard columns
        for (let j = 0; j < headers.length; j++) {
          if (headers[j]) {
            resultObj[headers[j]] = formatVal(matchRow[j]);
          }
        }
        
        const coachNumber = String(matchRow[sourceCoachIdx]).trim();

        // ----------------------------------------------------
        // CROSS-REFERENCE: Look up from Imported Database
        // ----------------------------------------------------
        if (targetSheetName === "DOWNLOAD status modified" && impHeaders) {
          let foundRly = '-';
          let foundTypeOfWspd = '-';
          let foundWspMake = '-';
          let foundLeftDate = '-';
          let foundArrivalDate = '-';
          let foundDbTrainNo = '-';
          
          if (isCoachSearch) {
             // OPTIMIZED LOOKUP
             const impSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Imported Database");
             if (impSheet) {
               const tfImp = impSheet.getRange("A:A").createTextFinder(coachNumber).matchEntireCell(true);
               const impResults = tfImp.findAll();
               if (impResults.length > 0) {
                 const rIdx = impResults[0].getRow();
                 if (rIdx > 2) { // Skip headers
                   const impRowData = impSheet.getRange(rIdx, 1, 1, impSheet.getLastColumn()).getValues()[0];
                   foundRly = impRowData[impRlyIdx];
                   if (impTypeWspdIdx !== -1) foundTypeOfWspd = impRowData[impTypeWspdIdx];
                   if (impWspMakeIdx !== -1) foundWspMake = impRowData[impWspMakeIdx];
                   if (impLeftDateIdx !== -1) foundLeftDate = formatVal(impRowData[impLeftDateIdx]);
                   if (impArrivalDateIdx !== -1) foundArrivalDate = formatVal(impRowData[impArrivalDateIdx]);
                   if (impTrainNoIdx !== -1 && impRowData[impTrainNoIdx]) foundDbTrainNo = impRowData[impTrainNoIdx];
                 }
               }
             }
          } else if (importedDbData) {
             // MEMORY LOOKUP FOR BULK SEARCH
             for (let d = 2; d < importedDbData.length; d++) {
                if (String(importedDbData[d][impCoachIdx]).trim() === coachNumber) {
                   foundRly = importedDbData[d][impRlyIdx];
                   if (impTypeWspdIdx !== -1) foundTypeOfWspd = importedDbData[d][impTypeWspdIdx];
                   if (impWspMakeIdx !== -1) foundWspMake = importedDbData[d][impWspMakeIdx];
                   if (impLeftDateIdx !== -1) foundLeftDate = formatVal(importedDbData[d][impLeftDateIdx]);
                   if (impArrivalDateIdx !== -1) foundArrivalDate = formatVal(importedDbData[d][impArrivalDateIdx]);
                   if (impTrainNoIdx !== -1 && importedDbData[d][impTrainNoIdx]) foundDbTrainNo = importedDbData[d][impTrainNoIdx];
                   break;
                }
             }
          }
          resultObj['RLY'] = foundRly;
          resultObj['Type of WSPD'] = foundTypeOfWspd;
          resultObj['WSP Make'] = foundWspMake;
          resultObj['Left Date'] = foundLeftDate;
          resultObj['Arrival Date'] = foundArrivalDate;
          resultObj['DB Train No'] = foundDbTrainNo;
        }
        
        // ----------------------------------------------------
        // CROSS-REFERENCE: Look up from DOWNLOAD status modified
        // ----------------------------------------------------
        if (targetSheetName === "Imported Database" && dlHeaders && dlSheet) {
           let foundWheelCondition = '-';
           let latestDate = null;
           let latestCond = '-';
           
           if (isCoachSearch) {
              // OPTIMIZED LOOKUP
              const tfDl = dlSheet.getRange("A:A").createTextFinder(coachNumber).matchEntireCell(true);
              const dlResults = tfDl.findAll();
              
              for (let r = 0; r < dlResults.length; r++) {
                 const dlRowIdx = dlResults[r].getRow();
                 if (dlRowIdx > 1) { // Skip headers
                    const dlRowData = dlSheet.getRange(dlRowIdx, 1, 1, dlSheet.getLastColumn()).getValues()[0];
                    const cond = dlRowData[dlWheelCondIdx];
                    if (cond && String(cond).trim() !== '') {
                        let rowDate = null;
                        if (dlDateIdx !== -1) {
                            const dateVal = dlRowData[dlDateIdx];
                            if (dateVal instanceof Date) rowDate = dateVal;
                            else if (dateVal && String(dateVal).trim() !== '') rowDate = new Date(dateVal);
                        }
                        if (rowDate && !isNaN(rowDate)) {
                            if (!latestDate || rowDate > latestDate) {
                                latestDate = rowDate;
                                latestCond = cond;
                            }
                        } else {
                            latestCond = cond;
                        }
                    }
                 }
              }
           } else if (downloadStatusData) {
              // MEMORY LOOKUP FOR BULK SEARCH
              for (let d = 1; d < downloadStatusData.length; d++) {
                 if (String(downloadStatusData[d][dlCoachIdx]).trim() === coachNumber) {
                    const cond = downloadStatusData[d][dlWheelCondIdx];
                    if (cond && String(cond).trim() !== '') {
                        let rowDate = null;
                        if (dlDateIdx !== -1) {
                            const dateVal = downloadStatusData[d][dlDateIdx];
                            if (dateVal instanceof Date) rowDate = dateVal;
                            else if (dateVal && String(dateVal).trim() !== '') rowDate = new Date(dateVal);
                        }
                        if (rowDate && !isNaN(rowDate)) {
                            if (!latestDate || rowDate > latestDate) {
                                latestDate = rowDate;
                                latestCond = cond;
                            }
                        } else {
                            latestCond = cond;
                        }
                    }
                 }
              }
           }
           
           if (latestDate && latestCond !== '-') {
               const formattedDate = String(latestDate.getDate()).padStart(2,'0') + '-' + String(latestDate.getMonth()+1).padStart(2,'0') + '-' + latestDate.getFullYear();
               foundWheelCondition = `Date-${formattedDate}, Wheel condition-${latestCond}`;
           } else {
               foundWheelCondition = latestCond;
           }
           
           resultObj['Wheel Condition'] = foundWheelCondition;
        }
        
        // Add explicit properties for columns
        resultObj['_colO'] = formatVal(matchRow[14]); // Rake String
        resultObj['_colP'] = formatVal(matchRow[15]); // Left Date (Departure)
        resultObj['_colQ'] = formatVal(matchRow[16]); // Arrival Date
        resultObj['_colS'] = formatVal(matchRow[18]); // Indication
        resultObj['_rawRow'] = matchRow.map(formatVal);
        resultObj['_headers'] = headers;
        resultObj['_rowIndex'] = rowIndex; 
        
        resultsArray.push(resultObj);
      }
      
      return createJsonResponse({ status: 'success', data: resultsArray });
    } else {
      return createJsonResponse({ status: 'error', message: 'Coach not found' });
    }
    
  } catch (error) {
    return createJsonResponse({ status: 'error', message: 'Server error: ' + error.toString() });
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
        sheet = doc.insertSheet('DOWNLOAD status modified');
        sheet.appendRow([
          'COACH NO', 'RAKE', 'TRAIN NO', 'COACH TYPE', 'CI', 'LEFT DATE', 
          'ARRIVAL DATE', 'ARRIVAL T NO', 'WSP MAKE', 'Download Date', 'Month', 
          'PS status', 'wsp code', 'Self test dump valve', 'Sensor gap', 
          'downloading obseravtion', 'OTHER OBSERVATION', 'Wheel condition', 
          'defect category', 'ATTENTION IF ANY', 'PENDING WORK', 
          'DEFECT DESCRIPTION', 'ITEM REQUIRED / USED', 'CHECKLIST SUBMITTED',
          'Data Entry By', 'ANY WORK PENDING'
        ]);
      }
      
      var colA = sheet.getRange("A:A").getValues();
      var lastRow = 0;
      for (var i = colA.length - 1; i >= 0; i--) {
        if (colA[i][0] !== "" && colA[i][0] != null) {
          lastRow = i + 1;
          break;
        }
      }
      
      var targetRow = body.editRow ? parseInt(body.editRow, 10) : (lastRow + 1);
      
      sheet.getRange(targetRow, 1).setValue(body.coachNumber || '');
      
      var col10to27 = [
        body.downloadDate || '', 
        body.month || '', 
        body.psStatus || '', 
        body.wspCode || '', 
        body.dumpValve || '', 
        body.sensorGap || '', 
        body.observation || '', 
        body.otherObservation || '', 
        body.wheelCondition || '', 
        body.defectCategory || '', 
        body.attention || '', 
        '', // 21. PENDING WORK (Removed)
        body.description || '', 
        body.itemRequired || '', 
        body.checklistSubmitted || '', 
        body.dataEntryBy || '', 
        body.anyWorkPending || '', 
        body.pendingWorkDesc || '' 
      ];
      
      sheet.getRange(targetRow, 10, 1, col10to27.length).setValues([col10to27]);
      
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
