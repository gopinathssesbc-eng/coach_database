// Replace this URL with the actual Web App URL provided by Google Apps Script after deployment
const GOOGLE_APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzVl0qS-ApqoWQwDSyluLOdV7JvinVSibq5SrB0G8T2ex1ynW4_ZGNBM4Pv-AhJ6KvU1Q/exec';

// URL for the new Schedule Database Apps Script
const SCHEDULE_APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxzSrcye1yLxG5fsOsOScrSHAPgPGaP1EsNyeLML9JQusykQ-xWzt5i4oYbTQT1LDTL/exec';

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
    wspDateResults: document.getElementById('wspDateResultsScreen'),
    wspResults: document.getElementById('wspResultsScreen'),
    scheduleSearch: document.getElementById('scheduleSearchScreen'),
    scheduleResults: document.getElementById('scheduleResultsScreen')
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
    
    // Schedule Event Listeners
    const scheduleSearchForm = document.getElementById('scheduleSearchForm');
    if(scheduleSearchForm) {
        scheduleSearchForm.addEventListener('submit', handleScheduleSearch);
    }
    
    const scheduleUpdateForm = document.getElementById('scheduleUpdateForm');
    if(scheduleUpdateForm) {
        scheduleUpdateForm.addEventListener('submit', handleScheduleSubmit);
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
        showErrorAlert('Invalid password');
        // Shake effect
        const card = document.querySelector('.login-card');
        card.style.animation = 'none';
        card.offsetHeight; // trigger reflow
        card.style.animation = 'shake 0.5s ease-in-out';
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
    
    // Loading State
    spinner.classList.remove('hidden');
    btnText.style.opacity = '0';
    submitBtn.disabled = true;

    const cacheKey = 'cachedCoach_' + coachNumber;
    const cachedCoach = localStorage.getItem(cacheKey);
    let usedCache = false;
    
    if (cachedCoach) {
        try {
            const data = JSON.parse(cachedCoach);
            if (data.status === 'success') {
                if (data.data.length === 1) {
                    await renderResults(data.data[0]);
                } else if (data.data.length > 1) {
                    renderSelectionList(data.data);
                }
                usedCache = true;
            }
        } catch (e) {
            console.error('Cache parsing error:', e);
        }
    }

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
                    await renderResults(data.data[0]);
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
function parseDateSafely(dateString) {
    if (!dateString || dateString === '-') return null;
    let doneDate = new Date(dateString);
    if (isNaN(doneDate.getTime()) && typeof dateString === 'string') {
        const parts = dateString.split('/');
        if (parts.length === 3) {
            doneDate = new Date(parts[2], parts[1] - 1, parts[0]);
        }
    }
    return isNaN(doneDate.getTime()) ? null : doneDate;
}

function getDueDateColor(dueDateString) {
    const dueDate = parseDateSafely(dueDateString);
    if (!dueDate) return 'inherit';
    
    const today = new Date();
    today.setHours(0,0,0,0);
    dueDate.setHours(0,0,0,0);
    
    const diffDays = Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return '#ef4444'; // Red (past)
    if (diffDays >= 0 && diffDays <= 3) return '#f97316'; // Orange (today or within 3 days)
    return '#10b981'; // Green
}

async function viewRakeCoaches() {
    const trainCode = document.getElementById('trainSelect').value;
    const selectedRake = document.getElementById('rakeSelect').value;
    
    if (!selectedRake) {
        showWarningAlert("Please select a rake.");
        return;
    }
    
    const fetchBtn = document.getElementById('viewRakeCoachesBtn');
    let spinner, btnText;
    if (fetchBtn) {
        spinner = fetchBtn.querySelector('.spinner');
        btnText = fetchBtn.querySelector('.btn-text');
        if (spinner) spinner.classList.remove('hidden');
        if (btnText) btnText.style.opacity = '0';
        fetchBtn.disabled = true;
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
    
    // Fetch schedule details for D2 and D3
    let scheduleMap = {};
    if (rakeCoaches.length > 0 && typeof SCHEDULE_APP_SCRIPT_URL !== 'undefined') {
        try {
            const coachNumbersList = rakeCoaches.map(coach => {
                for (const key of Object.keys(coach)) {
                    if (key.toLowerCase().includes('coach') && key.toLowerCase().includes('no')) return coach[key];
                    if (key.toLowerCase().includes('coach num')) return coach[key];
                }
                return null;
            }).filter(c => c).join(',');
            
            const scheduleUrl = `${SCHEDULE_APP_SCRIPT_URL}?coachNumbers=${encodeURIComponent(coachNumbersList)}`;
            const response = await fetch(scheduleUrl);
            const data = await response.json();
            
            if (data.status === 'success' && data.data) {
                data.data.forEach(s => {
                    const cNum = String(s['COACH NO.']).trim();
                    let d2DueVal = s['D2 DUE'] || s['D2 Due'] || s['D2 due'];
                    let d3DueVal = s['D3 DUE'] || s['D3 Due'] || s['D3 due'];
                    scheduleMap[cNum] = { 
                        d2: s['D 2'], 
                        d3: s['D 3'],
                        d2Due: d2DueVal,
                        d3Due: d3DueVal
                    };
                });
            }
        } catch(e) {
            console.error('Error fetching bulk schedules:', e);
        }
    }
    
    // Render the table
    const tableBody = document.getElementById('rakeTableBody');
    tableBody.innerHTML = '';
    
    rakeCoaches.forEach(coach => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.onclick = async () => {
            const icon = tr.querySelector('.fa-chevron-right, .fa-spinner');
            if (icon) icon.className = 'fa-solid fa-spinner fa-spin text-primary';
            await renderResults(coach);
            if (icon) icon.className = 'fa-solid fa-chevron-right text-primary';
        };
        
        // Find RLY, Coach No, Type
        const rly = coach['RLY'] || coach['Rly'] || coach['Col2'] || '-';
        
        let coachNum = '-';
        let type = coach['TYPE'] || coach['Coach Type'] || coach['Col3'] || '-';
        
        for (const key of Object.keys(coach)) {
            if (key.toLowerCase().includes('coach') && key.toLowerCase().includes('no')) coachNum = coach[key];
            if (key.toLowerCase().includes('coach num')) coachNum = coach[key];
        }
        
        const indication = coach['_colS'] || '-';
        
        let d2 = '-';
        let d3 = '-';
        let d2DueStr = '-';
        let d3DueStr = '-';
        let d2Color = 'inherit';
        let d3Color = 'inherit';
        

        
        if (scheduleMap[coachNum]) {
            const rawD2 = scheduleMap[coachNum].d2;
            const rawD3 = scheduleMap[coachNum].d3;
            const rawD2Due = scheduleMap[coachNum].d2Due;
            const rawD3Due = scheduleMap[coachNum].d3Due;
            
            d2 = rawD2 ? formatIfDate(rawD2) : '-';
            d3 = rawD3 ? formatIfDate(rawD3) : '-';
            
            d2DueStr = rawD2Due ? formatIfDate(rawD2Due) : '-';
            d3DueStr = rawD3Due ? formatIfDate(rawD3Due) : '-';
            
            d2Color = rawD2Due ? getDueDateColor(rawD2Due) : 'inherit';
            d3Color = rawD3Due ? getDueDateColor(rawD3Due) : 'inherit';
        }
        
        tr.innerHTML = `
            <td>${coach._position}</td>
            <td>${rly}</td>
            <td>${coachNum}</td>
            <td>${type}</td>
            <td>${indication}</td>
        `;
        // Remove bottom border from main row cells to connect with sub-row
        tr.querySelectorAll('td').forEach(td => td.style.borderBottom = 'none');
        
        tableBody.appendChild(tr);

        // Sub-row for D2 and D3 dates
        const subTr = document.createElement('tr');
        subTr.style.cursor = 'pointer';
        subTr.onclick = tr.onclick;
        subTr.innerHTML = `
            <td colspan="5" style="padding-top: 0; padding-bottom: 0.75rem; color: #94a3b8; font-size: 0.85rem;">
                <div style="display: flex; flex-direction: column; gap: 0.4rem;">
                    <div>
                        <span style="display: inline-block; width: 120px;">
                            <i class="fa-regular fa-calendar" style="margin-right: 4px;"></i>D2: ${d2}
                        </span>
                        <span style="display: inline-block;">
                            <span style="margin-right: 4px;">Due:</span>
                            <span style="color: ${d2Color}; font-weight: ${d2Color !== 'inherit' ? 'bold' : 'normal'}">${d2DueStr}</span>
                        </span>
                    </div>
                    <div>
                        <span style="display: inline-block; width: 120px;">
                            <i class="fa-regular fa-calendar" style="margin-right: 4px;"></i>D3: ${d3}
                        </span>
                        <span style="display: inline-block;">
                            <span style="margin-right: 4px;">Due:</span>
                            <span style="color: ${d3Color}; font-weight: ${d3Color !== 'inherit' ? 'bold' : 'normal'}">${d3DueStr}</span>
                        </span>
                    </div>
                </div>
            </td>
        `;
        tableBody.appendChild(subTr);
    });
    
    document.getElementById('rakeResultTitle').innerText = `${trainCode} - Rake ${selectedRake}`;
    
    if (fetchBtn) {
        if (spinner) spinner.classList.add('hidden');
        if (btnText) btnText.style.opacity = '1';
        fetchBtn.disabled = false;
    }
    
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
        
        item.onclick = async () => {
            if (isWsp) {
                renderWspResults(match);
            } else {
                const icon = item.querySelector('.list-item-icon');
                icon.className = 'fa-solid fa-spinner fa-spin list-item-icon';
                await renderResults(match);
                icon.className = 'fa-solid fa-chevron-right list-item-icon';
            }
        };
        container.appendChild(item);
    });
    
    navigateTo('selectionScreen');
}

