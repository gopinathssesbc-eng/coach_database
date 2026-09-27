import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Insert FIREBASE_DB_URL and fetchFromDatabase
if 'fetchFromDatabase' not in content:
    wrapper_code = """const SCHEDULE_APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzzf27fH7b-R0P9O6n5hR-Q4TzK-r6G7Q1vM_f5K2Lq3-cT5kZ7X9n2N1Q8Q9Y0Z1x/exec';
const FIREBASE_DB_URL = 'https://coachdatawebapp-default-rtdb.firebaseio.com/wsp';

async function fetchFromDatabase(queryType, param) {
    try {
        let url = '';
        if (queryType === 'coach') url = `${FIREBASE_DB_URL}/searchCoach/${param}.json`;
        else if (queryType === 'train') url = `${FIREBASE_DB_URL}/searchTrain/${param}.json`;
        else if (queryType === 'date') url = `${FIREBASE_DB_URL}/searchDate/${param}.json`;
        else if (queryType === 'pending') url = `${FIREBASE_DB_URL}/searchPending.json`;
        else if (queryType === 'history') url = `${FIREBASE_DB_URL}/history/${param}.json`;
        else if (queryType === 'trainList') url = `${FIREBASE_DB_URL}/trainList.json`;
        
        const response = await fetch(url);
        if (!response.ok) return { status: 'error', message: 'Network error' };
        
        const data = await response.json();
        if (data) {
            return data;
        } else {
            return { status: 'error', message: 'Coach/Data not found in database' };
        }
    } catch (e) {
        return { status: 'error', message: e.toString() };
    }
}
"""
    content = content.replace("const SCHEDULE_APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzzf27fH7b-R0P9O6n5hR-Q4TzK-r6G7Q1vM_f5K2Lq3-cT5kZ7X9n2N1Q8Q9Y0Z1x/exec';", wrapper_code)

def replace_fetch_block(content, fetch_line, new_fetch_line):
    pattern = re.escape(fetch_line) + r'[\s\S]*?const data = await response\.json\(\);\s*'
    new_block = new_fetch_line + '\n        '
    return re.sub(pattern, new_block, content)

# 1. getTrains
content = replace_fetch_block(
    content,
    "const url = `${GOOGLE_APP_SCRIPT_URL}?getTrains=true`;\n        const response = await fetch(url);",
    "const data = await fetchFromDatabase('trainList');"
)

# 2. coachNumber search
content = replace_fetch_block(
    content,
    "const url = `${GOOGLE_APP_SCRIPT_URL}?coachNumber=${encodeURIComponent(coachNumber)}`;\n            const response = await fetch(url);",
    "const data = await fetchFromDatabase('coach', coachNumber);"
)

# 3. train search in fetchRakes
content = replace_fetch_block(
    content,
    "const url = `${GOOGLE_APP_SCRIPT_URL}?train=${encodeURIComponent(trainSelect)}`;\n        const response = await fetch(url);",
    "const data = await fetchFromDatabase('train', trainSelect);"
)

# 4. date search
content = replace_fetch_block(
    content,
    "const url = `${GOOGLE_APP_SCRIPT_URL}?date=${encodeURIComponent(dateInput)}&sheetName=${encodeURIComponent('DOWNLOAD status modified')}`;\n        const response = await fetch(url);",
    "const data = await fetchFromDatabase('date', dateInput);"
)

# 5. history search
content = replace_fetch_block(
    content,
    "const url = `${GOOGLE_APP_SCRIPT_URL}?coachNumber=${encodeURIComponent(coachNumber)}&sheetName=${encodeURIComponent('DOWNLOAD status modified')}`;\n        const response = await fetch(url);",
    "const data = await fetchFromDatabase('history', coachNumber);"
)

# 6. pending search
content = replace_fetch_block(
    content,
    "const url = `${GOOGLE_APP_SCRIPT_URL}?pendingWork=true&sheetName=${encodeURIComponent('DOWNLOAD status modified')}`;\n        const response = await fetch(url);",
    "const data = await fetchFromDatabase('pending');"
)

# Also fix the weird sheetName=wsp_wheel_status string? Wait, in my grep search I saw:
# const url = `${GOOGLE_APP_SCRIPT_URL}?coachNumber=${encodeURIComponent(coachNumber)}&sheetName=wsp_wheel_status`;
# Let's replace that one too just in case.
content = replace_fetch_block(
    content,
    "const url = `${GOOGLE_APP_SCRIPT_URL}?coachNumber=${encodeURIComponent(coachNumber)}&sheetName=wsp_wheel_status`;\n        const response = await fetch(url);",
    "const data = await fetchFromDatabase('history', coachNumber);"
)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('Refactored!')
