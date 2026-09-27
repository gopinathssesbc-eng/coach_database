/**
 * FIREBASE SYNC SCRIPT
 * 
 * Instructions:
 * 1. Open your Coach Database Google Sheet.
 * 2. Click Extensions > Apps Script.
 * 3. Add a NEW file by clicking the "+" next to Files and choosing "Script". Name it "FirebaseSync".
 * 4. Paste this entire code into FirebaseSync.gs.
 * 5. Save the project (Ctrl+S).
 * 6. To do the first bulk upload, select the `bulkSyncToFirebase` function at the top menu and click "Run". 
 *    (Grant permissions if asked).
 * 7. To make it automatic, go to Triggers (the alarm clock icon on the left).
 * 8. Click "Add Trigger" (bottom right).
 *    - Choose which function to run: `onEditFirebaseTrigger`
 *    - Choose which deployment should run: `Head`
 *    - Select event source: `From spreadsheet`
 *    - Select event type: `On edit`
 * 9. Click Save. 
 * Now every time you edit the sheet, Firebase updates automatically!
 */

const FIREBASE_URL = "https://coachdatawebapp-default-rtdb.firebaseio.com";

function onEditFirebaseTrigger(e) {
  // Run the bulk sync in the background whenever a cell is edited
  // This takes about 2-3 seconds but won't freeze your Google Sheet
  bulkSyncToFirebase();
}

function formatVal(val) {
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    return val.getFullYear() + '-' + String(val.getMonth() + 1).padStart(2, '0') + '-' + String(val.getDate()).padStart(2, '0');
  }
  return val;
}

