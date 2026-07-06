// Replace this URL with the actual Web App URL provided by Google Apps Script after deployment
const GOOGLE_APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzVl0qS-ApqoWQwDSyluLOdV7JvinVSibq5SrB0G8T2ex1ynW4_ZGNBM4Pv-AhJ6KvU1Q/exec';

// Simple static password for demonstration (you can change this)
const APP_PASSWORD = '1234';

// DOM Elements
const screens = {
    login: document.getElementById('loginScreen'),
    dashboard: document.getElementById('dashboardScreen'),
    search: document.getElementById('searchScreen'),
    selection: document.getElementById('selectionScreen'),
    results: document.getElementById('resultsScreen'),
    rakeResults: document.getElementById('rakeResultsScreen'),
    wspSearch: document.getElementById('wspSearchScreen'),
    wspRakeResults: document.getElementById('wspRakeResultsScreen'),
    wspResults: document.getElementById('wspResultsScreen')
};

// --- SweetAlert Helpers ---
function showErrorAlert(message) {
    Swal.fire({
        icon: 'error',
        title: 'Error',
        text: message,
        background: '#1E293B',
        color: '#F8FAFC',
        confirmButtonColor: '#4F46E5',
        customClass: { popup: 'glass-card' }
    });
}

function showWarningAlert(message) {
    Swal.fire({
        icon: 'warning',
        title: 'Notice',
        text: message,
        background: '#1E293B',
        color: '#F8FAFC',
        confirmButtonColor: '#4F46E5',
        customClass: { popup: 'glass-card' }
    });
}

// --- Initialization & Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    // Preload train options immediately so data is ready when the user passes the password screen
    fetchAvailableTrains();

    // Login
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Toggle Password Visibility
    const togglePasswordBtn = document.getElementById('togglePasswordBtn');
    const passwordInput = document.getElementById('passwordInput');
    togglePasswordBtn.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        togglePasswordBtn.innerHTML = type === 'password' ? '<i class="fa-solid fa-eye"></i>' : '<i class="fa-solid fa-eye-slash"></i>';
    });

    // Search Form
    document.getElementById('searchCoachForm').addEventListener('submit', handleSearch);
    
    // Prevent non-numeric input for coach number
    const coachNumberInput = document.getElementById('coachNumberInput');
    coachNumberInput.addEventListener('input', function() {
        if (this.value.length > 6) {
            this.value = this.value.slice(0, 6);
        }
    });

    // WSP Event Listeners
    const wspCoachForm = document.getElementById('wspSearchCoachForm');
    if(wspCoachForm) {
        wspCoachForm.addEventListener('submit', handleWspSearch);
    }
    
    const wspDefectForm = document.getElementById('wspDefectForm');
    if(wspDefectForm) {
        wspDefectForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const btn = document.getElementById('wspSubmitDefectBtn');
            btn.disabled = true;
            btn.querySelector('.spinner').classList.remove('hidden');
            btn.querySelector('.btn-text').style.opacity = '0';
            
            const downloadDateStr = document.getElementById('wspDownloadDate').value;
            let monthName = '';
            if(downloadDateStr) {
                const d = new Date(downloadDateStr);
                monthName = d.toLocaleString('default', { month: 'long' });
            }
            
            const formData = {
                action: 'addWspEntry',
                coachNumber: document.getElementById('wspDefectCoachNum').value,
                downloadDate: downloadDateStr,
                month: monthName,
                psStatus: document.getElementById('wspPsStatus').value,
                wspCode: document.getElementById('wspCode').value,
                dumpValve: document.getElementById('wspDumpValve').value,
                sensorGap: document.getElementById('wspSensorGap').value,
                observation: document.getElementById('wspObservation').value,
                otherObservation: document.getElementById('wspOtherObservation').value,
                wheelCondition: document.getElementById('wspWheelCondition').value,
                defectCategory: document.getElementById('wspDefectCategory').value,
                attention: document.getElementById('wspAttention').value,
                followUp: document.getElementById('wspFollowUp').value,
                description: document.getElementById('wspDescription').value,
                itemRequired: document.getElementById('wspItemRequired').value,
                dataEntryBy: document.getElementById('wspDataEntryBy').value,
                checklistSubmitted: document.getElementById('wspChecklist').value
            };
            
            try {
                const response = await fetch(GOOGLE_APP_SCRIPT_URL, {
                    method: 'POST',
                    mode: 'no-cors', // Because Google Apps Script does not return proper CORS headers for POST without explicit handling sometimes, no-cors is a fire-and-forget approach
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });
                
                // Assuming success due to no-cors
                Swal.fire({
                    icon: 'success',
                    title: 'Defect Logged!',
                    text: 'The WSP defect has been added successfully.',
                    background: 'var(--surface)',
                    color: 'var(--text)'
                }).then(() => {
                    wspDefectForm.reset();
                    
                    // Close the accordion
                    const wrapper = document.getElementById('wspDefectFormWrapper');
                    if (wrapper && !wrapper.classList.contains('hidden')) {
                        wrapper.classList.add('hidden');
                        const header = wrapper.previousElementSibling;
                        if (header) {
                            header.querySelector('.chevron').classList.remove('fa-chevron-up');
                            header.querySelector('.chevron').classList.add('fa-chevron-down');
                        }
                    }
                    
                    // Refresh history
                    fetchWspHistory(formData.coachNumber);
                });
                
            } catch (error) {
                console.error('Error submitting form:', error);
                showErrorAlert('Failed to submit defect. Please try again.');
            } finally {
                btn.disabled = false;
                btn.querySelector('.spinner').classList.add('hidden');
                btn.querySelector('.btn-text').style.opacity = '1';
            }
        });
    }

});