async function renderResults(dataObj) {
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

    if (coachNum && typeof SCHEDULE_APP_SCRIPT_URL !== 'undefined') {
        await appendScheduleDetailsToResults(coachNum, container, delayCounter);
    }

    navigateTo('resultsScreen');
}

async function appendScheduleDetailsToResults(coachNumber, container, delayCounter) {
    try {
        const url = `${SCHEDULE_APP_SCRIPT_URL}?coachNumber=${encodeURIComponent(coachNumber)}`;
        const response = await fetch(url);
        if (!response.ok) return;
        const data = await response.json();
        
        if (data.status === 'success' && data.data) {
            const schedObj = data.data;
            let groupHTML = `<div class="group-section slide-up" style="animation-delay: ${Math.min(delayCounter * 0.05, 1)}s; border-color: #3b82f6;">
                                <h3 class="group-title" style="color: #3b82f6;"><i class="fa-solid fa-calendar-check"></i> Schedule Details</h3>
                                <div class="group-content">`;
            
            const fmtDate = (dStr) => {
                return formatDateDMY(dStr);
            };

            const getVal = (key, isDate=false) => {
                let val = schedObj[key];
                let displayValue = (val === '' || val === null || val === undefined) ? '-' : val;
                if (isDate) displayValue = fmtDate(displayValue);
                return displayValue;
            };

            const d2DueVal = schedObj['D2 DUE'] || schedObj['D2 Due'] || schedObj['D2 due'];
            const d3DueVal = schedObj['D3 DUE'] || schedObj['D3 Due'] || schedObj['D3 due'];
            const d2DueColor = d2DueVal ? getDueDateColor(d2DueVal) : 'inherit';
            const d3DueColor = d3DueVal ? getDueDateColor(d3DueVal) : 'inherit';

            // Full width rows for dates
            groupHTML += `
                <div class="data-row">
                    <div class="data-label">D2 Done Date</div>
                    <div class="data-value" style="font-weight: 500;">${getVal('D 2', true)}</div>
                </div>
                <div class="data-row">
                    <div class="data-label">D2 Due Date</div>
                    <div class="data-value" style="font-weight: bold; color: ${d2DueColor}">${fmtDate(d2DueVal)}</div>
                </div>
                <div class="data-row">
                    <div class="data-label">D3 Done Date</div>
                    <div class="data-value" style="font-weight: 500;">${getVal('D 3', true)}</div>
                </div>
                <div class="data-row">
                    <div class="data-label">D3 Due Date</div>
                    <div class="data-value" style="font-weight: bold; color: ${d3DueColor}">${fmtDate(d3DueVal)}</div>
                </div>
            `;

            // Helper for side-by-side rows
            const sideBySide = (label1, key1, label2, key2) => `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
                    <div class="data-row" style="margin-bottom: 0;">
                        <div class="data-label">${label1}</div>
                        <div class="data-value" style="font-weight: 500;">${getVal(key1)}</div>
                    </div>
                    <div class="data-row" style="margin-bottom: 0;">
                        <div class="data-label">${label2}</div>
                        <div class="data-value" style="font-weight: 500;">${getVal(key2)}</div>
                    </div>
                </div>
            `;

            groupHTML += sideBySide('L1', 'L1', 'R8', 'R8');
            groupHTML += sideBySide('L2', 'L2', 'R7', 'R7');
            groupHTML += sideBySide('L3', 'L3', 'R6', 'R6');
            groupHTML += sideBySide('L4', 'L4', 'R5', 'R5');
            groupHTML += sideBySide('PP End', 'stiffener plate PP end', 'NPP End', 'stiffener plate NPP end');

            // Full width row for remarks
            groupHTML += `
                <div class="data-row">
                    <div class="data-label">Remarks</div>
                    <div class="data-value" style="font-weight: 500;">${getVal('ATTENTION GIVEN IF ANY')}</div>
                </div>
            `;
            
            groupHTML += `</div></div>`;
            const wrapper = document.createElement('div');
            wrapper.innerHTML = groupHTML;
            
            const contentDiv = wrapper.querySelector('.group-content');
            const editBtn = document.createElement('button');
            editBtn.className = 'btn secondary-btn';
            editBtn.style.width = '100%';
            editBtn.style.marginTop = '1rem';
            editBtn.innerHTML = '<i class="fa-solid fa-pen"></i> Update Schedule Details';
            editBtn.onclick = () => renderScheduleResults(schedObj);
            contentDiv.appendChild(editBtn);
            
            const firstChild = wrapper.firstElementChild;
            firstChild.id = 'schedule-details-box';
            
            // Remove any existing schedule details box to prevent duplicates
            const existing = container.querySelector('#schedule-details-box');
            if (existing) existing.remove();
            
            // Insert after the first child (Coach Details)
            if (container.children.length > 1) {
                container.insertBefore(firstChild, container.children[1]);
            } else {
                container.appendChild(firstChild);
            }
        }
    } catch (e) {
        console.error('Failed to append schedule data:', e);
    }
}

