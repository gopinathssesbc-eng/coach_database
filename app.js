// Replace this URL with the actual Web App URL provided by Google Apps Script after deployment
const GOOGLE_APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwa2T8bY4P4sG9DmrEiesubIU5EKlFWTaQHhUgj_4O0hqqO2CSvHt6eELdScmadtX1ahQ/exec';

// URL for the new Schedule Database Apps Script
const SCHEDULE_APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzhXxdJp9xH_wagvryAUyGR_9gSJw-kwb5LM0dSFpCfoXkQMp_pvV_nWjKbd9OpapGE/exec';

const FIREBASE_DB_URL = 'https://coachdatawebapp-default-rtdb.firebaseio.com/wsp';

function parseToIsoDate(val) {
    if (!val) return '';
    if (val instanceof Date) {
        if (isNaN(val.getTime())) return '';
        return val.getFullYear() + '-' + String(val.getMonth() + 1).padStart(2, '0') + '-' + String(val.getDate()).padStart(2, '0');
    }
    const s = String(val).trim();
    const isoMatch = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (isoMatch) {
        return isoMatch[1] + '-' + String(isoMatch[2]).padStart(2, '0') + '-' + String(isoMatch[3]).padStart(2, '0');
    }
    const dmyMatch = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
    if (dmyMatch) {
        return dmyMatch[3] + '-' + String(dmyMatch[2]).padStart(2, '0') + '-' + String(dmyMatch[1]).padStart(2, '0');
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    return '';
}

async function fetchFromDatabase(queryType, param) {
    try {
        let url = '';
        const cb = `?t=${new Date().getTime()}`;
        if (queryType === 'coach') url = `${FIREBASE_DB_URL}/searchCoach/${param}.json${cb}`;
        else if (queryType === 'train') url = `${FIREBASE_DB_URL}/searchTrain/${param}.json${cb}`;
        else if (queryType === 'date') url = `${FIREBASE_DB_URL}/searchDate/${param}.json${cb}`;
        else if (queryType === 'pending') url = `${FIREBASE_DB_URL}/searchPending.json${cb}`;
        else if (queryType === 'history') url = `${FIREBASE_DB_URL}/history/${param}.json${cb}`;
        else if (queryType === 'trainList') url = `${FIREBASE_DB_URL}/trainList.json${cb}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            if (queryType === 'date') return { status: 'success', data: [] };
            return { status: 'error', message: 'Network error' };
        }
        
        const data = await response.json();
        if (data) {
            return data;
        } else {
            if (queryType === 'date') {
                return { status: 'success', data: [] };
            }
            return { status: 'error', message: 'Coach/Data not found in database' };
        }
    } catch (e) {
        if (queryType === 'date') {
            return { status: 'success', data: [] };
        }
        return { status: 'error', message: e.toString() };
    }
}

async function fetchFromScheduleDatabase(queryType, param) {
    try {
        const base = 'https://coachdatawebapp-default-rtdb.firebaseio.com/schedule/coaches';
        const cb = `?t=${new Date().getTime()}`;
        if (queryType === 'coach') {
            const res = await fetch(`${base}/${param}.json${cb}`);
            if(!res.ok) return {status: 'error', message: 'Network error'};
            const coachData = await res.json();
            if(coachData) {
                return { status: 'success', data: coachData };
            } else {
                const wspRes = await fetchFromDatabase('coach', param);
                if (wspRes && wspRes.status === 'success' && wspRes.data.length > 0) {
                    const wspCoach = wspRes.data[0];
                    return { status: 'success', isNewCoach: true, data: wspCoach };
                }
                return { status: 'error', message: 'Coach details not available in database' };
            }
        }
        else if (queryType === 'coachesList') {
            const list = param.split(',').map(s => s.trim()).filter(Boolean);
            const promises = list.map(c => 
                fetch(`${base}/${c}.json${cb}`)
                    .then(r => r.json())
                    .then(d => {
                        if (d) {
                            d._coachQueryNum = c;
                            return d;
                        }
                        return null;
                    })
                    .catch(() => null)
            );
            const results = await Promise.all(promises);
            const validData = results.filter(d => d !== null);
            return { status: 'success', data: validData };
        }
        else if (queryType === 'due') {
            const res = await fetch(`${base}.json${cb}`);
            if(!res.ok) return {status: 'error', message: 'Network error'};
            const allCoaches = await res.json();
            if(!allCoaches) return { status: 'success', data: [] };
            
            const selectedDate = new Date(param);
            selectedDate.setHours(0,0,0,0);
            const dueCoaches = [];
            for (const coachNo in allCoaches) {
                const row = allCoaches[coachNo];
                let pit1Match = false, pit2Match = false;
                
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
    scheduleResults: document.getElementById('scheduleResultsScreen'),
    dueCoaches: document.getElementById('dueCoachesScreen'),
    wspPendingResults: document.getElementById('wspPendingResultsScreen'),
    adminLogin: document.getElementById('adminLoginScreen'),
    adminDashboard: document.getElementById('adminDashboardScreen')
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
    
    // Log user visit for Admin Analytics
    logVisit();

    // Login
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Admin Login
    const adminLoginForm = document.getElementById('adminLoginForm');
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', handleAdminLogin);
    }
    
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
                editRow: document.getElementById('wspEditRowIndex').value || '',
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
                description: document.getElementById('wspDescription').value,
                itemRequired: document.getElementById('wspItemRequired').value,
                dataEntryBy: document.getElementById('wspDataEntryBy').value,
                checklistSubmitted: document.getElementById('wspChecklist').value,
                anyWorkPending: document.getElementById('wspAnyWorkPending').value,
                pendingWorkDesc: document.getElementById('wspPendingWorkDesc') ? document.getElementById('wspPendingWorkDesc').value : ''
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
                    document.getElementById('wspEditRowIndex').value = '';
                    const formTitle = document.getElementById('wspFormTitle');
                    if (formTitle) formTitle.innerHTML = `<i class="fa-solid fa-plus"></i> Add New Defect`;
                    const defectSubmitBtn = document.getElementById('wspSubmitDefectBtn');
                    if (defectSubmitBtn) {
                        const textSpan = defectSubmitBtn.querySelector('.btn-text');
                        if (textSpan) textSpan.innerText = 'Submit Defect';
                    }
                    
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
        
        const anyWorkPendingSelect = document.getElementById('wspAnyWorkPending');
        if (anyWorkPendingSelect) {
            anyWorkPendingSelect.addEventListener('change', () => {
                const descGroup = document.getElementById('wspPendingWorkDescGroup');
                const descInput = document.getElementById('wspPendingWorkDesc');
                if (anyWorkPendingSelect.value === 'Yes') {
                    if (descGroup) descGroup.style.borderColor = '#f59e0b';
                    if (descInput) {
                        descInput.required = true;
                        descInput.focus();
                    }
                } else {
                    if (descGroup) descGroup.style.borderColor = '';
                    if (descInput) {
                        descInput.required = false;
                    }
                }
            });
        }
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

function goBackFromWspResults() {
    if (window.wspLastSearchScreen) {
        navigateTo(window.wspLastSearchScreen);
    } else {
        navigateTo('wspSearchScreen');
    }
}

function goBackFromResults() {
    if (window.lastSearchScreen) {
        navigateTo(window.lastSearchScreen);
    } else {
        navigateTo('searchScreen');
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
    
    const searchResultScreens = ['selectionScreen', 'resultsScreen', 'rakeResultsScreen'];
    searchResultScreens.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('hidden');
            el.classList.remove('active');
        }
    });
    
    const searchScreen = document.getElementById('searchScreen');
    if (searchScreen) {
        searchScreen.style.minHeight = '100vh';
    }

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

// --- Admin & Analytics Logic ---
function generateSessionId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function getDeviceType() {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return "Tablet";
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) return "Mobile";
    return "Desktop";
}

function getBrowserName() {
    const ua = navigator.userAgent;
    if (ua.includes("Firefox/")) return "Firefox";
    if (ua.includes("Edg/")) return "Edge";
    if (ua.includes("Chrome/") && !ua.includes("Edg/")) return "Chrome";
    if (ua.includes("Safari/") && !ua.includes("Chrome/")) return "Safari";
    return "Other";
}

let sessionId = localStorage.getItem('sessionId');
if (!sessionId) {
    sessionId = generateSessionId();
    localStorage.setItem('sessionId', sessionId);
}

async function logVisit() {
    try {
        const device = getDeviceType();
        const browser = getBrowserName();
        const url = `${GOOGLE_APP_SCRIPT_URL}?logVisit=true&sessionId=${sessionId}&device=${encodeURIComponent(device)}&browser=${encodeURIComponent(browser)}`;
        // Fire and forget
        fetch(url).catch(e => console.error("Analytics ping failed", e));
    } catch (err) {}
}

function handleAdminLogin(e) {
    e.preventDefault();
    const passwordInput = document.getElementById('adminPasswordInput');
    const errorEl = document.getElementById('adminLoginError');

    if (passwordInput.value === '0488') {
        errorEl.classList.add('hidden');
        passwordInput.value = '';
        navigateTo('adminDashboardScreen');
        fetchAdminAnalytics();
    } else {
        errorEl.classList.remove('hidden');
        passwordInput.value = '';
    }
}

async function fetchAdminAnalytics() {
    const container = document.getElementById('adminDataContainer');
    const loading = document.getElementById('adminLoading');
    
    container.classList.add('hidden');
    loading.classList.remove('hidden');
    
    try {
        const url = `${GOOGLE_APP_SCRIPT_URL}?getAnalytics=true`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status === 'success' && data.data) {
            document.getElementById('adminDailyVisitors').innerText = data.data.dailyVisits;
            document.getElementById('adminActiveUsers').innerText = data.data.activeUsers;
            document.getElementById('adminMobileCount').innerText = data.data.devices.mobile;
            document.getElementById('adminDesktopCount').innerText = data.data.devices.desktop;
            
            loading.classList.add('hidden');
            container.classList.remove('hidden');
        } else {
            loading.innerHTML = `<p class="error-text">Failed to load analytics: ${data.message || 'Unknown error'}</p>`;
            console.error("Analytics fetch failed:", data);
        }
    } catch (e) {
        console.error(e);
        loading.innerHTML = `<p class="error-text">Error fetching analytics: ${e.message}</p>`;
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
        const data = await fetchFromDatabase('trainList');
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
                    window.lastSearchScreen = 'searchScreen';
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
            const data = await fetchFromDatabase('coach', coachNumber);
        if (data.status === 'success') {
                localStorage.setItem(cacheKey, JSON.stringify(data));
                if (data.data.length === 1) {
                    window.lastSearchScreen = 'searchScreen';
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
        const data = await fetchFromDatabase('train', trainSelect);
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

function parseRakeAndPosition(colO, trainCode) {
    if (!colO) return null;
    const prefix = 'RK' + trainCode;
    const str = String(colO).trim();
    if (!str.startsWith(prefix)) return null;

    if (trainCode === 'CLONE') {
        const clean = str.substring(prefix.length).trim();
        const m = clean.match(/^(\d+)/);
        const pos = m ? parseInt(m[1], 10) : 0;
        return { rakeNum: '1', position: pos };
    }

    const clean = str.substring(prefix.length).trim();
    const m = clean.match(/^(\d+)/);
    if (!m) return null;
    
    const digits = m[1];
    if (digits.length >= 3) {
        // Last 2 digits are the 2-digit position (01 to 24), preceding digits are the rake number
        const rakeNum = digits.slice(0, -2);
        const pos = parseInt(digits.slice(-2), 10);
        return { rakeNum, position: pos };
    } else {
        return { rakeNum: digits, position: 0 };
    }
}

function populateRakeDropdown(coachArray, trainCode) {
    const rakeSelect = document.getElementById('rakeSelect');
    rakeSelect.innerHTML = '<option value="" disabled selected>Select Rake</option>';
    
    const rakeSet = new Set();
    
    coachArray.forEach(coach => {
        const parsed = parseRakeAndPosition(coach['_colO'], trainCode);
        if (parsed && parsed.rakeNum) {
            rakeSet.add(parsed.rakeNum);
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
        if (dateString.includes('/')) {
            const parts = dateString.split('/');
            if (parts.length === 3) doneDate = new Date(parts[2], parts[1] - 1, parts[0]);
        } else if (dateString.includes('-')) {
            const parts = dateString.split('-');
            if (parts.length === 3 && parts[0].length === 2) doneDate = new Date(parts[2], parts[1] - 1, parts[0]);
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
        const parsed = parseRakeAndPosition(coach['_colO'], trainCode);
        if (parsed && parsed.rakeNum === selectedRake) {
            coach._position = parsed.position;
            rakeCoaches.push(coach);
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
            
            const data = await fetchFromScheduleDatabase('coachesList', coachNumbersList);
            if (data.status === 'success' && data.data) {
                data.data.forEach(s => {
                    let cNum = s._coachQueryNum || s['COACH NO'] || s['COACH NO.'] || s['COACH No'] || s['COach Number'] || s['coachNo'];
                    if (!cNum) {
                        for (const k of Object.keys(s)) {
                            if (k.toLowerCase().includes('coach') && k.toLowerCase().includes('no')) {
                                cNum = s[k];
                                break;
                            }
                        }
                    }
                    cNum = String(cNum || '').trim();
                    if (!cNum) return;

                    let d2Val = s['D 2'] || s['D2'] || s['d2'];
                    let d3Val = s['D 3'] || s['D3'] || s['d3'];
                    let d2DueVal = s['D2 DUE'] || s['D2 Due'] || s['D2 due'] || s['_d2'];
                    let d3DueVal = s['D3 DUE'] || s['D3 Due'] || s['D3 due'] || s['_d3'];
                    scheduleMap[cNum] = { 
                        d2: d2Val, 
                        d3: d3Val,
                        d2Due: d2DueVal,
                        d3Due: d3DueVal,
                        trainNo: s['TRAIN NO'] || s['_trainNo'] || s['trainNo'],
                        leftDate: s['LEFT DATE'],
                        arrivalDate: s['ARRIVAL DATE']
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
            window.lastSearchScreen = 'rakeResultsScreen';
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
        
        const coachNumStr = String(coachNum).trim();
        const sched = scheduleMap[coachNumStr] || scheduleMap[coachNum];
        
        let d2 = '-';
        let d3 = '-';
        let d2DueStr = '-';
        let d3DueStr = '-';
        let d2Color = 'inherit';
        let d3Color = 'inherit';
        
        if (sched) {
            const rawD2 = sched.d2;
            const rawD3 = sched.d3;
            const rawD2Due = sched.d2Due;
            const rawD3Due = sched.d3Due;
            
            d2 = rawD2 ? formatIfDate(rawD2) : '-';
            d3 = rawD3 ? formatIfDate(rawD3) : '-';
            
            d2DueStr = rawD2Due ? formatIfDate(rawD2Due) : '-';
            d3DueStr = rawD3Due ? formatIfDate(rawD3Due) : '-';
            
            d2Color = rawD2Due ? getDueDateColor(rawD2Due) : 'inherit';
            d3Color = rawD3Due ? getDueDateColor(rawD3Due) : 'inherit';
        }
        
        const leftDateVal = coach['LEFT DATE'] || coach['Left Date'] || coach['_colP'] || (sched ? sched.leftDate : null);
        const arrivalDateVal = coach['ARRIVAL DATE'] || coach['ARRIVAL'] || coach['Arrival Date'] || coach['Arrival'] || coach['_colQ'] || (sched ? sched.arrivalDate : null);
        const wspTypeVal = coach['TYPE OF WSPD'] || coach['Type of WSPD'] || coach['WSP'] || coach['TYPE OF FT WSPD'] || '-';
        const trainNoVal = (sched && sched.trainNo) || coach['STATUS'] || coach['DB Train No'] || coach['TRAIN NO'] || coach['Position'] || '-';
        const indicationVal = coach['_colS'] || coach['CI'] || coach['Indication'] || coach['Coach Indication'] || '-';

        tr.innerHTML = `
            <td>${coach._position !== undefined ? coach._position : '-'}</td>
            <td>${rly}</td>
            <td><span class="highlight-badge">${coachNum}</span></td>
            <td>${type}</td>
            <td>${leftDateVal ? formatIfDate(leftDateVal) : '-'}</td>
            <td>${arrivalDateVal ? formatIfDate(arrivalDateVal) : '-'}</td>
            <td>${wspTypeVal}</td>
            <td>${trainNoVal}</td>
            <td>${indicationVal}</td>
        `;
        // Remove bottom border from main row cells to connect with sub-row
        tr.querySelectorAll('td').forEach(td => td.style.borderBottom = 'none');
        
        tableBody.appendChild(tr);

        // Sub-row for D2 and D3 dates
        const subTr = document.createElement('tr');
        subTr.style.cursor = 'pointer';
        subTr.onclick = tr.onclick;
        subTr.innerHTML = `
            <td colspan="9" style="padding-top: 0; padding-bottom: 0.75rem; color: #94a3b8; font-size: 0.85rem;">
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
                window.wspLastSearchScreen = 'selectionScreen';
                renderWspResults(match);
            } else {
                window.lastSearchScreen = 'selectionScreen';
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

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function toggleSectionAccordion(sectionId) {
    const sec = document.getElementById(sectionId);
    if (!sec) return;
    const content = sec.querySelector('.group-content');
    const isCollapsed = sec.classList.toggle('is-collapsed');
    if (content) {
        content.style.display = isCollapsed ? 'none' : (content.classList.contains('compact-grid') ? 'grid' : 'flex');
    }
    const hint = sec.querySelector('.collapsed-hint');
    if (hint) {
        hint.style.display = isCollapsed ? 'inline' : 'none';
    }
    if (sectionId === 'section-other' && !isCollapsed) {
        window._userOpenedOtherDetails = true;
    }
}

function toggleAllCoachSections() {
    const container = document.getElementById('resultsContainer');
    if (!container) return;
    const sections = container.querySelectorAll('.group-section');
    const hasCollapsed = Array.from(sections).some(s => s.classList.contains('is-collapsed'));
    
    sections.forEach(sec => {
        const content = sec.querySelector('.group-content');
        const hint = sec.querySelector('.collapsed-hint');
        if (hasCollapsed) {
            sec.classList.remove('is-collapsed');
            if (content) content.style.display = content.classList.contains('compact-grid') ? 'grid' : 'flex';
            if (hint) hint.style.display = 'none';
        } else {
            sec.classList.add('is-collapsed');
            if (content) content.style.display = 'none';
            if (hint) hint.style.display = 'inline';
        }
    });
    
    const icon = document.getElementById('expandAllIcon');
    if (icon) {
        icon.className = hasCollapsed ? 'fa-solid fa-angles-up' : 'fa-solid fa-angles-down';
    }
}

function filterCoachDetailsFields(query) {
    const q = String(query || '').trim().toLowerCase();
    const clearBtn = document.getElementById('clearCoachFieldSearchBtn');
    if (clearBtn) clearBtn.style.display = q ? 'block' : 'none';
    
    const container = document.getElementById('resultsContainer');
    if (!container) return;
    
    const rows = container.querySelectorAll('.data-row, .sched-tile, .axle-cell');
    
    if (!q) {
        rows.forEach(r => r.style.display = '');
        const otherSec = document.getElementById('section-other');
        if (otherSec && !window._userOpenedOtherDetails) {
            otherSec.classList.add('is-collapsed');
            const content = otherSec.querySelector('.group-content');
            if (content) content.style.display = 'none';
            const hint = otherSec.querySelector('.collapsed-hint');
            if (hint) hint.style.display = 'inline';
        }
        return;
    }
    
    // Auto-expand all sections so matches are immediately visible
    container.querySelectorAll('.group-section').forEach(sec => {
        sec.classList.remove('is-collapsed');
        const content = sec.querySelector('.group-content');
        if (content) content.style.display = content.classList.contains('compact-grid') ? 'grid' : 'flex';
        const hint = sec.querySelector('.collapsed-hint');
        if (hint) hint.style.display = 'none';
    });
    
    rows.forEach(r => {
        const lbl = (r.getAttribute('data-label') || '').toLowerCase();
        const val = (r.getAttribute('data-value') || '').toLowerCase();
        const text = (r.innerText || '').toLowerCase();
        
        if (lbl.includes(q) || val.includes(q) || text.includes(q)) {
            r.style.display = '';
        } else {
            r.style.display = 'none';
        }
    });
}

function clearCoachFieldSearch() {
    const input = document.getElementById('coachSearchFieldInput');
    if (input) {
        input.value = '';
        filterCoachDetailsFields('');
    }
}

function jumpToSection(sectionId) {
    const container = document.getElementById('resultsContainer');
    if (!container) return;
    
    const strip = container.querySelector('.results-nav-strip');
    if (strip && event && event.currentTarget) {
        strip.querySelectorAll('.nav-chip').forEach(c => c.classList.remove('active'));
        event.currentTarget.classList.add('active');
    }
    
    if (sectionId === 'all') {
        container.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }
    
    const target = document.getElementById(sectionId);
    if (target) {
        if (target.classList.contains('is-collapsed')) {
            toggleSectionAccordion(sectionId);
        }
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function openScheduleEntryForCoach(coachNum) {
    navigateTo('scheduleSearchScreen');
    const searchInput = document.getElementById('scheduleCoachNumberInput');
    if (searchInput) {
        searchInput.value = coachNum;
        const form = document.getElementById('scheduleSearchForm');
        if (form) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }
}

async function renderResults(dataObj) {
    const container = document.getElementById('resultsContainer');
    window._userOpenedOtherDetails = false;
    
    // Try to build a clean title
    const rly = dataObj['RLY'] ? String(dataObj['RLY']).substring(0, 2) : '';
    let coachNum = '';
    for (const key of Object.keys(dataObj)) {
        if (key.toLowerCase().includes('coach') && key.toLowerCase().includes('no')) coachNum = dataObj[key];
        if (key.toLowerCase().includes('coach num')) coachNum = dataObj[key];
    }
    
    const displayTitle = (rly && coachNum) ? rly + coachNum : (coachNum || 'Coach Details');
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
    
    const idxCoachNo = findIndexByText(['coach no', 'coach number', 'coach num']);
    const idxRly = findIndexByText(['rly']);
    const idxType = findIndexByText(['type']);
    const idxMake = letterToIndex('E');
    const idxColX = letterToIndex('X');
    const idxTypeOfWSPD = findIndexByText(['type of wspd']);
    const idxTrainNo = letterToIndex('R');
    const idxPos = letterToIndex('O');

    const cleanRly = rly || (idxRly !== -1 && rawRow[idxRly]) || 'IR';
    const cleanType = (idxType !== -1 && rawRow[idxType]) || 'Coach';
    const cleanMake = (idxMake >= 0 && rawRow[idxMake]) || '-';
    const cleanWspVal = (idxColX >= 0 && rawRow[idxColX]) ? rawRow[idxColX] : '';
    const cleanWspType = (idxTypeOfWSPD !== -1 && rawRow[idxTypeOfWSPD]) ? rawRow[idxTypeOfWSPD] : '';
    const cleanWspCombined = cleanWspVal ? (cleanWspType && cleanWspType !== cleanWspVal ? `${cleanWspVal} (${cleanWspType})` : cleanWspVal) : (cleanWspType || '-');
    const cleanTrain = (idxTrainNo >= 0 && rawRow[idxTrainNo]) || '-';
    const cleanPos = (idxPos >= 0 && rawRow[idxPos]) || '-';

    // 1. Render Top Coach Hero Summary Card
    const heroHTML = `
        <div class="coach-hero-card slide-up">
            <div class="hero-header-row">
                <div class="hero-id-wrap">
                    <span class="hero-rly-badge">${escapeHtml(cleanRly)}</span>
                    <span class="hero-coach-num">${escapeHtml(coachNum || displayTitle)}</span>
                </div>
                <span class="hero-type-badge">${escapeHtml(cleanType)}</span>
            </div>
            
            <div class="hero-specs-pills">
                <span class="hero-pill"><i class="fa-solid fa-industry"></i> Make: <strong>${escapeHtml(cleanMake)}</strong></span>
                <span class="hero-pill"><i class="fa-solid fa-shield-halved"></i> WSP: <strong>${escapeHtml(cleanWspCombined)}</strong></span>
                <span class="hero-pill"><i class="fa-solid fa-train"></i> Train: <strong>${escapeHtml(cleanTrain)}</strong></span>
                <span class="hero-pill"><i class="fa-solid fa-location-crosshairs"></i> Pos: <strong>${escapeHtml(cleanPos)}</strong></span>
            </div>

            <div class="hero-due-row" id="heroDueRow">
                <div class="hero-due-chip" id="heroD2DueChip">
                    <span class="due-chip-lbl">D2 DUE</span>
                    <span class="due-chip-val" id="heroD2DueVal"><i class="fa-solid fa-circle-notch fa-spin"></i> Checking...</span>
                </div>
                <div class="hero-due-chip" id="heroD3DueChip">
                    <span class="due-chip-lbl">D3 DUE</span>
                    <span class="due-chip-val" id="heroD3DueVal"><i class="fa-solid fa-circle-notch fa-spin"></i> Checking...</span>
                </div>
            </div>
        </div>
    `;
    const heroWrapper = document.createElement('div');
    heroWrapper.innerHTML = heroHTML;
    container.appendChild(heroWrapper.firstElementChild);

    // 2. Render Results Toolbar (Category Navigation Chips + Instant Filter Search)
    const toolbarHTML = `
        <div class="results-toolbar slide-up">
            <div class="results-nav-strip">
                <button class="nav-chip active" onclick="jumpToSection('all')"><i class="fa-solid fa-layer-group"></i> All</button>
                <button class="nav-chip" onclick="jumpToSection('schedule-details-box')"><i class="fa-solid fa-calendar-check"></i> Schedule</button>
                <button class="nav-chip" onclick="jumpToSection('section-location')"><i class="fa-solid fa-location-dot"></i> Status</button>
                <button class="nav-chip" onclick="jumpToSection('section-pro')"><i class="fa-solid fa-wrench"></i> PRO</button>
                <button class="nav-chip" onclick="jumpToSection('section-other')"><i class="fa-solid fa-bars-staggered"></i> More</button>
            </div>
            <div class="results-search-box">
                <i class="fa-solid fa-magnifying-glass search-icon"></i>
                <input type="text" id="coachSearchFieldInput" placeholder="Filter details (e.g. wsp, date, axle)..." oninput="filterCoachDetailsFields(this.value)">
                <button id="clearCoachFieldSearchBtn" class="clear-search-btn" style="display:none;" onclick="clearCoachFieldSearch()"><i class="fa-solid fa-xmark"></i></button>
                <button class="expand-all-btn" id="expandAllSectionsBtn" onclick="toggleAllCoachSections()" title="Expand or collapse all sections">
                    <i class="fa-solid fa-angles-down" id="expandAllIcon"></i>
                </button>
            </div>
        </div>
    `;
    const toolbarWrapper = document.createElement('div');
    toolbarWrapper.innerHTML = toolbarHTML;
    container.appendChild(toolbarWrapper.firstElementChild);

    let delayCounter = 1;
    
    function createGroup(title, columnsData, options = {}) {
        if (columnsData.length === 0) return;
        
        const icon = options.icon || 'fa-circle-info';
        const sectionId = options.sectionId || ('sec-' + Math.random().toString(36).substr(2, 6));
        const isCollapsed = !!options.collapsedByDefault;
        const count = columnsData.length;
        
        let groupHTML = `
            <div class="group-section slide-up ${isCollapsed ? 'is-collapsed' : ''}" id="${sectionId}" style="animation-delay: ${Math.min(delayCounter * 0.05, 1)}s">
                <div class="group-header" onclick="toggleSectionAccordion('${sectionId}')">
                    <div class="group-header-left">
                        <i class="fa-solid ${icon} group-header-icon"></i>
                        <h3 class="group-title">${title}</h3>
                        <span class="group-count-badge">${count}</span>
                    </div>
                    <div class="group-header-right">
                        ${isCollapsed ? '<span class="collapsed-hint">Tap to view</span>' : ''}
                        <i class="fa-solid fa-chevron-up accordion-chevron"></i>
                    </div>
                </div>
                <div class="group-content compact-grid" ${isCollapsed ? 'style="display:none;"' : ''}>`;
        delayCounter++;
                                
        columnsData.forEach(col => {
            const val = rawRow[col.index];
            let displayValue = (val === '' || val === null || val === undefined) ? '-' : val;
            displayValue = formatIfDate(displayValue);
            
            const isLong = String(displayValue).length > 20 || String(col.label).length > 22;
            const fullWidthClass = isLong ? ' full-width' : '';
            
            groupHTML += `
                <div class="data-row${fullWidthClass}" data-label="${escapeHtml(String(col.label).toLowerCase())}" data-value="${escapeHtml(String(displayValue).toLowerCase())}">
                    <div class="data-label">${escapeHtml(col.label)}</div>
                    <div class="data-value">${escapeHtml(displayValue)}</div>
                </div>`;
            usedIndices.add(col.index);
        });
        
        groupHTML += `</div></div>`;
        const wrapper = document.createElement('div');
        wrapper.innerHTML = groupHTML;
        container.appendChild(wrapper.firstElementChild);
    }

    // Group 1: Coach Details
    const group1 = [];
    if (idxCoachNo !== -1) group1.push({ index: idxCoachNo, label: headers[idxCoachNo] || 'Coach Number' });
    if (idxRly !== -1) group1.push({ index: idxRly, label: headers[idxRly] || 'Railway' });
    if (idxType !== -1) group1.push({ index: idxType, label: headers[idxType] || 'Coach Type' });
    group1.push({ index: idxMake, label: headers[idxMake] || 'Make' });
    group1.push({ index: idxColX, label: headers[idxColX] || 'Column X' });
    if (idxTypeOfWSPD !== -1 && idxTypeOfWSPD !== idxColX) group1.push({ index: idxTypeOfWSPD, label: headers[idxTypeOfWSPD] || 'Type of WSPD' });
    
    createGroup('Coach Details', group1, {
        icon: 'fa-train',
        sectionId: 'section-coach',
        collapsedByDefault: false
    });
    
    // Group 2: Location/Status
    const group2 = [
        { index: letterToIndex('O'), label: headers[letterToIndex('O')] || 'Current Position' },
        { index: letterToIndex('R'), label: headers[letterToIndex('R')] || 'Train Number' },
        { index: letterToIndex('S'), label: headers[letterToIndex('S')] || 'Coach Indication' },
        { index: letterToIndex('P'), label: headers[letterToIndex('P')] || 'Departure Date' },
        { index: letterToIndex('Q'), label: headers[letterToIndex('Q')] || 'Arrival Date' }
    ];
    createGroup('Location & Status', group2, {
        icon: 'fa-location-dot',
        sectionId: 'section-location',
        collapsedByDefault: false
    });

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
    
    createGroup('PRO Details', group3, {
        icon: 'fa-wrench',
        sectionId: 'section-pro',
        collapsedByDefault: false
    });
    
    // Group 4: Other Details (Collapsed by default on mobile to save vertical scrolling)
    const group4 = [];
    for (let i = 0; i < headers.length; i++) {
        if (!usedIndices.has(i) && !omittedIndices.includes(i) && headers[i]) {
            const h = String(headers[i]).toLowerCase();
            if (h.includes('coach no') || h.includes('coach num')) {
                continue;
            }
            group4.push({ index: i, label: headers[i] });
        }
    }
    createGroup('Other Details', group4, {
        icon: 'fa-bars-staggered',
        sectionId: 'section-other',
        collapsedByDefault: true
    });

    if (coachNum && typeof SCHEDULE_APP_SCRIPT_URL !== 'undefined') {
        await appendScheduleDetailsToResults(coachNum, container, delayCounter);
    }
    
    navigateTo('resultsScreen');
}

async function appendScheduleDetailsToResults(coachNumber, container, delayCounter) {
    try {
        const data = await fetchFromScheduleDatabase('coach', coachNumber);
        if (data.status === 'success' && data.data) {
            const schedObj = data.data;
            
            const fmtDate = (dStr) => formatDateDMY(dStr);
            const getVal = (key, isDate=false) => {
                let val = schedObj[key];
                let displayValue = (val === '' || val === null || val === undefined) ? '-' : val;
                if (isDate) displayValue = fmtDate(displayValue);
                return displayValue;
            };

            const d2DueVal = schedObj['D2 DUE'] || schedObj['D2 Due'] || schedObj['D2 due'];
            const d3DueVal = schedObj['D3 DUE'] || schedObj['D3 Due'] || schedObj['D3 due'];
            const d2DueColor = d2DueVal ? getDueDateColor(d2DueVal) : '#94a3b8';
            const d3DueColor = d3DueVal ? getDueDateColor(d3DueVal) : '#94a3b8';

            // 1. Update the Top Hero Card Due Badges immediately
            const heroD2Val = document.getElementById('heroD2DueVal');
            const heroD2Chip = document.getElementById('heroD2DueChip');
            if (heroD2Val && heroD2Chip) {
                const formattedD2 = fmtDate(d2DueVal);
                heroD2Val.innerText = formattedD2;
                if (d2DueColor !== 'inherit') {
                    heroD2Val.style.color = d2DueColor;
                    heroD2Chip.style.borderColor = d2DueColor;
                    heroD2Chip.style.background = `${d2DueColor}18`;
                }
            }

            const heroD3Val = document.getElementById('heroD3DueVal');
            const heroD3Chip = document.getElementById('heroD3DueChip');
            if (heroD3Val && heroD3Chip) {
                const formattedD3 = fmtDate(d3DueVal);
                heroD3Val.innerText = formattedD3;
                if (d3DueColor !== 'inherit') {
                    heroD3Val.style.color = d3DueColor;
                    heroD3Chip.style.borderColor = d3DueColor;
                    heroD3Chip.style.background = `${d3DueColor}18`;
                }
            }

            // 2. Build High-Density Schedule Accordion Box
            let groupHTML = `
                <div class="group-section slide-up" id="schedule-details-box" style="animation-delay: ${Math.min(delayCounter * 0.05, 1)}s; border-color: rgba(59, 130, 246, 0.45);">
                    <div class="group-header" onclick="toggleSectionAccordion('schedule-details-box')">
                        <div class="group-header-left">
                            <i class="fa-solid fa-calendar-check group-header-icon" style="color: #60a5fa;"></i>
                            <h3 class="group-title" style="color: #60a5fa;">Schedule Details</h3>
                            <span class="group-count-badge" style="background: rgba(59, 130, 246, 0.2); color: #93c5fd;">Active</span>
                        </div>
                        <div class="group-header-right">
                            <i class="fa-solid fa-chevron-up accordion-chevron"></i>
                        </div>
                    </div>
                    <div class="group-content">
                        <!-- 2x2 D2/D3 Due & Done Matrix -->
                        <div class="sched-matrix-grid">
                            <div class="sched-tile" data-label="d2 done date" data-value="${escapeHtml(getVal('D 2', true))}">
                                <span class="sched-tile-lbl">D2 Done</span>
                                <span class="sched-tile-val">${escapeHtml(getVal('D 2', true))}</span>
                            </div>
                            <div class="sched-tile highlight" style="border-color: ${d2DueColor}; background: ${d2DueColor}15;" data-label="d2 due date" data-value="${escapeHtml(fmtDate(d2DueVal))}">
                                <span class="sched-tile-lbl" style="color: ${d2DueColor}; font-weight: 700;">D2 Due</span>
                                <span class="sched-tile-val bold" style="color: ${d2DueColor}; font-size: 0.95rem;">${escapeHtml(fmtDate(d2DueVal))}</span>
                            </div>
                            <div class="sched-tile" data-label="d3 done date" data-value="${escapeHtml(getVal('D 3', true))}">
                                <span class="sched-tile-lbl">D3 Done</span>
                                <span class="sched-tile-val">${escapeHtml(getVal('D 3', true))}</span>
                            </div>
                            <div class="sched-tile highlight" style="border-color: ${d3DueColor}; background: ${d3DueColor}15;" data-label="d3 due date" data-value="${escapeHtml(fmtDate(d3DueVal))}">
                                <span class="sched-tile-lbl" style="color: ${d3DueColor}; font-weight: 700;">D3 Due</span>
                                <span class="sched-tile-val bold" style="color: ${d3DueColor}; font-size: 0.95rem;">${escapeHtml(fmtDate(d3DueVal))}</span>
                            </div>
                        </div>

                        <!-- Wheel Measurements 4x2 Axle Matrix -->
                        <div class="wheel-section-box">
                            <div class="wheel-box-title"><i class="fa-solid fa-circle-dot"></i> Wheel Diameters (mm)</div>
                            <div class="wheel-axle-grid">
                                <div class="axle-cell" data-label="wheel axle 1 l1 r8" data-value="${escapeHtml(getVal('L1'))} ${escapeHtml(getVal('R8'))}">
                                    <span class="axle-label">Axle 1</span>
                                    <div class="axle-vals">
                                        <span>L1: <strong>${escapeHtml(getVal('L1'))}</strong></span>
                                        <span class="axle-sep">|</span>
                                        <span>R8: <strong>${escapeHtml(getVal('R8'))}</strong></span>
                                    </div>
                                </div>
                                <div class="axle-cell" data-label="wheel axle 2 l2 r7" data-value="${escapeHtml(getVal('L2'))} ${escapeHtml(getVal('R7'))}">
                                    <span class="axle-label">Axle 2</span>
                                    <div class="axle-vals">
                                        <span>L2: <strong>${escapeHtml(getVal('L2'))}</strong></span>
                                        <span class="axle-sep">|</span>
                                        <span>R7: <strong>${escapeHtml(getVal('R7'))}</strong></span>
                                    </div>
                                </div>
                                <div class="axle-cell" data-label="wheel axle 3 l3 r6" data-value="${escapeHtml(getVal('L3'))} ${escapeHtml(getVal('R6'))}">
                                    <span class="axle-label">Axle 3</span>
                                    <div class="axle-vals">
                                        <span>L3: <strong>${escapeHtml(getVal('L3'))}</strong></span>
                                        <span class="axle-sep">|</span>
                                        <span>R6: <strong>${escapeHtml(getVal('R6'))}</strong></span>
                                    </div>
                                </div>
                                <div class="axle-cell" data-label="wheel axle 4 l4 r5" data-value="${escapeHtml(getVal('L4'))} ${escapeHtml(getVal('R5'))}">
                                    <span class="axle-label">Axle 4</span>
                                    <div class="axle-vals">
                                        <span>L4: <strong>${escapeHtml(getVal('L4'))}</strong></span>
                                        <span class="axle-sep">|</span>
                                        <span>R5: <strong>${escapeHtml(getVal('R5'))}</strong></span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Stiffener Plate 2-Column Row -->
                        <div class="compact-grid" style="margin-top: 6px;">
                            <div class="data-row" data-label="stiffener plate pp end" data-value="${escapeHtml(getVal('stiffener plate PP end'))}">
                                <div class="data-label">PP End Stiffener</div>
                                <div class="data-value">${escapeHtml(getVal('stiffener plate PP end'))}</div>
                            </div>
                            <div class="data-row" data-label="stiffener plate npp end" data-value="${escapeHtml(getVal('stiffener plate NPP end'))}">
                                <div class="data-label">NPP End Stiffener</div>
                                <div class="data-value">${escapeHtml(getVal('stiffener plate NPP end'))}</div>
                            </div>
                        </div>

                        <!-- Remarks Full Width Tile -->
                        <div class="data-row full-width" style="margin-top: 6px;" data-label="remarks attention given if any" data-value="${escapeHtml(getVal('ATTENTION GIVEN IF ANY'))}">
                            <div class="data-label"><i class="fa-regular fa-comment-dots"></i> Remarks / Attention Given</div>
                            <div class="data-value" style="font-weight: 500;">${escapeHtml(getVal('ATTENTION GIVEN IF ANY'))}</div>
                        </div>

                        <button class="btn secondary-btn" style="width: 100%; margin-top: 0.75rem; padding: 0.6rem; font-size: 0.88rem;" onclick="openScheduleEntryForCoach('${escapeHtml(coachNumber)}')">
                            <i class="fa-solid fa-pen"></i> Update Schedule Details
                        </button>
                    </div>
                </div>
            `;

            const wrapper = document.createElement('div');
            wrapper.innerHTML = groupHTML;
            const firstChild = wrapper.firstElementChild;
            
            // Remove existing if any
            const existing = container.querySelector('#schedule-details-box');
            if (existing) existing.remove();

            // Insert after Coach Details
            const coachSec = container.querySelector('#section-coach');
            if (coachSec && coachSec.nextSibling) {
                container.insertBefore(firstChild, coachSec.nextSibling);
            } else {
                container.appendChild(firstChild);
            }
        } else {
            const heroD2Val = document.getElementById('heroD2DueVal');
            if (heroD2Val) heroD2Val.innerText = '-';
            const heroD3Val = document.getElementById('heroD3DueVal');
            if (heroD3Val) heroD3Val.innerText = '-';
        }
    } catch (e) {
        console.error('Failed to append schedule data:', e);
        const heroD2Val = document.getElementById('heroD2DueVal');
        if (heroD2Val) heroD2Val.innerText = '-';
        const heroD3Val = document.getElementById('heroD3DueVal');
        if (heroD3Val) heroD3Val.innerText = '-';
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
    
    // If it's a full ISO timestamp (contains T), parse it to get the local date
    if (d.includes('T')) {
        const parsed = new Date(d);
        if (!isNaN(parsed.getTime())) {
            return `${String(parsed.getDate()).padStart(2, '0')}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${parsed.getFullYear()}`;
        }
        // Fallback if Date parsing fails
        d = d.split('T')[0];
    }
    
    // Check if it's already DD-MM-YYYY (or DD/MM/YYYY)
    if (d.match(/^\d{2}[-\/]\d{2}[-\/]\d{4}$/)) {
        return d.replace(/\//g, '-');
    }
    
    // If it's YYYY-MM-DD
    const parts = d.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    
    // Fallback parsing - only try this if it's not a pure number
    if (!/^\d+$/.test(d)) {
        const parsed = new Date(d);
        if (!isNaN(parsed.getTime())) {
            return `${String(parsed.getDate()).padStart(2, '0')}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${parsed.getFullYear()}`;
        }
    }
    
    return d;
}

// Keep formatIfDate as an alias for formatDateDMY for compatibility with existing calls
function formatIfDate(displayValue) {
    return formatDateDMY(displayValue);
}

function formatDateYMD(dStr) {
    if (!dStr || dStr === '-') return '';
    let d = String(dStr).trim();
    
    // If it's a full ISO timestamp (contains T), parse it to get the local date
    if (d.includes('T')) {
        const parsed = new Date(d);
        if (!isNaN(parsed.getTime())) {
            return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
        }
        // Fallback if Date parsing fails
        d = d.split('T')[0];
    }
    
    // If it's already YYYY-MM-DD
    if (d.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return d;
    }
    
    // Check if it's DD-MM-YYYY (or DD/MM/YYYY)
    const parts = d.split(/[-\/]/);
    if (parts.length === 3) {
        if (parts[2].length === 4) {
            // DD-MM-YYYY -> YYYY-MM-DD
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        } else if (parts[0].length === 4) {
            // YYYY-MM-DD -> YYYY-MM-DD
            return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        }
    }
    
    // Fallback parsing
    if (!/^\d+$/.test(d)) {
        const parsed = new Date(d);
        if (!isNaN(parsed.getTime())) {
            return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
        }
    }
    
    return '';
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
    const pendingBtn = document.getElementById('wspTabPending');
    const coachForm = document.getElementById('wspSearchCoachForm');
    const rakeForm = document.getElementById('wspSearchRakeForm');
    const dateForm = document.getElementById('wspSearchDateForm');
    
    if(coachBtn) coachBtn.classList.remove('active');
    if(rakeBtn) rakeBtn.classList.remove('active');
    if(dateBtn) dateBtn.classList.remove('active');
    if(pendingBtn) pendingBtn.classList.remove('active');
    
    if(coachForm) coachForm.classList.add('hidden');
    if(rakeForm) rakeForm.classList.add('hidden');
    if(dateForm) dateForm.classList.add('hidden');
    
    const wspResultScreens = ['wspResultsScreen', 'wspRakeResultsScreen', 'wspDateResultsScreen', 'wspPendingResultsScreen'];
    wspResultScreens.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('hidden');
            el.classList.remove('active');
        }
    });
    
    const searchScreen = document.getElementById('wspSearchScreen');
    if (searchScreen) {
        searchScreen.style.minHeight = '100vh';
    }
    
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
        loadWspRecentDates();
    }
}


let wspRecentDatesCache = null;

async function loadWspRecentDates() {
    const container = document.getElementById('wspRecentDatesContainer');
    if (!container) return;
    
    if (wspRecentDatesCache && wspRecentDatesCache.length > 0) {
        renderRecentDatePills(wspRecentDatesCache);
        return;
    }
    
    try {
        const res = await fetch(`${FIREBASE_DB_URL}/searchDate.json?shallow=true&t=${new Date().getTime()}`);
        if (!res.ok) return;
        const keysObj = await res.json();
        if (keysObj && typeof keysObj === 'object') {
            const sortedDates = Object.keys(keysObj)
                .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
                .sort()
                .reverse()
                .slice(0, 6);
            wspRecentDatesCache = sortedDates;
            renderRecentDatePills(sortedDates);
        }
    } catch (e) {
        console.warn('Could not load recent WSP dates:', e);
    }
}

function renderRecentDatePills(dates) {
    const container = document.getElementById('wspRecentDatesContainer');
    if (!container || !dates || dates.length === 0) return;
    
    let html = `
        <div style="margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.08);">
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-clock-rotate-left" style="color: #10b981;"></i>
                <span>Recent dates with defects:</span>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 0.45rem;">
    `;
    
    dates.forEach(isoDate => {
        const parts = isoDate.split('-');
        const displayStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
        html += `
            <button type="button" class="btn" style="padding: 0.35rem 0.7rem; font-size: 0.8rem; background: rgba(16, 185, 129, 0.12); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 20px; cursor: pointer; transition: all 0.2s;" onclick="selectWspDate('${isoDate}')">
                <i class="fa-solid fa-calendar-day" style="font-size: 0.75rem; margin-right: 4px;"></i>${displayStr}
            </button>
        `;
    });
    
    html += `
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

function selectWspDate(isoDate) {
    const input = document.getElementById('wspDateInput');
    if (input) {
        input.value = isoDate;
        fetchWspByDate();
    }
}

// ==========================================================================
// WSP Defect Restructured Helpers & Card Builders
// ==========================================================================

function getWspField(entry, ...aliases) {
    if (!entry) return '-';
    for (const alias of aliases) {
        if (entry[alias] !== undefined && entry[alias] !== null && String(entry[alias]).trim() !== '') {
            return String(entry[alias]).trim();
        }
        const lowerAlias = alias.toLowerCase().trim();
        for (const k of Object.keys(entry)) {
            if (k.toLowerCase().trim() === lowerAlias && entry[k] !== undefined && entry[k] !== null && String(entry[k]).trim() !== '') {
                return String(entry[k]).trim();
            }
        }
        for (const k of Object.keys(entry)) {
            if (k.toLowerCase().includes(lowerAlias) && entry[k] !== undefined && entry[k] !== null && String(entry[k]).trim() !== '') {
                return String(entry[k]).trim();
            }
        }
    }
    return '-';
}

function renderWspCoachHero(coachNum, rly, type, typeOfWspd, trainNo, ci, leftDate, arrivalDate) {
    const fmt = (d) => formatDateDMY(d);
    return `
        <div class="wsp-coach-hero">
            <div class="wsp-hero-top">
                <div class="wsp-hero-badges">
                    <span class="wsp-badge-coach"><i class="fa-solid fa-train"></i> ${rly && rly !== '-' ? rly : 'IR'} ${coachNum}</span>
                    <span class="badge" style="background: rgba(255,255,255,0.08); color: #cbd5e1; font-weight: 600;">${type}</span>
                </div>
                <div class="wsp-hero-badges">
                    <span class="badge" style="background: rgba(139, 92, 246, 0.2); color: #c4b5fd; border: 1px solid rgba(139, 92, 246, 0.35);"><i class="fa-solid fa-gear"></i> ${typeOfWspd}</span>
                </div>
            </div>
            <div class="wsp-kv-grid" style="grid-template-columns: repeat(2, 1fr);">
                <div class="wsp-kv-item"><span class="wsp-kv-label"><i class="fa-solid fa-train text-primary" style="opacity:0.7"></i> Train No</span><span class="wsp-kv-value" id="wspDetailsTrainNo">${trainNo}</span></div>
                <div class="wsp-kv-item"><span class="wsp-kv-label"><i class="fa-solid fa-location-crosshairs text-primary" style="opacity:0.7"></i> CI / Position</span><span class="wsp-kv-value">${ci}</span></div>
                <div class="wsp-kv-item"><span class="wsp-kv-label"><i class="fa-solid fa-arrow-right-from-bracket text-success" style="opacity:0.7"></i> Left Date</span><span class="wsp-kv-value">${fmt(leftDate)}</span></div>
                <div class="wsp-kv-item"><span class="wsp-kv-label"><i class="fa-solid fa-arrow-right-to-bracket text-warning" style="opacity:0.7"></i> Arrival Date</span><span class="wsp-kv-value" id="wspDetailsArrivalDate">${fmt(arrivalDate)}</span></div>
            </div>
        </div>
    `;
}

function buildWspDefectCardHTML(entry, options = {}) {
    if (!entry) return '';
    
    // Extract fields
    let coachNum = getWspField(entry, 'Coach No', 'COACH NO', 'coach num', 'Coach Number');
    if (coachNum === '-' && entry['_rawRow']) coachNum = entry['_rawRow'][0] || '-';
    
    let rly = getWspField(entry, 'RLY', 'Rly');
    if (rly === '-' && typeof currentTrainCoaches !== 'undefined' && currentTrainCoaches.length > 0) {
        const match = currentTrainCoaches.find(c => {
            const ck = Object.keys(c).find(k => String(k).toLowerCase().includes('coach no') || String(k).toLowerCase().includes('coach num'));
            return ck && c[ck] == coachNum;
        });
        if (match) rly = match['RLY'] || match['Rly'] || '-';
    }
    
    let wheelCondition = getWspField(entry, 'Wheel condition', 'wheel condition');
    if (wheelCondition !== '-') {
        wheelCondition = String(wheelCondition).replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, '$3-$2-$1');
    }
    
    let type = getWspField(entry, 'Coach Type', 'coach type', 'TYPE', 'type');
    let rake = getWspField(entry, 'Rake', 'rake');
    let trainNo = getWspField(entry, 'Train No', 'DB Train No', 'train no', 'train');
    let ci = getWspField(entry, 'CI', 'ci', 'Position', 'position');
    let leftDate = getWspField(entry, 'Left Date', 'left date', 'departure');
    let arrivalDate = getWspField(entry, 'Arrival Date', 'arrival date');
    let downloadDate = getWspField(entry, 'Download Date', 'download date');
    let wspMake = getWspField(entry, 'WSP Make', 'wsp make');
    let typeOfWspd = getWspField(entry, 'Type of WSPD', 'type of wspd', 'wspd type');
    let psStatus = getWspField(entry, 'PS Status', 'ps status', 'Pressure switch');
    let wspCode = getWspField(entry, 'WSP Code', 'wsp code', 'code');
    let dumpValve = getWspField(entry, 'Dump Valve', 'dump valve', 'Self Test Dump Valve');
    let sensorGap = getWspField(entry, 'Sensor Gap', 'sensor gap');
    let observation = getWspField(entry, 'Downloading Observation', 'downloading obseravtion', 'downloading observation', 'downloading');
    let otherObservation = getWspField(entry, 'Other Observation', 'other observation');
    let defectCat = getWspField(entry, 'Defect Category', 'defect category');
    let attention = getWspField(entry, 'Attention If Any', 'attention if any', 'attention');
    let defectDesc = getWspField(entry, 'Defect Description', 'defect description', 'defect desc', 'description');
    let pendingWork = getWspField(entry, 'Pending Work', 'pending work desc', 'pending work description', 'follo up', 'follow up');
    let anyPending = getWspField(entry, 'Any work pending', 'any work pending');
    let itemRequired = getWspField(entry, 'Item Required / Used', 'item required', 'item required/used');
    let checklist = getWspField(entry, 'Checklist Submitted', 'checklist submitted', 'checklist');
    let dataEntryBy = getWspField(entry, 'Data Entry By', 'data entry by', 'data entry');
    
    // Status assessment
    const isPendingActive = (
        (pendingWork !== '-' && pendingWork.toLowerCase() !== 'nil' && pendingWork.toLowerCase() !== 'no' && pendingWork !== '') ||
        (anyPending.toLowerCase() === 'yes')
    );
    
    const isDefectActive = (
        (defectCat !== '-' && defectCat.toLowerCase() !== 'no defect' && defectCat.toLowerCase() !== 'nil') ||
        (wspCode !== '-' && wspCode !== '99' && wspCode !== '') ||
        (psStatus.toLowerCase().includes('not ok')) ||
        (dumpValve.toLowerCase().includes('not ok'))
    );
    
    // WSP Code pill
    let wspCodeHtml = '';
    if (wspCode === '99') {
        wspCodeHtml = `<span class="wsp-badge-pill ok"><i class="fa-solid fa-circle-check"></i> 99 (Normal)</span>`;
    } else if (wspCode !== '-' && wspCode !== '') {
        wspCodeHtml = `<span class="wsp-badge-pill fault"><i class="fa-solid fa-triangle-exclamation"></i> Code ${wspCode}</span>`;
    } else {
        wspCodeHtml = `<span class="wsp-badge-pill neutral">-</span>`;
    }
    
    // PS Status pill
    let psStatusHtml = '';
    if (psStatus.toLowerCase() === 'ok') {
        psStatusHtml = `<span class="wsp-badge-pill ok"><i class="fa-solid fa-check"></i> OK</span>`;
    } else if (psStatus.toLowerCase().includes('not ok')) {
        psStatusHtml = `<span class="wsp-badge-pill fault"><i class="fa-solid fa-xmark"></i> Fault</span>`;
    } else {
        psStatusHtml = `<span class="wsp-badge-pill neutral">${psStatus}</span>`;
    }
    
    // Dump Valve pill
    let dumpValveHtml = '';
    if (dumpValve.toLowerCase() === 'ok') {
        dumpValveHtml = `<span class="wsp-badge-pill ok"><i class="fa-solid fa-check"></i> OK</span>`;
    } else if (dumpValve.toLowerCase().includes('not ok')) {
        dumpValveHtml = `<span class="wsp-badge-pill fault"><i class="fa-solid fa-xmark"></i> Fault</span>`;
    } else {
        dumpValveHtml = `<span class="wsp-badge-pill neutral">${dumpValve}</span>`;
    }
    
    // Card header status badge
    let statusBadgeHtml = '';
    if (isPendingActive) {
        statusBadgeHtml = `<span class="wsp-status-badge pending"><i class="fa-solid fa-clock-rotate-left"></i> Pending Work</span>`;
    } else if (isDefectActive) {
        statusBadgeHtml = `<span class="wsp-status-badge defect"><i class="fa-solid fa-triangle-exclamation"></i> ${defectCat !== '-' ? defectCat : 'Defect Reported'}</span>`;
    } else {
        statusBadgeHtml = `<span class="wsp-status-badge ok"><i class="fa-solid fa-circle-check"></i> Normal (99)</span>`;
    }
    
    const cardClass = isPendingActive ? 'wsp-defect-card has-pending' : (isDefectActive ? 'wsp-defect-card has-defect' : 'wsp-defect-card');
    
    return `
        <div class="${cardClass}">
            <!-- Header Ribbon -->
            <div class="wsp-card-header">
                <div class="wsp-header-left">
                    <span class="wsp-badge-coach"><i class="fa-solid fa-train"></i> ${rly !== '-' ? rly : 'IR'} ${coachNum}</span>
                    ${downloadDate !== '-' ? `<span class="wsp-chip-date"><i class="fa-regular fa-calendar"></i> Download date- ${formatDateDMY(downloadDate)}</span>` : ''}
                </div>
                <div class="wsp-header-right">
                    ${statusBadgeHtml}
                </div>
            </div>
            
            <!-- Wheel Condition Callout -->
            ${wheelCondition !== '-' && wheelCondition.toLowerCase() !== 'nil' ? `
            <div class="wsp-callout wsp-callout-wheel">
                <i class="fa-solid fa-compact-disc wsp-callout-icon"></i>
                <div class="wsp-callout-content">
                    <span class="wsp-callout-label">Wheel Condition</span>
                    <span class="wsp-callout-value">${wheelCondition}</span>
                </div>
            </div>` : ''}
            
            <!-- Section 1: Movement & Rake -->
            <div class="wsp-card-section">
                <div class="wsp-section-title"><i class="fa-solid fa-route"></i> Movement & Rake</div>
                <div class="wsp-kv-grid">
                    <div class="wsp-kv-item"><span class="wsp-kv-label">Coach Type</span><span class="wsp-kv-value">${type}</span></div>
                    <div class="wsp-kv-item"><span class="wsp-kv-label">WSP Make</span><span class="wsp-kv-value">${wspMake}</span></div>
                    <div class="wsp-kv-item"><span class="wsp-kv-label">Type of WSPD</span><span class="wsp-kv-value">${typeOfWspd}</span></div>
                    <div class="wsp-kv-item"><span class="wsp-kv-label">Rake / Train</span><span class="wsp-kv-value">${rake} / ${trainNo}</span></div>
                    <div class="wsp-kv-item"><span class="wsp-kv-label">CI / Pos</span><span class="wsp-kv-value">${ci}</span></div>
                    <div class="wsp-kv-item"><span class="wsp-kv-label">Left Date</span><span class="wsp-kv-value">${formatDateDMY(leftDate)}</span></div>
                    <div class="wsp-kv-item"><span class="wsp-kv-label">Arrival Date</span><span class="wsp-kv-value">${formatDateDMY(arrivalDate)}</span></div>
                </div>
            </div>
            
            <!-- Section 2: Diagnostics & Sensors -->
            <div class="wsp-card-section">
                <div class="wsp-section-title"><i class="fa-solid fa-bolt"></i> Diagnostics & Sensor Status</div>
                <div class="wsp-diag-grid">
                    <div class="wsp-diag-tile">
                        <span class="wsp-kv-label">WSP Code</span>
                        ${wspCodeHtml}
                    </div>
                    <div class="wsp-diag-tile">
                        <span class="wsp-kv-label">PS Status</span>
                        ${psStatusHtml}
                    </div>
                    <div class="wsp-diag-tile">
                        <span class="wsp-kv-label">Dump Valve</span>
                        ${dumpValveHtml}
                    </div>
                    <div class="wsp-diag-tile wsp-diag-wide">
                        <span class="wsp-kv-label">Sensor Gap</span>
                        <span class="wsp-diag-text"><i class="fa-solid fa-ruler-horizontal"></i> ${sensorGap}</span>
                    </div>
                </div>
            </div>
            
            <!-- Section 3: Observations & Defect -->
            <div class="wsp-card-section">
                <div class="wsp-section-title"><i class="fa-solid fa-magnifying-glass"></i> Defect & Observations</div>
                <div class="wsp-obs-list">
                    <div class="wsp-obs-item">
                        <span class="wsp-kv-label">Defect Category</span>
                        <span class="wsp-obs-badge ${isDefectActive ? 'defect' : 'normal'}">${defectCat}</span>
                    </div>
                    <div class="wsp-obs-item">
                        <span class="wsp-kv-label">Downloading Observation</span>
                        <span class="wsp-kv-value">${observation}</span>
                    </div>
                    <div class="wsp-obs-item">
                        <span class="wsp-kv-label">Other Observation</span>
                        <span class="wsp-kv-value">${otherObservation}</span>
                    </div>
                    ${defectDesc !== '-' && defectDesc.toLowerCase() !== 'nil' ? `
                    <div class="wsp-obs-item">
                        <span class="wsp-kv-label">Defect Description</span>
                        <span class="wsp-kv-value highlight-desc">${defectDesc}</span>
                    </div>` : ''}
                </div>
            </div>
            
            <!-- Section 4: Action & Pending Work -->
            <div class="wsp-card-section">
                <div class="wsp-section-title"><i class="fa-solid fa-wrench"></i> Action & Pending Work</div>
                ${isPendingActive ? `
                <div class="wsp-callout wsp-callout-pending">
                    <i class="fa-solid fa-triangle-exclamation wsp-callout-icon"></i>
                    <div class="wsp-callout-content">
                        <span class="wsp-callout-label">Action Pending</span>
                        <span class="wsp-callout-value">${pendingWork !== '-' ? pendingWork : 'Work pending flagged'}</span>
                    </div>
                </div>` : `
                <div class="wsp-kv-item" style="margin-bottom:0.4rem;">
                    <span class="wsp-kv-label">Pending Work</span>
                    <span class="wsp-badge-pill ok"><i class="fa-solid fa-check"></i> None</span>
                </div>`}
                
                <div class="wsp-kv-grid" style="margin-top:0.4rem;">
                    <div class="wsp-kv-item"><span class="wsp-kv-label">Attention (If Any)</span><span class="wsp-kv-value">${attention}</span></div>
                    <div class="wsp-kv-item"><span class="wsp-kv-label">Item Required / Used</span><span class="wsp-kv-value">${itemRequired}</span></div>
                </div>
            </div>
            
            <!-- Section 5: Verification & Staff -->
            <div class="wsp-card-section wsp-section-compact">
                <div class="wsp-kv-grid">
                    <div class="wsp-kv-item">
                        <span class="wsp-kv-label">Checklist Submitted</span>
                        <span class="wsp-kv-value">${checklist.toLowerCase() === 'yes' ? '<i class="fa-solid fa-check-circle text-success"></i> Yes' : '<i class="fa-solid fa-circle-xmark text-muted"></i> No'}</span>
                    </div>
                    <div class="wsp-kv-item">
                        <span class="wsp-kv-label">Data Entry By</span>
                        <span class="wsp-kv-value"><i class="fa-solid fa-id-badge" style="opacity:0.7"></i> ID: ${dataEntryBy}</span>
                    </div>
                </div>
            </div>
            
            <!-- Actions Bar -->
            ${options.showActions !== false ? `
            <div class="wsp-card-actions">
                ${entry._rowIndex ? `
                <button type="button" class="btn wsp-action-btn edit" onclick="event.stopPropagation(); editWspEntry(${entry._rowIndex})">
                    <i class="fa-solid fa-pen-to-square"></i> Edit Defect
                </button>` : ''}
                ${coachNum && coachNum !== '-' ? `
                <button type="button" class="btn wsp-action-btn history" onclick="event.stopPropagation(); fetchWspHistory('${coachNum}')">
                    <i class="fa-solid fa-clock-rotate-left"></i> Coach History
                </button>` : ''}
            </div>` : ''}
        </div>
    `;
}

async function fetchWspByDate() {
    const rawDateInput = document.getElementById('wspDateInput').value;
    if (!rawDateInput) {
        showWarningAlert("Please select a date.");
        return;
    }

    const dateInput = parseToIsoDate(rawDateInput);
    if (!dateInput) {
        showWarningAlert("Please select a valid date.");
        return;
    }
    
    const fetchBtn = document.getElementById('wspFetchDateBtn');
    const spinner = fetchBtn ? fetchBtn.querySelector('.spinner') : null;
    const btnText = fetchBtn ? fetchBtn.querySelector('.btn-text') : null;
    
    if (spinner) spinner.classList.remove('hidden');
    if (btnText) btnText.style.opacity = '0';
    if (fetchBtn) fetchBtn.disabled = true;

    const parts = dateInput.split('-');
    const formattedDisplayDate = `${parts[2]}-${parts[1]}-${parts[0]}`;

    try {
        let data = await fetchFromDatabase('date', dateInput);
        
        // Fallback to Google Apps Script if Firebase has no records or returned empty
        if (!data || data.status !== 'success' || !data.data || data.data.length === 0) {
            try {
                const gasUrl = `${GOOGLE_APP_SCRIPT_URL}?date=${encodeURIComponent(dateInput)}&sheetName=${encodeURIComponent('DOWNLOAD status modified')}`;
                const gasRes = await fetch(gasUrl);
                if (gasRes.ok) {
                    const gasData = await gasRes.json();
                    if (gasData && gasData.status === 'success' && gasData.data && gasData.data.length > 0) {
                        data = gasData;
                    }
                }
            } catch (fallbackErr) {
                console.warn('Apps Script fallback check failed:', fallbackErr);
            }
        }

        const titleEl = document.getElementById('wspDateResultTitle');
        const subtitleEl = document.getElementById('wspDateResultSubtitle');
        const tbody = document.getElementById('wspDateTableBody');
        
        if (data && data.status === 'success' && data.data && data.data.length > 0) {
            if (titleEl) titleEl.innerText = `Defects for ${formattedDisplayDate}`;
            if (subtitleEl) subtitleEl.innerText = `${data.data.length} coach defect record(s) found`;
            
            if (tbody) {
                tbody.innerHTML = '';
                window.wspHistoryMap = window.wspHistoryMap || {};
                
                data.data.forEach(entry => {
                    if (entry._rowIndex) {
                        window.wspHistoryMap[entry._rowIndex] = entry;
                    }
                    
                    const tr = document.createElement('tr');
                    tr.style.cursor = 'pointer';
                    
                    let coachNum = getWspField(entry, 'Coach No', 'COACH NO', 'coach num', 'Coach Number');
                    if (coachNum === '-' && entry['_rawRow']) coachNum = entry['_rawRow'][0] || '-';
                    
                    let rly = getWspField(entry, 'RLY', 'Rly');
                    if (rly === '-' && typeof currentTrainCoaches !== 'undefined' && currentTrainCoaches.length > 0) {
                        const match = currentTrainCoaches.find(c => {
                            const ck = Object.keys(c).find(k => String(k).toLowerCase().includes('coach no') || String(k).toLowerCase().includes('coach num'));
                            return ck && c[ck] == coachNum;
                        });
                        if (match) rly = match['RLY'] || match['Rly'] || '-';
                    }
                    
                    let wheelCondition = getWspField(entry, 'Wheel condition', 'wheel condition');
                    if (wheelCondition !== '-') {
                        wheelCondition = String(wheelCondition).replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, '$3-$2-$1');
                    }
                    
                    let wspCode = getWspField(entry, 'WSP Code', 'wsp code');
                    let defectCat = getWspField(entry, 'Defect Category', 'defect category');
                    let pendingWork = getWspField(entry, 'Pending Work', 'pending work desc', 'pending work description', 'follo up', 'follow up');
                    let anyPending = getWspField(entry, 'Any work pending', 'any work pending');
                    
                    const isPendingActive = (
                        (pendingWork !== '-' && pendingWork.toLowerCase() !== 'nil' && pendingWork.toLowerCase() !== 'no' && pendingWork !== '') ||
                        (anyPending.toLowerCase() === 'yes')
                    );
                    const isDefectActive = (
                        (defectCat !== '-' && defectCat.toLowerCase() !== 'no defect' && defectCat.toLowerCase() !== 'nil') ||
                        (wspCode !== '-' && wspCode !== '99' && wspCode !== '')
                    );
                    
                    tr.innerHTML = `
                        <td><span class="wsp-rly-pill">${rly !== '-' ? rly : 'IR'}</span></td>
                        <td><span class="highlight-badge">${coachNum || '-'}</span></td>
                        <td>
                            <div class="wsp-table-wheel">
                                ${isPendingActive ? '<span class="wsp-dot-warn" title="Pending Work"></span>' : (isDefectActive ? '<span class="wsp-dot-defect" title="Defect Reported"></span>' : '<span class="wsp-dot-ok" title="Normal"></span>')}
                                <span>${wheelCondition}</span>
                            </div>
                        </td>
                        <td style="text-align:center;"><i class="fa-solid fa-chevron-down text-primary" style="transition: transform 0.3s;"></i></td>
                    `;
                    
                    const detailsTr = document.createElement('tr');
                    detailsTr.style.display = 'none';
                    detailsTr.innerHTML = `
                        <td colspan="4" style="padding: 0.4rem 0.6rem; border-bottom: 1px solid rgba(255,255,255,0.06); background: rgba(0,0,0,0.15);">
                            ${buildWspDefectCardHTML(entry, { showActions: true })}
                        </td>
                    `;
                    
                    tr.onclick = () => {
                        window.wspLastSearchScreen = 'wspDateResultsScreen';
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
            }
            
            navigateTo('wspDateResultsScreen');
        } else {
            // No defects found for this date -> Show friendly empty state
            if (titleEl) titleEl.innerText = `Defects for ${formattedDisplayDate}`;
            if (subtitleEl) subtitleEl.innerText = '0 defect records';
            
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="4" style="text-align: center; padding: 3rem 1.5rem;">
                            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;">
                                <i class="fa-solid fa-circle-check" style="color: #10b981; font-size: 3rem; margin-bottom: 1rem;"></i>
                                <h3 style="font-size: 1.15rem; font-weight: 600; color: #fff; margin-bottom: 0.35rem;">No Defects Found</h3>
                                <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.25rem; max-width: 320px;">No WSP wheel issues were logged on ${formattedDisplayDate}.</p>
                                <button type="button" class="btn secondary-btn" onclick="navigateTo('wspSearchScreen')" style="padding: 0.6rem 1.25rem; font-size: 0.9rem; background: rgba(255,255,255,0.08);">
                                    <i class="fa-solid fa-arrow-left" style="margin-right: 0.5rem;"></i> Select Another Date
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }
            navigateTo('wspDateResultsScreen');
        }
    } catch (error) {
        console.error('Error fetching WSP by date:', error);
        showErrorAlert(`Error fetching data: ${error.message || 'Please check your connection'}`);
    } finally {
        if (spinner) spinner.classList.add('hidden');
        if (btnText) btnText.style.opacity = '1';
        if (fetchBtn) fetchBtn.disabled = false;
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
            const parsed = parseRakeAndPosition(coach['_colO'], trainSelect);
            if (parsed && parsed.rakeNum) {
                rakeSet.add(parsed.rakeNum);
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
        const data = await fetchFromDatabase('train', trainSelect);
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
        const parsed = parseRakeAndPosition(coach['_colO'], selectedTrain);
        if (parsed && parsed.rakeNum === selectedRake) {
            coach._position = parsed.position;
            rakeCoaches.push(coach);
        }
    });
    
    // Sort by position
    rakeCoaches.sort((a, b) => (a._position || 999) - (b._position || 999));
    
    // Extract general details from the first coach in the rake
    if (rakeCoaches.length > 0) {
        const firstCoach = rakeCoaches[0];
        let departureDate = firstCoach['_colP'] ? formatIfDate(firstCoach['_colP']) : '-';
        let arrivalDate = firstCoach['_colQ'] ? formatIfDate(firstCoach['_colQ']) : '-';
        
        const arrEl = document.getElementById('wspRakeArrivalDate');
        if(arrEl) arrEl.innerText = arrivalDate;
        const depEl = document.getElementById('wspRakeDepartureDate');
        if(depEl) depEl.innerText = departureDate;
    } else {
        const arrEl = document.getElementById('wspRakeArrivalDate');
        if(arrEl) arrEl.innerText = '-';
        const depEl = document.getElementById('wspRakeDepartureDate');
        if(depEl) depEl.innerText = '-';
    }

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
            let wheelCond = coach['Wheel Condition'] || '-';
            wheelCond = String(wheelCond).replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, '$3-$2-$1');
            
            const hasWheelCond = wheelCond !== '-';
            
            const leftDate = coach['LEFT DATE'] || coach['Left Date'] || coach['_colP'] || '-';
            const arrivalDate = coach['ARRIVAL DATE'] || coach['ARRIVAL'] || coach['Arrival Date'] || coach['_colQ'] || '-';
            const wspType = coach['TYPE OF WSPD'] || coach['Type of WSPD'] || coach['WSP'] || coach['TYPE OF FT WSPD'] || '-';
            const dbPos = coach['STATUS'] || coach['DB Train No'] || coach['TRAIN NO'] || coach['Position'] || '-';
            const indication = coach['_colS'] || coach['CI'] || coach['Indication'] || '-';
            
            tr.innerHTML = `
                <td ${hasWheelCond ? 'style="border-bottom: none;"' : ''}>${pos}</td>
                <td ${hasWheelCond ? 'style="border-bottom: none;"' : ''}>${rly}</td>
                <td ${hasWheelCond ? 'style="border-bottom: none;"' : ''}><span class="highlight-badge">${coachNum}</span></td>
                <td ${hasWheelCond ? 'style="border-bottom: none;"' : ''}>${type}</td>
                <td ${hasWheelCond ? 'style="border-bottom: none;"' : ''}>${leftDate ? formatIfDate(leftDate) : '-'}</td>
                <td ${hasWheelCond ? 'style="border-bottom: none;"' : ''}>${arrivalDate ? formatIfDate(arrivalDate) : '-'}</td>
                <td ${hasWheelCond ? 'style="border-bottom: none;"' : ''}>${wspType}</td>
                <td ${hasWheelCond ? 'style="border-bottom: none;"' : ''}>${dbPos}</td>
                <td ${hasWheelCond ? 'style="border-bottom: none;"' : ''}>${indication}</td>
            `;
            
            tr.onclick = () => { 
                window.wspLastSearchScreen = 'wspRakeResultsScreen';
                renderWspResults(coach); 
            };
            tbody.appendChild(tr);
            
            if (hasWheelCond) {
                const subTr = document.createElement('tr');
                subTr.style.cursor = 'pointer';
                subTr.innerHTML = `
                    <td colspan="9" style="padding-top: 0; color: var(--text-muted); font-size: 0.85rem; border-top: none;">
                        <i class="fa-solid fa-triangle-exclamation" style="margin-right: 4px; opacity: 0.9; color: #e74c3c;"></i> <span style="color: #e74c3c;">${wheelCond}</span>
                    </td>
                `;
                subTr.onclick = () => { 
                    window.wspLastSearchScreen = 'wspRakeResultsScreen';
                    renderWspResults(coach); 
                };
                tbody.appendChild(subTr);
            }
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
                    window.wspLastSearchScreen = 'wspSearchScreen';
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
                window.wspLastSearchScreen = 'wspSearchScreen';
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
    const wspForm = document.getElementById('wspDefectForm');
    if (wspForm) wspForm.reset();
    const wspEditRow = document.getElementById('wspEditRowIndex');
    if (wspEditRow) wspEditRow.value = '';

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
        detailsContainer.innerHTML = renderWspCoachHero(coachNum, rly, type, typeOfWspd, trainNo, ci, leftDate, arrivalDate);
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

    try {
        const data = await fetchFromDatabase('history', coachNumber);
        const historyContainer = document.getElementById('wspHistoryContainer');
        historyContainer.innerHTML = '';
        
        // Reset defect form state and hide it
        const defectForm = document.getElementById('wspDefectForm');
        if (defectForm) defectForm.reset();
        const editRowIdx = document.getElementById('wspEditRowIndex');
        if (editRowIdx) editRowIdx.value = '';
        const formTitle = document.getElementById('wspFormTitle');
        if (formTitle) formTitle.innerHTML = `<i class="fa-solid fa-plus"></i> Add New Defect`;
        const defectSubmitBtn = document.getElementById('wspSubmitDefectBtn');
        if (defectSubmitBtn) {
            const textSpan = defectSubmitBtn.querySelector('.btn-text');
            if (textSpan) textSpan.innerText = 'Submit Defect';
        }
        
        const wrapper = document.getElementById('wspDefectFormWrapper');
        if (wrapper && !wrapper.classList.contains('hidden')) {
            wrapper.classList.add('hidden');
            const header = wrapper.previousElementSibling;
            if (header) {
                const chevron = header.querySelector('.chevron');
                if (chevron) {
                    chevron.classList.remove('fa-chevron-up');
                    chevron.classList.add('fa-chevron-down');
                }
            }
        }
        
        document.getElementById('wspResultCoachId').innerText = coachNumber;
        document.getElementById('wspDefectCoachNum').value = coachNumber;
        
        if (data.status === 'success' && data.data && data.data.length > 0) {
            window.wspHistoryMap = {};
            data.data.forEach((entry, idx) => {
                window.wspHistoryMap[entry._rowIndex] = entry;
                const card = document.createElement('div');
                card.className = 'slide-up';
                card.style.animationDelay = `${idx * 0.05}s`;
                card.style.marginBottom = '0.75rem';
                
                card.innerHTML = buildWspDefectCardHTML(entry, { showActions: true });
                historyContainer.appendChild(card);
            });
        } else {
            window.wspHistoryMap = {};
            historyContainer.innerHTML = `
                <div class="empty-state" style="padding: 1.5rem 0;">
                    <i class="fa-solid fa-check-circle" style="color: #10b981; font-size: 2rem; margin-bottom: 0.5rem;"></i>
                    <p>No previous reported wheel issue for above coach.</p>
                </div>
            `;
        }
        
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
        const data = await fetchFromScheduleDatabase('coach', coachNumber);
        if (data.status === 'success') {
            if (data.isNewCoach) {
                showWarningAlert("Coach not found in schedule database. A new entry will be created.");
            }
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
    const detailsContainer = document.getElementById('scheduleCoachDetailsContainer');
    
    const fmtDate = (dStr) => formatDateDMY(dStr);
    
    let trainNo = '-';
    let ci = '-';
    let arrivalDate = '-';
    let leftDate = '-';
    let cNo = '-';
    let rly = '-';
    let cType = '-';
    let rake = '-';
    
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
        } else if (h.includes('coach no') || h.includes('coach num')) {
            if (cNo === '-') cNo = dataObj[key] || '-';
        } else if (h === 'own rly' || h === 'rly' || h === 'railway') {
            if (rly === '-') rly = dataObj[key] || '-';
        } else if (h === 'coach type' || h === 'type') {
            if (cType === '-') cType = dataObj[key] || '-';
        } else if (h === 'rake') {
            if (rake === '-') rake = dataObj[key] || '-';
        }
    }
    
    if (cNo === '-') cNo = dataObj['COACH NO.'] || dataObj['Coach Number'] || '-';
    if (rly === '-') rly = dataObj['OWN RLY'] || dataObj['RLY'] || dataObj['Rly'] || '-';
    if (cType === '-') cType = dataObj['COACH TYPE'] || dataObj['TYPE'] || dataObj['Coach Type'] || '-';
    if (rake === '-') rake = dataObj['RAKE'] || dataObj['Rake'] || '-';
    
    document.getElementById('scheduleResultCoachId').innerText = cNo !== '-' ? cNo : (dataObj['COACH NO.'] || 'Schedule Entry');

    detailsContainer.innerHTML = `
        <div>
            <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Coach Number</span>
            <span style="font-weight:600; font-size:1.1rem; color: #3b82f6;">${cNo}</span>
        </div>
        <div>
            <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Owning Railway</span>
            <span style="font-weight:500;">${rly}</span>
        </div>
        <div>
            <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Coach Type</span>
            <span style="font-weight:500;">${cType}</span>
        </div>
        <div>
            <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Rake</span>
            <span style="font-weight:500;">${rake}</span>
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
    const inputDateFmt = (dStr) => formatDateYMD(dStr);

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
    
    document.getElementById('scheduleCBCMake').value = dataObj['CBC Make'] || '';
    document.getElementById('scheduleStaffToken').value = dataObj['Staff Token Number'] || '';
    
    document.getElementById('scheduleRemarks').value = dataObj['ATTENTION GIVEN IF ANY'] || '';
    
    navigateTo('scheduleResultsScreen');
}

async function handleScheduleSubmit(e) {
    e.preventDefault();
    
    const { value: password } = await Swal.fire({
        title: 'Enter Password',
        input: 'password',
        inputLabel: 'Please enter the password to update schedule data',
        inputPlaceholder: 'Enter password',
        inputAttributes: {
            autocapitalize: 'off',
            autocorrect: 'off'
        },
        showCancelButton: true,
        background: 'var(--surface)',
        color: 'var(--text)',
        confirmButtonColor: '#3b82f6',
        cancelButtonColor: '#64748b'
    });

    if (password === undefined) {
        // User clicked cancel
        return;
    }

    if (password !== '1212') {
        showErrorAlert('Wrong password');
        return;
    }
    
    const btn = document.getElementById('scheduleSubmitBtn');
    btn.disabled = true;
    btn.querySelector('.spinner').classList.remove('hidden');
    btn.querySelector('.btn-text').style.opacity = '0';
    
    const formData = {
        action: 'updateSchedule',
        coachNumber: document.getElementById('scheduleResultCoachId').innerText,
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
        cbcMake: document.getElementById('scheduleCBCMake').value,
        staffToken: document.getElementById('scheduleStaffToken').value,
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

// --- Due Coaches Logic ---
async function fetchDueCoaches() {
    const dateInput = document.getElementById('dueDatePicker').value;
    const errorEl = document.getElementById('dueCoachesError');
    const loadingEl = document.getElementById('dueCoachesLoading');
    const resultsContainer = document.getElementById('dueCoachesResultsContainer');
    const tbody = document.getElementById('dueCoachesTableBody');
    
    errorEl.classList.add('hidden');
    resultsContainer.classList.add('hidden');
    
    if (!dateInput) {
        errorEl.textContent = 'Please select a date.';
        errorEl.classList.remove('hidden');
        return;
    }
    
    const pitSchedule = {
        0: { day: 'KARWAR', night: 'No rake' }, // Sunday
        1: { day: 'KARWAR', night: 'LAL' }, // Monday
        2: { day: 'SMET JAN', night: 'LAL, UBL JAN' }, // Tuesday
        3: { day: 'KARWAR', night: 'No rake' }, // Wednesday
        4: { day: 'KARWAR', night: 'LAL' }, // Thursday
        5: { day: 'No rake', night: 'LAL' }, // Friday
        6: { day: 'SMET JAN', night: 'UBL JAN' }  // Saturday
    };
    
    const selectedDateObj = new Date(dateInput);
    const dayOfWeek = selectedDateObj.getDay();
    const dayName = selectedDateObj.toLocaleDateString('en-US', { weekday: 'long' });
    const todaysSchedule = pitSchedule[dayOfWeek];
    
    document.getElementById('pitCheckDayRakes').textContent = todaysSchedule.day;
    document.getElementById('pitCheckNightRakes').textContent = todaysSchedule.night;
    const dayOfWeekEl = document.getElementById('pitCheckDayOfWeek');
    if (dayOfWeekEl) dayOfWeekEl.textContent = `(${dayName})`;
    
    loadingEl.classList.remove('hidden');
    tbody.innerHTML = '';
    
    try {
        const url = `${SCHEDULE_APP_SCRIPT_URL}?action=getDueCoaches&date=${encodeURIComponent(dateInput)}`;
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.status === 'success') {
            const coaches = result.data || [];
            document.getElementById('dueCoachesTotalText').textContent = `Total schedule due coaches: ${coaches.length}`;
            
            if (coaches.length > 0) {
                coaches.forEach(coach => {
                    const tr = document.createElement('tr');
                    
                    const d2Display = coach.isD2Due 
                        ? `<span style="background: rgba(231, 76, 60, 0.2); color: #ff6b6b; padding: 4px 8px; border-radius: 4px; font-weight: 500; display: inline-block;">${coach.d2Date}</span>` 
                        : coach.d2Date;
                        
                    const d3Display = coach.isD3Due 
                        ? `<span style="background: rgba(231, 76, 60, 0.2); color: #ff6b6b; padding: 4px 8px; border-radius: 4px; font-weight: 500; display: inline-block;">${coach.d3Date}</span>` 
                        : coach.d3Date;
                    
                    tr.style.cursor = 'pointer';
                    tr.style.transition = 'background-color 0.2s';
                    tr.onmouseover = () => tr.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                    tr.onmouseout = () => tr.style.backgroundColor = 'transparent';
                    tr.title = "Click to update schedule";
                    
                    tr.onclick = () => {
                        navigateTo('scheduleSearchScreen');
                        const searchInput = document.getElementById('scheduleCoachNumberInput');
                        if (searchInput) {
                            searchInput.value = coach.coachNo;
                            const form = document.getElementById('scheduleSearchForm');
                            if (form) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                        }
                    };
                    
                    tr.innerHTML = `
                        <td style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); padding: 14px 8px; vertical-align: middle;">${coach.rly}</td>
                        <td style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); padding: 14px 8px; vertical-align: middle;">${coach.type}</td>
                        <td style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); padding: 14px 8px; vertical-align: middle;"><span class="highlight-badge">${coach.coachNo}</span></td>
                        <td style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); padding: 14px 8px; vertical-align: middle;">${coach.trainNo}</td>
                        <td style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); padding: 14px 8px; vertical-align: middle;">${d2Display}</td>
                        <td style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); padding: 14px 8px; vertical-align: middle;">${d3Display}</td>
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">No coaches due on this date for available rakes.</td>`;
                tbody.appendChild(tr);
            }
            resultsContainer.classList.remove('hidden');
        } else {
            errorEl.textContent = result.message || 'Failed to fetch due coaches.';
            errorEl.classList.remove('hidden');
        }
    } catch (err) {
        console.error('Error fetching due coaches:', err);
        errorEl.textContent = 'Failed to load data. Ensure Apps Script is updated and deployed.';
        errorEl.classList.remove('hidden');
    } finally {
        loadingEl.classList.add('hidden');
    }
}

function editWspEntry(rowIndex) {
    if (!window.wspHistoryMap && !window.pendingWorkMap) return;
    const entry = (window.wspHistoryMap && window.wspHistoryMap[rowIndex]) || (window.pendingWorkMap && window.pendingWorkMap[rowIndex]);
    if (!entry) return;
    
    // Set Edit Row ID
    document.getElementById('wspEditRowIndex').value = rowIndex;
    
    // Function to safely set value
    const setVal = (id, keyArr) => {
        const el = document.getElementById(id);
        if(!el) return;
        const val = keyArr.reduce((found, k) => {
            if(found) return found;
            const entryKey = Object.keys(entry).find(ek => ek.toLowerCase().trim() === k.toLowerCase().trim());
            return entryKey ? entry[entryKey] : '';
        }, '');
        if(val) el.value = val;
    };
    
    // Map of id -> possible keys in entry
    setVal('wspWheelCondition', ['Wheel condition']);
    setVal('wspPsStatus', ['PS status']);
    setVal('wspCode', ['wsp code']);
    setVal('wspDumpValve', ['Self test dump valve']);
    setVal('wspSensorGap', ['Sensor gap']);
    setVal('wspObservation', ['downloading obseravtion', 'downloading observation']);
    setVal('wspOtherObservation', ['OTHER OBSERVATION']);
    setVal('wspDefectCategory', ['defect category']);
    setVal('wspAttention', ['ATTENTION IF ANY']);
    setVal('wspDescription', ['DEFECT DESCRIPTION']);
    setVal('wspItemRequired', ['ITEM REQUIRED / USED']);
    setVal('wspDataEntryBy', ['Data Entry By']);
    setVal('wspChecklist', ['CHECKLIST SUBMITTED']);
    setVal('wspAnyWorkPending', ['ANY WORK PENDING']);
    setVal('wspPendingWorkDesc', ['PENDING WORK DESCRIPTION', 'pending work desc']);
    
    // Handle Date (Download Date)
    const dateKey = Object.keys(entry).find(k => String(k).toLowerCase().trim() === 'download date');
    if(dateKey && entry[dateKey]) {
        document.getElementById('wspDownloadDate').value = formatDateYMD(entry[dateKey]);
    }
    
    // Ensure we are on the correct screen
    const resultsScreen = document.getElementById('wspResultsScreen');
    if (resultsScreen && resultsScreen.classList.contains('hidden')) {
        window.wspLastSearchScreen = window.wspLastSearchScreen || 'wspPendingResultsScreen';
        navigateTo('wspResultsScreen');
        const coachNo = entry['COACH NO'] || entry['coach no'] || (entry._rawRow ? entry._rawRow[0] : 'Unknown');
        document.getElementById('wspResultCoachId').innerText = coachNo;
        document.getElementById('wspDefectCoachNum').value = coachNo;
        
        // Hide history since we navigated directly here from Pending Work or Date Results
        const historyContainer = document.getElementById('wspHistoryContainer');
        if (historyContainer) {
            historyContainer.innerHTML = '<div class="empty-state" style="padding: 1rem 0;"><p>History hidden while editing entry.</p></div>';
        }
        const detailsContainer = document.getElementById('wspCoachDetailsContainer');
        if (detailsContainer) {
            const rly = entry['RLY'] || entry['rly'] || '-';
            const type = entry['Coach Type'] || entry['coach type'] || '-';
            const typeOfWspd = entry['Type of WSPD'] || entry['type of wspd'] || '-';
            const trainNo = entry['DB Train No'] || entry['train no'] || '-';
            const ci = entry['CI'] || entry['ci'] || '-';
            const leftDate = entry['Left Date'] || entry['left date'] || '-';
            const arrivalDate = entry['Arrival Date'] || entry['arrival date'] || '-';
            
            detailsContainer.innerHTML = renderWspCoachHero(coachNo, rly, type, typeOfWspd, trainNo, ci, leftDate, arrivalDate);
        }
    }

    // Set form title & button to Edit mode
    const formTitle = document.getElementById('wspFormTitle');
    if (formTitle) formTitle.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit Defect (Row #${rowIndex})`;
    const defectSubmitBtn = document.getElementById('wspSubmitDefectBtn');
    if (defectSubmitBtn) {
        const textSpan = defectSubmitBtn.querySelector('.btn-text');
        if (textSpan) textSpan.innerText = 'Update Defect';
    }

    // Open accordion if hidden
    const wrapper = document.getElementById('wspDefectFormWrapper');
    if (wrapper && wrapper.classList.contains('hidden')) {
        wrapper.classList.remove('hidden');
        const header = wrapper.previousElementSibling;
        if(header) {
            const chevron = header.querySelector('.chevron');
            if(chevron) {
                chevron.classList.remove('fa-chevron-down');
                chevron.classList.add('fa-chevron-up');
            }
        }
    }
    
    // Scroll to form
    if(wrapper) {
        setTimeout(() => {
            wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }
}

async function fetchWspPendingWork() {
    const btn = document.getElementById('wspFetchPendingBtn');
    if(btn) {
        btn.disabled = true;
        btn.querySelector('.spinner').classList.remove('hidden');
        btn.querySelector('.btn-text').style.opacity = '0';
    }

    try {
        const data = await fetchFromDatabase('pending');
        const container = document.getElementById('wspPendingWorkContainer');
        container.innerHTML = '';
        
        if (data.status === 'success' && data.data && data.data.length > 0) {
            window.wspHistoryMap = window.wspHistoryMap || {};
            
            // Group by Coach Number
            const grouped = {};
            data.data.forEach(entry => {
                const coachNo = entry['COACH NO'] || entry['coach no'] || (entry._rawRow ? entry._rawRow[0] : 'Unknown');
                if (!grouped[coachNo]) grouped[coachNo] = [];
                grouped[coachNo].push(entry);
                window.wspHistoryMap[entry._rowIndex] = entry; // Save for editing
            });
            
            // Sort grouped entries by arrival date
            const parseDateString = (dateStr) => {
                if (!dateStr || dateStr === '-') return Infinity;
                const parts = String(dateStr).split('-');
                if (parts.length === 3 && parts[2].length === 4) {
                    return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00Z`).getTime();
                }
                const ts = Date.parse(dateStr);
                return isNaN(ts) ? Infinity : ts;
            };

            const sortedEntries = Object.entries(grouped).sort((a, b) => {
                const dateA = a[1][0]['Arrival Date'] || a[1][0]['arrival date'] || '-';
                const dateB = b[1][0]['Arrival Date'] || b[1][0]['arrival date'] || '-';
                return parseDateString(dateA) - parseDateString(dateB);
            });

            // Render Accordion
            for (const [coachNo, entries] of sortedEntries) {
                const firstEntry = entries[0];
                const leftDate = firstEntry['Left Date'] || firstEntry['left date'] || '-';
                const arrivalDate = firstEntry['Arrival Date'] || firstEntry['arrival date'] || '-';
                const wspType = firstEntry['Type of WSPD'] || firstEntry['type of wspd'] || '-';
                const pos = firstEntry['DB Train No'] || firstEntry['Position'] || firstEntry['position'] || '-';
                
                const coachCard = document.createElement('div');
                coachCard.className = 'glass-card slide-up';
                coachCard.style.padding = '0';
                coachCard.style.marginBottom = '1rem';
                coachCard.style.overflow = 'hidden';
                
                let coachHtml = `
                    <div class="accordion-header" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; padding: 1.2rem; background: rgba(255,255,255,0.05);" onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('.chevron').classList.toggle('fa-chevron-up'); this.querySelector('.chevron').classList.toggle('fa-chevron-down');">
                        <div>
                            <div style="font-weight: 600; font-size: 1.1rem; margin-bottom: 0.4rem;">
                                <i class="fa-solid fa-train-tram" style="color:#10b981; margin-right: 0.5rem;"></i> Coach: <span style="color:var(--text);">${coachNo}</span> 
                                <span style="font-size: 0.8rem; background: rgba(239, 68, 68, 0.2); color: #ef4444; padding: 2px 6px; border-radius: 4px; margin-left: 0.5rem;">${entries.length} Pending</span>
                            </div>
                            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem; margin-top: 0.5rem; font-size: 0.85rem;">
                                <div style="background: rgba(255,255,255,0.03); padding: 0.4rem 0.6rem; border-radius: 4px; display: flex; align-items: center;"><i class="fa-solid fa-train" style="opacity:0.7; width: 16px; margin-right: 4px; color: #3b82f6;"></i> <span style="color:var(--text-muted); margin-right: 4px;">Train:</span> <span>${pos}</span></div>
                                <div style="background: rgba(255,255,255,0.03); padding: 0.4rem 0.6rem; border-radius: 4px; display: flex; align-items: center;"><i class="fa-solid fa-gear" style="opacity:0.7; width: 16px; margin-right: 4px; color: #8b5cf6;"></i> <span style="color:var(--text-muted); margin-right: 4px;">WSP:</span> <span>${wspType}</span></div>
                                <div style="background: rgba(255,255,255,0.03); padding: 0.4rem 0.6rem; border-radius: 4px; display: flex; align-items: center;"><i class="fa-solid fa-arrow-right-from-bracket" style="opacity:0.7; width: 16px; margin-right: 4px; color: #10b981;"></i> <span style="color:var(--text-muted); margin-right: 4px;">Left:</span> <span>${formatIfDate(leftDate)}</span></div>
                                <div style="background: rgba(255,255,255,0.03); padding: 0.4rem 0.6rem; border-radius: 4px; display: flex; align-items: center;"><i class="fa-solid fa-arrow-right-to-bracket" style="opacity:0.7; width: 16px; margin-right: 4px; color: #f59e0b;"></i> <span style="color:var(--text-muted); margin-right: 4px;">Arr:</span> <span>${formatIfDate(arrivalDate)}</span></div>
                            </div>
                        </div>
                        <i class="fa-solid fa-chevron-down chevron"></i>
                    </div>
                    <div class="accordion-content hidden" style="padding: 0.8rem; border-top: 1px solid rgba(255,255,255,0.08);">
                `;
                
                entries.forEach((entry) => {
                    coachHtml += `
                        <div style="margin-bottom: 0.75rem;">
                            ${buildWspDefectCardHTML(entry, { showActions: true })}
                        </div>
                    `;
                });
                
                coachHtml += `</div>`;
                coachCard.innerHTML = coachHtml;
                container.appendChild(coachCard);
            }
        } else {
            container.innerHTML = `
                <div class="empty-state" style="padding: 1.5rem 0;">
                    <i class="fa-solid fa-check-circle" style="color: #10b981; font-size: 2rem; margin-bottom: 0.5rem;"></i>
                    <p>Awesome! No pending WSP work found.</p>
                </div>
            `;
        }
        
        navigateTo('wspPendingResultsScreen');
        
    } catch (error) {
        console.error('Error fetching pending work:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Could not fetch pending work.',
            background: 'var(--surface)',
            color: 'var(--text)'
        });
    } finally {
        if(btn) {
            btn.disabled = false;
            btn.querySelector('.spinner').classList.add('hidden');
            btn.querySelector('.btn-text').style.opacity = '1';
        }
    }
}


function showChangelog() {
    Swal.fire({
        title: 'Changelog v1',
        html: '<div style="text-align: left; font-size: 0.9rem; line-height: 1.5;">' +
              '<ul>' +
              '<li><b>Progressive Web App (PWA):</b> Full install support on Android, iOS, Windows & Mac with standalone app window and home screen icon.</li>' +
              '<li><b>Offline Capability:</b> Core app shell, fonts, icons, and cached depot data now accessible even with zero network connectivity.</li>' +
              '<li><b>App Shortcuts:</b> Long-press or right-click app icon to jump directly into Search Coach, WSP Entry, Schedule Entry, or Due Coaches.</li>' +
              '<li><b>Performance:</b> Firebase RTDB integration for sub-100ms ultra-fast query responses.</li>' +
              '</ul>' +
              '</div>',
        icon: 'info',
        background: 'rgba(30, 41, 59, 0.95)',
        color: 'var(--text)',
        confirmButtonColor: 'var(--primary)'
    });
}