// --- Navigation ---
function navigateTo(screenId) {
    // Hide all screens
    Object.values(screens).forEach(screen => {
        if (!screen) return;
        
        // Special case: keep search screen visible above results, but remove its huge vertical space
        if (screenId === 'wspResultsScreen' && screen.id === 'wspSearchScreen') {
            screen.style.minHeight = 'auto';
            return;
        }
        
        // Reset min-height when navigating back to search screen or away
        if (screen.id === 'wspSearchScreen' && screenId !== 'wspResultsScreen') {
            screen.style.minHeight = '100vh';
        }
        
        screen.classList.remove('active');
        screen.classList.add('hidden');
    });

    // Show target screen
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.remove('hidden');
        targetScreen.classList.add('active');
    }
}

function logout() {
    document.getElementById('passwordInput').value = '';
    navigateTo('loginScreen');
}

// --- Tab Logic ---
let trainsFetched = false;

async function switchSearchTab(tabName) {
    const coachTab = document.getElementById('tabCoach');
    const rakeTab = document.getElementById('tabRake');
    const coachForm = document.getElementById('searchCoachForm');
    const rakeForm = document.getElementById('searchRakeForm');
    
    if (tabName === 'coach') {
        coachTab.classList.add('active');
        rakeTab.classList.remove('active');
        coachForm.classList.remove('hidden');
        rakeForm.classList.add('hidden');
    } else {
        rakeTab.classList.add('active');
        coachTab.classList.remove('active');
        rakeForm.classList.remove('hidden');
        coachForm.classList.add('hidden');
        
        if (!trainsFetched) {
            await fetchAvailableTrains();
        }
    }
}

async function fetchAvailableTrains() {
    const trainSelect = document.getElementById('trainSelect');
    
    function populate(dataArr) {
        const options = '<option value="" disabled selected>Select Train</option>' + 
            dataArr.map(t => `<option value="${t}">${t}</option>`).join('');
        if (trainSelect) trainSelect.innerHTML = options;
        const wspSelect = document.getElementById('wspTrainSelect');
        if (wspSelect) wspSelect.innerHTML = options;
    }
    
    const cached = localStorage.getItem('cachedTrains');
    if (cached) {
        try {
            populate(JSON.parse(cached).data);
            trainsFetched = true;
        } catch (e) {}
    } else {
        trainSelect.innerHTML = '<option value="" disabled selected>Loading trains...</option>';
    }
    
    try {
        const url = `${GOOGLE_APP_SCRIPT_URL}?getTrains=true`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        
        if (data.status === 'success') {
            localStorage.setItem('cachedTrains', JSON.stringify(data));
            populate(data.data);
            trainsFetched = true;
        } else {
            throw new Error(data.message || 'Could not fetch trains');
        }
    } catch (error) {
        console.error('Error fetching trains:', error);
        if (!cached) trainSelect.innerHTML = '<option value="" disabled selected>Error loading trains</option>';
    }
}

// --- Login Logic ---
function handleLogin(e) {
    e.preventDefault();
    const password = document.getElementById('passwordInput').value;
    const errorMsg = document.getElementById('loginError');

    if (password === '1234') {
        errorMsg.classList.add('hidden');
        document.getElementById('passwordInput').value = '';
        navigateTo('dashboardScreen');
    } else {
        errorMsg.classList.remove('hidden');
        // Shake effect
        const card = document.querySelector('.login-card');
        card.style.animation = 'none';
        card.offsetHeight; // trigger reflow
        card.style.animation = 'shake 0.4s ease-in-out';
    }
}

// --- Search & Fetch Logic ---
async function handleSearch(e) {
    e.preventDefault();
    
    const coachNumber = document.getElementById('coachNumberInput').value;
    
    if (coachNumber.length !== 6) {
        showWarningAlert("Please enter a valid 6-digit coach number.");
        return;
    }
    
    const submitBtn = document.getElementById('searchSubmitBtn');
    const spinner = submitBtn.querySelector('.spinner');
    const btnText = submitBtn.querySelector('span');
    
    const cacheKey = 'cachedCoach_' + coachNumber;
    const cachedCoach = localStorage.getItem(cacheKey);
    let usedCache = false;
    
    if (cachedCoach) {
        try {
            const data = JSON.parse(cachedCoach);
            if (data.status === 'success') {
                if (data.data.length === 1) {
                    renderResults(data.data[0]);
                } else if (data.data.length > 1) {
                    renderSelectionList(data.data);
                }
                usedCache = true;
            }
        } catch (e) {
            console.error('Cache parsing error:', e);
        }
    }
    
    // Loading State
    spinner.classList.remove('hidden');
    btnText.style.opacity = '0';
    submitBtn.disabled = true;

    try {
        if (GOOGLE_APP_SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE') {
            // Mock Data for demonstration purposes since no URL is provided yet
            await simulateNetworkDelay();
            renderSelectionList([
                { "RLY": "SWR", "Coach Number": coachNumber, "Coach Type": "LHB AC 3-Tier" },
                { "RLY": "SER", "Coach Number": coachNumber, "Coach Type": "LHB AC 2-Tier" }
            ]);
        } else {
            // Actual API Call
            const url = `${GOOGLE_APP_SCRIPT_URL}?coachNumber=${encodeURIComponent(coachNumber)}`;
            const response = await fetch(url);
            
            if (!response.ok) throw new Error('Network response was not ok');
            
            const data = await response.json();
            
            if (data.status === 'success') {
                localStorage.setItem(cacheKey, JSON.stringify(data));
                if (data.data.length === 1) {
                    renderResults(data.data[0]);
                } else if (data.data.length > 1) {
                    renderSelectionList(data.data);
                } else {
                    throw new Error('Coach not found');
                }
            } else {
                throw new Error(data.message || 'Coach not found');
            }
        }
    } catch (error) {
        console.error('Error fetching data:', error);
        if (!usedCache) {
            if (error.message === 'Coach not found') {
                showWarningAlert(`Coach not available in database`);
            } else {
                showErrorAlert(`Error: ${error.message}`);
            }
        }
    } finally {
        // Reset Button
        spinner.classList.add('hidden');
        btnText.style.opacity = '1';
        submitBtn.disabled = false;
    }
}