// --- Utility Functions ---
function letterToIndex(letter) {
    let index = 0;
    for (let i = 0; i < letter.length; i++) {
        index = index * 26 + (letter.toUpperCase().charCodeAt(i) - 64);
    }
    return index - 1;
}
function formatDateDMY(dStr) {
    if (!dStr || dStr === '-') return '-';
    let d = String(dStr).trim();
    if (d.includes('T')) d = d.split('T')[0];
    
    // Check if it's already DD-MM-YYYY (or DD/MM/YYYY)
    if (d.match(/^\d{2}[-\/]\d{2}[-\/]\d{4}$/)) {
        return d.replace(/\//g, '-');
    }
    
    // If it's YYYY-MM-DD
    const parts = d.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    
    // Fallback parsing
    const parsed = new Date(d);
    if (!isNaN(parsed.getTime())) {
        return `${String(parsed.getDate()).padStart(2, '0')}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${parsed.getFullYear()}`;
    }
    
    return d;
}

// Keep formatIfDate as an alias for formatDateDMY for compatibility with existing calls
function formatIfDate(displayValue) {
    return formatDateDMY(displayValue);
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
    const dateBtn = document.getElementById('wspTabDate');
    const coachForm = document.getElementById('wspSearchCoachForm');
    const rakeForm = document.getElementById('wspSearchRakeForm');
    const dateForm = document.getElementById('wspSearchDateForm');
    
    if(coachBtn) coachBtn.classList.remove('active');
    if(rakeBtn) rakeBtn.classList.remove('active');
    if(dateBtn) dateBtn.classList.remove('active');
    
    if(coachForm) coachForm.classList.add('hidden');
    if(rakeForm) rakeForm.classList.add('hidden');
    if(dateForm) dateForm.classList.add('hidden');
    
    if (tab === 'coach') {
        if(coachBtn) coachBtn.classList.add('active');
        if(coachForm) coachForm.classList.remove('hidden');
    } else if (tab === 'rake') {
        if(rakeBtn) rakeBtn.classList.add('active');
        if(rakeForm) rakeForm.classList.remove('hidden');
        
        const trainSelect = document.getElementById('wspTrainSelect');
        if (trainSelect && trainSelect.options.length <= 1) {
            const mainSelect = document.getElementById('trainSelect');
            if(mainSelect && mainSelect.options.length > 1) {
                trainSelect.innerHTML = mainSelect.innerHTML;
            } else {
                fetchAvailableTrains().then(() => {
                    if(document.getElementById('trainSelect')) {
                        trainSelect.innerHTML = document.getElementById('trainSelect').innerHTML;
                    }
                });
            }
        }
    } else if (tab === 'date') {
        if(dateBtn) dateBtn.classList.add('active');
        if(dateForm) dateForm.classList.remove('hidden');
    }
}

async function fetchWspByDate() {
    const dateInput = document.getElementById('wspDateInput').value;
    if (!dateInput) {
        showWarningAlert("Please select a date.");
        return;
    }
    
    const fetchBtn = document.getElementById('wspFetchDateBtn');
    const spinner = fetchBtn.querySelector('.spinner');
    const btnText = fetchBtn.querySelector('.btn-text');
    
    spinner.classList.remove('hidden');
    btnText.style.opacity = '0';
    fetchBtn.disabled = true;

    try {
        const url = `${GOOGLE_APP_SCRIPT_URL}?date=${encodeURIComponent(dateInput)}&sheetName=DOWNLOAD status modified`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        
        if (data.status === 'success' && data.data && data.data.length > 0) {
            document.getElementById('wspDateResultTitle').innerText = `Defects for ${dateInput}`;
            
            const tbody = document.getElementById('wspDateTableBody');
            tbody.innerHTML = '';
            
            data.data.forEach(entry => {
                const tr = document.createElement('tr');
                tr.style.cursor = 'pointer';
                
                let coachNum = '';
                const coachKey = Object.keys(entry).find(k => k.toLowerCase().includes('coach no') || k.toLowerCase().includes('coach num'));
                if (coachKey) coachNum = entry[coachKey];
                if (!coachNum && entry['_rawRow']) coachNum = entry['_rawRow'][0];
                
                let rly = entry['RLY'] || '-';
                if (rly === '-') {
                    // Try to find RLY from currentTrainCoaches cache as fallback
                    if (typeof currentTrainCoaches !== 'undefined' && currentTrainCoaches.length > 0) {
                        const match = currentTrainCoaches.find(c => {
                            const ck = Object.keys(c).find(k => String(k).toLowerCase().includes('coach no') || String(k).toLowerCase().includes('coach num'));
                            return ck && c[ck] == coachNum;
                        });
                        if (match) rly = match['RLY'] || match['Rly'] || '-';
                    }
                }
                
                let wheelCondition = '-';
                const wcKey = Object.keys(entry).find(k => String(k).toLowerCase().includes('wheel condition'));
                if (wcKey) wheelCondition = entry[wcKey];
                
                // Extract other details for inline expansion
                const getVal = (searchStr) => {
                    // search by exact match first, then fallback to partial
                    let key = Object.keys(entry).find(k => String(k).toLowerCase() === searchStr.toLowerCase());
                    if (!key) {
                        key = Object.keys(entry).find(k => String(k).toLowerCase().includes(searchStr.toLowerCase()));
                    }
                    return key && entry[key] ? entry[key] : '-';
                };
                
                let type = getVal('coach type');
                let rake = getVal('rake');
                let trainNo = getVal('train no');
                let ci = getVal('ci');
                let leftDate = getVal('left date');
                let arrivalDate = getVal('arrival date');
                let arrivalTno = getVal('arrival t no');
                let wspMake = entry['WSP Make'] || getVal('wsp make');
                let typeOfWspd = entry['Type of WSPD'] || getVal('type of wspd');
                let psStatus = getVal('ps status');
                let wspCode = getVal('wsp code');
                let dumpValve = getVal('dump valve');
                let sensorGap = getVal('sensor gap');
                let observation = getVal('downloading'); // downloading obseravtion
                let otherObservation = getVal('other observation');
                let defectCat = getVal('defect category');
                let attentionIfAny = getVal('attention if any');
                let followUp = getVal('follo up'); // follo up remarks
                let defectDesc = getVal('defect desc');
                let itemRequired = getVal('item required');
                let checklist = getVal('checklist');
                let dataEntryBy = getVal('data entry');

                // Format dates to look cleaner
                const fmtDt = (d) => {
                    return formatDateDMY(d);
                };

                tr.innerHTML = `
                    <td>${rly}</td>
                    <td><span class="highlight-badge">${coachNum || '-'}</span></td>
                    <td>${wheelCondition}</td>
                    <td style="text-align:center;"><i class="fa-solid fa-chevron-down text-primary" style="transition: transform 0.3s;"></i></td>
                `;
                
                const detailsTr = document.createElement('tr');
                detailsTr.style.display = 'none';
                detailsTr.innerHTML = `
                    <td colspan="4" style="padding: 0; border-bottom: none;">
                        <div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px; margin: 0.5rem; border: 1px solid rgba(255,255,255,0.05);">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem; margin-bottom: 0.8rem;">
                                <div><small style="color: var(--text-muted); display: block;">Coach Type</small> <span style="font-weight: 500;">${type}</span></div>
                                <div><small style="color: var(--text-muted); display: block;">WSP Make</small> <span style="font-weight: 500;">${wspMake}</span></div>
                                
                                <div><small style="color: var(--text-muted); display: block;">Type of WSPD</small> <span style="font-weight: 500;">${typeOfWspd}</span></div>
                                <div><small style="color: var(--text-muted); display: block;">Rake / Train No.</small> <span style="font-weight: 500;">${rake} / ${trainNo}</span></div>
                                <div><small style="color: var(--text-muted); display: block;">CI</small> <span style="font-weight: 500;">${ci}</span></div>
                                
                                <div><small style="color: var(--text-muted); display: block;">Left Date</small> <span style="font-weight: 500;">${fmtDt(leftDate)}</span></div>
                                <div><small style="color: var(--text-muted); display: block;">Arrival Date</small> <span style="font-weight: 500;">${fmtDt(arrivalDate)}</span></div>
                                
                                <div><small style="color: var(--text-muted); display: block;">PS Status</small> <span style="font-weight: 500;">${psStatus}</span></div>
                                <div><small style="color: var(--text-muted); display: block;">WSP Code</small> <span style="font-weight: 500;">${wspCode}</span></div>
                                
                                <div><small style="color: var(--text-muted); display: block;">Dump Valve</small> <span style="font-weight: 500;">${dumpValve}</span></div>
                                <div><small style="color: var(--text-muted); display: block;">Sensor Gap</small> <span style="font-weight: 500;">${sensorGap}</span></div>
                                
                                <div style="grid-column: 1 / -1;"><small style="color: var(--text-muted); display: block;">Defect Category</small> <span style="font-weight: 500;">${defectCat}</span></div>
                                <div style="grid-column: 1 / -1;"><small style="color: var(--text-muted); display: block;">Downloading Observation</small> <span style="font-weight: 500;">${observation}</span></div>
                                <div style="grid-column: 1 / -1;"><small style="color: var(--text-muted); display: block;">Other Observation</small> <span style="font-weight: 500;">${otherObservation}</span></div>
                                <div style="grid-column: 1 / -1;"><small style="color: var(--text-muted); display: block;">Defect Description</small> <span style="font-weight: 500;">${defectDesc}</span></div>
                                <div style="grid-column: 1 / -1;"><small style="color: var(--text-muted); display: block;">Attention if Any</small> <span style="font-weight: 500;">${attentionIfAny}</span></div>
                                <div style="grid-column: 1 / -1;"><small style="color: var(--text-muted); display: block;">Follow Up Remarks</small> <span style="font-weight: 500;">${followUp}</span></div>
                                <div style="grid-column: 1 / -1;"><small style="color: var(--text-muted); display: block;">Item Required/Used</small> <span style="font-weight: 500;">${itemRequired}</span></div>
                                <div><small style="color: var(--text-muted); display: block;">Checklist Submitted</small> <span style="font-weight: 500;">${checklist}</span></div>
                                <div><small style="color: var(--text-muted); display: block;">Data Entry By</small> <span style="font-weight: 500;">${dataEntryBy}</span></div>
                            </div>
                        </div>
                    </td>
                `;
                
                tr.onclick = () => {
                    const icon = tr.querySelector('.fa-chevron-down');
                    if (detailsTr.style.display === 'none') {
                        detailsTr.style.display = 'table-row';
                        if(icon) icon.style.transform = 'rotate(180deg)';
                    } else {
                        detailsTr.style.display = 'none';
                        if(icon) icon.style.transform = 'rotate(0deg)';
                    }
                };
                
                tbody.appendChild(tr);
                tbody.appendChild(detailsTr);
            });
            
            navigateTo('wspDateResultsScreen');
        } else if (data.status === 'error') {
            throw new Error(data.message || `No defects found for ${dateInput}`);
        } else {
            showWarningAlert(`No defects found for ${dateInput}`);
        }
    } catch (error) {
        console.error('Error fetching WSP by date:', error);
        showErrorAlert(`Error: ${error.message}`);
    } finally {
        spinner.classList.add('hidden');
        btnText.style.opacity = '1';
        fetchBtn.disabled = false;
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
                const prefix = 'RK' + trainSelect;
                if (String(rakeStr).startsWith(prefix)) {
                    if (trainSelect === 'CLONE') {
                        rakeSet.add('1');
                    } else {
                        const remainder = String(rakeStr).substring(prefix.length);
                        if (remainder.length >= 3) {
                            const rakeNum = remainder.slice(0, -2);
                            rakeSet.add(rakeNum);
                        } else {
                            rakeSet.add(remainder);
                        }
                    }
                } else {
                    // Fallback just in case
                    let match = String(rakeStr).match(/\d+/);
                    if(trainSelect === 'CLONE') match = ['1'];
                    if (match) rakeSet.add(match[0]);
                }
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
    
    const rakeCoaches = [];
    currentWspTrainCoaches.forEach(coach => {
        const rakeStr = coach['_colO'];
        if (!rakeStr) return;
        
        const prefix = 'RK' + selectedTrain;
        if (String(rakeStr).startsWith(prefix)) {
            if (selectedTrain === 'CLONE') {
                if (selectedRake === '1') {
                    const pos = String(rakeStr).substring(prefix.length);
                    coach._position = parseInt(pos, 10);
                    rakeCoaches.push(coach);
                }
            } else {
                const remainder = String(rakeStr).substring(prefix.length);
                let rakeNum = remainder;
                if (remainder.length >= 3) {
                    rakeNum = remainder.slice(0, -2);
                    coach._position = parseInt(remainder.slice(-2), 10);
                } else {
                    coach._position = parseInt(remainder, 10);
                }
                if (rakeNum === selectedRake) {
                    rakeCoaches.push(coach);
                }
            }
        } else {
            let match = String(rakeStr).match(/\d+/);
            if(selectedTrain === 'CLONE') match = ['1'];
            if (match && match[0] === selectedRake) {
                const posMatch = String(rakeStr).match(/\d+$/);
                if (posMatch) {
                    const numStr = posMatch[0];
                    coach._position = numStr.length >= 3 ? parseInt(numStr.slice(-2), 10) : parseInt(numStr, 10);
                } else {
                    coach._position = 999;
                }
                rakeCoaches.push(coach);
            }
        }
    });
    
    // Sort by position
    rakeCoaches.sort((a, b) => (a._position || 999) - (b._position || 999));
    
    const tbody = document.getElementById('wspRakeTableBody');
    tbody.innerHTML = '';
    
    if (rakeCoaches.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No coaches found for this rake.</td></tr>`;
    } else {
        rakeCoaches.forEach(coach => {
            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer';
            
            const pos = coach._position !== undefined ? coach._position : '-';
            
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
            const wheelCond = coach['Wheel Condition'] || '-';
            const indication = coach['_colS'] || '-';
            
            tr.innerHTML = `
                <td style="border-bottom: none;">${pos}</td>
                <td style="border-bottom: none;">${rly}</td>
                <td style="border-bottom: none;"><span class="highlight-badge">${coachNum}</span></td>
                <td style="border-bottom: none;">${type}</td>
                <td style="border-bottom: none;">${indication}</td>
            `;
            
            const subTr = document.createElement('tr');
            subTr.style.cursor = 'pointer';
            subTr.innerHTML = `
                <td colspan="5" style="padding-top: 0; color: var(--text-muted); font-size: 0.85rem; border-top: none;">
                    <i class="fa-solid fa-triangle-exclamation" style="margin-right: 4px; opacity: 0.7;"></i> Wheel Cond: <span style="color: var(--text);">${wheelCond}</span>
                </td>
            `;
            
            tr.onclick = () => { renderWspResults(coach); };
            subTr.onclick = () => { renderWspResults(coach); };
            
            tbody.appendChild(tr);
            tbody.appendChild(subTr);
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
            return formatDateDMY(dStr);
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
                const fullWidthKeys = ['other observation', 'attention if any', 'downloading obseravtion', 'downloading observation', 'defect description', 'data entry by'];
                
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

// --- Schedule Entry Logic ---

async function handleScheduleSearch(e) {
    e.preventDefault();
    
    const coachNumber = document.getElementById('scheduleCoachNumberInput').value;
    
    if (coachNumber.length !== 6) {
        showWarningAlert("Please enter a valid 6-digit coach number.");
        return;
    }
    
    const submitBtn = document.getElementById('scheduleSearchSubmitBtn');
    const spinner = submitBtn.querySelector('.spinner');
    const btnText = submitBtn.querySelector('.btn-text');
    
    spinner.classList.remove('hidden');
    btnText.style.opacity = '0';
    submitBtn.disabled = true;

    try {
        const url = `${SCHEDULE_APP_SCRIPT_URL}?coachNumber=${encodeURIComponent(coachNumber)}`;
        const response = await fetch(url);
        
        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.json();
        
        if (data.status === 'success') {
            renderScheduleResults(data.data);
        } else {
            throw new Error(data.message || 'Coach not found');
        }
    } catch (error) {
        console.error('Error fetching schedule data:', error);
        if (error.message.includes('Coach not found')) {
            showErrorAlert(`Coach not available in schedule data base`);
        } else {
            showErrorAlert(`Error: ${error.message}`);
        }
    } finally {
        spinner.classList.add('hidden');
        btnText.style.opacity = '1';
        submitBtn.disabled = false;
    }
}

function renderScheduleResults(dataObj) {
    document.getElementById('scheduleResultCoachId').innerText = dataObj['COACH NO.'] || 'Schedule Entry';
    
    const detailsContainer = document.getElementById('scheduleCoachDetailsContainer');
    
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
    
    let trainNo = '-';
    let ci = '-';
    let arrivalDate = '-';
    let leftDate = '-';
    
    for (const key of Object.keys(dataObj)) {
        const h = String(key).toLowerCase().trim();
        if (h === 'train no' || h.includes('train')) {
            if (trainNo === '-') trainNo = dataObj[key] || '-';
        } else if (h === 'ci') {
            ci = dataObj[key] || '-';
        } else if (h === 'arrival' || h.includes('arrival date')) {
            if (arrivalDate === '-') arrivalDate = dataObj[key] || '-';
        } else if (h === 'left date' || h.includes('left date') || h.includes('departure')) {
            if (leftDate === '-') leftDate = dataObj[key] || '-';
        }
    }

    detailsContainer.innerHTML = `
        <div>
            <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Coach Number</span>
            <span style="font-weight:600; font-size:1.1rem; color: #3b82f6;">${dataObj['COACH NO.'] || '-'}</span>
        </div>
        <div>
            <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Owning Railway</span>
            <span style="font-weight:500;">${dataObj['OWN RLY'] || '-'}</span>
        </div>
        <div>
            <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Coach Type</span>
            <span style="font-weight:500;">${dataObj['COACH TYPE'] || '-'}</span>
        </div>
        <div>
            <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Rake</span>
            <span style="font-weight:500;">${dataObj['RAKE'] || '-'}</span>
        </div>
        <div>
            <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Train Number</span>
            <span style="font-weight:500;">${trainNo}</span>
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
            <span style="font-weight:500;">${fmtDate(arrivalDate)}</span>
        </div>
    `;
    
    // Helper to format date for input type="date"
    const inputDateFmt = (dStr) => {
        if(!dStr || dStr === '-') return '';
        let d = String(dStr);
        if(d.includes('T')) return d.split('T')[0];
        // If DD/MM/YYYY
        const parts = d.split('/');
        if(parts.length === 3) {
            return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
        }
        return '';
    };

    // Populate form
    document.getElementById('scheduleRowIndex').value = dataObj['_rowIndex'] || '';
    
    document.getElementById('scheduleD2').value = inputDateFmt(dataObj['D 2']);
    document.getElementById('scheduleD3').value = inputDateFmt(dataObj['D 3']);
    
    document.getElementById('scheduleL1').value = dataObj['L1'] || '';
    document.getElementById('scheduleR8').value = dataObj['R8'] || '';
    document.getElementById('scheduleL2').value = dataObj['L2'] || '';
    document.getElementById('scheduleR7').value = dataObj['R7'] || '';
    document.getElementById('scheduleL3').value = dataObj['L3'] || '';
    document.getElementById('scheduleR6').value = dataObj['R6'] || '';
    document.getElementById('scheduleL4').value = dataObj['L4'] || '';
    document.getElementById('scheduleR5').value = dataObj['R5'] || '';
    
    document.getElementById('schedulePPEnd').value = dataObj['stiffener plate PP end'] || '';
    document.getElementById('scheduleNPPEnd').value = dataObj['stiffener plate NPP end'] || '';
    
    document.getElementById('scheduleRemarks').value = dataObj['ATTENTION GIVEN IF ANY'] || '';
    
    navigateTo('scheduleResultsScreen');
}

async function handleScheduleSubmit(e) {
    e.preventDefault();
    
    const btn = document.getElementById('scheduleSubmitBtn');
    btn.disabled = true;
    btn.querySelector('.spinner').classList.remove('hidden');
    btn.querySelector('.btn-text').style.opacity = '0';
    
    const formData = {
        action: 'updateSchedule',
        rowIndex: document.getElementById('scheduleRowIndex').value,
        d2: document.getElementById('scheduleD2').value,
        d3: document.getElementById('scheduleD3').value,
        l1: document.getElementById('scheduleL1').value,
        r8: document.getElementById('scheduleR8').value,
        l2: document.getElementById('scheduleL2').value,
        r7: document.getElementById('scheduleR7').value,
        l3: document.getElementById('scheduleL3').value,
        r6: document.getElementById('scheduleR6').value,
        l4: document.getElementById('scheduleL4').value,
        r5: document.getElementById('scheduleR5').value,
        ppEnd: document.getElementById('schedulePPEnd').value,
        nppEnd: document.getElementById('scheduleNPPEnd').value,
        remarks: document.getElementById('scheduleRemarks').value
    };
    
    try {
        const response = await fetch(SCHEDULE_APP_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        Swal.fire({
            icon: 'success',
            title: 'Schedule Updated!',
            text: 'The schedule details have been updated successfully.',
            background: 'var(--surface)',
            color: 'var(--text)'
        });
        
    } catch (error) {
        console.error('Error submitting schedule update:', error);
        showErrorAlert('Failed to update schedule. Please try again.');
    } finally {
        btn.disabled = false;
        btn.querySelector('.spinner').classList.add('hidden');
        btn.querySelector('.btn-text').style.opacity = '1';
    }
}
