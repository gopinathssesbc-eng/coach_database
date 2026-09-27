import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Add fetchFromScheduleDatabase
schedule_wrapper = """
async function fetchFromScheduleDatabase(queryType, param) {
    try {
        const base = 'https://coachdatawebapp-default-rtdb.firebaseio.com/schedule/coaches';
        if (queryType === 'coach') {
            const res = await fetch(`${base}/${param}.json`);
            if(!res.ok) return {status: 'error', message: 'Network error'};
            const coachData = await res.json();
            if(coachData) {
                // If it is a new coach, the old logic expects isNewCoach = true, but since we only have schedule data here, we handle missing as error
                return { status: 'success', data: coachData };
            } else {
                // Let's fallback to WSP database just like old script did
                const wspRes = await fetchFromDatabase('coach', param);
                if (wspRes && wspRes.status === 'success' && wspRes.data.length > 0) {
                    const wspCoach = wspRes.data[0];
                    return { status: 'success', isNewCoach: true, data: wspCoach };
                }
                return { status: 'error', message: 'Coach details not available in database' };
            }
        }
        else if (queryType === 'coachesList') {
            const list = param.split(',').map(s => s.trim());
            const promises = list.map(c => fetch(`${base}/${c}.json`).then(r => r.json()));
            const results = await Promise.all(promises);
            const validData = results.filter(d => d !== null);
            return { status: 'success', data: validData };
        }
        else if (queryType === 'due') {
            // Fetch all coaches and filter locally
            const res = await fetch(`${base}.json`);
            if(!res.ok) return {status: 'error', message: 'Network error'};
            const allCoaches = await res.json();
            if(!allCoaches) return { status: 'success', data: [] };
            
            const selectedDate = new Date(param);
            selectedDate.setHours(0,0,0,0);
            
            const dueCoaches = [];
            
            for (const coachNo in allCoaches) {
                const row = allCoaches[coachNo];
                let pit1Match = false;
                let pit2Match = false;
                
                if (row['_pit1']) {
                    let p1 = new Date(row['_pit1']);
                    if(!isNaN(p1)){ p1.setHours(0,0,0,0); if (p1.getTime() === selectedDate.getTime()) pit1Match = true; }
                }
                if (row['_pit2']) {
                    let p2 = new Date(row['_pit2']);
                    if(!isNaN(p2)){ p2.setHours(0,0,0,0); if (p2.getTime() === selectedDate.getTime()) pit2Match = true; }
                }
                
                if (pit1Match || pit2Match) {
                    let d2Match = false, d3Match = false;
                    let d2DateStr = '-', d3DateStr = '-';
                    
                    if (row['_d2']) {
                        let d2Date = new Date(row['_d2']);
                        if(!isNaN(d2Date)) { d2Date.setHours(0,0,0,0); if(d2Date.getTime() <= selectedDate.getTime()) d2Match = true; d2DateStr = String(d2Date.getDate()).padStart(2, '0') + '-' + String(d2Date.getMonth() + 1).padStart(2, '0') + '-' + d2Date.getFullYear(); }
                    }
                    if (row['_d3']) {
                        let d3Date = new Date(row['_d3']);
                        if(!isNaN(d3Date)) { d3Date.setHours(0,0,0,0); if(d3Date.getTime() <= selectedDate.getTime()) d3Match = true; d3DateStr = String(d3Date.getDate()).padStart(2, '0') + '-' + String(d3Date.getMonth() + 1).padStart(2, '0') + '-' + d3Date.getFullYear(); }
                    }
                    
                    if (d2Match || d3Match) {
                        dueCoaches.push({
                            rly: row['_rly'], type: row['_type'], coachNo: coachNo, trainNo: row['_trainNo'],
                            d2Date: d2DateStr, d3Date: d3DateStr, isD2Due: d2Match, isD3Due: d3Match
                        });
                    }
                }
            }
            return { status: 'success', data: dueCoaches };
        }
    } catch(e) {
        return { status: 'error', message: e.toString() };
    }
}
"""

if 'fetchFromScheduleDatabase' not in content:
    content = content.replace("async function fetchFromDatabase(queryType, param) {", schedule_wrapper + "\nasync function fetchFromDatabase(queryType, param) {")

def replace_fetch_block(content, fetch_line, new_fetch_line):
    pattern = re.escape(fetch_line) + r'[\s\S]*?const data = await response\.json\(\);\s*'
    new_block = new_fetch_line + '\n        '
    return re.sub(pattern, new_block, content)

# 1. coachNumbersStr in viewRakeCoaches
content = replace_fetch_block(
    content,
    "const scheduleUrl = `${SCHEDULE_APP_SCRIPT_URL}?coachNumbers=${encodeURIComponent(coachNumbersList)}`;\n            const response = await fetch(scheduleUrl);",
    "const data = await fetchFromScheduleDatabase('coachesList', coachNumbersList);"
)

# 2. single coach in editSchedule
content = replace_fetch_block(
    content,
    "const url = `${SCHEDULE_APP_SCRIPT_URL}?coachNumber=${encodeURIComponent(coachNumber)}`;\n        const response = await fetch(url);",
    "const data = await fetchFromScheduleDatabase('coach', coachNumber);"
)

# 3. single coach in handleScheduleSearch
content = replace_fetch_block(
    content,
    "const url = `${SCHEDULE_APP_SCRIPT_URL}?coachNumber=${encodeURIComponent(coachNumber)}`;\n        const response = await fetch(url);",
    "const data = await fetchFromScheduleDatabase('coach', coachNumber);"
)

# 4. due coaches
content = replace_fetch_block(
    content,
    "const url = `${SCHEDULE_APP_SCRIPT_URL}?action=getDueCoaches&date=${encodeURIComponent(dateInput)}`;\n        const response = await fetch(url);",
    "const data = await fetchFromScheduleDatabase('due', dateInput);"
)


with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('Refactored schedule queries!')