// --- Rake Search & Fetch Logic ---
let currentTrainCoaches = []; // Store fetched train data

async function fetchRakes() {
    const trainSelect = document.getElementById('trainSelect').value;
    if (!trainSelect) {
        showWarningAlert("Please select a train.");
        return;
    }
    
    const fetchBtn = document.getElementById('fetchRakesBtn');
    const spinner = fetchBtn.querySelector('.spinner');
    const btnText = fetchBtn.querySelector('.btn-text');
    
    const cacheKey = 'cachedRakes_' + trainSelect;
    const cachedRakes = localStorage.getItem(cacheKey);
    let usedCache = false;
    
    if (cachedRakes) {
        try {
            const data = JSON.parse(cachedRakes);
            currentTrainCoaches = data.data;
            populateRakeDropdown(data.data, trainSelect);
            usedCache = true;
        } catch (e) {
            console.error('Cache parsing error:', e);
        }
    }
    
    spinner.classList.remove('hidden');
    btnText.style.opacity = '0';
    fetchBtn.disabled = true;

    try {
        const url = `${GOOGLE_APP_SCRIPT_URL}?train=${encodeURIComponent(trainSelect)}`;
        const response = await fetch(url);
        
        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.json();
        
        if (data.status === 'success' && data.data.length > 0) {
            localStorage.setItem(cacheKey, JSON.stringify(data));
            currentTrainCoaches = data.data;
            populateRakeDropdown(data.data, trainSelect);
        } else {
            throw new Error(data.message || 'No rakes found for this train');
        }
    } catch (error) {
        console.error('Error fetching rakes:', error);
        if (!usedCache) showErrorAlert(`Error: ${error.message}`);
    } finally {
        spinner.classList.add('hidden');
        btnText.style.opacity = '1';
        fetchBtn.disabled = false;
    }
}

function populateRakeDropdown(coachArray, trainCode) {
    const rakeSelect = document.getElementById('rakeSelect');
    rakeSelect.innerHTML = '<option value="" disabled selected>Select Rake</option>';
    
    const rakeSet = new Set();
    
    coachArray.forEach(coach => {
        const colO = coach['_colO'];
        if (colO) {
            // Remove the RK prefix and Train Code (e.g. RKCAPE)
            const prefix = 'RK' + trainCode;
            if (String(colO).startsWith(prefix)) {
                if (trainCode === 'CLONE') {
                    // CLONE format is RKCLONE01 (RK, CLONE, 01 is position). Only 1 rake.
                    rakeSet.add('1');
                } else {
                    const remainder = String(colO).substring(prefix.length); // e.g. '319' or '1119'
                    // Assuming last 2 digits are position, the rest is rake number
                    if (remainder.length >= 3) {
                        const rakeNum = remainder.slice(0, -2);
                        rakeSet.add(rakeNum);
                    } else {
                        // Fallback if structure is unexpected
                        rakeSet.add(remainder);
                    }
                }
            }
        }
    });
    
    // Sort rake numbers numerically
    const sortedRakes = Array.from(rakeSet).sort((a, b) => parseInt(a) - parseInt(b));
    
    if (sortedRakes.length === 0) {
        showWarningAlert("Found coaches for this train, but could not parse their Rake Numbers.");
        return;
    }
    
    sortedRakes.forEach(rake => {
        const option = document.createElement('option');
        option.value = rake;
        option.innerText = `Rake ${rake}`;
        rakeSelect.appendChild(option);
    });
    
    // Show the selection area
    document.getElementById('rakeSelectionArea').classList.remove('hidden');
    
    // If there's only 1 rake, automatically select it and view coaches
    if (sortedRakes.length === 1) {
        rakeSelect.value = sortedRakes[0];
        viewRakeCoaches();
    }
}

function viewRakeCoaches() {
    const trainCode = document.getElementById('trainSelect').value;
    const selectedRake = document.getElementById('rakeSelect').value;
    
    if (!selectedRake) {
        showWarningAlert("Please select a rake.");
        return;
    }
    
    // Filter coaches for the selected rake
    const rakeCoaches = [];
    currentTrainCoaches.forEach(coach => {
        const colO = coach['_colO'];
        if (colO) {
            const trainPrefix = 'RK' + trainCode;
            if (String(colO).startsWith(trainPrefix)) {
                if (trainCode === 'CLONE') {
                    if (selectedRake === '1') {
                        const pos = String(colO).substring(trainPrefix.length); // e.g., '01'
                        coach._position = parseInt(pos, 10);
                        rakeCoaches.push(coach);
                    }
                } else {
                    const remainder = String(colO).substring(trainPrefix.length);
                    if (remainder.length >= 3) {
                        const rNum = remainder.slice(0, -2);
                        const pos = remainder.slice(-2);
                        if (rNum === selectedRake) {
                            // Inject position into coach object for easy sorting
                            coach._position = parseInt(pos, 10);
                            rakeCoaches.push(coach);
                        }
                    }
                }
            }
        }
    });
    
    // Sort by position
    rakeCoaches.sort((a, b) => a._position - b._position);
    
    // Extract general details from the first coach in the rake
    if (rakeCoaches.length > 0) {
        const firstCoach = rakeCoaches[0];
        
        // Read strictly from _colP (Left Date/Departure) and _colQ (Arrival)
        let departureDate = firstCoach['_colP'] ? formatIfDate(firstCoach['_colP']) : '-';
        let arrivalDate = firstCoach['_colQ'] ? formatIfDate(firstCoach['_colQ']) : '-';
        
        document.getElementById('rakeArrivalDate').innerText = arrivalDate;
        document.getElementById('rakeDepartureDate').innerText = departureDate;
    } else {
        document.getElementById('rakeArrivalDate').innerText = '-';
        document.getElementById('rakeDepartureDate').innerText = '-';
    }
    
    // Render the table
    const tableBody = document.getElementById('rakeTableBody');
    tableBody.innerHTML = '';
    
    rakeCoaches.forEach(coach => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.onclick = () => renderResults(coach);
        
        // Find RLY, Coach No, Type
        const rly = coach['RLY'] || coach['Rly'] || coach['Col2'] || '-';
        
        let coachNum = '-';
        let type = coach['TYPE'] || coach['Coach Type'] || coach['Col3'] || '-';
        
        for (const key of Object.keys(coach)) {
            if (key.toLowerCase().includes('coach') && key.toLowerCase().includes('no')) coachNum = coach[key];
            if (key.toLowerCase().includes('coach num')) coachNum = coach[key];
        }
        
        const indication = coach['_colS'] || '-';
        
        tr.innerHTML = `
            <td>${coach._position}</td>
            <td>${rly}</td>
            <td>${coachNum}</td>
            <td>${type}</td>
            <td>${indication}</td>
        `;
        tableBody.appendChild(tr);
    });
    
    document.getElementById('rakeResultTitle').innerText = `${trainCode} - Rake ${selectedRake}`;
    navigateTo('rakeResultsScreen');
}