function sanitizeKey(key) {
  if (!key) return "Empty_Key";
  // Firebase does not allow . # $ / [ ] in keys
  return String(key).replace(/[\.\#\$\/\[\]]/g, "");
}

function bulkSyncToFirebase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dbSheet = ss.getSheetByName("Imported Database");
  const dlSheet = ss.getSheetByName("DOWNLOAD status modified");

  if (!dbSheet) return;

  const dbData = dbSheet.getDataRange().getValues();
  const dbHeaders = dbData[1]; // row 2
  
  let dlData = [];
  let dlHeaders = [];
  if (dlSheet) {
    dlData = dlSheet.getDataRange().getValues();
    dlHeaders = dlData[0]; // row 1
  }

  // Find critical column indices in Imported Database
  const findImpIdx = (texts) => {
    for (let i = 0; i < dbHeaders.length; i++) {
      if (texts.some(t => String(dbHeaders[i]).toLowerCase().includes(t))) return i;
    }
    return -1;
  };
  const impCoachIdx = findImpIdx(['coach no', 'coach num']) !== -1 ? findImpIdx(['coach no', 'coach num']) : 0;
  const impRlyIdx = findImpIdx(['rly', 'railway']) !== -1 ? findImpIdx(['rly', 'railway']) : 1;
  const impTypeWspdIdx = findImpIdx(['type of wspd']);
  const impLeftDateIdx = findImpIdx(['left date', 'left']);
  const impArrivalDateIdx = findImpIdx(['arrival date', 'arrival']);
  const impTrainNoIdx = findImpIdx(['status']) !== -1 ? findImpIdx(['status']) : 17;
  const impWspMakeIdx = dbHeaders.findIndex(h => String(h).toLowerCase().trim() === 'wsp') !== -1 ? 
                        dbHeaders.findIndex(h => String(h).toLowerCase().trim() === 'wsp') : 23;

  // Find critical column indices in DOWNLOAD status modified
  const findDlIdx = (texts) => {
    for (let i = 0; i < dlHeaders.length; i++) {
      if (texts.some(t => String(dlHeaders[i]).toLowerCase().includes(t))) return i;
    }
    return -1;
  };
  const dlCoachIdx = findDlIdx(['coach no', 'coach num']) !== -1 ? findDlIdx(['coach no', 'coach num']) : 0;
  const dlWheelCondIdx = findDlIdx(['wheel condition']);
  const dlDateIdx = findDlIdx(['download date']) !== -1 ? findDlIdx(['download date']) : 9;
  const dlPendingIdx = 25; // Column Z

  // Build the Firebase JSON Tree
  const firebaseData = {
    searchCoach: {},
    searchTrain: {},
    searchDate: {},
    searchPending: { status: 'success', data: [] },
    history: {},
    trainList: { status: 'success', data: [] }
  };

  const trainSet = new Set();

  // 1. Process Imported Database (for searchCoach, searchTrain, trainList)
  for (let i = 2; i < dbData.length; i++) {
    const row = dbData[i];
    const coachNumber = String(row[impCoachIdx]).trim();
    if (!coachNumber) continue;

    // Format the standard result object
    const resultObj = {};
    for (let j = 0; j < dbHeaders.length; j++) {
      if (dbHeaders[j]) {
        resultObj[sanitizeKey(dbHeaders[j])] = formatVal(row[j]);
      }
    }

    resultObj['_colO'] = formatVal(row[14]);
    resultObj['_colP'] = formatVal(row[15]);
    resultObj['_colQ'] = formatVal(row[16]);
    resultObj['_colS'] = formatVal(row[18]);
    resultObj['_rawRow'] = row.map(formatVal);
    resultObj['_headers'] = dbHeaders.map(String);
    resultObj['_rowIndex'] = i + 1;

    // Cross-reference wheel condition from DOWNLOAD status modified
    let foundWheelCondition = '-';
    let latestDate = null;
    let latestCond = '-';
    
    if (dlData.length > 0) {
      for (let d = 1; d < dlData.length; d++) {
        if (String(dlData[d][dlCoachIdx]).trim() === coachNumber) {
          const cond = dlData[d][dlWheelCondIdx];
          if (cond && String(cond).trim() !== '') {
            let rowDate = null;
            if (dlDateIdx !== -1) {
              const dateVal = dlData[d][dlDateIdx];
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
      const formattedDate = String(latestDate.getDate()).padStart(2, '0') + '-' + String(latestDate.getMonth() + 1).padStart(2, '0') + '-' + latestDate.getFullYear();
      foundWheelCondition = `Date-${formattedDate}, Wheel condition-${latestCond}`;
    } else {
      foundWheelCondition = latestCond;
    }
    resultObj['Wheel Condition'] = foundWheelCondition;

    // Group by Coach
    const safeCoachNo = sanitizeKey(coachNumber);
    if (!firebaseData.searchCoach[safeCoachNo]) {
      firebaseData.searchCoach[safeCoachNo] = { status: 'success', data: [] };
    }
    firebaseData.searchCoach[safeCoachNo].data.push(resultObj);

    // Group by Train
    const colO = String(row[14]).trim();
    if (colO.startsWith('RK')) {
      const match = colO.match(/^RK([A-Z]+)/i);
      if (match && match[1]) {
        const trainCode = sanitizeKey(match[1].toUpperCase());
        trainSet.add(trainCode);
        if (!firebaseData.searchTrain[trainCode]) {
          firebaseData.searchTrain[trainCode] = { status: 'success', data: [] };
        }
        firebaseData.searchTrain[trainCode].data.push(resultObj);
      }
    }
  }

  firebaseData.trainList.data = Array.from(trainSet);

  // 2. Process DOWNLOAD status modified (for history, searchDate, searchPending)
  if (dlData.length > 0) {
    for (let i = 1; i < dlData.length; i++) {
      const row = dlData[i];
      const coachNumber = String(row[dlCoachIdx]).trim();
      if (!coachNumber) continue;

      const resultObj = {};
      for (let j = 0; j < dlHeaders.length; j++) {
        if (dlHeaders[j]) {
          resultObj[sanitizeKey(dlHeaders[j])] = formatVal(row[j]);
        }
      }
      resultObj['_rawRow'] = row.map(formatVal);
      resultObj['_headers'] = dlHeaders.map(String);
      resultObj['_rowIndex'] = i + 1;

      // Cross-reference from Imported Database
      let foundRly = '-';
      let foundTypeOfWspd = '-';
      let foundWspMake = '-';
      let foundLeftDate = '-';
      let foundArrivalDate = '-';
      let foundDbTrainNo = '-';

      for (let d = 2; d < dbData.length; d++) {
        if (String(dbData[d][impCoachIdx]).trim() === coachNumber) {
          foundRly = dbData[d][impRlyIdx];
          if (impTypeWspdIdx !== -1) foundTypeOfWspd = dbData[d][impTypeWspdIdx];
          if (impWspMakeIdx !== -1) foundWspMake = dbData[d][impWspMakeIdx];
          if (impLeftDateIdx !== -1) foundLeftDate = formatVal(dbData[d][impLeftDateIdx]);
          if (impArrivalDateIdx !== -1) foundArrivalDate = formatVal(dbData[d][impArrivalDateIdx]);
          if (impTrainNoIdx !== -1 && dbData[d][impTrainNoIdx]) foundDbTrainNo = dbData[d][impTrainNoIdx];
          break;
        }
      }

      resultObj['RLY'] = foundRly;
      resultObj['Type of WSPD'] = foundTypeOfWspd;
      resultObj['WSP Make'] = foundWspMake;
      resultObj['Left Date'] = foundLeftDate;
      resultObj['Arrival Date'] = foundArrivalDate;
      resultObj['DB Train No'] = foundDbTrainNo;

      // Group History
      const safeCoachNo = sanitizeKey(coachNumber);
      if (!firebaseData.history[safeCoachNo]) {
        firebaseData.history[safeCoachNo] = { status: 'success', data: [] };
      }
      firebaseData.history[safeCoachNo].data.push(resultObj);

      // Group Date Search
      const dateVal = row[dlDateIdx];
      let formattedRowDate = '';
      if (dateVal instanceof Date) {
        formattedRowDate = dateVal.getFullYear() + '-' + String(dateVal.getMonth() + 1).padStart(2, '0') + '-' + String(dateVal.getDate()).padStart(2, '0');
      } else if (dateVal) {
        const d = new Date(dateVal);
        if (!isNaN(d.getTime())) {
          formattedRowDate = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        }
      }
      if (formattedRowDate) {
        if (!firebaseData.searchDate[formattedRowDate]) {
          firebaseData.searchDate[formattedRowDate] = { status: 'success', data: [] };
        }
        firebaseData.searchDate[formattedRowDate].data.push(resultObj);
      }

      // Group Pending Search
      const isPending = String(row[dlPendingIdx]).trim().toLowerCase() === 'yes';
      if (isPending) {
        firebaseData.searchPending.data.push(resultObj);
      }
    }
  }

  // Push the entire structure to Firebase in a single REST API call
  const options = {
    method: 'put',
    contentType: 'application/json',
    payload: JSON.stringify(firebaseData)
  };
  
  UrlFetchApp.fetch(FIREBASE_URL + "/wsp.json", options);
}
