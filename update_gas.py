import re

with open('AppsScriptCode.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update doGet to support sheetName
sheet_logic = """
    var sheetName = e.parameter.sheetName;
    var sheet = sheetName ? doc.getSheetByName(sheetName) : doc.getSheets()[0];
    
    if (!sheet) {
      return createJsonResponse({
        status: 'error',
        message: 'Sheet not found'
      });
    }
"""

content = re.sub(
    r'var sheet = doc\.getSheets\(\)\[0\];',
    sheet_logic,
    content
)

# 2. Add doPost
dopost_logic = """
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
"""

if "function doPost" not in content:
    content += "\n\n" + dopost_logic

with open('AppsScriptCode.js', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done!')