// --- Render Logic ---
let currentMatches = []; // Store matches to access them from the list click

function renderSelectionList(matchesArray, isWsp = false) {
    currentMatches = matchesArray;
    const container = document.getElementById('selectionListContainer');
    container.innerHTML = '';
    
    matchesArray.forEach((match, index) => {
        // Try to determine RLY and Coach Number for the list display
        const rly = match['RLY'] || 'Unknown';
        const type = match['TYPE'] || match['Coach Type'] || '';
        
        const item = document.createElement('div');
        item.className = 'list-item slide-up';
        item.style.animationDelay = `${Math.min(index * 0.05, 1)}s`;
        
        item.innerHTML = `
            <div class="list-item-content">
                <div class="list-item-title">${rly} Coach</div>
                <div class="list-item-subtitle">${type}</div>
            </div>
            <i class="fa-solid fa-chevron-right list-item-icon"></i>
        `;
        
        item.onclick = () => {
            if (isWsp) {
                renderWspResults(match);
            } else {
                renderResults(match);
            }
        };
        container.appendChild(item);
    });
    
    navigateTo('selectionScreen');
}

function renderResults(dataObj) {
    const container = document.getElementById('resultsContainer');
    
    // Try to build a clean title
    const rly = dataObj['RLY'] ? String(dataObj['RLY']).substring(0, 2) : '';
    let coachNum = '';
    for (const key of Object.keys(dataObj)) {
        if (key.toLowerCase().includes('coach') && key.toLowerCase().includes('no')) coachNum = dataObj[key];
        if (key.toLowerCase().includes('coach num')) coachNum = dataObj[key];
    }
    
    const displayTitle = (rly && coachNum) ? rly + coachNum : 'Coach Details';
    document.getElementById('resultCoachId').innerText = displayTitle;
    
    container.innerHTML = ''; // Clear previous

    const rawRow = dataObj['_rawRow'];
    const headers = dataObj['_headers'];

    if (!rawRow || rawRow.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-folder-open"></i>
                <p>No data available for this coach.</p>
            </div>
        `;
        navigateTo('resultsScreen');
        return;
    }

    // --- Grouping Logic ---
    const omittedLetters = ['N', 'T', 'U', 'V', 'W', 'AC', 'AD', 'AO', 'AT', 'AW', 'AY', 'AZ', 'BA', 'BB', 'BD', 'BE', 'BF', 'BJ', 'BL', 'BN', 'BP', 'BQ', 'BR', 'BS', 'BT', 'BV', 'BW', 'BX', 'BY', 'BZ'];
    const omittedIndices = omittedLetters.map(letterToIndex);
    const usedIndices = new Set();
    
    function findIndexByText(texts) {
        for (let i = 0; i < headers.length; i++) {
            if (!headers[i]) continue;
            const h = String(headers[i]).toLowerCase();
            if (texts.some(t => h.includes(t))) return i;
        }
        return -1;
    }
    
    let delayCounter = 0;
    
    function createGroup(title, columnsData) {
        if (columnsData.length === 0) return;
        
        let groupHTML = `<div class="group-section slide-up" style="animation-delay: ${Math.min(delayCounter * 0.05, 1)}s">
                            <h3 class="group-title">${title}</h3>
                            <div class="group-content">`;
        delayCounter++;
                            
        columnsData.forEach(col => {
            const val = rawRow[col.index];
            let displayValue = (val === '' || val === null || val === undefined) ? '-' : val;
            displayValue = formatIfDate(displayValue);
            
            groupHTML += `
                <div class="data-row">
                    <div class="data-label">${col.label}</div>
                    <div class="data-value">${displayValue}</div>
                </div>`;
            usedIndices.add(col.index);
        });
        
        groupHTML += `</div></div>`;
        const wrapper = document.createElement('div');
        wrapper.innerHTML = groupHTML;
        container.appendChild(wrapper.firstElementChild);
    }

    // Group 1: Coach Details
    const idxCoachNo = findIndexByText(['coach no', 'coach number', 'coach num']);
    const idxRly = findIndexByText(['rly']);
    const idxType = findIndexByText(['type']);
    const idxMake = letterToIndex('E');
    const idxColX = letterToIndex('X');
    const idxTypeOfWSPD = findIndexByText(['type of wspd']);
    
    const group1 = [];
    if (idxCoachNo !== -1) group1.push({ index: idxCoachNo, label: headers[idxCoachNo] || 'Coach Number' });
    if (idxRly !== -1) group1.push({ index: idxRly, label: headers[idxRly] || 'Railway' });
    if (idxType !== -1) group1.push({ index: idxType, label: headers[idxType] || 'Coach Type' });
    group1.push({ index: idxMake, label: headers[idxMake] || 'Make' });
    
    // Add specifically Column X and Type of WSPD
    group1.push({ index: idxColX, label: headers[idxColX] || 'Column X' });
    if (idxTypeOfWSPD !== -1 && idxTypeOfWSPD !== idxColX) group1.push({ index: idxTypeOfWSPD, label: headers[idxTypeOfWSPD] || 'Type of WSPD' });
    
    createGroup('Coach Details', group1);
    
    // Group 2: Location/Status
    const group2 = [
        { index: letterToIndex('O'), label: headers[letterToIndex('O')] || 'Current Position' },
        { index: letterToIndex('R'), label: headers[letterToIndex('R')] || 'Train Number' },
        { index: letterToIndex('S'), label: headers[letterToIndex('S')] || 'Coach Indication' },
        { index: letterToIndex('P'), label: headers[letterToIndex('P')] || 'Departure Date' },
        { index: letterToIndex('Q'), label: headers[letterToIndex('Q')] || 'Arrival Date' }
    ];
    createGroup('Location & Status', group2);

    // Group 3: PRO Details
    const idxDOC = findIndexByText(['doc']);
    const idxSS1 = findIndexByText(['ss1', 'ss 1', 'ss-1']);
    const idxSS1Done = findIndexByText(['ss1 done', 'ss 1 done']);
    const idxWTT = findIndexByText(['wtt']);
    
    const group3 = [
        { index: letterToIndex('H'), label: headers[letterToIndex('H')] || 'RD' },
        { index: letterToIndex('G'), label: headers[letterToIndex('G')] || 'SS2/SS3/DOM' }
    ];
    if (idxDOC !== -1) group3.push({ index: idxDOC, label: headers[idxDOC] || 'DOC' });
    if (idxSS1 !== -1 && idxSS1 !== idxSS1Done) group3.push({ index: idxSS1, label: headers[idxSS1] || 'SS1' });
    if (idxSS1Done !== -1) group3.push({ index: idxSS1Done, label: headers[idxSS1Done] || 'SS1 Done Date' });
    if (idxWTT !== -1) group3.push({ index: idxWTT, label: headers[idxWTT] || 'WTT' });
    createGroup('PRO Details', group3);
    
    // Group 4: Other Details
    const group4 = [];
    for (let i = 0; i < headers.length; i++) {
        // Skip omitted columns, already used columns, and empty headers
        if (!usedIndices.has(i) && !omittedIndices.includes(i) && headers[i]) {
            const h = String(headers[i]).toLowerCase();
            // Explicitly filter out any duplicate Coach Number columns from falling into Other Details
            if (h.includes('coach no') || h.includes('coach num')) {
                continue;
            }
            group4.push({ index: i, label: headers[i] });
        }
    }
    createGroup('Other Details', group4);

    navigateTo('resultsScreen');
}

// --- Utility Functions ---
function letterToIndex(letter) {
    let index = 0;
    for (let i = 0; i < letter.length; i++) {
        index = index * 26 + (letter.toUpperCase().charCodeAt(i) - 64);
    }
    return index - 1;
}
function formatIfDate(displayValue) {
    if (typeof displayValue === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(displayValue)) {
        const date = new Date(displayValue);
        if (!isNaN(date.getTime())) {
            const dd = String(date.getDate()).padStart(2, '0');
            const mm = String(date.getMonth() + 1).padStart(2, '0'); // January is 0!
            const yyyy = date.getFullYear();
            return `${dd}/${mm}/${yyyy}`;
        }
    }
    return displayValue;
}

// --- Mock Data Helpers (For Demo) ---
function simulateNetworkDelay() {
    return new Promise(resolve => setTimeout(resolve, 1500));
}

function renderMockData(id) {
    const mockData = {
        "Owning Railway": id.substring(0,2),
        "Coach Number": id.substring(2),
        "Coach Type": "LHB AC 3-Tier",
        "Built Year": "2018",
        "Factory": "RCF Kapurthala",
        "DOC": "12-05-2018",
        "DOM SS1 Date": "20-06-2020",
        "DOM SS2 Date": "15-08-2023",
        "Next SS1 Due": "20-06-2026",
        "Next SS2 Due": "15-08-2026",
        "Air Spring Make": "Firestone",
        "Brake Cylinder Make": "Knorr Bremse",
        "FIBA Installed": "Yes",
        "Bio Toilet Make": "Amit Engg",
        "Last POH Date": "01-01-2024",
        "Base Depot": "SBC",
        "Current Status": "In Service",
        "Sick Marking count": "2",
        "Wheel Profile L1": "28.5mm",
        "Wheel Profile R1": "28.4mm",
        // Adding a few more to simulate a long list
        "Battery Make": "Amara Raja",
        "Battery Capacity": "120 Ah",
        "Alternator Make": "Kapsons",
        "Roof AC Make": "Sidwal",
        "Fire Extinguisher exp": "12-2026"
    };
    
    renderResults(id, mockData);
}

// Add CSS keyframes for shake dynamically
const style = document.createElement('style');
style.innerHTML = `
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  50% { transform: translateX(5px); }
  75% { transform: translateX(-5px); }
}
`;
document.head.appendChild(style);


// --- WSP Entry Logic ---
function switchWspTab(tab) {
    const coachBtn = document.getElementById('wspTabCoach');
    const rakeBtn = document.getElementById('wspTabRake');
    const coachForm = document.getElementById('wspSearchCoachForm');
    const rakeForm = document.getElementById('wspSearchRakeForm');
    
    if (tab === 'coach') {
        if(coachBtn) coachBtn.classList.add('active');
        if(rakeBtn) rakeBtn.classList.remove('active');
        if(coachForm) coachForm.classList.remove('hidden');
        if(rakeForm) rakeForm.classList.add('hidden');
    } else {
        if(rakeBtn) rakeBtn.classList.add('active');
        if(coachBtn) coachBtn.classList.remove('active');
        if(rakeForm) rakeForm.classList.remove('hidden');
        if(coachForm) coachForm.classList.add('hidden');
        
        const trainSelect = document.getElementById('wspTrainSelect');
        if (trainSelect && trainSelect.options.length <= 1) {
            // Populate from the main array if we haven't yet, by calling loadTrainOptions but manually populating wspTrainSelect
            // Wait, loadTrainOptions only populates trainSelect. We can copy options.
            const mainSelect = document.getElementById('trainSelect');
            if(mainSelect.options.length > 1) {
                trainSelect.innerHTML = mainSelect.innerHTML;
            } else {
                // If main isn't loaded, load it, then copy
                fetchAvailableTrains().then(() => {
                    trainSelect.innerHTML = document.getElementById('trainSelect').innerHTML;
                });
            }
        }
    }
}

let currentWspTrainCoaches = [];

async function fetchWspRakes() {
    const trainSelect = document.getElementById('wspTrainSelect').value;
    if (!trainSelect) {
        showWarningAlert("Please select a train.");
        return;
    }
    
    const fetchBtn = document.getElementById('wspFetchRakesBtn');
    const spinner = fetchBtn.querySelector('.spinner');
    const btnText = fetchBtn.querySelector('.btn-text');
    
    const cacheKey = 'cachedRakes_' + trainSelect;
    const cachedRakes = localStorage.getItem(cacheKey);
    let usedCache = false;
    
    function renderWspRakes(data) {
        currentWspTrainCoaches = data.data;
        
        const rakeSelect = document.getElementById('wspRakeSelect');
        rakeSelect.innerHTML = '<option value="" disabled selected>Select Rake Number</option>';
        const rakeSet = new Set();
        
        currentWspTrainCoaches.forEach(coach => {
            const rakeStr = coach['_colO'];
            if (rakeStr) {
                let match = rakeStr.match(/\d+/);
                if(trainSelect === 'CLONE') match = ['1'];
                if (match) rakeSet.add(match[0]);
            }
        });
        
        const sortedRakes = Array.from(rakeSet).sort((a, b) => parseInt(a) - parseInt(b));
        
        if (sortedRakes.length === 0) {
            showWarningAlert("Found coaches, but could not parse Rake Numbers.");
            return;
        }
        
        sortedRakes.forEach(rake => {
            const option = document.createElement('option');
            option.value = rake;
            option.innerText = `Rake ${rake}`;
            rakeSelect.appendChild(option);
        });
        
        document.getElementById('wspRakeSelectionArea').classList.remove('hidden');
        
        if (sortedRakes.length === 1) {
            rakeSelect.value = sortedRakes[0];
            viewWspRakeCoaches();
        }
    }

    if (cachedRakes) {
        try {
            const data = JSON.parse(cachedRakes);
            renderWspRakes(data);
            usedCache = true;
        } catch (e) {
            console.error('Cache parsing error:', e);
        }
    }
    
    spinner.classList.remove('hidden');
    btnText.style.opacity = '0';
    fetchBtn.disabled = true;

    try {
        const url = `${GOOGLE_APP_SCRIPT_URL}?train=${encodeURIComponent(trainSelect)}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        
        if (data.status === 'success' && data.data.length > 0) {
            localStorage.setItem(cacheKey, JSON.stringify(data));
            renderWspRakes(data);
        } else {
            throw new Error(data.message || 'No rakes found for this train');
        }
    } catch (error) {
        console.error('Error fetching rakes:', error);
        if (!usedCache) showErrorAlert(error.message);
    } finally {
        spinner.classList.add('hidden');
        btnText.style.opacity = '1';
        fetchBtn.disabled = false;
    }
}

function viewWspRakeCoaches() {
    const selectedRake = document.getElementById('wspRakeSelect').value;
    const selectedTrain = document.getElementById('wspTrainSelect').value;
    
    if (!selectedRake) {
        showWarningAlert("Please select a rake first.");
        return;
    }
    
    document.getElementById('wspRakeResultTitle').innerText = `${selectedTrain} - Rake ${selectedRake}`;
    
    const rakeCoaches = currentWspTrainCoaches.filter(coach => {
        const rakeStr = coach['_colO'];
        if (!rakeStr) return false;
        let match = rakeStr.match(/\d+/);
        if(selectedTrain === 'CLONE') match = ['1'];
        return match && match[0] === selectedRake;
    });
    
    const tbody = document.getElementById('wspRakeTableBody');
    tbody.innerHTML = '';
    
    if (rakeCoaches.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No coaches found for this rake.</td></tr>`;
    } else {
        rakeCoaches.forEach(coach => {
            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer';
            
            const rakeStr = coach['_colO'] || '';
            let positionMatch = rakeStr.match(/\d+$/);
            if(selectedTrain === 'CLONE') positionMatch = rakeStr.match(/0(\d+)$/);
            const pos = positionMatch ? positionMatch[0] : '-';
            
            const rly = coach['RLY'] || '-';
            let coachNum = '';
            for (const key of Object.keys(coach)) {
                if (key.toLowerCase().includes('coach no') || key.toLowerCase().includes('coach num')) {
                    coachNum = coach[key];
                    break;
                }
            }
            
            const typeKey = Object.keys(coach).find(k => k.toLowerCase().includes('type'));
            const type = typeKey ? coach[typeKey] : '-';
            const indication = coach['_colS'] || '-';
            
            tr.innerHTML = `
                <td>${pos}</td>
                <td>${rly}</td>
                <td><span class="highlight-badge">${coachNum}</span></td>
                <td>${type}</td>
                <td>${indication}</td>
            `;
            
            tr.onclick = () => {
                renderWspResults(coach);
            };
            
            tbody.appendChild(tr);
        });
    }
    
    navigateTo('wspRakeResultsScreen');
}

async function handleWspSearch(e) {
    e.preventDefault();
    
    const coachNumber = document.getElementById('wspCoachNumberInput').value;
    
    if (coachNumber.length !== 6) {
        showWarningAlert("Please enter a valid 6-digit coach number.");
        return;
    }
    
    const submitBtn = document.getElementById('wspSearchSubmitBtn');
    const spinner = submitBtn.querySelector('.spinner');
    const btnText = submitBtn.querySelector('span');
    
    const cacheKey = 'cachedCoach_' + coachNumber;
    const cachedCoach = localStorage.getItem(cacheKey);
    let usedCache = false;
    
    if (cachedCoach) {
        try {
            const data = JSON.parse(cachedCoach);
            if (data.status === 'success') {
                if (data.data.length === 1) {
                    renderWspResults(data.data[0]);
                } else if (data.data.length > 1) {
                    renderSelectionList(data.data, true);
                }
                usedCache = true;
            }
        } catch (e) {
            console.error('Cache parsing error:', e);
        }
    }
    
    spinner.classList.remove('hidden');
    btnText.style.opacity = '0';
    submitBtn.disabled = true;

    try {
        const url = `${GOOGLE_APP_SCRIPT_URL}?coachNumber=${encodeURIComponent(coachNumber)}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        
        if (data.status === 'success') {
            localStorage.setItem(cacheKey, JSON.stringify(data));
            if (data.data.length === 1) {
                renderWspResults(data.data[0]);
            } else if (data.data.length > 1) {
                renderSelectionList(data.data, true);
            } else {
                throw new Error('Coach not found');
            }
        } else {
            throw new Error(data.message || 'Coach not found');
        }
    } catch (error) {
        console.error('Error fetching data:', error);
        if (!usedCache) {
            if (error.message === 'Coach not found') {
                showWarningAlert(`Coach not available in database`);
            } else {
                showErrorAlert(`Error: ${error.message}`);
            }
        }
    } finally {
        spinner.classList.add('hidden');
        btnText.style.opacity = '1';
        submitBtn.disabled = false;
    }
}

function renderWspResults(dataObj) {
    let coachNum = '';
    for (const key of Object.keys(dataObj)) {
        if (key.toLowerCase().includes('coach') && key.toLowerCase().includes('no')) coachNum = dataObj[key];
        if (key.toLowerCase().includes('coach num')) coachNum = dataObj[key];
    }
    if(!coachNum) coachNum = document.getElementById('wspCoachNumberInput').value;
    
    const rly = dataObj['RLY'] || dataObj['Rly'] || '-';
    const type = dataObj['TYPE'] || dataObj['Coach Type'] || '-';
    
    let typeOfWspd = '-';
    let trainNo = '-';
    let ci = '-';
    let arrivalDate = '-';
    let leftDate = '-';
    const headers = dataObj['_headers'];
    const rawRow = dataObj['_rawRow'];
    if (headers && rawRow) {
        for (let i = 0; i < headers.length; i++) {
            const h = String(headers[i]).toLowerCase().trim();
            if (h.includes('type of wspd')) {
                typeOfWspd = rawRow[i] || '-';
            } else if (h === 'train no' || h.includes('train') || h === 'status') {
                if(trainNo === '-') trainNo = rawRow[i] || '-';
            } else if (h === 'ci') {
                ci = rawRow[i] || '-';
            } else if (h === 'arrival' || h.includes('arrival date')) {
                arrivalDate = rawRow[i] || '-';
            } else if (h === 'left date' || h.includes('left date') || h.includes('departure')) {
                leftDate = rawRow[i] || '-';
            }
        }
    }

    const detailsContainer = document.getElementById('wspCoachDetailsContainer');
    if (detailsContainer) {
        // Format dates just in case they're long ISO strings
        const fmtDate = (dStr) => {
            if(!dStr || dStr === '-') return '-';
            let d = String(dStr);
            if(d.includes('T')) d = d.split('T')[0];
            const parts = d.split('-');
            if(parts.length === 3 && parts[0].length === 4) {
                return `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
            return d;
        };
        
        detailsContainer.innerHTML = `
            <div>
                <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Coach Number</span>
                <span style="font-weight:600; font-size:1.1rem; color: #10b981;">${coachNum}</span>
            </div>
            <div>
                <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Owning Railway</span>
                <span style="font-weight:500;">${rly}</span>
            </div>
            <div>
                <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Coach Type</span>
                <span style="font-weight:500;">${type}</span>
            </div>
            <div>
                <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Type of WSPD</span>
                <span style="font-weight:500;">${typeOfWspd}</span>
            </div>
            <div>
                <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Train Number</span>
                <span style="font-weight:500;" id="wspDetailsTrainNo">${trainNo}</span>
            </div>
            <div>
                <span style="font-size:0.75rem; color:var(--text-muted); display:block;">CI</span>
                <span style="font-weight:500;">${ci}</span>
            </div>
            <div>
                <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Left Date</span>
                <span style="font-weight:500;">${fmtDate(leftDate)}</span>
            </div>
            <div>
                <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Arrival Date</span>
                <span style="font-weight:500;" id="wspDetailsArrivalDate">${fmtDate(arrivalDate)}</span>
            </div>
        `;
    }
    
    fetchWspHistory(coachNum);
}

async function fetchWspHistory(coachNumber) {
    coachNumber = String(coachNumber).trim();
    if (!coachNumber || coachNumber.length !== 6) {
        showWarningAlert("Please enter a valid 6-digit coach number.");
        return;
    }
    
    // Check if called from form
    const submitBtn = document.getElementById('wspSearchSubmitBtn');
    if(submitBtn) {
        submitBtn.disabled = true;
        submitBtn.querySelector('.spinner').classList.remove('hidden');
        submitBtn.querySelector('.btn-text').style.opacity = '0';
    }
    
    Swal.fire({
        title: 'Loading History...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });
    
    try {
        const url = `${GOOGLE_APP_SCRIPT_URL}?coachNumber=${encodeURIComponent(coachNumber)}&sheetName=DOWNLOAD status modified`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.json();
        const historyContainer = document.getElementById('wspHistoryContainer');
        historyContainer.innerHTML = '';
        
        document.getElementById('wspResultCoachId').innerText = coachNumber;
        document.getElementById('wspDefectCoachNum').value = coachNumber;
        
        if (data.status === 'success' && data.data && data.data.length > 0) {
            data.data.forEach((entry, idx) => {
                const card = document.createElement('div');
                card.className = 'glass-card slide-up';
                card.style.background = 'rgba(255,255,255,0.02)';
                card.style.animationDelay = `${idx * 0.05}s`;
                card.style.padding = '1rem';
                card.style.marginBottom = '0.5rem';
                card.style.borderLeft = '3px solid #10b981';
                
                const dDate = entry['Download Date'] || entry['download date'] || '-';
                let fmtDDate = String(dDate);
                if (fmtDDate.includes('T')) fmtDDate = fmtDDate.split('T')[0];
                const parts = fmtDDate.split('-');
                if (parts.length === 3 && parts[0].length === 4) {
                    fmtDDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                }
                
                let html = `
                    <div class="accordion-header" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;" onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('.chevron').classList.toggle('fa-chevron-up'); this.querySelector('.chevron').classList.toggle('fa-chevron-down');">
                        <div style="font-weight: 600; color: #10b981;">Download Date: <span style="color:var(--text);">${fmtDDate}</span></div>
                        <i class="fa-solid fa-chevron-down chevron"></i>
                    </div>
                    <div class="accordion-content hidden" style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; margin-top:1.5rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1rem;">
                `;
                
                const excludeKeys = ['coach no', 'rake', 'train no', 'coach type', 'ci', 'left date', 'arrival date', 'arrival t no', 'wsp make', 'month', 'download date', 'wheel condition'];
                const fullWidthKeys = ['other observation', 'attention if any', 'downloading obseravtion', 'downloading observation', 'defect description'];
                
                // Render Wheel Condition first if it exists
                const wheelCondKey = Object.keys(entry).find(k => String(k).toLowerCase().trim() === 'wheel condition');
                if (wheelCondKey) {
                    html += `<div style="grid-column: 1 / -1;"><span style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom: 0.2rem;">${wheelCondKey}</span>
                             <span style="font-weight:500;">${entry[wheelCondKey] || '-'}</span></div>`;
                }
                
                for (const [key, value] of Object.entries(entry)) {
                    if (key.startsWith('_')) continue;
                    const cleanKey = String(key).toLowerCase().trim();
                    if (excludeKeys.includes(cleanKey)) continue;
                    
                    const isFullWidth = fullWidthKeys.includes(cleanKey);
                    const gridStyle = isFullWidth ? 'grid-column: 1 / -1;' : '';
                    
                    html += `<div style="${gridStyle}"><span style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom: 0.2rem;">${key}</span>
                             <span style="font-weight:500;">${value || '-'}</span></div>`;
                }
                html += '</div>';
                card.innerHTML = html;
                historyContainer.appendChild(card);
            });
        } else {
            historyContainer.innerHTML = `
                <div class="empty-state" style="padding: 1.5rem 0;">
                    <i class="fa-solid fa-check-circle" style="color: #10b981; font-size: 2rem; margin-bottom: 0.5rem;"></i>
                    <p>No previous reported wheel issue for above coach.</p>
                </div>
            `;
        }
        
        Swal.close();
        navigateTo('wspResultsScreen');
        
    } catch (error) {
        console.error('Error fetching WSP history:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Could not fetch history. Creating new entry allowed.',
            background: 'var(--surface)',
            color: 'var(--text)'
        });
        
        // Still allow entering defect
        document.getElementById('wspResultCoachId').innerText = coachNumber;
        document.getElementById('wspDefectCoachNum').value = coachNumber;
        const historyContainer = document.getElementById('wspHistoryContainer');
        historyContainer.innerHTML = `
            <div class="empty-state" style="padding: 1.5rem 0;">
                <p>Could not load history. Proceed to add new defect.</p>
            </div>
        `;
        navigateTo('wspResultsScreen');
    } finally {
        if(submitBtn) {
            submitBtn.disabled = false;
            submitBtn.querySelector('.spinner').classList.add('hidden');
            submitBtn.querySelector('.btn-text').style.opacity = '1';
        }
    }
}

// --- Force Refresh Logic ---
function forceRefreshData() {
    const syncBtn = document.querySelector('.sync-btn i');
    if (syncBtn) syncBtn.classList.add('fa-spin');
    
    // Clear all cached data
    localStorage.clear();
    
    // Re-fetch initial trains
    fetchAvailableTrains().then(() => {
        if (syncBtn) syncBtn.classList.remove('fa-spin');
        Swal.fire({
            icon: 'success',
            title: 'Data Synced',
            text: 'Local cache cleared. Fresh data is now being served.',
            background: 'var(--surface)',
            color: 'var(--text)',
            timer: 2000,
            showConfirmButton: false
        });
    }).catch(() => {
        if (syncBtn) syncBtn.classList.remove('fa-spin');
        showErrorAlert('Failed to sync. Please check your connection.');
    });
}
