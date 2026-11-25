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
            if (!res.ok) return { status: 'error', message: 'Network error' };
            const coachData = await res.json();
            if (coachData) {
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
            if (!res.ok) return { status: 'error', message: 'Network error' };
            const allCoaches = await res.json();
            if (!allCoaches) return { status: 'success', data: [] };

            const selectedDate = new Date(param);
            selectedDate.setHours(0, 0, 0, 0);
            const dueCoaches = [];
            for (const coachNo in allCoaches) {
                const row = allCoaches[coachNo];
                let pit1Match = false, pit2Match = false;

                if (row['_pit1']) {
                    let p1 = new Date(row['_pit1']);
                    if (!isNaN(p1)) { p1.setHours(0, 0, 0, 0); if (p1.getTime() === selectedDate.getTime()) pit1Match = true; }
                }
                if (row['_pit2']) {
                    let p2 = new Date(row['_pit2']);
                    if (!isNaN(p2)) { p2.setHours(0, 0, 0, 0); if (p2.getTime() === selectedDate.getTime()) pit2Match = true; }
                }

                if (pit1Match || pit2Match) {
                    let d2Match = false, d3Match = false;
                    let d2DateStr = '-', d3DateStr = '-';
                    if (row['_d2']) {
                        let d2Date = new Date(row['_d2']);
                        if (!isNaN(d2Date)) { d2Date.setHours(0, 0, 0, 0); if (d2Date.getTime() <= selectedDate.getTime()) d2Match = true; d2DateStr = String(d2Date.getDate()).padStart(2, '0') + '-' + String(d2Date.getMonth() + 1).padStart(2, '0') + '-' + d2Date.getFullYear(); }
                    }
                    if (row['_d3']) {
                        let d3Date = new Date(row['_d3']);
                        if (!isNaN(d3Date)) { d3Date.setHours(0, 0, 0, 0); if (d3Date.getTime() <= selectedDate.getTime()) d3Match = true; d3DateStr = String(d3Date.getDate()).padStart(2, '0') + '-' + String(d3Date.getMonth() + 1).padStart(2, '0') + '-' + d3Date.getFullYear(); }
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
    } catch (e) {
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
    wspManuals: document.getElementById('wspManualsScreen'),
    lhbManuals: document.getElementById('lhbManualsScreen'),
    pohSurvey: document.getElementById('pohSurveyScreen'),
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
    // Initialize PWA Android back history guard
    initPwaHistory();

    // Preload train options immediately so data is ready when the user passes the password screen
    fetchAvailableTrains();

    // Log user visit for Admin Analytics
    logVisit();

    // Login
    document.getElementById('loginForm').addEventListener('submit', handleLogin);

    // Auto-restore session if already authenticated
    if (sessionStorage.getItem('coach_db_auth') === 'true') {
        const hash = window.location.hash ? window.location.hash.replace(/^#/, '') : '';
        const validScreens = [
            'dashboardScreen', 'searchScreen', 'scheduleSearchScreen',
            'dueCoachesScreen', 'wspManualsScreen', 'lhbManualsScreen',
            'pohSurveyScreen', 'adminDashboardScreen'
        ];
        if (hash && validScreens.includes(hash)) {
            navigateTo(hash, false);
        } else {
            navigateTo('dashboardScreen', false);
        }
    }

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
    coachNumberInput.addEventListener('input', function () {
        if (this.value.length > 6) {
            this.value = this.value.slice(0, 6);
        }
    });

    // Auto-sync Sensor Gap from Defect Form to Checklist Report
    const wspSensorGapInput = document.getElementById('wspSensorGap');
    if (wspSensorGapInput) {
        wspSensorGapInput.addEventListener('input', () => {
            const chkGap = document.getElementById('chkSensorGap');
            if (chkGap) {
                chkGap.value = wspSensorGapInput.value;
            }
        });
    }

    // WSP Event Listeners
    const wspCoachForm = document.getElementById('wspSearchCoachForm');
    if (wspCoachForm) {
        wspCoachForm.addEventListener('submit', handleWspSearch);
    }

    // Schedule Event Listeners
    const scheduleSearchForm = document.getElementById('scheduleSearchForm');
    if (scheduleSearchForm) {
        scheduleSearchForm.addEventListener('submit', handleScheduleSearch);
    }

    const scheduleUpdateForm = document.getElementById('scheduleUpdateForm');
    if (scheduleUpdateForm) {
        scheduleUpdateForm.addEventListener('submit', handleScheduleSubmit);
    }




    const wspDefectForm = document.getElementById('wspDefectForm');
    if (wspDefectForm) {
        wspDefectForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const btn = document.getElementById('wspSubmitDefectBtn');
            btn.disabled = true;
            btn.querySelector('.spinner').classList.remove('hidden');
            btn.querySelector('.btn-text').style.opacity = '0';

            const downloadDateStr = document.getElementById('wspDownloadDate').value;
            let monthName = '';
            if (downloadDateStr) {
                const d = new Date(downloadDateStr);
                monthName = d.toLocaleString('default', { month: 'long' });
            }

            const gVal = (id) => (document.getElementById(id) ? document.getElementById(id).value : '');
            const formData = {
                action: 'addWspEntry',
                editRow: gVal('wspEditRowIndex'),
                coachNumber: gVal('wspDefectCoachNum') || gVal('wspFormCoachNum'),
                coachType: gVal('wspFormCoachType'),
                trainNumber: gVal('wspFormTrainNo'),
                wspMake: gVal('wspFormWspd'),
                downloadDate: downloadDateStr,
                month: monthName,
                wheelCondition: gVal('wspWheelCondition'),
                wspCode: gVal('wspCode'),
                psStatus: gVal('wspPsStatus'),

                // Section 2: Batch Data
                phonicWheelCondition: gVal('wspPhonicWheelCondition'),
                ventingSound: gVal('wspVentingSound'),
                kmReadingDeficiency: gVal('wspKmReadingDeficiency'),
                bcPressure: gVal('wspBcPressure'),
                dvReleaseTime: gVal('wspDvReleaseTime'),
                dumpValveChokeMod: gVal('wspDumpValveChokeMod'),
                dumpValve: gVal('wspDumpValve'),
                chokeFilterCondition: gVal('wspChokeFilterCondition'),
                sensorGap: gVal('wspSensorGap'),
                hosePipeMod: gVal('wspHosePipeMod'),

                // Section 3A: Modification Status
                milConnector: gVal('wspMilConnector'),
                jbMounting: gVal('wspJbMounting'),
                reroutingSensorCable: gVal('wspReroutingSensorCable'),
                jbCover: gVal('wspJbCover'),
                jbOrientation: gVal('wspJbOrientation'),

                // Section 3B: Underframe Observation
                waterIngress: gVal('wspWaterIngress'),
                sensorProbeCondition: gVal('wspSensorProbeCondition'),
                correctSensorMake: gVal('wspCorrectSensorMake'),
                correctDvMake: gVal('wspCorrectDvMake'),
                crossSensorWiring: gVal('wspCrossSensorWiring'),
                crossDvWiring: gVal('wspCrossDvWiring'),
                dvPinCondition: gVal('wspDvPinCondition'),

                // Section 4: WSP Panel Observations
                rbcStatus: gVal('wspRbcStatus'),
                ksRelayTimer: gVal('wspKsRelayTimer'),
                mcbTripping: gVal('wspMcbTripping'),
                mcbFuseRating: gVal('wspMcbFuseRating'),
                ledGlow: gVal('wspLedGlow'),
                dvExcessiveActivation: gVal('wspDvExcessiveActivation'),
                continuousFaultAxle: gVal('wspContinuousFaultAxle'),
                psBypass: gVal('wspPsBypass'),
                sleepMode: gVal('wspSleepMode'),
                dateTimeSync: gVal('wspDateTimeSync'),
                powerOnIssues: gVal('wspPowerOnIssues'),
                speedVariation: gVal('wspSpeedVariation'),
                defectCategory: gVal('wspDefectCategory'),
                observation: gVal('wspObservation'),
                otherObservation: gVal('wspOtherObservation'),
                description: gVal('wspDescription'),

                // Section 5: Attention & Conclusion
                defectCorrelated: gVal('wspDefectCorrelated'),
                attention: gVal('wspAttention'),
                followUpRemarks: gVal('wspFollowUpRemarks'),
                itemRequired: gVal('wspItemRequired'),
                anyWorkPending: gVal('wspAnyWorkPending'),
                pendingWorkDesc: gVal('wspPendingWorkDesc'),
                checklistSubmitted: gVal('wspChecklist'),
                dataEntryBy: gVal('wspDataEntryBy')
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

                // Defect saved successfully -> Offer immediate PDF download
                Swal.fire({
                    icon: 'success',
                    title: 'Defect Logged Successfully!',
                    html: `
                        <p style="margin-bottom: 0.6rem;">The WSP defect record has been logged in the database.</p>
                        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.2rem;">Would you like to download the official PDF inspection report now?</p>
                    `,
                    showCancelButton: true,
                    confirmButtonColor: '#ef4444',
                    cancelButtonColor: '#64748b',
                    confirmButtonText: '<i class="fa-solid fa-file-pdf"></i> Download PDF Report',
                    cancelButtonText: '<i class="fa-solid fa-check"></i> Done',
                    background: 'var(--surface)',
                    color: 'var(--text)'
                }).then((result) => {
                    if (result.isConfirmed) {
                        generateWspDefectPdf(formData);
                    }
                    closeWspDefectModal();
                    wspDefectForm.reset();
                    updateWspFormAutoFill();
                    document.getElementById('wspEditRowIndex').value = '';
                    const formTitle = document.getElementById('wspFormTitle');
                    if (formTitle) formTitle.innerHTML = `<i class="fa-solid fa-plus"></i> Add New Defect`;
                    const defectSubmitBtn = document.getElementById('wspSubmitDefectBtn');
                    if (defectSubmitBtn) {
                        const textSpan = defectSubmitBtn.querySelector('.btn-text');
                        if (textSpan) textSpan.innerText = 'Submit Defect Record';
                    }

                    // Close the accordion if present
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

    // Submit listener for WSP Checklist Inspection Modal
    const wspChecklistForm = document.getElementById('wspChecklistForm');
    if (wspChecklistForm) {
        wspChecklistForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('wspSubmitChecklistBtn');
            if (btn) {
                btn.disabled = true;
                const spinner = btn.querySelector('.spinner');
                if (spinner) spinner.classList.remove('hidden');
                const txt = btn.querySelector('.btn-text');
                if (txt) txt.style.opacity = '0';
            }

            const gVal = (id) => {
                const el = document.getElementById(id);
                return el ? el.value.trim() : '';
            };

            const downloadDate = gVal('chkDownloadDate');
            let monthName = '';
            if (downloadDate) {
                const d = new Date(downloadDate);
                if (!isNaN(d.getTime())) {
                    monthName = d.toLocaleString('default', { month: 'long' });
                }
            }

            const formData = {
                action: 'addWspEntry',
                editRow: gVal('chkEditRowIndex'),
                coachNumber: gVal('chkCoachNum') || gVal('chkFormCoachNum'),
                coachType: gVal('chkFormCoachType'),
                trainNumber: gVal('chkFormTrainNo'),
                wspMake: gVal('chkFormWspd'),
                downloadDate: downloadDate,
                month: monthName,
                wheelCondition: gVal('chkWheelCondition'),
                wspCode: gVal('chkCode'),
                psStatus: gVal('chkPsStatus'),

                // Section 2: Batch Data
                phonicWheelCondition: gVal('chkPhonicWheelCondition'),
                ventingSound: gVal('chkVentingSound'),
                kmReadingDeficiency: gVal('chkKmReadingDeficiency'),
                bcPressure: gVal('chkBcPressure'),
                dvReleaseTime: gVal('chkDvReleaseTime'),
                dumpValveChokeMod: gVal('chkDumpValveChokeMod'),
                dumpValve: gVal('chkDumpValve'),
                chokeFilterCondition: gVal('chkChokeFilterCondition'),
                sensorGap: gVal('chkSensorGap') || gVal('wspSensorGap') || getWspField(window.latestCoachHistoryEntry, 'Sensor gap', 'sensor gap', 'sensorGap') || '',
                hosePipeMod: gVal('chkHosePipeMod'),

                // Section 3A: Modification Status
                milConnector: gVal('chkMilConnector'),
                jbMounting: gVal('chkJbMounting'),
                reroutingSensorCable: gVal('chkReroutingSensorCable'),
                jbCover: gVal('chkJbCover'),
                jbOrientation: gVal('chkJbOrientation'),

                // Section 3B: Underframe Observation
                waterIngress: gVal('chkWaterIngress'),
                sensorProbeCondition: gVal('chkSensorProbeCondition'),
                correctSensorMake: gVal('chkCorrectSensorMake'),
                correctDvMake: gVal('chkCorrectDvMake'),
                crossSensorWiring: gVal('chkCrossSensorWiring'),
                crossDvWiring: gVal('chkCrossDvWiring'),
                dvPinCondition: gVal('chkDvPinCondition'),

                // Section 4: WSP Panel Observations
                rbcStatus: gVal('chkRbcStatus'),
                ksRelayTimer: gVal('chkKsRelayTimer'),
                mcbTripping: gVal('chkMcbTripping'),
                mcbFuseRating: gVal('chkMcbFuseRating'),
                ledGlow: gVal('chkLedGlow'),
                dvExcessiveActivation: gVal('chkDvExcessiveActivation'),
                continuousFaultAxle: gVal('chkContinuousFaultAxle'),
                psBypass: gVal('chkPsBypass'),
                sleepMode: gVal('chkSleepMode'),
                dateTimeSync: gVal('chkDateTimeSync'),
                powerOnIssues: gVal('chkPowerOnIssues'),
                speedVariation: gVal('chkSpeedVariation'),
                defectCategory: gVal('chkDefectCategory'),
                observation: gVal('chkObservation'),
                otherObservation: gVal('chkOtherObservation'),
                description: gVal('chkDescription'),

                // Section 5: Attention & Conclusion
                defectCorrelated: gVal('chkDefectCorrelated'),
                attention: gVal('chkAttention'),
                followUpRemarks: gVal('chkFollowUpRemarks'),
                itemRequired: gVal('chkItemRequired'),
                anyWorkPending: gVal('chkAnyWorkPending'),
                pendingWorkDesc: gVal('chkPendingWorkDesc'),
                checklistSubmitted: 'Yes',
                dataEntryBy: gVal('chkDataEntryBy')
            };

            try {
                await fetch(GOOGLE_APP_SCRIPT_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });

                // Update local history cache entry
                const rowIdx = formData.editRow;
                const cardKey = gVal('chkEditCardId') || rowIdx;
                if (window.wspHistoryMap) {
                    if (rowIdx && window.wspHistoryMap[rowIdx]) {
                        Object.assign(window.wspHistoryMap[rowIdx], formData);
                        window.wspHistoryMap[rowIdx]['CHECKLIST SUBMITTED'] = 'Yes';
                        window.wspHistoryMap[rowIdx]['checklist submitted'] = 'Yes';
                    }
                    if (cardKey && window.wspHistoryMap[cardKey]) {
                        Object.assign(window.wspHistoryMap[cardKey], formData);
                        window.wspHistoryMap[cardKey]['CHECKLIST SUBMITTED'] = 'Yes';
                        window.wspHistoryMap[cardKey]['checklist submitted'] = 'Yes';
                    }
                }
                const wrapper = document.getElementById(`card-wrapper-${cardKey}`) || (rowIdx ? document.getElementById(`card-wrapper-${rowIdx}`) : null);
                if (wrapper && window.wspHistoryMap && (window.wspHistoryMap[cardKey] || window.wspHistoryMap[rowIdx])) {
                    const targetEntry = window.wspHistoryMap[cardKey] || window.wspHistoryMap[rowIdx];
                    wrapper.innerHTML = buildWspDefectCardHTML(targetEntry, {
                        showActions: true,
                        cardId: String(cardKey),
                        startExpanded: true
                    });
                }

                closeWspChecklistModal();

                Swal.fire({
                    icon: 'success',
                    title: 'Checklist Saved Successfully!',
                    html: `
                        <p style="margin-bottom: 0.6rem;">Inspection checklist for coach ${formData.coachNumber} has been logged.</p>
                        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.2rem;">Would you like to download the official PDF checklist report now?</p>
                    `,
                    showCancelButton: true,
                    confirmButtonColor: '#ef4444',
                    cancelButtonColor: '#64748b',
                    confirmButtonText: '<i class="fa-solid fa-file-pdf"></i> Download PDF Report',
                    cancelButtonText: '<i class="fa-solid fa-check"></i> Done',
                    background: 'var(--surface)',
                    color: 'var(--text)'
                }).then((result) => {
                    if (result.isConfirmed) {
                        openWspPdfPreviewModal(formData);
                    }
                });

            } catch (err) {
                console.error('Error submitting checklist:', err);
                showWarningAlert('Failed to save checklist. Please try again.');
            } finally {
                if (btn) {
                    btn.disabled = false;
                    const spinner = btn.querySelector('.spinner');
                    if (spinner) spinner.classList.add('hidden');
                    const txt = btn.querySelector('.btn-text');
                    if (txt) txt.style.opacity = '1';
                }
            }
        });
    }

});

// --- Navigation & Android PWA History Handling ---
let isHandlingPopState = false;
let lastBackPressTime = 0;

function pushModalState(modalId) {
    if (!isHandlingPopState) {
        try {
            window.history.pushState({ modal: modalId, type: 'modal', time: Date.now() }, '', '#' + modalId);
        } catch (e) {}
    }
}
window.pushModalState = pushModalState;

function showExitToast(message) {
    let toast = document.getElementById('pwaExitToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'pwaExitToast';
        toast.style.cssText = `
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%) translateY(20px);
            background: rgba(15, 23, 42, 0.94);
            color: #f8fafc;
            padding: 10px 22px;
            border-radius: 30px;
            font-size: 0.85rem;
            font-weight: 600;
            z-index: 99999;
            box-shadow: 0 4px 20px rgba(0,0,0,0.6);
            border: 1px solid rgba(255,255,255,0.18);
            backdrop-filter: blur(10px);
            opacity: 0;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            pointer-events: none;
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        document.body.appendChild(toast);
    }
    toast.innerHTML = `<i class="fa-solid fa-arrow-left" style="color:#60a5fa; font-size:0.8rem;"></i> ${message}`;
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
    });
    clearTimeout(window._exitToastTimer);
    window._exitToastTimer = setTimeout(() => {
        if (toast) {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(20px)';
        }
    }, 2000);
}

function handleAppBack() {
    // 1. SweetAlert2 open?
    if (typeof Swal !== 'undefined' && Swal.isVisible()) {
        Swal.close();
        return true;
    }

    // 2. WSP / POH PDF Preview modal open?
    const pdfPreview = document.getElementById('wspPdfPreviewModal');
    if (pdfPreview && !pdfPreview.classList.contains('hidden') && pdfPreview.style.display !== 'none') {
        closeWspPdfPreviewModal(true);
        return true;
    }
    const pohPdfPreview = document.getElementById('pohPdfPreviewModal');
    if (pohPdfPreview && !pohPdfPreview.classList.contains('hidden') && pohPdfPreview.style.display !== 'none') {
        closePohPdfPreviewModal(true);
        return true;
    }

    // 3. Fullscreen PDF Viewer modal open?
    const pdfViewer = document.getElementById('pdfViewerModal');
    if (pdfViewer && !pdfViewer.classList.contains('hidden') && pdfViewer.style.display !== 'none') {
        closePdfViewer(true);
        return true;
    }

    // 4. Checklist / Defect modal open?
    const checklistModal = document.getElementById('wspChecklistModal') || document.getElementById('wspDefectModal');
    if (checklistModal && !checklistModal.classList.contains('hidden') && checklistModal.style.display !== 'none') {
        closeWspDefectModal(true);
        return true;
    }

    // 5. Inline edit open on defect card?
    const openInline = document.querySelectorAll('[id^="wsp-edit-"]:not(.hidden)');
    if (openInline && openInline.length > 0) {
        openInline.forEach(el => {
            const cardId = el.id.replace('wsp-edit-', '');
            if (typeof cancelInlineWspDefect === 'function') cancelInlineWspDefect(cardId);
        });
        return true;
    }

    // 6. Current active screen
    const activeScreen = document.querySelector('.screen.active') || document.querySelector('.screen:not(.hidden)');
    const currentScreenId = activeScreen ? activeScreen.id : '';

    if (currentScreenId === 'wspResultsScreen') {
        goBackFromWspResults();
        return true;
    }
    if (currentScreenId === 'wspRakeResultsScreen' || currentScreenId === 'wspDateResultsScreen' || currentScreenId === 'wspPendingResultsScreen') {
        navigateTo('wspSearchScreen', false);
        return true;
    }
    if (currentScreenId === 'resultsScreen') {
        goBackFromResults();
        return true;
    }
    if (currentScreenId === 'rakeResultsScreen') {
        navigateTo('searchScreen', false);
        return true;
    }
    if (currentScreenId === 'scheduleResultsScreen') {
        navigateTo('scheduleSearchScreen', false);
        return true;
    }
    if (currentScreenId === 'selectionScreen') {
        navigateTo('searchScreen', false);
        return true;
    }

    // If on wspSearchScreen
    if (currentScreenId === 'wspSearchScreen') {
        navigateTo('dashboardScreen', false);
        return true;
    }

    // Other tool screens return to dashboard
    if (['searchScreen', 'scheduleSearchScreen', 'dueCoachesScreen', 'wspManualsScreen', 'lhbManualsScreen', 'pohSurveyScreen', 'adminDashboardScreen', 'adminLoginScreen'].includes(currentScreenId)) {
        navigateTo('dashboardScreen', false);
        return true;
    }

    // If on dashboardScreen or loginScreen, handle double-back-to-exit
    if (currentScreenId === 'dashboardScreen' || currentScreenId === 'loginScreen') {
        const now = Date.now();
        if (now - lastBackPressTime < 2000) {
            // Allow exit: do not push guard
            return false;
        } else {
            lastBackPressTime = now;
            showExitToast("Press back again to exit");
            try {
                window.history.pushState({ screen: currentScreenId, type: 'guard' }, '', '#' + currentScreenId);
            } catch (e) {}
            return true;
        }
    }

    return false;
}
window.handleAppBack = handleAppBack;

window.addEventListener('popstate', (event) => {
    isHandlingPopState = true;
    try {
        handleAppBack();
    } finally {
        setTimeout(() => {
            isHandlingPopState = false;
        }, 60);
    }
});

function initPwaHistory() {
    try {
        const initialScreen = document.querySelector('.screen.active')?.id || 'loginScreen';
        if (!window.history.state) {
            window.history.replaceState({ screen: initialScreen, type: 'root' }, '', '#' + initialScreen);
            window.history.pushState({ screen: initialScreen, type: 'guard' }, '', '#' + initialScreen);
        }
    } catch (e) {}
}
window.initPwaHistory = initPwaHistory;

function navigateTo(screenId, pushHistory = true) {
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

        if (screenId === 'dueCoachesScreen') {
            const duePicker = document.getElementById('dueDatePicker');
            if (duePicker && !duePicker.value) {
                const today = new Date();
                duePicker.value = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
            }
        }

        if (screenId === 'wspManualsScreen') {
            if (typeof window.loadManualsFromDrive === 'function') {
                window.loadManualsFromDrive();
            } else if (typeof loadManualsFromDrive === 'function') {
                loadManualsFromDrive();
            }
        }

        if (screenId === 'lhbManualsScreen') {
            if (typeof window.loadLhbManualsFromDrive === 'function') {
                window.loadLhbManualsFromDrive();
            } else if (typeof loadLhbManualsFromDrive === 'function') {
                loadLhbManualsFromDrive();
            }
        }
    }

    // Push state into history unless navigation was triggered by back action
    if (pushHistory && !isHandlingPopState) {
        try {
            window.history.pushState({ screen: screenId, type: 'screen', time: Date.now() }, '', '#' + screenId);
        } catch (e) {}
    }
}

function goBackFromWspResults() {
    if (window.wspLastSearchScreen) {
        navigateTo(window.wspLastSearchScreen, false);
    } else {
        navigateTo('wspSearchScreen', false);
    }
}

function goBackFromResults() {
    if (window.lastSearchScreen) {
        navigateTo(window.lastSearchScreen, false);
    } else {
        navigateTo('searchScreen', false);
    }
}

function logout() {
    sessionStorage.removeItem('coach_db_auth');
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
    } catch (err) { }
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
        } catch (e) { }
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
        sessionStorage.setItem('coach_db_auth', 'true');
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

    const coachNumber = String(document.getElementById('coachNumberInput').value).trim();

    if (coachNumber.length !== 6 && coachNumber !== '91223') {
        showWarningAlert("Please enter a valid 6-digit coach number (or 91223).");
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
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

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
        } catch (e) {
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
                <button class="nav-chip" onclick="jumpToSection('section-pro')"><i class="fa-solid fa-wrench"></i> PRO</button>
                <button class="nav-chip" onclick="jumpToSection('section-location')"><i class="fa-solid fa-location-dot"></i> Status</button>
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
    // Group 2: PRO Details (2nd section)
    const idxDOC = findIndexByText(['doc']);
    const idxSS1Done = findIndexByText(['ss1 done', 'ss 1 done']);
    let idxSS1 = -1;
    for (let i = 0; i < headers.length; i++) {
        if (!headers[i]) continue;
        const h = String(headers[i]).toLowerCase();
        if ((h.includes('ss1') || h.includes('ss 1') || h.includes('ss-1')) && !h.includes('done')) {
            idxSS1 = i;
            break;
        }
    }
    if (idxSS1 === -1) {
        idxSS1 = findIndexByText(['ss1', 'ss 1', 'ss-1']);
    }
    const idxWTT = findIndexByText(['wtt']);
    const idxPOH = letterToIndex('G');
    const idxRD = letterToIndex('H');

    // Desired display order: POH/DOM, SHOP/DOC, R/DATE, SS1 DONE DATE, SS1, WTT
    const group2PRO = [];
    if (idxPOH !== -1) group2PRO.push({ index: idxPOH, label: headers[idxPOH] || 'POH/DOM' });
    if (idxDOC !== -1) group2PRO.push({ index: idxDOC, label: headers[idxDOC] || 'SHOP/DOC' });
    if (idxRD !== -1) group2PRO.push({ index: idxRD, label: headers[idxRD] || 'R/DATE' });
    if (idxSS1Done !== -1) group2PRO.push({ index: idxSS1Done, label: headers[idxSS1Done] || 'SS1 Done Date' });
    if (idxSS1 !== -1 && idxSS1 !== idxSS1Done) group2PRO.push({ index: idxSS1, label: headers[idxSS1] || 'SS1' });
    if (idxWTT !== -1) group2PRO.push({ index: idxWTT, label: headers[idxWTT] || 'WTT' });

    createGroup('PRO Details', group2PRO, {
        icon: 'fa-wrench',
        sectionId: 'section-pro',
        collapsedByDefault: false
    });

    // Group 3: Location/Status (3rd section)
    const group3Location = [
            { index: letterToIndex('O'), label: headers[letterToIndex('O')] || 'Current Position' },
            { index: letterToIndex('R'), label: headers[letterToIndex('R')] || 'Train Number' },
            { index: letterToIndex('S'), label: headers[letterToIndex('S')] || 'Coach Indication' },
            { index: letterToIndex('P'), label: headers[letterToIndex('P')] || 'Departure Date' },
            { index: letterToIndex('Q'), label: headers[letterToIndex('Q')] || 'Arrival Date' }
        ];
        createGroup('Location & Status', group3Location, {
            icon: 'fa-location-dot',
            sectionId: 'section-location',
            collapsedByDefault: false
    });

    // Group 4: Other Details (Collapsed by default on mobile to save vertical scrolling)
    const group4 = [];
        for(let i = 0; i<headers.length; i++) {
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
            const getVal = (key, isDate = false) => {
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
                        <!-- 2x2 D2/D3 Matrix: Row 1 = D2 Date & D3 Date; Row 2 = D2 Due & D3 Due -->
                        <div class="sched-matrix-grid">
                            <!-- Row 1: D2 Date & D3 Date -->
                            <div class="sched-tile" data-label="d2 date d2 done" data-value="${escapeHtml(getVal('D 2', true))}">
                                <span class="sched-tile-lbl">D2 Date</span>
                                <span class="sched-tile-val">${escapeHtml(getVal('D 2', true))}</span>
                            </div>
                            <div class="sched-tile" data-label="d3 date d3 done" data-value="${escapeHtml(getVal('D 3', true))}">
                                <span class="sched-tile-lbl">D3 Date</span>
                                <span class="sched-tile-val">${escapeHtml(getVal('D 3', true))}</span>
                            </div>

                            <!-- Row 2: D2 Due & D3 Due -->
                            <div class="sched-tile highlight" style="border-color: ${d2DueColor}; background: ${d2DueColor}15;" data-label="d2 due date d2 due" data-value="${escapeHtml(fmtDate(d2DueVal))}">
                                <span class="sched-tile-lbl" style="color: ${d2DueColor}; font-weight: 700;">D2 Due</span>
                                <span class="sched-tile-val bold" style="color: ${d2DueColor}; font-size: 0.95rem;">${escapeHtml(fmtDate(d2DueVal))}</span>
                            </div>
                            <div class="sched-tile highlight" style="border-color: ${d3DueColor}; background: ${d3DueColor}15;" data-label="d3 due date d3 due" data-value="${escapeHtml(fmtDate(d3DueVal))}">
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

            // Place as Section 4: 1) Coach details, 2) PRO, 3) Location and status, 4) Schedule details, 5) Other details
            const otherSec = container.querySelector('#section-other');
            if (otherSec) {
                container.insertBefore(firstChild, otherSec);
            } else {
                const locSec = container.querySelector('#section-location');
                if (locSec && locSec.nextSibling) {
                    container.insertBefore(firstChild, locSec.nextSibling);
                } else {
                    container.appendChild(firstChild);
                }
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
            "Owning Railway": id.substring(0, 2),
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


    // --- WSP Textarea Auto-expand Helper ---
    function autoExpandTextarea(el) {
        if (!el || el.tagName !== 'TEXTAREA') return;
        el.style.height = 'auto';
        const newHeight = Math.min(280, Math.max(52, el.scrollHeight));
        el.style.height = newHeight + 'px';
        if (el.scrollHeight > 280) {
            el.style.overflowY = 'auto';
        } else {
            el.style.overflowY = 'hidden';
        }
    }
    window.autoExpandTextarea = autoExpandTextarea;

    document.addEventListener('input', (e) => {
        if (e.target && e.target.tagName === 'TEXTAREA' && (e.target.classList.contains('styled-input') || e.target.classList.contains('auto-expand'))) {
            autoExpandTextarea(e.target);
        }
    });

    // --- WSP Entry Logic ---
    function switchWspTab(tab) {
        const coachBtn = document.getElementById('wspTabCoach');
        const rakeBtn = document.getElementById('wspTabRake');
        const dateBtn = document.getElementById('wspTabDate');
        const pendingBtn = document.getElementById('wspTabPending');

        const coachForm = document.getElementById('wspSearchCoachForm');
        const rakeForm = document.getElementById('wspSearchRakeForm');
        const dateForm = document.getElementById('wspSearchDateForm');

        if (coachBtn) coachBtn.classList.remove('active');
        if (rakeBtn) rakeBtn.classList.remove('active');
        if (dateBtn) dateBtn.classList.remove('active');
        if (pendingBtn) pendingBtn.classList.remove('active');

        if (coachForm) coachForm.classList.add('hidden');
        if (rakeForm) rakeForm.classList.add('hidden');
        if (dateForm) dateForm.classList.add('hidden');

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
            if (coachBtn) coachBtn.classList.add('active');
            if (coachForm) coachForm.classList.remove('hidden');
        } else if (tab === 'rake') {
            if (rakeBtn) rakeBtn.classList.add('active');
            if (rakeForm) rakeForm.classList.remove('hidden');

            const trainSelect = document.getElementById('wspTrainSelect');
            if (trainSelect && trainSelect.options.length <= 1) {
                const mainSelect = document.getElementById('trainSelect');
                if (mainSelect && mainSelect.options.length > 1) {
                    trainSelect.innerHTML = mainSelect.innerHTML;
                } else {
                    fetchAvailableTrains().then(() => {
                        if (document.getElementById('trainSelect')) {
                            trainSelect.innerHTML = document.getElementById('trainSelect').innerHTML;
                        }
                    });
                }
            }
        } else if (tab === 'date') {
            if (dateBtn) dateBtn.classList.add('active');
            if (dateForm) dateForm.classList.remove('hidden');
            loadWspRecentDates();
        } else if (tab === 'manuals') {
            navigateTo('wspManualsScreen');
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

    function extractCoachNumber(entry) {
        if (entry) {
            let val = getWspField(entry, 'Coach No', 'COACH NO', 'coach num', 'Coach Number', 'coachNumber', 'coach_no', 'COACH_NO');
            if (val && val !== '-' && val !== 'Coach WSP') return val;
            if (entry._coachNumber && entry._coachNumber !== '-') return String(entry._coachNumber).trim();
            if (entry['Coach No'] && entry['Coach No'] !== '-') return String(entry['Coach No']).trim();
            if (entry['COACH NO'] && entry['COACH NO'] !== '-') return String(entry['COACH NO']).trim();
            if (entry._rawRow && entry._rawRow[0] && entry._rawRow[0] !== '-') return String(entry._rawRow[0]).trim();
        }
        const heroEl = document.getElementById('wspResultCoachId');
        if (heroEl && heroEl.innerText && heroEl.innerText.trim() !== '' && heroEl.innerText.trim() !== 'Coach WSP' && heroEl.innerText.trim() !== '-') {
            return heroEl.innerText.trim();
        }
        const inputEl = document.getElementById('wspDefectCoachNum') || document.getElementById('wspCoachNumberInput');
        if (inputEl && inputEl.value && inputEl.value.trim() !== '' && inputEl.value.trim() !== 'Coach WSP' && inputEl.value.trim() !== '-') {
            return inputEl.value.trim();
        }
        if (window.activeWspCoachData && window.activeWspCoachData.coachNum && window.activeWspCoachData.coachNum !== '-') {
            return String(window.activeWspCoachData.coachNum).trim();
        }
        return '';
    }
    window.extractCoachNumber = extractCoachNumber;

    function extractCoachType(entry) {
        if (entry) {
            let val = getWspField(entry, 'Coach Type', 'coach type', 'TYPE', 'type', 'coachType');
            if (val && val !== '-') return val;
        }
        if (window.activeWspCoachData && window.activeWspCoachData.type && window.activeWspCoachData.type !== '-') {
            return String(window.activeWspCoachData.type).trim();
        }
        const el = document.getElementById('chkFormCoachType') || document.getElementById('wspFormCoachType');
        return el && el.value && el.value !== '-' ? el.value.trim() : '';
    }
    window.extractCoachType = extractCoachType;

    function extractTrainNo(entry) {
        if (entry) {
            let val = getWspField(entry, 'Train No', 'DB Train No', 'train no', 'trainNumber');
            if (val && val !== '-') return val;
        }
        if (window.activeWspCoachData && window.activeWspCoachData.trainNo && window.activeWspCoachData.trainNo !== '-') {
            return String(window.activeWspCoachData.trainNo).trim();
        }
        const el = document.getElementById('chkFormTrainNo') || document.getElementById('wspFormTrainNo');
        return el && el.value && el.value !== '-' ? el.value.trim() : '';
    }
    window.extractTrainNo = extractTrainNo;

    function extractWspMake(entry) {
        if (entry) {
            let val = getWspField(entry, 'WSP Make', 'wsp make', 'Type of WSPD', 'type of wspd', 'wspMake');
            if (val && val !== '-') {
                val = String(val).trim();
                return val.toUpperCase() === 'ESC' ? 'ESCORTS' : val;
            }
        }
        if (window.activeWspCoachData && window.activeWspCoachData.typeOfWspd && window.activeWspCoachData.typeOfWspd !== '-') {
            let val = String(window.activeWspCoachData.typeOfWspd).trim();
            return val.toUpperCase() === 'ESC' ? 'ESCORTS' : val;
        }
        const el = document.getElementById('chkFormWspd') || document.getElementById('wspFormWspd');
        if (el && el.value && el.value !== '-') {
            let val = el.value.trim();
            return val.toUpperCase() === 'ESC' ? 'ESCORTS' : val;
        }
        return '';
    }
    window.extractWspMake = extractWspMake;

    function updateWspFormAutoFill() {
        const data = window.activeWspCoachData || {};

        const findVal = (keys) => {
            if (!keys) return '';
            for (const k of keys) {
                if (data[k] && data[k] !== '-') return String(data[k]).trim();
                const lowerK = k.toLowerCase().trim();
                for (const objKey of Object.keys(data)) {
                    if (objKey.toLowerCase().trim() === lowerK && data[objKey] && data[objKey] !== '-') {
                        return String(data[objKey]).trim();
                    }
                }
            }
            return '';
        };

        // 1. Coach Number (from active data, hero badge, header, search input, or latest history entry)
        let coachNum = data.coachNum || findVal(['coachNum', 'COACH NO', 'coach no', 'coach number', 'Coach No']);
        if (!coachNum || coachNum === '-') {
            coachNum = document.getElementById('wspHeroCoachNum')?.innerText?.trim() ||
                document.getElementById('wspResultCoachId')?.innerText?.trim() ||
                document.getElementById('wspCoachNumberInput')?.value?.trim() || '';
        }
        if ((!coachNum || coachNum === '-') && window.latestCoachHistoryEntry) {
            coachNum = getWspField(window.latestCoachHistoryEntry, 'COACH NO', 'coach no');
        }

        // 2. Coach Type (from active data, hero badge, or latest history entry)
        let coachType = data.type || findVal(['type', 'TYPE', 'Coach Type', 'coach type', 'COACH TYPE']);
        if (!coachType || coachType === '-') {
            coachType = document.getElementById('wspHeroCoachType')?.innerText?.trim() || '';
        }
        if ((!coachType || coachType === '-') && window.latestCoachHistoryEntry) {
            coachType = getWspField(window.latestCoachHistoryEntry, 'COACH TYPE', 'coach type', 'type');
        }

        // 3. Train Number (from active data, hero item, or latest history entry)
        let trainNo = data.trainNo || findVal(['trainNo', 'TRAIN NO', 'train no', 'DB Train No', 'TRAIN']);
        if (!trainNo || trainNo === '-') {
            const trainEl = document.getElementById('wspDetailsTrainNo');
            if (trainEl && trainEl.innerText.trim() !== '-') trainNo = trainEl.innerText.trim();
        }
        if ((!trainNo || trainNo === '-') && window.latestCoachHistoryEntry) {
            trainNo = getWspField(window.latestCoachHistoryEntry, 'TRAIN NO', 'train no', 'ARRIVAL T NO');
        }

        // 4. WSPD Make (from active data, hero badge, or latest historical entry)
        let wspd = data.typeOfWspd || findVal(['typeOfWspd', 'Type of WSPD', 'WSP MAKE', 'wsp make', 'WSP Make', 'wspd', 'WSPD']);
        if (!wspd || wspd === '-') {
            if (window.latestCoachHistoryEntry) {
                wspd = getWspField(window.latestCoachHistoryEntry, 'WSP MAKE', 'wsp make', 'Type of WSPD', 'type of wspd');
            }
        }
        if (!wspd || wspd === '-') {
            const badge = document.getElementById('wspHeroWspd');
            if (badge) {
                wspd = badge.innerText.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();
            }
        }

        const setField = (id, val) => {
            const el = document.getElementById(id);
            if (el) {
                const finalVal = (val && val !== '-') ? String(val).trim() : '';
                el.value = finalVal;
                el.defaultValue = finalVal;
            }
        };

        setField('wspFormCoachNum', coachNum);
        setField('wspDefectCoachNum', coachNum);
        setField('wspFormCoachType', coachType);
        setField('wspFormTrainNo', trainNo);
        setField('wspFormWspd', wspd);

        const subtitleEl = document.getElementById('wspModalSubtitle');
        if (subtitleEl && coachNum) {
            subtitleEl.innerHTML = `Coach: <strong style="color: #38bdf8;">${coachNum}</strong> ${coachType && coachType !== '-' ? `(${coachType})` : ''} ${trainNo && trainNo !== '-' ? `&bull; Train: ${trainNo}` : ''}`;
        }
    }
    window.updateWspFormAutoFill = updateWspFormAutoFill;

    function populateWspFormFromEntry(entry, options = {}) {
        if (!entry) return;

        const setVal = (id, keyArr) => {
            const el = document.getElementById(id);
            if (!el) return;
            const val = keyArr.reduce((found, k) => {
                if (found) return found;
                const entryKey = Object.keys(entry).find(ek => ek.toLowerCase().trim() === k.toLowerCase().trim());
                return (entryKey && entry[entryKey] !== undefined && entry[entryKey] !== null) ? String(entry[entryKey]).trim() : '';
            }, '');
            if (!val || val === '-') return;

            if (el.tagName === 'SELECT') {
                const SYNONYM_MAP = {
                    'satisfactory': 'ok',
                    'loose': 'not ok',
                    'damaged': 'not ok',
                    'dust/metal accumulation': 'not ok',
                    'not ok': 'not ok',
                    'normal venting sound (yes)': 'ok',
                    'normal venting sound': 'ok',
                    'no venting sound (no)': 'not ok',
                    'no venting sound': 'not ok',
                    'abnormal sound': 'not ok',
                    'no deficiency': 'ok',
                    'no deficiency (normal)': 'ok',
                    'km not updating': 'not ok',
                    'abnormal km jump': 'not ok',
                    'deficiency found': 'not ok',
                    'data not available': 'data not available',
                    'complied': 'modified',
                    'not complied': 'not modified',
                    'not applicable': 'not applicable',
                    'nc': 'not ok',
                    'nc (not checked)': 'not ok',
                    'clean / good': 'ok',
                    'clean/good': 'ok',
                    'cleaned during inspection': 'ok',
                    'choked / dirty': 'blocked',
                    'defective / replaced': 'blocked',
                    'provided & intact': 'available',
                    'provided and intact': 'available',
                    'not provided': 'not available',
                    'damaged / replaced': 'not available',
                    'good': 'ok',
                    'rubbing with wheel/axle': 'rubbing',
                    'normal (110v dc)': 'ok',
                    'normal': 'ok',
                    'high voltage': 'not ok',
                    'low voltage': 'not ok',
                    'no supply / fluctuating': 'not ok',
                    'no (normal)': 'no',
                    'yes (fault led glowing)': 'yes',
                    'working normal': 'yes',
                    'not working / always on': 'no',
                    'not working': 'no',
                    'synchronised (ok)': 'ok',
                    'synchronised': 'ok',
                    'date/time mismatch': 'wrong date time( attended)',
                    'reset to current date/time': 'wrong date time( attended)'
                };

                const cleanVal = val.toLowerCase().trim();
                const synVal = SYNONYM_MAP[cleanVal] || cleanVal;

                let matched = false;
                for (let i = 0; i < el.options.length; i++) {
                    const optVal = el.options[i].value.toLowerCase().trim();
                    const optTxt = el.options[i].text.toLowerCase().trim();
                    if (optVal === cleanVal || optTxt === cleanVal || optVal === synVal || optTxt === synVal) {
                        el.selectedIndex = i;
                        el.value = el.options[i].value;
                        matched = true;
                        break;
                    }
                }
                if (!matched) {
                    const opt = document.createElement('option');
                    opt.value = val;
                    opt.textContent = val;
                    opt.selected = true;
                    el.appendChild(opt);
                    el.selectedIndex = el.options.length - 1;
                    el.value = val;
                }
                el.defaultValue = el.value || val;
                el.dispatchEvent(new Event('change'));
            } else {
                el.value = val;
                el.defaultValue = val;
                if (el.tagName === 'TEXTAREA') {
                    autoExpandTextarea(el);
                }
            }
        };

        // 1. Core / Historical Columns (matching sheet headers)
        setVal('wspWheelCondition', ['Wheel condition', 'wheel condition', 'wheelCondition']);
        setVal('wspPsStatus', ['PS status', 'ps status', 'psStatus']);
        setVal('wspCode', ['wsp code', 'wspCode']);
        setVal('wspDumpValve', ['Self test dump valve', 'Self-test of Dump Valve', 'dumpValve']);
        setVal('wspSensorGap', ['Sensor gap', 'sensor gap', 'sensorGap']);
        setVal('wspObservation', ['downloading obseravtion', 'downloading observation', 'observation']);
        setVal('wspOtherObservation', ['OTHER OBSERVATION', 'other observation', 'otherObservation']);
        setVal('wspDefectCategory', ['defect category', 'Defect Category', 'defectCategory']);
        setVal('wspAttention', ['ATTENTION IF ANY', 'attention if any', 'attention']);
        setVal('wspFollowUpRemarks', ['FOLLOU UP REMARKS', 'follow up remarks', 'follo up', 'follow up', 'followUpRemarks']);
        setVal('wspDescription', ['DEFECT DESCRIPTION', 'defect description', 'description']);
        setVal('wspItemRequired', ['ITEM REQUIRED / USED', 'item required / used', 'itemRequired']);
        setVal('wspChecklist', ['CHECKLIST SUBMITTED', 'checklist submitted', 'checklistSubmitted']);
        setVal('wspAnyWorkPending', ['Pending Work', 'pending work', 'ANY WORK PENDING', 'any work pending', 'anyWorkPending']);
        setVal('wspPendingWorkDesc', ['PENDING WORK DESCRIPTION', 'pending work description', 'pending work desc', 'pendingWorkDesc']);
        setVal('wspDataEntryBy', ['Data Entry By', 'data entry by', 'dataEntryBy']);

        // WSP Make
        setVal('wspFormWspd', ['WSP MAKE', 'wsp make', 'Type of WSPD', 'type of wspd', 'wspMake']);

        // 2. Restructured Inspection Fields (Sections 2, 3, 4, 5) - matching both short and full question headers
        const checklistFieldDefs = [
            ['wspPhonicWheelCondition', ['Condition of Phonic Wheel', 'Condition and installation of Phonic wheel', 'phonicWheelCondition']],
            ['wspVentingSound', ['Venting Sound', 'Proper venting sound from Dump Valve', 'ventingSound']],
            ['wspKmReadingDeficiency', ['KM Reading Deficiency', 'Any Deficiency in KM reading recording', 'kmReadingDeficiency']],
            ['wspBcPressure', ['BC Pressure', 'BC pressure', 'bcPressure']],
            ['wspDvReleaseTime', ['DV Release Time', 'DV release time', 'dvReleaseTime']],
            ['wspDumpValveChokeMod', ['Dump Valve Choke Mod', 'Modification of Dump Valve Choke', 'dumpValveChokeMod']],
            ['wspChokeFilterCondition', ['Choke Filter Condition', 'Condition of Dump Valve Choke filters', 'chokeFilterCondition']],
            ['wspHosePipeMod', ['Hose Pipe Mod', 'Hose pipe modification status', 'hosePipeMod']],

            ['wspMilConnector', ['MIL Connector Compliance', 'Compliance of revised wiring MIL grade connector', 'milConnector']],
            ['wspJbMounting', ['JB Mounting Compliance', 'Compliance of standardization of junction box mounting', 'jbMounting']],
            ['wspReroutingSensorCable', ['Sensor Cable Rerouting', 'Compliance of Rerouting of the speed sensor cable', 'reroutingSensorCable']],
            ['wspJbCover', ['JB Protection Cover', 'Junction box protection cover', 'jbCover']],
            ['wspJbOrientation', ['JB Orientation Compliance', 'Compliance of standardization of junction box orientation', 'jbOrientation']],

            ['wspWaterIngress', ['Water Ingress in Connectors', 'Any water ingress in Connectors', 'waterIngress']],
            ['wspSensorProbeCondition', ['Sensor Probe Condition', 'Condition of speed sensor cable probe', 'sensorProbeCondition']],
            ['wspCorrectSensorMake', ['Correct Sensor Make & Type', 'Provision of Correct make &type of speed sensor', 'correctSensorMake']],
            ['wspCorrectDvMake', ['Correct DV Make & Type', 'Provision of Correct make &type of Dump valve', 'correctDvMake']],
            ['wspCrossSensorWiring', ['Cross Sensor Wiring', 'Any Cross connection in wiring of Speed sensor wiring', 'crossSensorWiring']],
            ['wspCrossDvWiring', ['Cross DV Wiring', 'Any Cross connection in wiring of dump valves', 'crossDvWiring']],
            ['wspDvPinCondition', ['DV Pin Condition', 'Condition of Dump valve connector pins', 'dvPinCondition']],

            ['wspRbcStatus', ['RBC Power Supply Status', 'Check Regulated Battery Charger (RBC) for power supply to WSP System', 'rbcStatus']],
            ['wspKsRelayTimer', ['KS Relay Timer', 'KS Relay timer setting', 'ksRelayTimer']],
            ['wspMcbTripping', ['MCB Tripping', 'Any tripping of MCB', 'mcbTripping']],
            ['wspMcbFuseRating', ['MCB/Fuse Rating', 'Correct rating of MCB/FUSE', 'mcbFuseRating']],
            ['wspLedGlow', ['LED Glow Status', 'Any fault LED glow on the panel', 'ledGlow']],
            ['wspDvExcessiveActivation', ['DV Excessive Activation', 'Any dump valve activated more no of times as per the down loaded data', 'dvExcessiveActivation']],
            ['wspContinuousFaultAxle', ['Continuous Fault Axle', 'Any particular axle continuous fault reported', 'continuousFaultAxle']],
            ['wspPsBypass', ['PS Bypass Status', 'Any bypass of pressure switch', 'psBypass']],
            ['wspSleepMode', ['Sleep Mode Status', 'Sleep mode of WSPD', 'sleepMode']],
            ['wspDateTimeSync', ['DateTime Sync Status', 'Synchronising of Date time of the WSPD system with current date/time', 'dateTimeSync']],
            ['wspPowerOnIssues', ['Power On Issues', 'Any power on issues noticed', 'powerOnIssues']],
            ['wspSpeedVariation', ['Speed Variation Status', 'Any speed variation in the axle', 'speedVariation']],
            ['wspDefectCorrelated', ['Defect Correlated with WSPD', 'Whether defect correlated with any defect in the WSPD', 'Whether defect correlated with any defect in thw WSPD', 'defectCorrelated']]
        ];

        if (options.loadChecklistEmpty) {
            checklistFieldDefs.forEach(([id]) => {
                const el = document.getElementById(id);
                if (!el) return;
                if (el.tagName === 'SELECT') {
                    el.selectedIndex = 0;
                    el.defaultValue = el.value;
                } else {
                    el.value = '';
                    el.defaultValue = '';
                }
            });
        } else {
            checklistFieldDefs.forEach(([id, keys]) => setVal(id, keys));
        }

        // Date handling
        const dateInput = document.getElementById('wspDownloadDate');
        if (dateInput) {
            if (!options.isPrefillForNew) {
                const dateKey = Object.keys(entry).find(k => String(k).toLowerCase().trim() === 'download date');
                if (dateKey && entry[dateKey]) {
                    dateInput.value = formatDateYMD(entry[dateKey]);
                    dateInput.defaultValue = dateInput.value;
                }
            } else {
                // For new defect entry prefilled with old data, set date to today by default
                dateInput.value = new Date().toISOString().split('T')[0];
                dateInput.defaultValue = dateInput.value;
            }
        }
    }
    window.populateWspFormFromEntry = populateWspFormFromEntry;

    function resetWspFormToBlank() {
        const form = document.getElementById('wspDefectForm');
        if (form) {
            form.reset();
            // Completely wipe values and defaultValues so old defect data is never retained
            const inputs = form.querySelectorAll('input:not([type="hidden"]):not([readonly]), textarea');
            inputs.forEach(el => {
                el.value = '';
                el.defaultValue = '';
            });
            const selects = form.querySelectorAll('select');
            selects.forEach(el => {
                el.selectedIndex = 0;
                el.defaultValue = el.value;
            });
        }

        const editRowInput = document.getElementById('wspEditRowIndex');
        if (editRowInput) editRowInput.value = '';

        const dateInput = document.getElementById('wspDownloadDate');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
            dateInput.defaultValue = dateInput.value;
        }

        // Auto-fill ONLY coach metadata (coach num, type, train no, wsp make)
        updateWspFormAutoFill();

        const formTitle = document.getElementById('wspFormTitle');
        if (formTitle) formTitle.innerHTML = `<i class="fa-solid fa-plus"></i> Add New Defect`;

        const defectSubmitBtn = document.getElementById('wspSubmitDefectBtn');
        if (defectSubmitBtn) {
            const textSpan = defectSubmitBtn.querySelector('.btn-text');
            if (textSpan) textSpan.innerText = 'Submit Defect';
        }

        const modalSubtitle = document.getElementById('wspModalSubtitle');
        if (modalSubtitle) modalSubtitle.textContent = 'Fresh Defect Entry (Blank Form)';
    }
    window.resetWspFormToBlank = resetWspFormToBlank;

    function openWspDefectModal(rowIndex = null) {
        const modal = document.getElementById('wspDefectModal');
        const formTitle = document.getElementById('wspFormTitle');
        const modalIcon = document.getElementById('wspModalIcon');
        const submitBtn = document.getElementById('wspSubmitDefectBtn');
        const editRowInput = document.getElementById('wspEditRowIndex');
        const subtitleEl = document.getElementById('wspModalSubtitle');

        if (!modal) return;

        if (rowIndex) {
            if (formTitle) formTitle.textContent = `Edit Defect (Row #${rowIndex})`;
            if (modalIcon) modalIcon.className = 'fa-solid fa-pen-to-square';
            if (submitBtn) {
                const txt = submitBtn.querySelector('.btn-text');
                if (txt) txt.textContent = 'Update Defect Record';
            }
            if (editRowInput) editRowInput.value = rowIndex;

            const entry = (window.wspHistoryMap && window.wspHistoryMap[rowIndex]) ||
                (window.pendingWorkMap && window.pendingWorkMap[rowIndex]);
            if (entry) {
                populateWspFormFromEntry(entry, { isPrefillForNew: false, rowIndex: rowIndex });
                if (subtitleEl) {
                    subtitleEl.innerHTML = `<span style="color:#60a5fa;"><i class="fa-solid fa-pen"></i> Editing saved defect record #${rowIndex}</span>`;
                }
            }
            updateWspFormAutoFill();
        } else {
            if (editRowInput) editRowInput.value = '';
            if (formTitle) formTitle.textContent = 'Add New Defect';
            if (modalIcon) modalIcon.className = 'fa-solid fa-file-pen';
            if (submitBtn) {
                const txt = submitBtn.querySelector('.btn-text');
                if (txt) txt.textContent = 'Submit Defect Record';
            }

            // Fresh defect entry: load empty form
            resetWspFormToBlank();
            if (subtitleEl) subtitleEl.textContent = 'Inspection & Diagnostic Details (Blank Form)';
        }

        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        pushModalState('wspChecklistModal');
    }
    window.openWspDefectModal = openWspDefectModal;

    function closeWspDefectModal(fromBack = false) {
        const modal = document.getElementById('wspChecklistModal') || document.getElementById('wspDefectModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }
        document.body.style.overflow = '';
        if (!fromBack && !isHandlingPopState && window.history.state && (window.history.state.modal === 'wspChecklistModal' || window.history.state.modal === 'wspDefectModal')) {
            window.history.back();
        }
    }
    window.closeWspDefectModal = closeWspDefectModal;
    window.closeWspChecklistModal = closeWspDefectModal;

    function collapseAllWspDefectCards() {
        // Collapse all defect card accordion bodies
        const openBodies = document.querySelectorAll('.wsp-accordion-body');
        openBodies.forEach(body => {
            body.classList.add('hidden');
        });

        // Reset all chevron arrows on defect cards
        const openChevrons = document.querySelectorAll('.wsp-accordion-chevron');
        openChevrons.forEach(ch => {
            ch.classList.remove('expanded');
        });

        // Revert any card from inline-edit mode back to view mode
        const activeEdits = document.querySelectorAll('.wsp-card-edit-mode');
        activeEdits.forEach(editEl => {
            editEl.classList.add('hidden');
        });
        const hiddenViews = document.querySelectorAll('[id^="wsp-view-"]');
        hiddenViews.forEach(viewEl => {
            viewEl.classList.remove('hidden');
        });
    }
    window.collapseAllWspDefectCards = collapseAllWspDefectCards;

    function toggleAddDefectAccordion() {
        const wrapper = document.getElementById('wspDefectFormWrapper');
        const chevron = document.getElementById('wspAddDefectChevron');
        if (!wrapper) return;
        const isHidden = wrapper.classList.contains('hidden');
        if (isHidden) {
            // When user clicks Add New Defect, drop/collapse all previously expanded defect cards!
            collapseAllWspDefectCards();

            // Load empty blank form every time user clicks Add New Defect!
            resetWspFormToBlank();

            wrapper.classList.remove('hidden');
            if (chevron) {
                chevron.classList.add('fa-chevron-up');
                chevron.classList.remove('fa-chevron-down');
            }
        } else {
            wrapper.classList.add('hidden');
            if (chevron) {
                chevron.classList.remove('fa-chevron-up');
                chevron.classList.add('fa-chevron-down');
            }
        }
    }
    window.toggleAddDefectAccordion = toggleAddDefectAccordion;

    function resetWspChecklistToBlank() {
        const form = document.getElementById('wspChecklistForm');
        if (form) form.reset();
        const dateInput = document.getElementById('chkDownloadDate');
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
        const coachNo = document.getElementById('wspResultCoachId') ? document.getElementById('wspResultCoachId').innerText.trim() : '';
        const elC = document.getElementById('chkCoachNum');
        if (elC && coachNo && coachNo !== 'Coach WSP') elC.value = coachNo;
        const elFc = document.getElementById('chkFormCoachNum');
        if (elFc && coachNo && coachNo !== 'Coach WSP') elFc.value = coachNo;
        if (window.activeWspCoachData) {
            const elFt = document.getElementById('chkFormCoachType');
            if (elFt) elFt.value = window.activeWspCoachData.type || '';
            const elTr = document.getElementById('chkFormTrainNo');
            if (elTr) elTr.value = window.activeWspCoachData.trainNo || '';
            const elW = document.getElementById('chkFormWspd');
            if (elW) {
                let m = (window.activeWspCoachData.typeOfWspd || '').trim();
                elW.value = m.toUpperCase() === 'ESC' ? 'ESCORTS' : m;
            }
        }
        // Auto-fill Air Gap between Phonic Wheel & Sensor from Defect Form
        const elGap = document.getElementById('chkSensorGap');
        const formGap = document.getElementById('wspSensorGap')?.value?.trim();
        if (elGap && formGap) {
            elGap.value = formGap;
        }
    }
    window.resetWspChecklistToBlank = resetWspChecklistToBlank;

    function generateWspPdfFromChecklistForm() {
        const gVal = (id) => (document.getElementById(id) ? document.getElementById(id).value.trim() : '');
        const data = {
            coachNumber: gVal('chkCoachNum') || gVal('chkFormCoachNum') || extractCoachNumber(null),
            coachType: gVal('chkFormCoachType') || extractCoachType(null),
            trainNumber: gVal('chkFormTrainNo') || extractTrainNo(null),
            wspMake: gVal('chkFormWspd') || extractWspMake(null),
            downloadDate: gVal('chkDownloadDate'),
            wheelCondition: gVal('chkWheelCondition'),
            wspCode: gVal('chkCode'),
            psStatus: gVal('chkPsStatus'),
            phonicWheelCondition: gVal('chkPhonicWheelCondition'),
            ventingSound: gVal('chkVentingSound'),
            kmReadingDeficiency: gVal('chkKmReadingDeficiency'),
            bcPressure: gVal('chkBcPressure'),
            dvReleaseTime: gVal('chkDvReleaseTime'),
            dumpValveChokeMod: gVal('chkDumpValveChokeMod'),
            dumpValve: gVal('chkDumpValve'),
            chokeFilterCondition: gVal('chkChokeFilterCondition'),
            sensorGap: gVal('chkSensorGap'),
            hosePipeMod: gVal('chkHosePipeMod'),
            milConnector: gVal('chkMilConnector'),
            jbMounting: gVal('chkJbMounting'),
            reroutingSensorCable: gVal('chkReroutingSensorCable'),
            jbCover: gVal('chkJbCover'),
            jbOrientation: gVal('chkJbOrientation'),
            waterIngress: gVal('chkWaterIngress'),
            sensorProbeCondition: gVal('chkSensorProbeCondition'),
            correctSensorMake: gVal('chkCorrectSensorMake'),
            correctDvMake: gVal('chkCorrectDvMake'),
            crossSensorWiring: gVal('chkCrossSensorWiring'),
            crossDvWiring: gVal('chkCrossDvWiring'),
            dvPinCondition: gVal('chkDvPinCondition'),
            rbcStatus: gVal('chkRbcStatus'),
            ksRelayTimer: gVal('chkKsRelayTimer'),
            mcbTripping: gVal('chkMcbTripping'),
            mcbFuseRating: gVal('chkMcbFuseRating'),
            ledGlow: gVal('chkLedGlow'),
            dvExcessiveActivation: gVal('chkDvExcessiveActivation'),
            continuousFaultAxle: gVal('chkContinuousFaultAxle'),
            psBypass: gVal('chkPsBypass'),
            sleepMode: gVal('chkSleepMode'),
            dateTimeSync: gVal('chkDateTimeSync'),
            powerOnIssues: gVal('chkPowerOnIssues'),
            speedVariation: gVal('chkSpeedVariation'),
            defectCategory: gVal('chkDefectCategory'),
            observation: gVal('chkObservation'),
            otherObservation: gVal('chkOtherObservation'),
            description: gVal('chkDescription'),
            defectCorrelated: gVal('chkDefectCorrelated'),
            attention: gVal('chkAttention'),
            followUpRemarks: gVal('chkFollowUpRemarks'),
            itemRequired: gVal('chkItemRequired'),
            anyWorkPending: gVal('chkAnyWorkPending'),
            pendingWorkDesc: gVal('chkPendingWorkDesc'),
            checklistSubmitted: 'Yes',
            dataEntryBy: gVal('chkDataEntryBy')
        };
        openWspPdfPreviewModal(data);
    }
    window.generateWspPdfFromChecklistForm = generateWspPdfFromChecklistForm;

    function populateWspChecklistModal(entry, options = {}) {
        if (!entry) return;

        const setVal = (id, keyArr) => {
            const el = document.getElementById(id);
            if (!el) return;
            const val = keyArr.reduce((found, k) => {
                if (found) return found;
                const entryKey = Object.keys(entry).find(ek => ek.toLowerCase().trim() === k.toLowerCase().trim());
                return (entryKey && entry[entryKey] !== undefined && entry[entryKey] !== null) ? String(entry[entryKey]).trim() : '';
            }, '');
            if (!val || val === '-') return;

            if (el.tagName === 'SELECT') {
                const SYNONYM_MAP = {
                    'satisfactory': 'ok',
                    'loose': 'not ok',
                    'damaged': 'not ok',
                    'dust/metal accumulation': 'not ok',
                    'not ok': 'not ok',
                    'normal venting sound (yes)': 'ok',
                    'normal venting sound': 'ok',
                    'no venting sound (no)': 'not ok',
                    'no venting sound': 'not ok',
                    'abnormal sound': 'not ok',
                    'no deficiency': 'ok',
                    'no deficiency (normal)': 'ok',
                    'km not updating': 'not ok',
                    'abnormal km jump': 'not ok',
                    'deficiency found': 'not ok',
                    'data not available': 'data not available',
                    'complied': 'modified',
                    'not complied': 'not modified',
                    'not applicable': 'not applicable',
                    'nc': 'not ok',
                    'nc (not checked)': 'not ok',
                    'clean / good': 'ok',
                    'clean/good': 'ok',
                    'cleaned during inspection': 'ok',
                    'choked / dirty': 'blocked',
                    'defective / replaced': 'blocked',
                    'provided & intact': 'available',
                    'provided and intact': 'available',
                    'not provided': 'not available',
                    'damaged / replaced': 'not available',
                    'good': 'ok',
                    'rubbing with wheel/axle': 'rubbing',
                    'normal (110v dc)': 'ok',
                    'normal': 'ok',
                    'high voltage': 'not ok',
                    'low voltage': 'not ok',
                    'no supply / fluctuating': 'not ok',
                    'no (normal)': 'no',
                    'yes (fault led glowing)': 'yes',
                    'working normal': 'yes',
                    'not working / always on': 'no',
                    'not working': 'no',
                    'synchronised (ok)': 'ok',
                    'synchronised': 'ok',
                    'date/time mismatch': 'wrong date time( attended)',
                    'reset to current date/time': 'wrong date time( attended)'
                };

                const cleanVal = val.toLowerCase().trim();
                const synVal = SYNONYM_MAP[cleanVal] || cleanVal;

                let matched = false;
                for (let i = 0; i < el.options.length; i++) {
                    const optVal = el.options[i].value.toLowerCase().trim();
                    const optTxt = el.options[i].text.toLowerCase().trim();
                    if (optVal === cleanVal || optTxt === cleanVal || optVal === synVal || optTxt === synVal) {
                        el.selectedIndex = i;
                        el.value = el.options[i].value;
                        matched = true;
                        break;
                    }
                }
                if (!matched) {
                    const opt = document.createElement('option');
                    opt.value = val;
                    opt.textContent = val;
                    opt.selected = true;
                    el.appendChild(opt);
                    el.selectedIndex = el.options.length - 1;
                    el.value = val;
                }
                el.defaultValue = el.value || val;
                el.dispatchEvent(new Event('change'));
            } else {
                el.value = val;
                el.defaultValue = val;
                if (el.tagName === 'TEXTAREA') {
                    autoExpandTextarea(el);
                }
            }
        };

        // Header & Auto-filled values
        const coachNo = extractCoachNumber(entry);
        const coachType = extractCoachType(entry);
        const trainNo = extractTrainNo(entry);
        const wspMake = extractWspMake(entry);

        const elC = document.getElementById('chkCoachNum');
        if (elC) elC.value = coachNo;
        const elFc = document.getElementById('chkFormCoachNum');
        if (elFc) elFc.value = coachNo;
        const elFt = document.getElementById('chkFormCoachType');
        if (elFt) elFt.value = coachType;
        const elTr = document.getElementById('chkFormTrainNo');
        if (elTr) elTr.value = trainNo;
        const elW = document.getElementById('chkFormWspd');
        if (elW) elW.value = wspMake;

        const elRow = document.getElementById('chkEditRowIndex');
        if (elRow) elRow.value = entry._rowIndex || options.rowIndex || '';

        // Date & Wheel Condition
        const dateInput = document.getElementById('chkDownloadDate');
        if (dateInput) {
            const rawDate = getWspField(entry, 'Download Date', 'download date');
            if (rawDate && rawDate !== '-') {
                dateInput.value = formatDateYMD(rawDate);
            } else {
                dateInput.value = new Date().toISOString().split('T')[0];
            }
        }
        setVal('chkWheelCondition', ['Wheel condition', 'wheel condition', 'wheelCondition']);

        // Core Defect fields
        setVal('chkCode', ['wsp code', 'wspCode']);
        setVal('chkPsStatus', ['PS status', 'ps status', 'psStatus']);
        setVal('chkDumpValve', ['Self test dump valve', 'dumpValve', 'Self-test of Dump Valve']);
        setVal('chkSensorGap', ['Sensor gap', 'sensor gap', 'sensorGap', 'Sensor Gap', 'sensor_gap', 'Air Gap between Phonic Wheel & Sensor (sensor gap)', 'Air Gap between Phonic Wheel & Sensor', 'Air gap', 'air gap']);
        // Auto-fill sensor gap from defect form or history if not already set
        const elChkSensorGap = document.getElementById('chkSensorGap');
        if (elChkSensorGap) {
            let gapVal = elChkSensorGap.value.trim();
            if (!gapVal || gapVal === '-') {
                const fromEntry = getWspField(entry, 'Sensor gap', 'sensor gap', 'sensorGap', 'Sensor Gap', 'sensor_gap', 'Air Gap between Phonic Wheel & Sensor (sensor gap)', 'Air gap', 'air gap');
                const fromForm = document.getElementById('wspSensorGap')?.value?.trim();
                if (fromEntry && fromEntry !== '-') {
                    gapVal = fromEntry;
                } else if (fromForm) {
                    gapVal = fromForm;
                } else if (window.latestCoachHistoryEntry) {
                    const histGap = getWspField(window.latestCoachHistoryEntry, 'Sensor gap', 'sensor gap', 'sensorGap', 'Sensor Gap');
                    if (histGap && histGap !== '-') gapVal = histGap;
                }
            }
            if (gapVal && gapVal !== '-') {
                elChkSensorGap.value = gapVal;
            }
        }
        setVal('chkDefectCategory', ['defect category', 'Defect Category', 'defectCategory']);
        setVal('chkObservation', ['downloading obseravtion', 'downloading observation', 'observation']);
        setVal('chkOtherObservation', ['OTHER OBSERVATION', 'other observation', 'otherObservation']);
        setVal('chkDescription', ['DEFECT DESCRIPTION', 'defect description', 'description']);
        setVal('chkAttention', ['ATTENTION IF ANY', 'attention if any', 'attention']);
        setVal('chkFollowUpRemarks', ['FOLLOU UP REMARKS', 'follow up remarks', 'follow up', 'followUpRemarks']);
        setVal('chkItemRequired', ['ITEM REQUIRED / USED', 'item required / used', 'itemRequired']);
        setVal('chkAnyWorkPending', ['Pending Work', 'pending work', 'ANY WORK PENDING', 'any work pending', 'anyWorkPending']);
        setVal('chkPendingWorkDesc', ['PENDING WORK DESCRIPTION', 'pending work description', 'pending work desc', 'pendingWorkDesc']);
        setVal('chkDataEntryBy', ['Data Entry By', 'data entry by', 'dataEntryBy']);

        // Checklist Inspection Fields (Sections 2, 3, 4, 5)
        const checklistFieldDefs = [
            ['chkPhonicWheelCondition', ['Condition of Phonic Wheel', 'Condition and installation of Phonic wheel', 'phonicWheelCondition']],
            ['chkVentingSound', ['Venting Sound', 'Proper venting sound from Dump Valve', 'ventingSound']],
            ['chkKmReadingDeficiency', ['KM Reading Deficiency', 'Any Deficiency in KM reading recording', 'kmReadingDeficiency']],
            ['chkBcPressure', ['BC Pressure', 'BC pressure', 'bcPressure']],
            ['chkDvReleaseTime', ['DV Release Time', 'DV release time', 'dvReleaseTime']],
            ['chkDumpValveChokeMod', ['Dump Valve Choke Mod', 'Modification of Dump Valve Choke', 'dumpValveChokeMod']],
            ['chkChokeFilterCondition', ['Choke Filter Condition', 'Condition of Dump Valve Choke filters', 'chokeFilterCondition']],
            ['chkHosePipeMod', ['Hose Pipe Mod', 'Hose pipe modification status', 'hosePipeMod']],

            ['chkMilConnector', ['MIL Connector Compliance', 'Compliance of revised wiring MIL grade connector', 'milConnector']],
            ['chkJbMounting', ['JB Mounting Compliance', 'Compliance of standardization of junction box mounting', 'jbMounting']],
            ['chkReroutingSensorCable', ['Sensor Cable Rerouting', 'Compliance of Rerouting of the speed sensor cable', 'reroutingSensorCable']],
            ['chkJbCover', ['JB Protection Cover', 'Junction box protection cover', 'jbCover']],
            ['chkJbOrientation', ['JB Orientation Compliance', 'Compliance of standardization of junction box orientation', 'jbOrientation']],

            ['chkWaterIngress', ['Water Ingress in Connectors', 'Any water ingress in Connectors', 'waterIngress']],
            ['chkSensorProbeCondition', ['Sensor Probe Condition', 'Condition of speed sensor cable probe', 'sensorProbeCondition']],
            ['chkCorrectSensorMake', ['Correct Sensor Make & Type', 'Provision of Correct make &type of speed sensor', 'correctSensorMake']],
            ['chkCorrectDvMake', ['Correct DV Make & Type', 'Provision of Correct make &type of Dump valve', 'correctDvMake']],
            ['chkCrossSensorWiring', ['Cross Sensor Wiring', 'Any Cross connection in wiring of Speed sensor wiring', 'crossSensorWiring']],
            ['chkCrossDvWiring', ['Cross DV Wiring', 'Any Cross connection in wiring of dump valves', 'crossDvWiring']],
            ['chkDvPinCondition', ['DV Pin Condition', 'Condition of Dump valve connector pins', 'dvPinCondition']],

            ['chkRbcStatus', ['RBC Power Supply Status', 'Check Regulated Battery Charger (RBC) for power supply to WSP System', 'rbcStatus']],
            ['chkKsRelayTimer', ['KS Relay Timer', 'KS Relay timer setting', 'ksRelayTimer']],
            ['chkMcbTripping', ['MCB Tripping', 'Any tripping of MCB', 'mcbTripping']],
            ['chkMcbFuseRating', ['MCB/Fuse Rating', 'Correct rating of MCB/FUSE', 'mcbFuseRating']],
            ['chkLedGlow', ['LED Glow Status', 'Any fault LED glow on the panel', 'ledGlow']],
            ['chkDvExcessiveActivation', ['DV Excessive Activation', 'Any dump valve activated more no of times as per the down loaded data', 'dvExcessiveActivation']],
            ['chkContinuousFaultAxle', ['Continuous Fault Axle', 'Any particular axle continuous fault reported', 'continuousFaultAxle']],
            ['chkPsBypass', ['PS Bypass Status', 'Any bypass of pressure switch', 'psBypass']],
            ['chkSleepMode', ['Sleep Mode Status', 'Sleep mode of WSPD', 'sleepMode']],
            ['chkDateTimeSync', ['DateTime Sync Status', 'Synchronising of Date time of the WSPD system with current date/time', 'dateTimeSync']],
            ['chkPowerOnIssues', ['Power On Issues', 'Any power on issues noticed', 'powerOnIssues']],
            ['chkSpeedVariation', ['Speed Variation Status', 'Any speed variation in the axle', 'speedVariation']],
            ['chkDefectCorrelated', ['Defect Correlated with WSPD', 'Whether defect correlated with any defect in the WSPD', 'Whether defect correlated with any defect in thw WSPD', 'defectCorrelated']]
        ];

        if (options.loadChecklistEmpty) {
            checklistFieldDefs.forEach(([id]) => {
                const el = document.getElementById(id);
                if (!el) return;
                if (el.tagName === 'SELECT') {
                    el.selectedIndex = 0;
                    el.defaultValue = el.value;
                } else {
                    el.value = '';
                    el.defaultValue = '';
                }
            });
        } else {
            checklistFieldDefs.forEach(([id, keys]) => setVal(id, keys));
        }
    }
    window.populateWspChecklistModal = populateWspChecklistModal;

    function hasChecklistData(entry) {
        if (!entry) return false;
        const sub = getWspField(entry, 'CHECKLIST SUBMITTED', 'checklist submitted', 'Checklist Submitted', 'checklist');
        if (sub && (sub.toLowerCase() === 'yes' || sub.toLowerCase() === 'y')) return true;

        // Check if any specific checklist inspection fields have non-empty, non-dash values
        const checklistKeys = [
            'Condition of Phonic Wheel', 'phonicWheelCondition',
            'Venting Sound', 'ventingSound',
            'KM Reading Deficiency', 'kmReadingDeficiency',
            'BC Pressure', 'bcPressure',
            'DV Release Time', 'dvReleaseTime',
            'Dump Valve Choke Mod', 'dumpValveChokeMod',
            'Choke Filter Condition', 'chokeFilterCondition',
            'Hose Pipe Mod', 'hosePipeMod',
            'MIL Connector Compliance', 'milConnector',
            'JB Mounting Compliance', 'jbMounting',
            'Water Ingress in Connectors', 'waterIngress',
            'RBC Power Supply Status', 'rbcStatus',
            'Defect Correlated with WSPD', 'defectCorrelated'
        ];
        for (const k of checklistKeys) {
            const val = getWspField(entry, k);
            if (val && val !== '-' && val !== '') return true;
        }
        return false;
    }
    window.hasChecklistData = hasChecklistData;

    function openWspChecklistForCard(cardId) {
        try {
            const entry = (window.wspHistoryMap && (window.wspHistoryMap[cardId] || window.wspHistoryMap[Number(cardId)] || window.wspHistoryMap['coach_' + cardId])) ||
                (window.pendingWorkMap && (window.pendingWorkMap[cardId] || window.pendingWorkMap[Number(cardId)])) ||
                window.latestCoachHistoryEntry;
            if (!entry) {
                showWarningAlert("No record found to generate checklist report.");
                return;
            }

            const modal = document.getElementById('wspChecklistModal') || document.getElementById('wspDefectModal');
            const formTitle = document.getElementById('wspChecklistTitle') || document.getElementById('wspFormTitle');
            const subtitleEl = document.getElementById('wspChecklistSubtitle') || document.getElementById('wspModalSubtitle');
            const submitBtn = document.getElementById('wspSubmitChecklistBtn') || document.getElementById('wspSubmitDefectBtn');

            if (!modal) {
                console.error("wspChecklistModal not found in DOM");
                return;
            }

            const elCard = document.getElementById('chkEditCardId');
            if (elCard) elCard.value = cardId || '';

            const rowIndex = entry._rowIndex || '';
            const hasData = hasChecklistData(entry);
            const coachNo = extractCoachNumber(entry);

            if (formTitle) {
                formTitle.innerHTML = `<i class="fa-solid fa-clipboard-check"></i> ${hasData ? `Checklist Inspection Report - Coach ${coachNo}` : `Fill Checklist Report - Coach ${coachNo}`}`;
            }
            if (submitBtn) {
                const txt = submitBtn.querySelector('.btn-text');
                if (txt) txt.textContent = hasData ? 'Update Checklist Report' : 'Save Checklist Report';
            }

            if (hasData) {
                populateWspChecklistModal(entry, { rowIndex: rowIndex, loadChecklistEmpty: false });
                if (subtitleEl) {
                    subtitleEl.innerHTML = `<span style="color:#10b981;"><i class="fa-solid fa-circle-check"></i> Pre-loaded saved checklist inspection data</span>`;
                }
            } else {
                populateWspChecklistModal(entry, { rowIndex: rowIndex, loadChecklistEmpty: true });
                if (subtitleEl) {
                    subtitleEl.innerHTML = `<span style="color:#fbbf24;"><i class="fa-solid fa-pen-to-square"></i> Fresh Checklist - Fill batch and underframe inspection items</span>`;
                }
            }

            // Ensure Air Gap between Phonic Wheel & Sensor (chkSensorGap) is auto-filled from defect form or entry
            const elDirectGap = document.getElementById('chkSensorGap');
            if (elDirectGap && (!elDirectGap.value || elDirectGap.value.trim() === '-')) {
                const gapFromEntry = getWspField(entry, 'Sensor gap', 'sensor gap', 'sensorGap', 'Sensor Gap', 'sensor_gap', 'Air gap', 'air gap');
                const gapFromForm = document.getElementById('wspSensorGap')?.value?.trim();
                if (gapFromEntry && gapFromEntry !== '-') {
                    elDirectGap.value = gapFromEntry;
                } else if (gapFromForm) {
                    elDirectGap.value = gapFromForm;
                }
            }

            modal.classList.remove('hidden');
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            pushModalState('wspChecklistModal');
        } catch (err) {
            console.error("Error in openWspChecklistForCard:", err);
            showWarningAlert("Could not open checklist form: " + (err.message || err));
        }
    }
    window.openWspChecklistForCard = openWspChecklistForCard;
    window.openWspDefectModal = openWspChecklistForCard;

    function toggleWspCardAccordion(cardId) {
        const body = document.getElementById(`wsp-body-${cardId}`);
        const chevron = document.getElementById(`chevron-${cardId}`);
        if (!body) return;

        const isHidden = body.classList.contains('hidden');
        if (isHidden) {
            // Close Add New Defect form if open
            const addDefectWrapper = document.getElementById('wspDefectFormWrapper');
            const addDefectChevron = document.getElementById('wspAddDefectChevron');
            if (addDefectWrapper && !addDefectWrapper.classList.contains('hidden')) {
                addDefectWrapper.classList.add('hidden');
                if (addDefectChevron) {
                    addDefectChevron.classList.remove('fa-chevron-up');
                    addDefectChevron.classList.add('fa-chevron-down');
                }
            }

            body.classList.remove('hidden');
            if (chevron) chevron.classList.add('expanded');
        } else {
            body.classList.add('hidden');
            if (chevron) chevron.classList.remove('expanded');
        }
    }
    window.toggleWspCardAccordion = toggleWspCardAccordion;

    function startInlineEditWspDefect(cardId) {
        const viewEl = document.getElementById(`wsp-view-${cardId}`);
        const editEl = document.getElementById(`wsp-edit-${cardId}`);
        const bodyEl = document.getElementById(`wsp-body-${cardId}`);
        const chevron = document.getElementById(`chevron-${cardId}`);

        if (bodyEl && bodyEl.classList.contains('hidden')) {
            bodyEl.classList.remove('hidden');
            if (chevron) chevron.classList.add('expanded');
        }

        if (viewEl) viewEl.classList.add('hidden');
        if (editEl) editEl.classList.remove('hidden');
    }
    window.startInlineEditWspDefect = startInlineEditWspDefect;

    function cancelInlineWspDefect(cardId) {
        const viewEl = document.getElementById(`wsp-view-${cardId}`);
        const editEl = document.getElementById(`wsp-edit-${cardId}`);
        if (editEl) editEl.classList.add('hidden');
        if (viewEl) viewEl.classList.remove('hidden');
    }
    window.cancelInlineWspDefect = cancelInlineWspDefect;

    function buildInlineEditFormHTML(entry, cardId) {
        const gVal = (keys, fallback = '') => {
            for (const k of keys) {
                const ek = Object.keys(entry).find(key => key.toLowerCase().trim() === k.toLowerCase().trim());
                if (ek && entry[ek] !== undefined && entry[ek] !== null && String(entry[ek]).trim() !== '' && String(entry[ek]).trim() !== '-') {
                    return String(entry[ek]).trim();
                }
            }
            return fallback;
        };

        const downloadDate = gVal(['Download Date', 'download date', 'downloadDate']);
        const isoDate = downloadDate ? formatDateYMD(downloadDate) : '';
        const wheelCondition = gVal(['Wheel condition', 'wheel condition', 'wheelCondition']);
        const wspCode = gVal(['wsp code', 'wspCode']);
        const psStatus = gVal(['PS status', 'ps status', 'psStatus']);
        const dumpValve = gVal(['Self test dump valve', 'dumpValve', 'Self-test of Dump Valve']);
        const sensorGap = gVal(['Sensor gap', 'sensor gap', 'sensorGap']);
        const defectCat = gVal(['defect category', 'Defect Category', 'defectCategory']);
        const observation = gVal(['downloading obseravtion', 'downloading observation', 'observation']);
        const otherObs = gVal(['OTHER OBSERVATION', 'other observation', 'otherObservation']);
        const defectDesc = gVal(['DEFECT DESCRIPTION', 'defect description', 'description']);
        const attention = gVal(['ATTENTION IF ANY', 'attention if any', 'attention']);
        const followUp = gVal(['FOLLOU UP REMARKS', 'follow up remarks', 'follow up', 'followUpRemarks']);
        const itemReq = gVal(['ITEM REQUIRED / USED', 'item required / used', 'itemRequired']);
        const anyPending = gVal(['Pending Work', 'pending work', 'ANY WORK PENDING', 'any work pending', 'anyWorkPending']);
        const pendingDesc = gVal(['PENDING WORK DESCRIPTION', 'pending work description', 'pending work desc', 'pendingWorkDesc']);
        const staffId = gVal(['Data Entry By', 'data entry by', 'dataEntryBy']);

        const isPendingYes = anyPending.toLowerCase() === 'yes';

        const renderSelect = (id, optionsList, selectedVal) => {
            return `<select id="${id}" class="wsp-inline-input">
            ${optionsList.map(opt => {
                const val = typeof opt === 'object' ? opt.value : opt;
                const label = typeof opt === 'object' ? opt.label : opt;
                const isSel = String(selectedVal).toLowerCase() === String(val).toLowerCase();
                return `<option value="${val}" ${isSel ? 'selected' : ''}>${label}</option>`;
            }).join('')}
        </select>`;
        };

        return `
        <div class="wsp-inline-edit-header">
            <i class="fa-solid fa-pen-to-square"></i> Quick Edit Defect Record
        </div>
        <div class="wsp-inline-edit-grid">
            <div class="wsp-inline-edit-group">
                <label class="wsp-inline-edit-label" for="inline-date-${cardId}">Download Date</label>
                <input type="date" id="inline-date-${cardId}" class="wsp-inline-input" value="${isoDate}">
            </div>
            <div class="wsp-inline-edit-group">
                <label class="wsp-inline-edit-label" for="inline-wheel-${cardId}">Wheel Condition</label>
                <input type="text" id="inline-wheel-${cardId}" class="wsp-inline-input" value="${wheelCondition}" placeholder="e.g. 3rd axle old shining">
            </div>
            <div class="wsp-inline-edit-group">
                <label class="wsp-inline-edit-label" for="inline-code-${cardId}">WSP Code</label>
                <input type="text" id="inline-code-${cardId}" class="wsp-inline-input" value="${wspCode}" placeholder="e.g. 99, 72, 95">
            </div>
            <div class="wsp-inline-edit-group">
                <label class="wsp-inline-edit-label" for="inline-ps-${cardId}">PS Status</label>
                ${renderSelect(`inline-ps-${cardId}`, [
            { value: '', label: 'Select Status' },
            { value: 'OK', label: 'OK' },
            { value: 'NOT OK', label: 'NOT OK' },
            { value: 'LOOPED', label: 'LOOPED' },
            { value: 'BYPASS', label: 'BYPASS' }
        ], psStatus)}
            </div>
            <div class="wsp-inline-edit-group">
                <label class="wsp-inline-edit-label" for="inline-dv-${cardId}">Self-Test Dump Valve</label>
                ${renderSelect(`inline-dv-${cardId}`, [
            { value: '', label: 'Select Status' },
            { value: 'OK', label: 'OK' },
            { value: 'NOT OK', label: 'NOT OK' },
            { value: 'NC', label: 'NC' }
        ], dumpValve)}
            </div>
            <div class="wsp-inline-edit-group">
                <label class="wsp-inline-edit-label" for="inline-gap-${cardId}">Sensor Gap</label>
                <input type="text" id="inline-gap-${cardId}" class="wsp-inline-input" value="${sensorGap}" placeholder="e.g. 1st axle 1.15mm">
            </div>
            <div class="wsp-inline-edit-group full-width">
                <label class="wsp-inline-edit-label" for="inline-cat-${cardId}">Defect Category</label>
                ${renderSelect(`inline-cat-${cardId}`, [
            { value: '', label: 'Select Category' },
            { value: 'NO DEFECT', label: 'NO DEFECT' },
            { value: 'SENSOR DEFECT', label: 'SENSOR DEFECT' },
            { value: 'DUMP VALVE DEFECT', label: 'DUMP VALVE DEFECT' },
            { value: 'PRESSURE SWITCH', label: 'PRESSURE SWITCH' },
            { value: 'WIRING ISSUE', label: 'WIRING ISSUE' },
            { value: 'POWER SUPPLY', label: 'POWER SUPPLY' },
            { value: 'WSPD HARDWARE', label: 'WSPD HARDWARE' },
            { value: 'OTHER', label: 'OTHER' }
        ], defectCat)}
            </div>
            <div class="wsp-inline-edit-group full-width">
                <label class="wsp-inline-edit-label" for="inline-obs-${cardId}">Downloading Observation</label>
                <textarea id="inline-obs-${cardId}" class="wsp-inline-input" rows="2" placeholder="WSP memory downloading observations...">${observation}</textarea>
            </div>
            <div class="wsp-inline-edit-group full-width">
                <label class="wsp-inline-edit-label" for="inline-otherobs-${cardId}">Other Observation</label>
                <textarea id="inline-otherobs-${cardId}" class="wsp-inline-input" rows="2" placeholder="Physical inspection observations...">${otherObs}</textarea>
            </div>
            <div class="wsp-inline-edit-group full-width">
                <label class="wsp-inline-edit-label" for="inline-desc-${cardId}">Defect Description</label>
                <textarea id="inline-desc-${cardId}" class="wsp-inline-input" rows="2" placeholder="Detailed defect explanation...">${defectDesc}</textarea>
            </div>
            <div class="wsp-inline-edit-group full-width">
                <label class="wsp-inline-edit-label" for="inline-att-${cardId}">Attention If Any</label>
                <input type="text" id="inline-att-${cardId}" class="wsp-inline-input" value="${attention}" placeholder="Action taken or attention given">
            </div>
            <div class="wsp-inline-edit-group">
                <label class="wsp-inline-edit-label" for="inline-fu-${cardId}">Follow Up Remarks</label>
                <input type="text" id="inline-fu-${cardId}" class="wsp-inline-input" value="${followUp}" placeholder="Monitoring notes...">
            </div>
            <div class="wsp-inline-edit-group full-width">
                <label class="wsp-inline-edit-label" for="inline-item-${cardId}">Item Required / Used</label>
                <input type="text" id="inline-item-${cardId}" class="wsp-inline-input" value="${itemReq}" placeholder="Parts replaced or needed">
            </div>
            <div class="wsp-inline-edit-group">
                <label class="wsp-inline-edit-label" for="inline-pending-${cardId}">Pending Work?</label>
                ${renderSelect(`inline-pending-${cardId}`, [
            { value: 'No', label: 'No' },
            { value: 'Yes', label: 'Yes' }
        ], isPendingYes ? 'Yes' : 'No')}
            </div>
            <div class="wsp-inline-edit-group full-width">
                <label class="wsp-inline-edit-label" for="inline-pendingdesc-${cardId}">Pending Work Description</label>
                <input type="text" id="inline-pendingdesc-${cardId}" class="wsp-inline-input" value="${pendingDesc}" placeholder="Specify pending items...">
            </div>
            <div class="wsp-inline-edit-group">
                <label class="wsp-inline-edit-label" for="inline-staff-${cardId}">Data Entry By / Staff ID</label>
                <input type="text" id="inline-staff-${cardId}" class="wsp-inline-input" value="${staffId}" placeholder="Staff Token / ID">
            </div>
        </div>
        <div class="wsp-inline-edit-actions">
            <button type="button" class="btn btn-cancel-inline" onclick="cancelInlineWspDefect('${cardId}')">
                <i class="fa-solid fa-xmark"></i> Cancel
            </button>
            <button type="button" class="btn btn-save-inline" id="btn-save-${cardId}" onclick="saveInlineWspDefect('${cardId}')">
                <i class="fa-solid fa-floppy-disk"></i> Save Changes
            </button>
        </div>
    `;
    }
    window.buildInlineEditFormHTML = buildInlineEditFormHTML;

    async function saveInlineWspDefect(cardId) {
        const entry = (window.wspHistoryMap && (window.wspHistoryMap[cardId] || window.wspHistoryMap[Number(cardId)])) || {};
        const saveBtn = document.getElementById(`btn-save-${cardId}`);
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;
        }

        const getInp = (id) => {
            const el = document.getElementById(id);
            return el ? el.value.trim() : '';
        };

        const downloadDate = getInp(`inline-date-${cardId}`);
        let monthName = '';
        if (downloadDate) {
            const d = new Date(downloadDate);
            if (!isNaN(d.getTime())) {
                monthName = d.toLocaleString('default', { month: 'long' });
            }
        }

        const coachNo = getWspField(entry, 'Coach No', 'COACH NO', 'coach num', 'Coach Number') || (entry._rawRow ? entry._rawRow[0] : '') || (window.activeWspCoachData ? window.activeWspCoachData.coachNum : '');
        const coachType = getWspField(entry, 'Coach Type', 'coach type', 'TYPE', 'type') || (window.activeWspCoachData ? window.activeWspCoachData.type : '');
        const trainNo = getWspField(entry, 'Train No', 'DB Train No', 'train no') || (window.activeWspCoachData ? window.activeWspCoachData.trainNo : '');
        const wspMake = getWspField(entry, 'WSP Make', 'wsp make', 'Type of WSPD') || (window.activeWspCoachData ? window.activeWspCoachData.typeOfWspd : '');

        const payload = {
            action: 'addWspEntry',
            editRow: entry._rowIndex || '',
            coachNumber: coachNo,
            coachType: coachType,
            trainNumber: trainNo,
            wspMake: wspMake,
            downloadDate: downloadDate,
            month: monthName,
            wheelCondition: getInp(`inline-wheel-${cardId}`),
            wspCode: getInp(`inline-code-${cardId}`),
            psStatus: getInp(`inline-ps-${cardId}`),
            dumpValve: getInp(`inline-dv-${cardId}`),
            sensorGap: getInp(`inline-gap-${cardId}`),
            defectCategory: getInp(`inline-cat-${cardId}`),
            observation: getInp(`inline-obs-${cardId}`),
            otherObservation: getInp(`inline-otherobs-${cardId}`),
            description: getInp(`inline-desc-${cardId}`),
            attention: getInp(`inline-att-${cardId}`),
            followUpRemarks: getInp(`inline-fu-${cardId}`),
            itemRequired: getInp(`inline-item-${cardId}`),
            anyWorkPending: getInp(`inline-pending-${cardId}`),
            pendingWorkDesc: getInp(`inline-pendingdesc-${cardId}`),
            checklistSubmitted: getWspField(entry, 'Checklist Submitted', 'checklist submitted') || '',
            dataEntryBy: getInp(`inline-staff-${cardId}`),

            // Preserve all Checklist fields (Sections 2-5) from entry so nothing is lost
            phonicWheelCondition: getWspField(entry, 'Condition of Phonic Wheel', 'phonicWheelCondition'),
            ventingSound: getWspField(entry, 'Venting Sound', 'ventingSound'),
            kmReadingDeficiency: getWspField(entry, 'KM Reading Deficiency', 'kmReadingDeficiency'),
            bcPressure: getWspField(entry, 'BC Pressure', 'bcPressure'),
            dvReleaseTime: getWspField(entry, 'DV Release Time', 'dvReleaseTime'),
            dumpValveChokeMod: getWspField(entry, 'Dump Valve Choke Mod', 'dumpValveChokeMod'),
            chokeFilterCondition: getWspField(entry, 'Choke Filter Condition', 'chokeFilterCondition'),
            hosePipeMod: getWspField(entry, 'Hose Pipe Mod', 'hosePipeMod'),
            milConnector: getWspField(entry, 'MIL Connector Compliance', 'milConnector'),
            jbMounting: getWspField(entry, 'JB Mounting Compliance', 'jbMounting'),
            reroutingSensorCable: getWspField(entry, 'Sensor Cable Rerouting', 'reroutingSensorCable'),
            jbCover: getWspField(entry, 'JB Protection Cover', 'jbCover'),
            jbOrientation: getWspField(entry, 'JB Orientation Compliance', 'jbOrientation'),
            waterIngress: getWspField(entry, 'Water Ingress in Connectors', 'waterIngress'),
            sensorProbeCondition: getWspField(entry, 'Sensor Probe Condition', 'sensorProbeCondition'),
            correctSensorMake: getWspField(entry, 'Correct Sensor Make & Type', 'correctSensorMake'),
            correctDvMake: getWspField(entry, 'Correct DV Make & Type', 'correctDvMake'),
            crossSensorWiring: getWspField(entry, 'Cross Sensor Wiring', 'crossSensorWiring'),
            crossDvWiring: getWspField(entry, 'Cross DV Wiring', 'crossDvWiring'),
            dvPinCondition: getWspField(entry, 'DV Pin Condition', 'dvPinCondition'),
            rbcStatus: getWspField(entry, 'RBC Power Supply Status', 'rbcStatus'),
            ksRelayTimer: getWspField(entry, 'KS Relay Timer', 'ksRelayTimer'),
            mcbTripping: getWspField(entry, 'MCB Tripping', 'mcbTripping'),
            mcbFuseRating: getWspField(entry, 'MCB/Fuse Rating', 'mcbFuseRating'),
            ledGlow: getWspField(entry, 'LED Glow Status', 'ledGlow'),
            dvExcessiveActivation: getWspField(entry, 'DV Excessive Activation', 'dvExcessiveActivation'),
            continuousFaultAxle: getWspField(entry, 'Continuous Fault Axle', 'continuousFaultAxle'),
            psBypass: getWspField(entry, 'PS Bypass Status', 'psBypass'),
            sleepMode: getWspField(entry, 'Sleep Mode Status', 'sleepMode'),
            dateTimeSync: getWspField(entry, 'DateTime Sync Status', 'dateTimeSync'),
            powerOnIssues: getWspField(entry, 'Power On Issues', 'powerOnIssues'),
            speedVariation: getWspField(entry, 'Speed Variation Status', 'speedVariation'),
            defectCorrelated: getWspField(entry, 'Defect Correlated with WSPD', 'defectCorrelated')
        };

        try {
            await fetch(GOOGLE_APP_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // Update local object
            entry['Download Date'] = payload.downloadDate;
            entry['download date'] = payload.downloadDate;
            entry['Wheel condition'] = payload.wheelCondition;
            entry['wheel condition'] = payload.wheelCondition;
            entry['wsp code'] = payload.wspCode;
            entry['PS status'] = payload.psStatus;
            entry['Self test dump valve'] = payload.dumpValve;
            entry['Sensor gap'] = payload.sensorGap;
            entry['defect category'] = payload.defectCategory;
            entry['downloading obseravtion'] = payload.observation;
            entry['OTHER OBSERVATION'] = payload.otherObservation;
            entry['DEFECT DESCRIPTION'] = payload.description;
            entry['ATTENTION IF ANY'] = payload.attention;
            entry['FOLLOU UP REMARKS'] = payload.followUpRemarks;
            entry['ITEM REQUIRED / USED'] = payload.itemRequired;
            entry['Pending work'] = payload.anyWorkPending;
            entry['pending work description'] = payload.pendingWorkDesc;
            entry['data entry by'] = payload.dataEntryBy;

            window.wspHistoryMap[cardId] = entry;
            if (entry._rowIndex) window.wspHistoryMap[entry._rowIndex] = entry;
            window.latestCoachHistoryEntry = entry;

            // Re-render the card with updated data
            const wrapper = document.getElementById(`card-wrapper-${cardId}`);
            if (wrapper) {
                wrapper.innerHTML = buildWspDefectCardHTML(entry, {
                    showActions: true,
                    cardId: cardId,
                    startExpanded: true
                });
            } else {
                cancelInlineWspDefect(cardId);
            }

            Swal.fire({
                icon: 'success',
                title: 'Defect Updated',
                text: `Changes to coach ${coachNo} defect record saved successfully.`,
                timer: 2000,
                showConfirmButton: false,
                background: 'var(--surface)',
                color: 'var(--text)'
            });

        } catch (err) {
            console.error('Error saving inline WSP defect:', err);
            showWarningAlert('Failed to save defect changes. Please try again.');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Save Changes`;
            }
        }
    }
    window.saveInlineWspDefect = saveInlineWspDefect;

    function renderWspCoachHero(coachNum, rly, type, typeOfWspd, trainNo, ci, leftDate, arrivalDate) {
        window.activeWspCoachData = { coachNum, rly, type, typeOfWspd, trainNo, ci, leftDate, arrivalDate };
        setTimeout(updateWspFormAutoFill, 50);
        const fmt = (d) => formatDateDMY(d);
        return `
        <div class="wsp-coach-hero">
            <div class="wsp-hero-top">
                <div class="wsp-hero-badges">
                    <span class="wsp-badge-coach"><i class="fa-solid fa-train"></i> ${rly && rly !== '-' ? rly : 'IR'} <span id="wspHeroCoachNum">${coachNum}</span></span>
                    <span class="badge" id="wspHeroCoachType" style="background: rgba(255,255,255,0.08); color: #cbd5e1; font-weight: 600;">${type}</span>
                </div>
                <div class="wsp-hero-badges">
                    <span class="badge" id="wspHeroWspd" style="background: rgba(139, 92, 246, 0.2); color: #c4b5fd; border: 1px solid rgba(139, 92, 246, 0.35);"><i class="fa-solid fa-gear"></i> ${typeOfWspd}</span>
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

        // Determine unique cardId
        const cardId = options.cardId || (entry._rowIndex ? String(entry._rowIndex) : ('card_' + (options.index !== undefined ? options.index : Math.random().toString(36).substr(2, 6))));

        window.wspHistoryMap = window.wspHistoryMap || {};
        window.wspHistoryMap[cardId] = entry;
        if (entry._rowIndex) {
            window.wspHistoryMap[entry._rowIndex] = entry;
        }

        // Extract fields
        let coachNum = extractCoachNumber(entry);
        if (coachNum && coachNum !== '-') {
            entry['Coach No'] = coachNum;
            entry._coachNumber = coachNum;
            window.wspHistoryMap['coach_' + coachNum] = entry;
        }

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
        let followUpRemarks = getWspField(entry, 'FOLLOU UP REMARKS', 'follow up remarks', 'follo up', 'follow up');
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

        const cardClass = isPendingActive ? 'wsp-defect-card has-pending wsp-accordion-card' : (isDefectActive ? 'wsp-defect-card has-defect wsp-accordion-card' : 'wsp-defect-card wsp-accordion-card');
        const isExpanded = options.startExpanded === true;

        return `
        <div class="${cardClass}" id="card-${cardId}">
            <!-- Header Ribbon (Dropdown / Accordion Toggle) -->
            <div class="wsp-card-header wsp-accordion-toggle" onclick="toggleWspCardAccordion('${cardId}')" title="Click to expand/collapse defect details">
                <div class="wsp-header-left" style="display:flex; align-items:center; gap:0.45rem; flex-wrap:wrap;">
                    <span class="wsp-badge-coach"><i class="fa-solid fa-train"></i> ${rly !== '-' ? rly : 'IR'} ${coachNum}</span>
                    ${downloadDate !== '-' ? `<span class="wsp-chip-date"><i class="fa-regular fa-calendar"></i> ${formatDateDMY(downloadDate)}</span>` : ''}
                    ${wheelCondition !== '-' && wheelCondition.toLowerCase() !== 'nil' ? `<span class="wsp-chip-wheel"><i class="fa-solid fa-compact-disc"></i> ${wheelCondition}</span>` : ''}
                </div>
                <div class="wsp-header-right" style="display:flex; align-items:center; gap:0.45rem;">
                    ${statusBadgeHtml}
                    <button type="button" class="wsp-accordion-arrow-btn" aria-label="Toggle details">
                        <i class="fa-solid fa-chevron-down wsp-accordion-chevron ${isExpanded ? 'expanded' : ''}" id="chevron-${cardId}"></i>
                    </button>
                </div>
            </div>
            
            <!-- Expandable Accordion Body -->
            <div id="wsp-body-${cardId}" class="wsp-accordion-body ${isExpanded ? '' : 'hidden'}">
                <!-- View Mode -->
                <div id="wsp-view-${cardId}">
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
                            <div class="wsp-kv-item" style="grid-column: 1 / -1;"><span class="wsp-kv-label">Attention (If Any)</span><span class="wsp-kv-value">${attention}</span></div>
                            <div class="wsp-kv-item" style="grid-column: 1 / -1;"><span class="wsp-kv-label">Item Required / Used</span><span class="wsp-kv-value">${itemRequired}</span></div>
                            ${followUpRemarks !== '-' ? `
                            <div class="wsp-kv-item" style="grid-column: 1 / -1;"><span class="wsp-kv-label">Follow Up Remarks</span><span class="wsp-kv-value" style="color: #38bdf8;">${followUpRemarks}</span></div>` : ''}
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
                        <button type="button" class="btn wsp-action-btn edit" onclick="event.stopPropagation(); startInlineEditWspDefect('${cardId}')" title="Edit defect directly on this card without opening modal">
                            <i class="fa-solid fa-pen-to-square"></i> Edit Defect
                        </button>
                        <button type="button" class="btn wsp-action-btn checklist" onclick="event.stopPropagation(); openWspChecklistForCard('${cardId}')" title="Open complete Checklist Report and generate PDF">
                            <i class="fa-solid fa-clipboard-check"></i> Checklist Report
                        </button>
                        ${coachNum && coachNum !== '-' ? `
                        <button type="button" class="btn wsp-action-btn history" onclick="event.stopPropagation(); fetchWspHistory('${coachNum}')">
                            <i class="fa-solid fa-clock-rotate-left"></i> Coach History
                        </button>` : ''}
                    </div>` : ''}
                </div>

                <!-- Inline Edit Form Container (replaces card content when Edit is clicked) -->
                <div id="wsp-edit-${cardId}" class="wsp-card-edit-mode hidden">
                    ${buildInlineEditFormHTML(entry, cardId)}
                </div>
            </div>
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
                                if (icon) icon.style.transform = 'rotate(180deg)';
                            } else {
                                detailsTr.style.display = 'none';
                                if (icon) icon.style.transform = 'rotate(0deg)';
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
            if (arrEl) arrEl.innerText = arrivalDate;
            const depEl = document.getElementById('wspRakeDepartureDate');
            if (depEl) depEl.innerText = departureDate;
        } else {
            const arrEl = document.getElementById('wspRakeArrivalDate');
            if (arrEl) arrEl.innerText = '-';
            const depEl = document.getElementById('wspRakeDepartureDate');
            if (depEl) depEl.innerText = '-';
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

        const coachNumber = String(document.getElementById('wspCoachNumberInput').value).trim();

        if (coachNumber.length !== 6 && coachNumber !== '91223') {
            showWarningAlert("Please enter a valid 6-digit coach number (or 91223).");
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
        if (!coachNum) coachNum = document.getElementById('wspCoachNumberInput').value;

        const rly = dataObj['RLY'] || dataObj['Rly'] || '-';
        const type = dataObj['TYPE'] || dataObj['Coach Type'] || '-';

        // Direct object keys lookup
        let typeOfWspd = dataObj['Type of WSPD'] || dataObj['TYPE OF WSPD'] || dataObj['WSP MAKE'] || dataObj['WSP Make'] || dataObj['wsp_make'] || '-';
        let trainNo = dataObj['TRAIN NO'] || dataObj['Train No'] || dataObj['DB Train No'] || dataObj['TRAIN'] || dataObj['train_no'] || '-';
        let ci = dataObj['CI'] || dataObj['ci'] || '-';
        let arrivalDate = dataObj['ARRIVAL DATE'] || dataObj['Arrival Date'] || dataObj['arrival date'] || '-';
        let leftDate = dataObj['LEFT DATE'] || dataObj['Left Date'] || dataObj['left date'] || '-';

        const headers = dataObj['_headers'];
        const rawRow = dataObj['_rawRow'];
        if (headers && rawRow) {
            for (let i = 0; i < headers.length; i++) {
                const h = String(headers[i]).toLowerCase().trim();
                if (h.includes('type of wspd') && typeOfWspd === '-') {
                    typeOfWspd = rawRow[i] || '-';
                } else if ((h === 'train no' || h.includes('train') || h === 'status') && trainNo === '-') {
                    trainNo = rawRow[i] || '-';
                } else if (h === 'ci' && ci === '-') {
                    ci = rawRow[i] || '-';
                } else if ((h === 'arrival' || h.includes('arrival date')) && arrivalDate === '-') {
                    arrivalDate = rawRow[i] || '-';
                } else if ((h === 'left date' || h.includes('left date') || h.includes('departure')) && leftDate === '-') {
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
        if (!coachNumber || (coachNumber.length !== 6 && coachNumber !== '91223')) {
            showWarningAlert("Please enter a valid 6-digit coach number (or 91223).");
            return;
        }

        // Check if called from form
        const submitBtn = document.getElementById('wspSearchSubmitBtn');
        if (submitBtn) {
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

                // Sort entries in descending order so newest defect is at the top
                const sortedEntries = [...data.data].sort((a, b) => {
                    const rowA = Number(a._rowIndex) || 0;
                    const rowB = Number(b._rowIndex) || 0;
                    if (rowA && rowB) return rowB - rowA;
                    const dateA = new Date(a['Download Date'] || a['download date'] || 0).getTime() || 0;
                    const dateB = new Date(b['Download Date'] || b['download date'] || 0).getTime() || 0;
                    return dateB - dateA;
                });

                // The newest historical defect is index 0
                const latestEntry = sortedEntries[0];
                window.latestCoachHistoryEntry = latestEntry;
                window.wspHistoryMap['coach_' + coachNumber] = latestEntry;

                sortedEntries.forEach((entry, idx) => {
                    entry['Coach No'] = coachNumber;
                    entry._coachNumber = coachNumber;
                    const cardId = entry._rowIndex ? String(entry._rowIndex) : ('card_' + idx + '_' + coachNumber);
                    window.wspHistoryMap[cardId] = entry;
                    if (entry._rowIndex) window.wspHistoryMap[entry._rowIndex] = entry;

                    const cardWrapper = document.createElement('div');
                    cardWrapper.id = `card-wrapper-${cardId}`;
                    cardWrapper.className = 'slide-up';
                    cardWrapper.style.animationDelay = `${idx * 0.05}s`;
                    cardWrapper.style.marginBottom = '0.75rem';

                    // Accordion dropdown: all cards start collapsed in clean dropdown fashion
                    cardWrapper.innerHTML = buildWspDefectCardHTML(entry, {
                        showActions: true,
                        cardId: cardId,
                        index: idx,
                        startExpanded: false
                    });
                    historyContainer.appendChild(cardWrapper);
                });

                // Keep Add New Defect form blank and ready for fresh entry
                resetWspFormToBlank();
            } else {
                window.wspHistoryMap = {};
                window.latestCoachHistoryEntry = null;
                historyContainer.innerHTML = `
                <div class="empty-state" style="padding: 1.5rem 0;">
                    <i class="fa-solid fa-check-circle" style="color: #10b981; font-size: 2rem; margin-bottom: 0.5rem;"></i>
                    <p>No previous reported wheel issue for above coach.</p>
                </div>
            `;
                const defectForm = document.getElementById('wspDefectForm');
                if (defectForm) defectForm.reset();
                updateWspFormAutoFill();
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
            if (submitBtn) {
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

        const coachNumber = String(document.getElementById('scheduleCoachNumberInput').value).trim();

        if (coachNumber.length !== 6 && coachNumber !== '91223') {
            showWarningAlert("Please enter a valid 6-digit coach number (or 91223).");
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
    let currentDueView = 'cards';

    function switchDueView(view) {
        currentDueView = view;
        const cardsBtn = document.getElementById('dueViewCardsBtn');
        const tableBtn = document.getElementById('dueViewTableBtn');
        const cardsContainer = document.getElementById('dueCoachesCardsContainer');
        const tableContainer = document.getElementById('dueCoachesTableContainer');

        if (view === 'cards') {
            if (cardsBtn) cardsBtn.classList.add('active');
            if (tableBtn) tableBtn.classList.remove('active');
            if (cardsContainer) cardsContainer.classList.remove('hidden');
            if (tableContainer) tableContainer.classList.add('hidden');
        } else {
            if (tableBtn) tableBtn.classList.add('active');
            if (cardsBtn) cardsBtn.classList.remove('active');
            if (tableContainer) tableContainer.classList.remove('hidden');
            if (cardsContainer) cardsContainer.classList.add('hidden');
        }
    }

    function selectDueCoach(coachNo) {
        navigateTo('scheduleSearchScreen');
        const searchInput = document.getElementById('scheduleCoachNumberInput');
        if (searchInput) {
            searchInput.value = coachNo;
            const form = document.getElementById('scheduleSearchForm');
            if (form) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
    }

    async function fetchDueCoaches() {
        const dateInput = document.getElementById('dueDatePicker').value;
        const errorEl = document.getElementById('dueCoachesError');
        const loadingEl = document.getElementById('dueCoachesLoading');
        const resultsContainer = document.getElementById('dueCoachesResultsContainer');
        const cardsContainer = document.getElementById('dueCoachesCardsContainer');
        const tbody = document.getElementById('dueCoachesTableBody');
        const fetchBtn = document.getElementById('dueFetchBtn');

        errorEl.classList.add('hidden');
        resultsContainer.classList.add('hidden');
        const resetSubTitle = document.getElementById('dueCoachesScreenSubtitle');
        if (resetSubTitle) resetSubTitle.textContent = 'Check which coaches are due';

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
        const todaysSchedule = pitSchedule[dayOfWeek] || { day: '-', night: '-' };

        document.getElementById('pitCheckDayRakes').textContent = todaysSchedule.day;
        document.getElementById('pitCheckNightRakes').textContent = todaysSchedule.night;
        const dayOfWeekEl = document.getElementById('pitCheckDayOfWeek');
        if (dayOfWeekEl) dayOfWeekEl.textContent = `(${dayName})`;

        loadingEl.classList.remove('hidden');
        if (fetchBtn) fetchBtn.disabled = true;
        if (tbody) tbody.innerHTML = '';
        if (cardsContainer) cardsContainer.innerHTML = '';

        try {
            const url = `${SCHEDULE_APP_SCRIPT_URL}?action=getDueCoaches&date=${encodeURIComponent(dateInput)}`;
            const response = await fetch(url);
            const result = await response.json();

            if (result.status === 'success') {
                const coaches = result.data || [];
                const totalDue = coaches.length;
                const d2Count = coaches.filter(c => c.isD2Due).length;
                const d3Count = coaches.filter(c => c.isD3Due).length;

                // 1. Update Screen Subtitle at the very top
                const subTitleEl = document.getElementById('dueCoachesScreenSubtitle');
                if (subTitleEl) {
                    subTitleEl.innerHTML = totalDue > 0
                        ? `<span style="color: #fca5a5; font-weight: 600;"><i class="fa-solid fa-triangle-exclamation"></i> ${totalDue} Coaches Pending</span>`
                        : `<span style="color: #6ee7b7;"><i class="fa-solid fa-circle-check"></i> All Clear - No Coaches Due</span>`;
                }

                // 2. Update Hero Banner at top of results
                const heroCard = document.getElementById('dueCountHeroCard');
                const heroNum = document.getElementById('dueHeroCountNumber');
                const heroD2 = document.getElementById('dueHeroD2Count');
                const heroD3 = document.getElementById('dueHeroD3Count');
                const heroTitle = document.getElementById('dueHeroCountTitle');
                const heroSubtitle = document.getElementById('dueHeroCountSubtitle');

                if (heroNum) heroNum.textContent = totalDue;
                if (heroD2) heroD2.textContent = d2Count;
                if (heroD3) heroD3.textContent = d3Count;
                if (heroTitle) {
                    heroTitle.textContent = totalDue === 1 ? '1 Coach Pending Schedule' : `${totalDue} Coaches Pending Schedule`;
                }
                if (heroSubtitle) {
                    heroSubtitle.textContent = totalDue > 0 ? 'Requires schedule maintenance on this pit date' : 'All rakes clear of pending schedules';
                }
                if (heroCard) {
                    if (totalDue === 0) {
                        heroCard.classList.add('all-clear');
                    } else {
                        heroCard.classList.remove('all-clear');
                    }
                }

                // 3. Update List Header Pill and Text
                const countPill = document.getElementById('dueCoachesCountPill');
                if (countPill) {
                    countPill.textContent = `${totalDue} Pending`;
                    countPill.className = totalDue > 0 ? 'due-header-count-pill has-pending' : 'due-header-count-pill all-clear';
                }

                const totalTextEl = document.getElementById('dueCoachesTotalText');
                if (totalTextEl) {
                    totalTextEl.textContent = totalDue > 0
                        ? `Total: ${totalDue} pending coach${totalDue > 1 ? 'es' : ''} (${d2Count} D2, ${d3Count} D3)`
                        : 'No pending coaches found';
                }

                if (coaches.length > 0) {
                    coaches.forEach(coach => {
                        // 1. Build Table Row
                        const tr = document.createElement('tr');

                        const d2Display = coach.isD2Due
                            ? `<span class="due-date-pill is-due"><i class="fa-solid fa-triangle-exclamation"></i> ${coach.d2Date}</span>`
                            : `<span class="due-date-pill is-ok">${coach.d2Date}</span>`;

                        const d3Display = coach.isD3Due
                            ? `<span class="due-date-pill is-due"><i class="fa-solid fa-triangle-exclamation"></i> ${coach.d3Date}</span>`
                            : `<span class="due-date-pill is-ok">${coach.d3Date}</span>`;

                        tr.style.cursor = 'pointer';
                        tr.title = "Click to update schedule";
                        tr.onclick = () => selectDueCoach(coach.coachNo);

                        tr.innerHTML = `
                        <td><span class="due-rly-tag">${coach.rly}</span></td>
                        <td><span class="due-type-tag">${coach.type}</span></td>
                        <td><span class="highlight-badge">${coach.coachNo}</span></td>
                        <td><span class="due-train-tag"><i class="fa-solid fa-train"></i> ${coach.trainNo}</span></td>
                        <td>${d2Display}</td>
                        <td>${d3Display}</td>
                    `;
                        if (tbody) tbody.appendChild(tr);

                        // 2. Build Mobile Card
                        if (cardsContainer) {
                            const card = document.createElement('div');
                            card.className = `due-coach-card ${coach.isD2Due || coach.isD3Due ? 'has-due' : ''}`;
                            card.onclick = () => selectDueCoach(coach.coachNo);

                            card.innerHTML = `
                            <div class="due-card-header">
                                <div class="due-card-badge-group">
                                    <span class="due-rly-tag">${coach.rly}</span>
                                    <span class="due-coach-number">${coach.coachNo}</span>
                                    <span class="due-type-tag">${coach.type}</span>
                                </div>
                                <div class="due-train-tag">
                                    <i class="fa-solid fa-train"></i> Train ${coach.trainNo}
                                </div>
                            </div>
                            
                            <div class="due-card-schedules">
                                <div class="due-sched-box ${coach.isD2Due ? 'is-due' : 'is-ok'}">
                                    <div class="due-sched-meta">
                                        <span class="due-sched-name"><i class="fa-solid fa-calendar-check"></i> D2 Schedule</span>
                                        ${coach.isD2Due ? '<span class="due-alert-chip">DUE</span>' : '<span class="due-ok-chip">OK</span>'}
                                    </div>
                                    <div class="due-sched-date">${coach.d2Date}</div>
                                </div>

                                <div class="due-sched-box ${coach.isD3Due ? 'is-due' : 'is-ok'}">
                                    <div class="due-sched-meta">
                                        <span class="due-sched-name"><i class="fa-solid fa-calendar-days"></i> D3 Schedule</span>
                                        ${coach.isD3Due ? '<span class="due-alert-chip">DUE</span>' : '<span class="due-ok-chip">OK</span>'}
                                    </div>
                                    <div class="due-sched-date">${coach.d3Date}</div>
                                </div>
                            </div>

                            <div class="due-card-footer">
                                <span><i class="fa-solid fa-pen-to-square"></i> Tap to update schedule</span>
                                <i class="fa-solid fa-chevron-right chevron"></i>
                            </div>
                        `;
                            cardsContainer.appendChild(card);
                        }
                    });
                } else {
                    if (tbody) {
                        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 25px;">No coaches due on this date for available rakes.</td></tr>`;
                    }
                    if (cardsContainer) {
                        cardsContainer.innerHTML = `
                        <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
                            <i class="fa-solid fa-circle-check" style="font-size: 2.5rem; color: #10b981; margin-bottom: 0.75rem; display: block;"></i>
                            <h4 style="color: #fff; margin-bottom: 0.25rem;">All Clear!</h4>
                            <p style="font-size: 0.85rem; margin: 0;">No coaches are due on this date for available rakes.</p>
                        </div>
                    `;
                    }
                }
                resultsContainer.classList.remove('hidden');
            } else {
                errorEl.textContent = result.message || 'Failed to fetch due coaches.';
                errorEl.classList.remove('hidden');
            }
        } catch (err) {
            errorEl.textContent = 'Error fetching due coaches: ' + err.message;
            errorEl.classList.remove('hidden');
        } finally {
            loadingEl.classList.add('hidden');
            if (fetchBtn) fetchBtn.disabled = false;
        }
    }

    function editWspEntry(rowIndex) {
        if (!window.wspHistoryMap && !window.pendingWorkMap) return;
        const entry = (window.wspHistoryMap && (window.wspHistoryMap[rowIndex] || window.wspHistoryMap[String(rowIndex)])) ||
            (window.pendingWorkMap && (window.pendingWorkMap[rowIndex] || window.pendingWorkMap[String(rowIndex)]));
        if (!entry) return;

        // If inline edit container is available on the current screen, edit right inside the card!
        const inlineEditEl = document.getElementById(`wsp-edit-${rowIndex}`);
        if (inlineEditEl) {
            startInlineEditWspDefect(rowIndex);
            return;
        }

        // Set Edit Row ID
        document.getElementById('wspEditRowIndex').value = rowIndex;

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

        // Populate all fields using historical entry mapping
        populateWspFormFromEntry(entry, { isPrefillForNew: false, rowIndex: rowIndex });
        updateWspFormAutoFill();

        // Open inline defect accordion on results screen
        const wrapper = document.getElementById('wspDefectFormWrapper');
        const chevron = document.getElementById('wspAddDefectChevron');
        if (wrapper && wrapper.classList.contains('hidden')) {
            wrapper.classList.remove('hidden');
            if (chevron) {
                chevron.classList.add('fa-chevron-up');
                chevron.classList.remove('fa-chevron-down');
            }
        }
        const formTitle = document.getElementById('wspFormTitle');
        if (formTitle) formTitle.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit Defect (Row #${rowIndex})`;
        const defectSubmitBtn = document.getElementById('wspSubmitDefectBtn');
        if (defectSubmitBtn) {
            const textSpan = defectSubmitBtn.querySelector('.btn-text');
            if (textSpan) textSpan.innerText = 'Update Defect Record';
        }
        if (wrapper) {
            wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    async function fetchWspPendingWork() {
        const btn = document.getElementById('wspFetchPendingBtn');
        if (btn) {
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

                const totalCoaches = sortedEntries.length;
                const totalIssues = data.data.length;

                // 1. Update Subtitle at top
                const subtitleEl = document.getElementById('wspPendingSubtitle');
                if (subtitleEl) {
                    subtitleEl.innerHTML = totalCoaches > 0
                        ? `Coaches with pending issues • <b style="color: #fca5a5;">${totalCoaches} Coaches Pending</b>`
                        : `No pending issues found`;
                }

                // 2. Update Hero Banner at top of screen
                const heroCard = document.getElementById('wspPendingHeroCard');
                const heroCoachCount = document.getElementById('wspPendingCoachCount');
                const heroTotalIssues = document.getElementById('wspPendingTotalIssues');
                const heroTitle = document.getElementById('wspPendingHeroTitle');
                const heroSubtitle = document.getElementById('wspPendingHeroSubtitle');

                if (heroCoachCount) heroCoachCount.textContent = totalCoaches;
                if (heroTotalIssues) heroTotalIssues.textContent = totalIssues;
                if (heroTitle) {
                    heroTitle.textContent = totalCoaches === 1 ? '1 Pending Coach' : `${totalCoaches} Total Pending Coaches`;
                }
                if (heroSubtitle) {
                    heroSubtitle.textContent = `${totalIssues} pending defect issue${totalIssues > 1 ? 's' : ''} across all coaches`;
                }
                if (heroCard) {
                    heroCard.classList.remove('all-clear');
                }

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
                const subtitleEl = document.getElementById('wspPendingSubtitle');
                if (subtitleEl) subtitleEl.textContent = 'Awesome! No pending WSP work found.';

                const heroCard = document.getElementById('wspPendingHeroCard');
                const heroCoachCount = document.getElementById('wspPendingCoachCount');
                const heroTotalIssues = document.getElementById('wspPendingTotalIssues');
                const heroTitle = document.getElementById('wspPendingHeroTitle');
                const heroSubtitle = document.getElementById('wspPendingHeroSubtitle');

                if (heroCoachCount) heroCoachCount.textContent = '0';
                if (heroTotalIssues) heroTotalIssues.textContent = '0';
                if (heroTitle) heroTitle.textContent = '0 Pending Coaches';
                if (heroSubtitle) heroSubtitle.textContent = 'All clear - No pending defects found';
                if (heroCard) heroCard.classList.add('all-clear');

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
            if (btn) {
                btn.disabled = false;
                btn.querySelector('.spinner').classList.add('hidden');
                btn.querySelector('.btn-text').style.opacity = '1';
            }
        }
    }


    function showChangelog() {
        Swal.fire({
            title: 'Changelog V 5.0',
            html: '<div style="text-align: left; font-size: 0.9rem; line-height: 1.5;">' +
                '<ul>' +
                '<li><b>LHB Manuals & Google Drive Integration:</b> Direct link and automatic PDF catalog fetch from Google Drive folder with in-app reader, zoom, 90° rotation, offline caching & share.</li>' +
                '<li><b>WSP Checklist Landscape PDF Report:</b> High-definition single-page A4 landscape format with balanced columns, full-width Section 6 conclusion, and high-contrast bold fonts.</li>' +
                '<li><b>Auto-Expanding Textareas:</b> Defect description, attention given, items used, and observation fields dynamically expand with text.</li>' +
                '<li><b>WSP Tab Optimization:</b> Clean 4-segment tab bar with quick navigation for coach, rake, date, and pending defects.</li>' +
                '<li><b>WSP Defect Form Restructure:</b> Comprehensive 6-section inspection layout with auto-filled coach headers, diagnostics, modification compliance, underframe status, WSP panel checks, and conclusion.</li>' +
                '<li><b>Progressive Web App (PWA):</b> Full install support on Android, iOS, Windows & Mac with offline capabilities and cached depot data.</li>' +
                '</ul>' +
                '</div>',
            icon: 'info',
            background: 'rgba(30, 41, 59, 0.95)',
            color: 'var(--text)',
            confirmButtonColor: 'var(--primary)'
        });
    }


    // ==========================================================================
    // WSP Manuals & PDF Viewer Logic
    // ==========================================================================

    const DEFAULT_WSP_MANUALS_FOLDER_ID = '1puysobNlAtUwjdJ1hy1E6ieJpk24QQcx';
    const DEFAULT_WSP_MANUALS_DRIVE_URL = 'https://drive.google.com/drive/folders/1puysobNlAtUwjdJ1hy1E6ieJpk24QQcx?usp=sharing';

    const DEFAULT_LHB_MANUALS_FOLDER_ID = '1aGdYlSIri5xoZYPF3KqGPaeue6QgeKCz';
    const DEFAULT_LHB_MANUALS_DRIVE_URL = 'https://drive.google.com/drive/folders/1aGdYlSIri5xoZYPF3KqGPaeue6QgeKCz?usp=sharing';

    const INITIAL_WSP_MANUALS = [
        {
            id: "1027BnFJHQfAC_rgme7CWg5HL4qv1iOWf",
            name: "1.1 KB manual.pdf",
            size: 1323318,
            lastUpdated: "2026-11-25T09:15:02.702Z",
            downloadUrl: "https://drive.google.com/uc?export=download&id=1027BnFJHQfAC_rgme7CWg5HL4qv1iOWf",
            viewUrl: "https://drive.google.com/file/d/1027BnFJHQfAC_rgme7CWg5HL4qv1iOWf/view?usp=sharing",
            previewUrl: "https://drive.google.com/file/d/1027BnFJHQfAC_rgme7CWg5HL4qv1iOWf/preview"
        },
        {
            id: "1WidenNOGh1hTLvAmrriXpwiAW4Nxpsgv",
            name: "1.2 KB fault code.pdf",
            size: 366008,
            lastUpdated: "2026-11-25T09:11:56.522Z",
            downloadUrl: "https://drive.google.com/uc?export=download&id=1WidenNOGh1hTLvAmrriXpwiAW4Nxpsgv",
            viewUrl: "https://drive.google.com/file/d/1WidenNOGh1hTLvAmrriXpwiAW4Nxpsgv/view?usp=sharing",
            previewUrl: "https://drive.google.com/file/d/1WidenNOGh1hTLvAmrriXpwiAW4Nxpsgv/preview"
        },
        {
            id: "1YOwXBbwhOeUIII_erdZDWYWNYiXvfvr9",
            name: "1.3 KB download procedure.pdf",
            size: 1178545,
            lastUpdated: "2026-11-25T08:58:22.992Z",
            downloadUrl: "https://drive.google.com/uc?export=download&id=1YOwXBbwhOeUIII_erdZDWYWNYiXvfvr9",
            viewUrl: "https://drive.google.com/file/d/1YOwXBbwhOeUIII_erdZDWYWNYiXvfvr9/view?usp=sharing",
            previewUrl: "https://drive.google.com/file/d/1YOwXBbwhOeUIII_erdZDWYWNYiXvfvr9/preview"
        },
        {
            id: "1cWaprx5BPnize16JJGDkLHH9H3QsxnCn",
            name: "2.1 FT KES manual.pdf",
            size: 3766142,
            lastUpdated: "2026-11-25T09:14:27.968Z",
            downloadUrl: "https://drive.google.com/uc?export=download&id=1cWaprx5BPnize16JJGDkLHH9H3QsxnCn",
            viewUrl: "https://drive.google.com/file/d/1cWaprx5BPnize16JJGDkLHH9H3QsxnCn/view?usp=sharing",
            previewUrl: "https://drive.google.com/file/d/1cWaprx5BPnize16JJGDkLHH9H3QsxnCn/preview"
        },
        {
            id: "1MGkcT1fyxyohoUvU4zhTYqaCxcHoyBxq",
            name: "2.2 FT KES - fault code.pdf",
            size: 1118019,
            lastUpdated: "2026-11-25T09:11:11.379Z",
            downloadUrl: "https://drive.google.com/uc?export=download&id=1MGkcT1fyxyohoUvU4zhTYqaCxcHoyBxq",
            viewUrl: "https://drive.google.com/file/d/1MGkcT1fyxyohoUvU4zhTYqaCxcHoyBxq/view?usp=sharing",
            previewUrl: "https://drive.google.com/file/d/1MGkcT1fyxyohoUvU4zhTYqaCxcHoyBxq/preview"
        },
        {
            id: "1xHIqz11tpQjlwx3p_rrjLoRkRqPH_IWt",
            name: "2.3 FT KES - selft test procedure.pdf",
            size: 74427,
            lastUpdated: "2026-11-25T08:46:41.129Z",
            downloadUrl: "https://drive.google.com/uc?export=download&id=1xHIqz11tpQjlwx3p_rrjLoRkRqPH_IWt",
            viewUrl: "https://drive.google.com/file/d/1xHIqz11tpQjlwx3p_rrjLoRkRqPH_IWt/view?usp=sharing",
            previewUrl: "https://drive.google.com/file/d/1xHIqz11tpQjlwx3p_rrjLoRkRqPH_IWt/preview"
        },
        {
            id: "1A6spn2wQ1t2EbPXgU2SJbIVbqdAyotsT",
            name: "3.1 FT KES, NEW manual.pdf",
            size: 7000644,
            lastUpdated: "2026-11-25T08:42:53.091Z",
            downloadUrl: "https://drive.google.com/uc?export=download&id=1A6spn2wQ1t2EbPXgU2SJbIVbqdAyotsT",
            viewUrl: "https://drive.google.com/file/d/1A6spn2wQ1t2EbPXgU2SJbIVbqdAyotsT/view?usp=sharing",
            previewUrl: "https://drive.google.com/file/d/1A6spn2wQ1t2EbPXgU2SJbIVbqdAyotsT/preview"
        },
        {
            id: "1qA2o3psuBQrQWGAeyaw-Jll4cjOyXmwc",
            name: "3.2 FT new downloading procedure.pdf",
            size: 2219650,
            lastUpdated: "2026-11-25T08:45:14.939Z",
            downloadUrl: "https://drive.google.com/uc?export=download&id=1qA2o3psuBQrQWGAeyaw-Jll4cjOyXmwc",
            viewUrl: "https://drive.google.com/file/d/1qA2o3psuBQrQWGAeyaw-Jll4cjOyXmwc/view?usp=sharing",
            previewUrl: "https://drive.google.com/file/d/1qA2o3psuBQrQWGAeyaw-Jll4cjOyXmwc/preview"
        },
        {
            id: "1WiwSvm3qQfzi78WTiGlWIDmhoNhgfBIt",
            name: "3.3 FT NEW fault code.pdf",
            size: 81113,
            lastUpdated: "2026-11-25T08:49:10.652Z",
            downloadUrl: "https://drive.google.com/uc?export=download&id=1WiwSvm3qQfzi78WTiGlWIDmhoNhgfBIt",
            viewUrl: "https://drive.google.com/file/d/1WiwSvm3qQfzi78WTiGlWIDmhoNhgfBIt/view?usp=sharing",
            previewUrl: "https://drive.google.com/file/d/1WiwSvm3qQfzi78WTiGlWIDmhoNhgfBIt/preview"
        },
        {
            id: "1GUwC82uC30Y5O3SIHS2TnBnLAPORDW8B",
            name: "3.3 FT new- self test procedure.pdf",
            size: 174329,
            lastUpdated: "2026-11-25T08:44:00.531Z",
            downloadUrl: "https://drive.google.com/uc?export=download&id=1GUwC82uC30Y5O3SIHS2TnBnLAPORDW8B",
            viewUrl: "https://drive.google.com/file/d/1GUwC82uC30Y5O3SIHS2TnBnLAPORDW8B/view?usp=sharing",
            previewUrl: "https://drive.google.com/file/d/1GUwC82uC30Y5O3SIHS2TnBnLAPORDW8B/preview"
        },
        {
            id: "1Ey3reh3zu54ck2W5uRHLVi6I8ybrPx6q",
            name: "4.1 ESCORTS manual.pdf",
            size: 1888491,
            lastUpdated: "2026-11-25T08:01:56.078Z",
            downloadUrl: "https://drive.google.com/uc?export=download&id=1Ey3reh3zu54ck2W5uRHLVi6I8ybrPx6q",
            viewUrl: "https://drive.google.com/file/d/1Ey3reh3zu54ck2W5uRHLVi6I8ybrPx6q/view?usp=sharing",
            previewUrl: "https://drive.google.com/file/d/1Ey3reh3zu54ck2W5uRHLVi6I8ybrPx6q/preview"
        },
        {
            id: "1V1wcO3DTyIJxL24uoWtmJ50C7_EZXiHv",
            name: "4.2 Escorts- Faultcode.pdf",
            size: 1479612,
            lastUpdated: "2026-11-25T08:35:28.138Z",
            downloadUrl: "https://drive.google.com/uc?export=download&id=1V1wcO3DTyIJxL24uoWtmJ50C7_EZXiHv",
            viewUrl: "https://drive.google.com/file/d/1V1wcO3DTyIJxL24uoWtmJ50C7_EZXiHv/view?usp=sharing",
            previewUrl: "https://drive.google.com/file/d/1V1wcO3DTyIJxL24uoWtmJ50C7_EZXiHv/preview"
        },
        {
            id: "1xDeu7zvqGkGaibYQ3WwJQiAB8kq-Wwxf",
            name: "4.3 Escorts- downloading procedure.pdf",
            size: 1107170,
            lastUpdated: "2026-11-25T08:37:50.202Z",
            downloadUrl: "https://drive.google.com/uc?export=download&id=1xDeu7zvqGkGaibYQ3WwJQiAB8kq-Wwxf",
            viewUrl: "https://drive.google.com/file/d/1xDeu7zvqGkGaibYQ3WwJQiAB8kq-Wwxf/view?usp=sharing",
            previewUrl: "https://drive.google.com/file/d/1xDeu7zvqGkGaibYQ3WwJQiAB8kq-Wwxf/preview"
        },
        {
            id: "1qwcKrQptdBVmaNGWUu-8U6wxomQZ_vk6",
            name: "5.1 Escorts KES Manual.pdf",
            size: 3978134,
            lastUpdated: "2026-11-25T09:07:54.101Z",
            downloadUrl: "https://drive.google.com/uc?export=download&id=1qwcKrQptdBVmaNGWUu-8U6wxomQZ_vk6",
            viewUrl: "https://drive.google.com/file/d/1qwcKrQptdBVmaNGWUu-8U6wxomQZ_vk6/view?usp=sharing",
            previewUrl: "https://drive.google.com/file/d/1qwcKrQptdBVmaNGWUu-8U6wxomQZ_vk6/preview"
        },
        {
            id: "1KRedod6ADQXaIXuHCNfl9f46oJe6wyPd",
            name: "5.2 Escorts KES - Fault code.pdf",
            size: 1595869,
            lastUpdated: "2026-11-25T09:09:34.599Z",
            downloadUrl: "https://drive.google.com/uc?export=download&id=1KRedod6ADQXaIXuHCNfl9f46oJe6wyPd",
            viewUrl: "https://drive.google.com/file/d/1KRedod6ADQXaIXuHCNfl9f46oJe6wyPd/view?usp=sharing",
            previewUrl: "https://drive.google.com/file/d/1KRedod6ADQXaIXuHCNfl9f46oJe6wyPd/preview"
        }
    ];

    const INITIAL_LHB_MANUALS = [
        {
            id: "1ads9IrB-7GUZhYKT-7eazzuMpbQ818DL",
            name: "D2D3 format.pdf",
            size: 191996,
            lastUpdated: "2023-12-31T16:26:45.888Z",
            downloadUrl: "https://drive.google.com/uc?export=download&id=1ads9IrB-7GUZhYKT-7eazzuMpbQ818DL",
            viewUrl: "https://drive.google.com/file/d/1ads9IrB-7GUZhYKT-7eazzuMpbQ818DL/view?usp=sharing",
            previewUrl: "https://drive.google.com/file/d/1ads9IrB-7GUZhYKT-7eazzuMpbQ818DL/preview"
        },
        {
            id: "1afRkGrHsJSSRBMXdYNCWNNxdOSzUwnGF",
            name: "lhb maintenance manual 2022.pdf",
            size: 103219259,
            lastUpdated: "2023-12-31T16:28:28.875Z",
            downloadUrl: "https://drive.google.com/uc?export=download&id=1afRkGrHsJSSRBMXdYNCWNNxdOSzUwnGF",
            viewUrl: "https://drive.google.com/file/d/1afRkGrHsJSSRBMXdYNCWNNxdOSzUwnGF/view?usp=sharing",
            previewUrl: "https://drive.google.com/file/d/1afRkGrHsJSSRBMXdYNCWNNxdOSzUwnGF/preview"
        },
        {
            id: "1kmSf4shX8pD9tvMFa5T8dysPGeHD5UEO",
            name: "lhb schedules format.pdf",
            size: 585440,
            lastUpdated: "2023-12-31T16:45:04.552Z",
            downloadUrl: "https://drive.google.com/uc?export=download&id=1kmSf4shX8pD9tvMFa5T8dysPGeHD5UEO",
            viewUrl: "https://drive.google.com/file/d/1kmSf4shX8pD9tvMFa5T8dysPGeHD5UEO/view?usp=sharing",
            previewUrl: "https://drive.google.com/file/d/1kmSf4shX8pD9tvMFa5T8dysPGeHD5UEO/preview"
        },
        {
            id: "1aMUfjDVVfcaGrQqUfisp2Zw3DScAPMud",
            name: "M8 modification rdso.pdf",
            size: 1184912,
            lastUpdated: "2023-12-31T15:11:30.291Z",
            downloadUrl: "https://drive.google.com/uc?export=download&id=1aMUfjDVVfcaGrQqUfisp2Zw3DScAPMud",
            viewUrl: "https://drive.google.com/file/d/1aMUfjDVVfcaGrQqUfisp2Zw3DScAPMud/view?usp=sharing",
            previewUrl: "https://drive.google.com/file/d/1aMUfjDVVfcaGrQqUfisp2Zw3DScAPMud/preview"
        },
        {
            id: "1aaoXkjH5En163MERfa5-x1mpzIlxtgQz",
            name: "Torque Values.pdf",
            size: 110609,
            lastUpdated: "2023-12-31T15:32:37.604Z",
            downloadUrl: "https://drive.google.com/uc?export=download&id=1aaoXkjH5En163MERfa5-x1mpzIlxtgQz",
            viewUrl: "https://drive.google.com/file/d/1aaoXkjH5En163MERfa5-x1mpzIlxtgQz/view?usp=sharing",
            previewUrl: "https://drive.google.com/file/d/1aaoXkjH5En163MERfa5-x1mpzIlxtgQz/preview"
        },
        {
            id: "1AEjybmz00LxfZD8LGvSRInLMzhjJVHZR",
            name: "tyre defect gauge checking and wheel profile instructions.pdf",
            size: 567586,
            lastUpdated: "2024-11-26T15:10:08.975Z",
            downloadUrl: "https://drive.google.com/uc?export=download&id=1AEjybmz00LxfZD8LGvSRInLMzhjJVHZR",
            viewUrl: "https://drive.google.com/file/d/1AEjybmz00LxfZD8LGvSRInLMzhjJVHZR/view?usp=sharing",
            previewUrl: "https://drive.google.com/file/d/1AEjybmz00LxfZD8LGvSRInLMzhjJVHZR/preview"
        }
    ];

    let currentManualsList = [...INITIAL_WSP_MANUALS];
    let currentLhbManualsList = [...INITIAL_LHB_MANUALS];
    let activePdfManual = null;
    let pdfZoomScale = 1.0;

    function formatFileSize(bytes) {
        if (!bytes || isNaN(bytes)) return '';
        if (bytes < 1024) return bytes + ' B';
        else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }

    function getActiveDriveFolderId() {
        const stored = localStorage.getItem('coachdb_manuals_folder_id');
        if (stored && stored !== '1ybQuCVbuRzHczorIBP-m-PapvXnrgVAi') return stored;
        return DEFAULT_WSP_MANUALS_FOLDER_ID;
    }

    function getActiveDriveFolderUrl() {
        const stored = localStorage.getItem('coachdb_manuals_drive_url');
        if (stored && !stored.includes('1ybQuCVbuRzHczorIBP-m-PapvXnrgVAi')) return stored;
        return DEFAULT_WSP_MANUALS_DRIVE_URL;
    }

    async function loadManualsFromDrive(forceRefresh = false) {
        const loadingEl = document.getElementById('manualsLoading');
        const errorEl = document.getElementById('manualsError');
        const container = document.getElementById('manualsListContainer');

        if (errorEl) errorEl.classList.add('hidden');

        const folderId = getActiveDriveFolderId();

        // Render immediately from cache or initial list for zero-latency UI
        const cached = localStorage.getItem('coachdb_cached_manuals_' + folderId);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    currentManualsList = parsed;
                }
            } catch (e) { }
        }
        renderManuals(currentManualsList);

        if (forceRefresh && loadingEl) loadingEl.classList.remove('hidden');

        try {
            const url = `${GOOGLE_APP_SCRIPT_URL}?action=getManuals&folderId=${encodeURIComponent(folderId)}`;
            const response = await fetch(url);
            const result = await response.json();

            if (result.status === 'success' && Array.isArray(result.data) && result.data.length > 0) {
                currentManualsList = result.data;
                localStorage.setItem('coachdb_cached_manuals_' + folderId, JSON.stringify(result.data));
                renderManuals(currentManualsList);
            }
        } catch (err) {
            console.warn('Could not query Apps Script for manuals, using local catalog:', err);
        } finally {
            if (loadingEl) loadingEl.classList.add('hidden');
        }
    }

    async function loadLhbManualsFromDrive(forceRefresh = false) {
        const loadingEl = document.getElementById('lhbManualsLoading');
        const errorEl = document.getElementById('lhbManualsError');
        const container = document.getElementById('lhbManualsListContainer');

        if (errorEl) errorEl.classList.add('hidden');

        const folderId = DEFAULT_LHB_MANUALS_FOLDER_ID;

        // Render immediately from cache or initial list for zero-latency UI
        const cached = localStorage.getItem('coachdb_cached_manuals_' + folderId);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    currentLhbManualsList = parsed;
                }
            } catch (e) { }
        }
        renderLhbManuals(currentLhbManualsList);

        if (forceRefresh && loadingEl) loadingEl.classList.remove('hidden');

        try {
            const url = `${GOOGLE_APP_SCRIPT_URL}?action=getManuals&folderId=${encodeURIComponent(folderId)}`;
            const response = await fetch(url);
            const result = await response.json();

            if (result.status === 'success' && Array.isArray(result.data) && result.data.length > 0) {
                currentLhbManualsList = result.data;
                localStorage.setItem('coachdb_cached_manuals_' + folderId, JSON.stringify(result.data));
                renderLhbManuals(currentLhbManualsList);
            }
        } catch (err) {
            console.warn('Could not query Apps Script for LHB manuals, using local catalog:', err);
        } finally {
            if (loadingEl) loadingEl.classList.add('hidden');
        }
    }


    // --- IndexedDB Local PDF Offline Storage ---
    const PDF_DB_NAME = 'CoachDb_PdfStorage';
    const PDF_DB_STORE = 'cached_manuals';
    const PDF_DB_VERSION = 1;

    function openPdfDatabase() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new Error('IndexedDB not supported'));
                return;
            }
            const req = indexedDB.open(PDF_DB_NAME, PDF_DB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(PDF_DB_STORE)) {
                    db.createObjectStore(PDF_DB_STORE, { keyPath: 'id' });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function getCachedPdf(id) {
        try {
            const db = await openPdfDatabase();
            return new Promise((resolve) => {
                const tx = db.transaction(PDF_DB_STORE, 'readonly');
                const store = tx.objectStore(PDF_DB_STORE);
                const req = store.get(id);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => resolve(null);
            });
        } catch (e) {
            return null;
        }
    }

    async function savePdfToCache(item, blob) {
        const db = await openPdfDatabase();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(PDF_DB_STORE, 'readwrite');
            const store = tx.objectStore(PDF_DB_STORE);
            const record = {
                id: item.id,
                name: item.name,
                blob: blob,
                size: blob.size,
                cachedAt: Date.now()
            };
            const req = store.put(record);
            req.onsuccess = () => resolve(record);
            req.onerror = () => reject(req.error);
        });
    }

    async function removePdfFromCache(id) {
        const db = await openPdfDatabase();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(PDF_DB_STORE, 'readwrite');
            const store = tx.objectStore(PDF_DB_STORE);
            const req = store.delete(id);
            req.onsuccess = () => resolve(true);
            req.onerror = () => reject(req.error);
        });
    }

    // Clear all offline cached PDFs
    async function clearAllPdfCache() {
        const res = await Swal.fire({
            title: 'Clear PDF Cache?',
            text: 'This will remove all downloaded offline PDF manuals from this device. You will still be able to open and download them whenever connected.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, clear cache',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b',
            background: 'rgba(30, 41, 59, 0.98)',
            color: 'var(--text)'
        });

        if (!res.isConfirmed) return;

        try {
            const db = await openPdfDatabase();
            await new Promise((resolve, reject) => {
                const tx = db.transaction(PDF_DB_STORE, 'readwrite');
                const store = tx.objectStore(PDF_DB_STORE);
                const req = store.clear();
                req.onsuccess = () => resolve(true);
                req.onerror = () => reject(req.error);
            });

            if (currentActiveBlobUrl) {
                URL.revokeObjectURL(currentActiveBlobUrl);
                currentActiveBlobUrl = null;
            }

            if (activePdfManual) {
                const frame = document.getElementById('pdfViewerFrame');
                if (frame && activePdfManual.previewUrl) {
                    frame.src = activePdfManual.previewUrl;
                }
                updateCacheStatusPill(false, false);
            }

            await renderManuals(currentManualsList);
            if (typeof renderLhbManuals === 'function') {
                await renderLhbManuals(currentLhbManualsList);
            }

            Swal.fire({
                icon: 'success',
                title: 'Cache Cleared',
                text: 'All offline PDF manuals have been removed from local storage.',
                timer: 1800,
                showConfirmButton: false,
                background: 'rgba(30, 41, 59, 0.98)',
                color: 'var(--text)'
            });
        } catch (err) {
            console.error('Error clearing PDF cache:', err);
            Swal.fire({
                icon: 'error',
                title: 'Failed to clear cache',
                text: err.message || 'An error occurred while clearing local cache.',
                background: 'rgba(30, 41, 59, 0.98)',
                color: 'var(--text)'
            });
        }
    }

    let pdfRotationAngle = 0;
    let currentActiveBlobUrl = null;
    const activeCachingIds = new Set();

    function updateCacheStatusPill(isCached, isCaching = false) {
        const pill = document.getElementById('pdfCacheStatusPill');
        if (!pill) return;

        if (isCaching) {
            pill.classList.remove('hidden');
            pill.classList.add('caching');
            pill.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Caching offline...</span>';
        } else if (isCached) {
            pill.classList.remove('hidden');
            pill.classList.remove('caching');
            pill.innerHTML = '<i class="fa-solid fa-bolt" style="color: #10b981;"></i> <span>Cached Offline</span>';
        } else {
            pill.classList.add('hidden');
        }
    }

    async function autoCachePdfInBackground(manual) {
        if (!manual || !manual.id) return;
        if (activeCachingIds.has(manual.id)) return;

        // Check if already cached
        const existing = await getCachedPdf(manual.id);
        if (existing && existing.blob) {
            if (activePdfManual && activePdfManual.id === manual.id) {
                updateCacheStatusPill(true, false);
            }
            return;
        }

        activeCachingIds.add(manual.id);
        if (activePdfManual && activePdfManual.id === manual.id) {
            updateCacheStatusPill(false, true);
        }

        try {
            const dlUrl = manual.downloadUrl || `https://drive.google.com/uc?export=download&id=${manual.id}`;
            const resp = await fetch(dlUrl);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const blob = await resp.blob();

            await savePdfToCache(manual, blob);

            // If the viewer is currently showing this manual, switch to local blob URL for high speed & offline support
            if (activePdfManual && activePdfManual.id === manual.id) {
                updateCacheStatusPill(true, false);
                const frame = document.getElementById('pdfViewerFrame');
                if (frame && (!currentActiveBlobUrl || frame.src === manual.previewUrl)) {
                    if (currentActiveBlobUrl) URL.revokeObjectURL(currentActiveBlobUrl);
                    currentActiveBlobUrl = URL.createObjectURL(blob);
                    frame.src = currentActiveBlobUrl;
                }
            }

            // Update list badges
            renderManuals(currentManualsList);
            if (typeof renderLhbManuals === 'function') {
                renderLhbManuals(currentLhbManualsList);
            }
        } catch (err) {
            console.warn('Background auto-caching skipped/failed:', err);
            if (activePdfManual && activePdfManual.id === manual.id) {
                updateCacheStatusPill(false, false);
            }
        } finally {
            activeCachingIds.delete(manual.id);
        }
    }

    function renderManuals(list) {
        const container = document.getElementById('manualsListContainer');
        if (!container) return;

        if (!list || list.length === 0) {
            container.innerHTML = `
            <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
                <i class="fa-solid fa-folder-open" style="font-size: 2.5rem; color: var(--text-muted); margin-bottom: 0.5rem; display: block;"></i>
                <p style="margin: 0; font-size: 0.9rem;">No PDF manuals found in Google Drive folder.</p>
            </div>
        `;
            return;
        }

        container.innerHTML = '';
        list.forEach(item => {
            const row = document.createElement('div');
            row.className = 'manual-list-item slide-up';
            row.style.cursor = 'pointer';
            row.onclick = () => openPdfViewer(item.id);

            row.innerHTML = `
            <div class="manual-item-left">
                <div class="manual-item-icon">
                    <i class="fa-solid fa-file-pdf"></i>
                </div>
                <div class="manual-item-details">
                    <h4 class="manual-item-title">${escapeHtml(item.name)} <span class="manual-cached-badge hidden" id="wsp-cached-badge-${item.id}" title="Cached Offline"><i class="fa-solid fa-bolt"></i></span></h4>
                </div>
            </div>
            <div class="manual-item-right">
                <i class="fa-solid fa-chevron-right chevron" style="color: var(--text-muted); font-size: 0.8rem; opacity: 0.7; transition: transform 0.2s ease;"></i>
            </div>
        `;
            container.appendChild(row);

            // Check cache asynchronously
            if (typeof getCachedPdf === 'function') {
                getCachedPdf(item.id).then(cached => {
                    if (cached) {
                        const badge = document.getElementById(`wsp-cached-badge-${item.id}`);
                        if (badge) badge.classList.remove('hidden');
                    }
                }).catch(() => {});
            }
        });
    }

    function renderLhbManuals(list) {
        const container = document.getElementById('lhbManualsListContainer');
        if (!container) return;

        if (!list || list.length === 0) {
            container.innerHTML = `
            <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
                <i class="fa-solid fa-folder-open" style="font-size: 2.5rem; color: var(--text-muted); margin-bottom: 0.5rem; display: block;"></i>
                <p style="margin: 0; font-size: 0.9rem;">No PDF manuals found in Google Drive folder.</p>
                <a href="${DEFAULT_LHB_MANUALS_DRIVE_URL}" target="_blank" rel="noopener" class="btn primary-btn" style="margin-top: 1rem; display: inline-flex; align-items: center; gap: 8px;">
                    <i class="fa-brands fa-google-drive"></i> Open Folder in Drive
                </a>
            </div>
        `;
            return;
        }

        container.innerHTML = '';
        list.forEach(item => {
            const row = document.createElement('div');
            row.className = 'manual-list-item lhb-item slide-up';
            row.style.borderLeftColor = '#10b981';
            row.style.cursor = 'pointer';
            row.onclick = () => openPdfViewer(item.id);

            row.innerHTML = `
            <div class="manual-item-left">
                <div class="manual-item-icon" style="background: rgba(16, 185, 129, 0.15); color: #10b981;">
                    <i class="fa-solid fa-file-pdf"></i>
                </div>
                <div class="manual-item-details">
                    <h4 class="manual-item-title">${escapeHtml(item.name)} <span class="manual-cached-badge hidden" id="lhb-cached-badge-${item.id}" title="Cached Offline"><i class="fa-solid fa-bolt"></i></span></h4>
                </div>
            </div>
            <div class="manual-item-right">
                <i class="fa-solid fa-chevron-right chevron" style="color: var(--text-muted); font-size: 0.8rem; opacity: 0.7; transition: transform 0.2s ease;"></i>
            </div>
        `;
            container.appendChild(row);

            // Check cache asynchronously
            if (typeof getCachedPdf === 'function') {
                getCachedPdf(item.id).then(cached => {
                    if (cached) {
                        const badge = document.getElementById(`lhb-cached-badge-${item.id}`);
                        if (badge) badge.classList.remove('hidden');
                    }
                }).catch(() => {});
            }
        });
    }

    function findManualById(id) {
        return currentManualsList.find(m => m.id === id) ||
            INITIAL_WSP_MANUALS.find(m => m.id === id) ||
            currentLhbManualsList.find(m => m.id === id) ||
            INITIAL_LHB_MANUALS.find(m => m.id === id);
    }

    async function openPdfViewer(id) {
        const manual = findManualById(id);
        if (!manual) return;

        activePdfManual = manual;
        const modal = document.getElementById('pdfViewerModal');
        const titleEl = document.getElementById('pdfViewerTitle');
        const frame = document.getElementById('pdfViewerFrame');

        if (titleEl) titleEl.textContent = manual.name;

        // Reset Zoom & Rotation
        resetPdfZoom();

        // Check if cached in IndexedDB for instant offline opening
        const cached = await getCachedPdf(manual.id);
        if (cached && cached.blob) {
            if (currentActiveBlobUrl) URL.revokeObjectURL(currentActiveBlobUrl);
            currentActiveBlobUrl = URL.createObjectURL(cached.blob);
            if (frame) frame.src = currentActiveBlobUrl;
            updateCacheStatusPill(true, false);
        } else {
            // Load immediately via Google Drive preview so user doesn't wait
            if (frame) frame.src = manual.previewUrl;
            updateCacheStatusPill(false, true);
            // Automatically cache in the background for offline & instant re-open
            autoCachePdfInBackground(manual);
        }

        if (modal) {
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            pushModalState('pdfViewerModal');
        }
    }

    function closePdfViewer(fromBack = false) {
        const modal = document.getElementById('pdfViewerModal');
        const frame = document.getElementById('pdfViewerFrame');

        if (currentActiveBlobUrl) {
            URL.revokeObjectURL(currentActiveBlobUrl);
            currentActiveBlobUrl = null;
        }
        if (frame) frame.src = 'about:blank';
        if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }
        document.body.style.overflow = '';
        activePdfManual = null;
        pdfRotationAngle = 0;

        if (!fromBack && !isHandlingPopState && window.history.state && window.history.state.modal === 'pdfViewerModal') {
            window.history.back();
        }
    }

    function updatePdfTransform() {
        const viewport = document.getElementById('pdfZoomViewport');
        const modalBody = document.getElementById('pdfModalBody');
        if (!viewport) return;

        const isPerpendicular = (pdfRotationAngle === 90 || pdfRotationAngle === 270);

        if (isPerpendicular && modalBody) {
            const bodyWidth = modalBody.clientWidth || window.innerWidth;
            const bodyHeight = modalBody.clientHeight || (window.innerHeight - 100);
            viewport.style.width = `${bodyHeight}px`;
            viewport.style.height = `${bodyWidth}px`;
        } else {
            viewport.style.width = '100%';
            viewport.style.height = '100%';
        }

        viewport.style.transformOrigin = 'center center';
        viewport.style.transform = `scale(${pdfZoomScale}) rotate(${pdfRotationAngle}deg)`;
    }

    function zoomPdf(delta) {
        pdfZoomScale = Math.min(3.0, Math.max(0.5, pdfZoomScale + delta));
        const zoomValEl = document.getElementById('pdfZoomVal');
        if (zoomValEl) zoomValEl.textContent = Math.round(pdfZoomScale * 100) + '%';
        updatePdfTransform();
    }

    function rotatePdf(degrees = 90) {
        pdfRotationAngle = (pdfRotationAngle + degrees) % 360;
        if (pdfRotationAngle < 0) pdfRotationAngle += 360;
        const rotateValEl = document.getElementById('pdfRotateVal');
        if (rotateValEl) rotateValEl.textContent = `${pdfRotationAngle}°`;
        updatePdfTransform();
    }

    function resetPdfZoom() {
        pdfZoomScale = 1.0;
        pdfRotationAngle = 0;
        const zoomValEl = document.getElementById('pdfZoomVal');
        const rotateValEl = document.getElementById('pdfRotateVal');

        if (zoomValEl) zoomValEl.textContent = '100%';
        if (rotateValEl) rotateValEl.textContent = '0°';
        updatePdfTransform();
    }

    window.addEventListener('resize', () => {
        if (activePdfManual && (pdfRotationAngle === 90 || pdfRotationAngle === 270)) {
            updatePdfTransform();
        }
    });

    function shareActivePdf() {
        if (!activePdfManual) return;
        shareManualObject(activePdfManual);
    }

    function shareManualById(id) {
        const manual = findManualById(id);
        if (manual) shareManualObject(manual);
    }

    function shareManualObject(manual) {
        const shareUrl = manual.viewUrl || manual.previewUrl || `https://drive.google.com/file/d/${manual.id}/view?usp=sharing`;

        if (navigator.share) {
            navigator.share({
                title: manual.name,
                text: `Railway WSP Manual: ${manual.name}`,
                url: shareUrl
            }).catch(err => {
                if (err.name !== 'AbortError') copyPdfLink(shareUrl);
            });
        } else {
            copyPdfLink(shareUrl);
        }
    }

    function copyPdfLink(url) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(() => {
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: 'PDF Link copied to clipboard!',
                    showConfirmButton: false,
                    timer: 2000,
                    background: 'var(--surface)',
                    color: 'var(--text)'
                });
            });
        } else {
            window.prompt('Copy PDF link:', url);
        }
    }

    function downloadActivePdf() {
        if (!activePdfManual) return;
        downloadManualObject(activePdfManual);
    }

    function downloadManualById(id) {
        const manual = findManualById(id);
        if (manual) downloadManualObject(manual);
    }

    function downloadManualObject(manual) {
        const dlUrl = manual.downloadUrl || `https://drive.google.com/uc?export=download&id=${manual.id}`;
        const a = document.createElement('a');
        a.href = dlUrl;
        a.target = '_blank';
        a.download = manual.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function openActivePdfInDrive() {
        if (!activePdfManual) return;
        const driveUrl = activePdfManual.viewUrl || `https://drive.google.com/file/d/${activePdfManual.id}/view?usp=sharing`;
        window.open(driveUrl, '_blank');
    }

    window.loadManualsFromDrive = loadManualsFromDrive;
    window.loadLhbManualsFromDrive = loadLhbManualsFromDrive;
    window.renderManuals = renderManuals;
    window.renderLhbManuals = renderLhbManuals;
    window.openPdfViewer = openPdfViewer;
    window.closePdfViewer = closePdfViewer;
    window.zoomPdf = zoomPdf;
    window.resetPdfZoom = resetPdfZoom;
    window.rotatePdf = rotatePdf;
    window.clearAllPdfCache = clearAllPdfCache;
    window.downloadActivePdf = downloadActivePdf;
    window.shareActivePdf = shareActivePdf;
    window.openActivePdfInDrive = openActivePdfInDrive;

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('wspDefectModal');
            if (modal && !modal.classList.contains('hidden')) {
                closeWspDefectModal();
            }
            const pdfModal = document.getElementById('pdfViewerModal');
            if (pdfModal && !pdfModal.classList.contains('hidden')) {
                closePdfViewer();
            }
        }
    });

    // ==========================================
    // WSP DEFECT & INSPECTION PDF REPORT GENERATION
    // ==========================================

    function getPdfFieldVal(data, ...keys) {
        if (!data) return '-';
        for (const k of keys) {
            if (data[k] !== undefined && data[k] !== null && String(data[k]).trim() !== '') {
                return String(data[k]).trim();
            }
            const lowerK = k.toLowerCase().trim();
            const foundKey = Object.keys(data).find(ek => ek.toLowerCase().trim() === lowerK);
            if (foundKey && data[foundKey] !== undefined && data[foundKey] !== null && String(data[foundKey]).trim() !== '') {
                return String(data[foundKey]).trim();
            }
        }
        return '-';
    }

    function getFormDataAsObject() {
        const gVal = (id) => (document.getElementById(id) ? document.getElementById(id).value : '');
        const downloadDateStr = gVal('wspDownloadDate');
        let monthName = '';
        if (downloadDateStr) {
            try {
                const d = new Date(downloadDateStr);
                monthName = d.toLocaleString('default', { month: 'long' });
            } catch (_) { }
        }

        return {
            coachNumber: gVal('wspDefectCoachNum') || gVal('wspFormCoachNum'),
            coachType: gVal('wspFormCoachType'),
            trainNumber: gVal('wspFormTrainNo'),
            wspMake: gVal('wspFormWspd'),
            downloadDate: downloadDateStr,
            month: monthName,
            wheelCondition: gVal('wspWheelCondition'),
            wspCode: gVal('wspCode'),
            psStatus: gVal('wspPsStatus'),

            // Section 2: Batch Data
            phonicWheelCondition: gVal('wspPhonicWheelCondition'),
            ventingSound: gVal('wspVentingSound'),
            kmReadingDeficiency: gVal('wspKmReadingDeficiency'),
            bcPressure: gVal('wspBcPressure'),
            dvReleaseTime: gVal('wspDvReleaseTime'),
            dumpValveChokeMod: gVal('wspDumpValveChokeMod'),
            dumpValve: gVal('wspDumpValve'),
            chokeFilterCondition: gVal('wspChokeFilterCondition'),
            sensorGap: gVal('wspSensorGap'),
            hosePipeMod: gVal('wspHosePipeMod'),

            // Section 3A: Modification Status
            milConnector: gVal('wspMilConnector'),
            jbMounting: gVal('wspJbMounting'),
            reroutingSensorCable: gVal('wspReroutingSensorCable'),
            jbCover: gVal('wspJbCover'),
            jbOrientation: gVal('wspJbOrientation'),

            // Section 3B: Underframe Observation
            waterIngress: gVal('wspWaterIngress'),
            sensorProbeCondition: gVal('wspSensorProbeCondition'),
            correctSensorMake: gVal('wspCorrectSensorMake'),
            correctDvMake: gVal('wspCorrectDvMake'),
            crossSensorWiring: gVal('wspCrossSensorWiring'),
            crossDvWiring: gVal('wspCrossDvWiring'),
            dvPinCondition: gVal('wspDvPinCondition'),

            // Section 4: WSP Panel Observations
            rbcStatus: gVal('wspRbcStatus'),
            ksRelayTimer: gVal('wspKsRelayTimer'),
            mcbTripping: gVal('wspMcbTripping'),
            mcbFuseRating: gVal('wspMcbFuseRating'),
            ledGlow: gVal('wspLedGlow'),
            dvExcessiveActivation: gVal('wspDvExcessiveActivation'),
            continuousFaultAxle: gVal('wspContinuousFaultAxle'),
            psBypass: gVal('wspPsBypass'),
            sleepMode: gVal('wspSleepMode'),
            dateTimeSync: gVal('wspDateTimeSync'),
            powerOnIssues: gVal('wspPowerOnIssues'),
            speedVariation: gVal('wspSpeedVariation'),
            defectCategory: gVal('wspDefectCategory'),
            observation: gVal('wspObservation'),
            otherObservation: gVal('wspOtherObservation'),
            description: gVal('wspDescription'),

            // Section 5: Attention & Conclusion
            defectCorrelated: gVal('wspDefectCorrelated'),
            attention: gVal('wspAttention'),
            followUpRemarks: gVal('wspFollowUpRemarks'),
            itemRequired: gVal('wspItemRequired'),
            anyWorkPending: gVal('wspAnyWorkPending'),
            pendingWorkDesc: gVal('wspPendingWorkDesc'),
            checklistSubmitted: gVal('wspChecklist'),
            dataEntryBy: gVal('wspDataEntryBy')
        };
    }
    window.getFormDataAsObject = getFormDataAsObject;

    function buildWspPdfReportHtml(data) {
        const fVal = (...keys) => getPdfFieldVal(data, ...keys);

        const coachNum = fVal('Coach No', 'COACH NO', 'coachNumber', 'coach no', 'coach num');
        const coachType = fVal('Coach Type', 'coachType', 'coach type');
        const trainNum = fVal('DB Train No', 'Train Number', 'trainNumber', 'train no');
        const wspMake = fVal('Type of WSPD', 'WSP Make', 'wspMake', 'type of wspd');
        const rawDate = fVal('Download Date', 'downloadDate', 'download date');
        const downloadDate = rawDate !== '-' ? formatDateDMY(rawDate) : '-';
        const wheelCondition = fVal('Wheel condition', 'wheelCondition', 'wheel condition');
        const wspCode = fVal('wsp code', 'wspCode');
        const psStatus = fVal('PS status', 'psStatus');

        // Section 2
        const phonicWheel = fVal('Condition of Phonic Wheel', 'phonicWheelCondition');
        const ventingSound = fVal('Venting Sound', 'ventingSound');
        const kmDeficiency = fVal('KM Reading Deficiency', 'kmReadingDeficiency');
        const bcPressure = fVal('BC Pressure', 'bcPressure');
        const dvReleaseTime = fVal('DV Release Time', 'dvReleaseTime');
        const dvChokeMod = fVal('Dump Valve Choke Mod', 'dumpValveChokeMod');
        const dumpValve = fVal('Self test dump valve', 'dumpValve');
        const chokeFilter = fVal('Choke Filter Condition', 'chokeFilterCondition');
        const sensorGap = fVal('Sensor gap', 'sensorGap', 'Sensor Gap', 'sensor_gap', 'Air Gap between Phonic Wheel & Sensor (sensor gap)', 'Air Gap between Phonic Wheel & Sensor', 'Air gap', 'air gap');
        const hosePipeMod = fVal('Hose Pipe Mod', 'hosePipeMod');

        // Section 3A
        const milConnector = fVal('MIL Connector Compliance', 'milConnector');
        const jbMounting = fVal('JB Mounting Compliance', 'jbMounting');
        const cableReroute = fVal('Sensor Cable Rerouting', 'reroutingSensorCable');
        const jbCover = fVal('JB Protection Cover', 'jbCover');
        const jbOrientation = fVal('JB Orientation Compliance', 'jbOrientation');

        // Section 3B
        const waterIngress = fVal('Water Ingress in Connectors', 'waterIngress');
        const sensorProbe = fVal('Sensor Probe Condition', 'sensorProbeCondition');
        const correctSensor = fVal('Correct Sensor Make & Type', 'correctSensorMake');
        const correctDv = fVal('Correct DV Make & Type', 'correctDvMake');
        const crossSensor = fVal('Cross Sensor Wiring', 'crossSensorWiring');
        const crossDv = fVal('Cross DV Wiring', 'crossDvWiring');
        const dvPin = fVal('DV Pin Condition', 'dvPinCondition');

        // Section 4
        const rbcStatus = fVal('RBC Power Supply Status', 'rbcStatus');
        const ksTimer = fVal('KS Relay Timer', 'ksRelayTimer');
        const mcbTripping = fVal('MCB Tripping', 'mcbTripping');
        const mcbFuseRating = fVal('MCB/Fuse Rating', 'mcbFuseRating');
        const ledGlow = fVal('LED Glow Status', 'ledGlow');
        const dvActivation = fVal('DV Excessive Activation', 'dvExcessiveActivation');
        const faultAxle = fVal('Continuous Fault Axle', 'continuousFaultAxle');
        const psBypass = fVal('PS Bypass Status', 'psBypass');
        const sleepMode = fVal('Sleep Mode Status', 'sleepMode');
        const dateTimeSync = fVal('DateTime Sync Status', 'dateTimeSync');
        const powerOnIssues = fVal('Power On Issues', 'powerOnIssues');
        const speedVariation = fVal('Speed Variation Status', 'speedVariation');
        const defectCat = fVal('defect category', 'defectCategory');
        const observation = fVal('downloading observation', 'downloading obseravtion', 'observation');
        const otherObs = fVal('OTHER OBSERVATION', 'otherObservation');
        const desc = fVal('DEFECT DESCRIPTION', 'description');

        // Section 5
        const correlated = fVal('Defect Correlated with WSPD', 'defectCorrelated');
        const attention = fVal('ATTENTION IF ANY', 'attention');
        const followUpRemarks = fVal('FOLLOU UP REMARKS', 'follow up remarks', 'follo up', 'follow up', 'followUpRemarks');
        const itemRequired = fVal('ITEM REQUIRED / USED', 'itemRequired');
        const anyPending = fVal('Pending Work', 'ANY WORK PENDING', 'anyWorkPending');
        const pendingDesc = fVal('PENDING WORK DESCRIPTION', 'pendingWorkDesc');
        const checklist = fVal('CHECKLIST SUBMITTED', 'checklistSubmitted');
        const dataEntryBy = fVal('Data Entry By', 'dataEntryBy');

        const generatedOn = new Date().toLocaleString('en-IN', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true
        });

        return `
    <div class="wsp-pdf-sheet" id="wspPdfPage1" style="background: #ffffff; color: #000000; width: 1060px; box-sizing: border-box; padding: 12px 18px; margin: 0 auto; font-family: Arial, Helvetica, sans-serif; font-size: 10px; line-height: 1.25; position: relative; font-weight: 700;">
        <!-- HEADER -->
        <div style="border-bottom: 2.5px solid #1e3a8a; padding-bottom: 3px; margin-bottom: 6px; text-align: center;">
            <div style="font-size: 15px; font-weight: 800; color: #1e3a8a; letter-spacing: 0.6px; text-transform: uppercase;">
                SOUTH WESTERN RAILWAY &bull; BENGALURU DIVISION
            </div>
            <div style="font-size: 12px; font-weight: 800; color: #000000; margin-top: 1px; letter-spacing: 0.5px;">
                SBC COACHING DEPOT- WSP CHECKLIST
            </div>
        </div>

        <!-- Section 1: Header & Basic Coach Information (Full Width 2 Rows) -->
        <div style="margin-bottom: 6px;">
            <div style="background: #1e3a8a !important; color: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; font-weight: 800; font-size: 10px; padding: 2.5px 8px; border-radius: 3px 3px 0 0; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #1e3a8a;">
                Section 1: Header &amp; Basic Coach Information
            </div>
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #94a3b8; font-size: 10px; font-weight: 700; color: #000000;">
                <tr>
                    <td style="width: 13%; background: #f1f5f9; font-weight: 800; color: #000000; padding: 2.5px 5px; border: 1px solid #cbd5e1;">Coach Number:</td>
                    <td style="width: 20%; font-weight: 800; color: #1e3a8a; padding: 2.5px 5px; border: 1px solid #cbd5e1;">${coachNum}</td>
                    <td style="width: 13%; background: #f1f5f9; font-weight: 800; color: #000000; padding: 2.5px 5px; border: 1px solid #cbd5e1;">Coach Type:</td>
                    <td style="width: 20%; font-weight: 700; color: #000000; padding: 2.5px 5px; border: 1px solid #cbd5e1;">${coachType}</td>
                    <td style="width: 14%; background: #f1f5f9; font-weight: 800; color: #000000; padding: 2.5px 5px; border: 1px solid #cbd5e1;">Train Number:</td>
                    <td style="width: 20%; font-weight: 700; color: #000000; padding: 2.5px 5px; border: 1px solid #cbd5e1;">${trainNum}</td>
                </tr>
                <tr>
                    <td style="background: #f1f5f9; font-weight: 800; color: #000000; padding: 2.5px 5px; border: 1px solid #cbd5e1;">WSPD Make:</td>
                    <td style="font-weight: 700; color: #000000; padding: 2.5px 5px; border: 1px solid #cbd5e1;">${wspMake}</td>
                    <td style="background: #f1f5f9; font-weight: 800; color: #000000; padding: 2.5px 5px; border: 1px solid #cbd5e1;">Download Date:</td>
                    <td style="font-weight: 700; color: #000000; padding: 2.5px 5px; border: 1px solid #cbd5e1;">${downloadDate}</td>
                    <td style="background: #f1f5f9; font-weight: 800; color: #000000; padding: 2.5px 5px; border: 1px solid #cbd5e1;">Wheel Condition:</td>
                    <td style="font-weight: 800; padding: 2.5px 5px; border: 1px solid #cbd5e1; color: ${wheelCondition !== 'Normal' && wheelCondition !== 'ok' && wheelCondition !== '-' ? '#b91c1c' : '#000000'};">${wheelCondition}</td>
                </tr>
            </table>
        </div>

        <!-- Middle 2-Column Split: Left Column (Sec 2, Sec 3A & 3B) | Right Column (Sec 4, Sec 5, Sec 6) -->
        <div style="display: flex; gap: 8px; margin-bottom: 6px;">
            <!-- LEFT COLUMN -->
            <div style="flex: 1; display: flex; flex-direction: column; gap: 5px;">
                <!-- Section 2: Data Filled by Batch -->
                <div>
                    <div style="background: #1e3a8a !important; color: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; font-weight: 800; font-size: 9.5px; padding: 2.5px 6px; border-radius: 3px 3px 0 0; text-transform: uppercase; letter-spacing: 0.4px; border: 1px solid #1e3a8a;">
                        Section 2: Diagnostics &amp; Mechanical Checks
                    </div>
                    <table style="width: 100%; border-collapse: collapse; border: 1px solid #94a3b8; font-size: 9.2px; font-weight: 700; color: #000000;">
                        <tr>
                            <td style="width: 32%; background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">Phonic Wheel Condition:</td>
                            <td style="width: 18%; font-weight: 700; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">${phonicWheel}</td>
                            <td style="width: 32%; background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">Venting Sound from DV:</td>
                            <td style="width: 18%; font-weight: 700; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">${ventingSound}</td>
                        </tr>
                        <tr>
                            <td style="background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">KM Reading Deficiency:</td>
                            <td style="font-weight: 700; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">${kmDeficiency}</td>
                            <td style="background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">BC Pressure:</td>
                            <td style="font-weight: 700; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">${bcPressure}</td>
                        </tr>
                        <tr>
                            <td style="background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">DV Release Time:</td>
                            <td style="font-weight: 700; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">${dvReleaseTime}</td>
                            <td style="background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">Dump Valve Choke Mod:</td>
                            <td style="font-weight: 700; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">${dvChokeMod}</td>
                        </tr>
                        <tr>
                            <td style="background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">Self-test of Dump Valve:</td>
                            <td style="font-weight: 700; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">${dumpValve}</td>
                            <td style="background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">Choke Filter Condition:</td>
                            <td style="font-weight: 700; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">${chokeFilter}</td>
                        </tr>
                        <tr>
                            <td style="background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">Sensor Probe Air Gap:</td>
                            <td style="font-weight: 700; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">${sensorGap}</td>
                            <td style="background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">Hose Pipe Mod Status:</td>
                            <td style="font-weight: 700; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">${hosePipeMod}</td>
                        </tr>
                    </table>
                </div>

                <!-- Section 3: Sec 3A & Sec 3B Side by Side -->
                <div style="display: flex; gap: 6px;">
                    <!-- Sec 3A -->
                    <div style="flex: 1;">
                        <div style="background: #1e3a8a !important; color: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; font-weight: 800; font-size: 9px; padding: 2.5px 5px; border-radius: 3px 3px 0 0; text-transform: uppercase; letter-spacing: 0.3px; border: 1px solid #1e3a8a;">
                            Sec 3A: Modification Compliance
                        </div>
                        <table style="width: 100%; border-collapse: collapse; border: 1px solid #94a3b8; font-size: 8.8px; font-weight: 700; color: #000000;">
                            <tr>
                                <td style="width: 60%; background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">Revised Wiring MIL Conn:</td>
                                <td style="width: 40%; font-weight: 700; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">${milConnector}</td>
                            </tr>
                            <tr>
                                <td style="background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">JB Mounting Standard:</td>
                                <td style="font-weight: 700; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">${jbMounting}</td>
                            </tr>
                            <tr>
                                <td style="background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">Sensor Cable Rerouting:</td>
                                <td style="font-weight: 700; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">${cableReroute}</td>
                            </tr>
                            <tr>
                                <td style="background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">JB Protection Cover:</td>
                                <td style="font-weight: 700; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">${jbCover}</td>
                            </tr>
                            <tr>
                                <td style="background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">JB Orientation Standard:</td>
                                <td style="font-weight: 700; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">${jbOrientation}</td>
                            </tr>
                            <tr>
                                <td style="background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">Dump Valve Connector Pins:</td>
                                <td style="font-weight: 700; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">${dvPin}</td>
                            </tr>
                        </table>
                    </div>
                    <!-- Sec 3B -->
                    <div style="flex: 1;">
                        <div style="background: #1e3a8a !important; color: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; font-weight: 800; font-size: 9px; padding: 2.5px 5px; border-radius: 3px 3px 0 0; text-transform: uppercase; letter-spacing: 0.3px; border: 1px solid #1e3a8a;">
                            Sec 3B: Underframe Observations
                        </div>
                        <table style="width: 100%; border-collapse: collapse; border: 1px solid #94a3b8; font-size: 8.8px; font-weight: 700; color: #000000;">
                            <tr>
                                <td style="width: 60%; background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">Water Ingress in Connectors:</td>
                                <td style="width: 40%; font-weight: 700; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">${waterIngress}</td>
                            </tr>
                            <tr>
                                <td style="background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">Speed Sensor Probe Cond:</td>
                                <td style="font-weight: 700; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">${sensorProbe}</td>
                            </tr>
                            <tr>
                                <td style="background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">Correct Sensor Make &amp; Type:</td>
                                <td style="font-weight: 700; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">${correctSensor}</td>
                            </tr>
                            <tr>
                                <td style="background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">Correct Dump Valve Make:</td>
                                <td style="font-weight: 700; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">${correctDv}</td>
                            </tr>
                            <tr>
                                <td style="background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">Cross Sensor Wiring:</td>
                                <td style="font-weight: 700; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">${crossSensor}</td>
                            </tr>
                            <tr>
                                <td style="background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">Cross Dump Valve Wiring:</td>
                                <td style="font-weight: 700; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">${crossDv}</td>
                            </tr>
                        </table>
                    </div>
                </div>
            </div>

            <!-- RIGHT COLUMN -->
            <div style="flex: 1; display: flex; flex-direction: column; gap: 5px;">
                <!-- Section 4: WSP Panel -->
                <div>
                    <div style="background: #1e3a8a !important; color: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; font-weight: 800; font-size: 9.5px; padding: 2.5px 6px; border-radius: 3px 3px 0 0; text-transform: uppercase; letter-spacing: 0.4px; border: 1px solid #1e3a8a;">
                        Section 4: WSP Panel
                    </div>
                    <table style="width: 100%; border-collapse: collapse; border: 1px solid #94a3b8; font-size: 9.2px; font-weight: 700; color: #000000;">
                        <tr>
                            <td style="width: 32%; background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">RBC Power Supply:</td>
                            <td style="width: 18%; font-weight: 700; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">${rbcStatus}</td>
                            <td style="width: 32%; background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">KS Relay Timer Setting:</td>
                            <td style="width: 18%; font-weight: 700; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">${ksTimer}</td>
                        </tr>
                        <tr>
                            <td style="background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">MCB Tripping:</td>
                            <td style="font-weight: 700; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">${mcbTripping}</td>
                            <td style="background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">Correct Rating MCB/Fuse:</td>
                            <td style="font-weight: 700; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">${mcbFuseRating}</td>
                        </tr>
                        <tr>
                            <td style="background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">Fault LED Glow on Panel:</td>
                            <td style="font-weight: 700; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">${ledGlow}</td>
                            <td style="background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">Bypass of Pressure Switch:</td>
                            <td style="font-weight: 700; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">${psBypass}</td>
                        </tr>
                        <tr>
                            <td style="background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">WSP Error Code:</td>
                            <td style="font-weight: 800; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">${wspCode}</td>
                            <td style="background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">Pressure Switch Status:</td>
                            <td style="font-weight: 800; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">${psStatus}</td>
                        </tr>
                        <tr>
                            <td style="background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">Sleep Mode of WSPD:</td>
                            <td colspan="3" style="font-weight: 700; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">${sleepMode}</td>
                        </tr>
                    </table>
                </div>

                <!-- Section 5: Download Observation -->
                <div>
                    <div style="background: #1e3a8a !important; color: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; font-weight: 800; font-size: 9.5px; padding: 2.5px 6px; border-radius: 3px 3px 0 0; text-transform: uppercase; letter-spacing: 0.4px; border: 1px solid #1e3a8a;">
                        Section 5: Download Observation
                    </div>
                    <table style="width: 100%; border-collapse: collapse; border: 1px solid #94a3b8; font-size: 9.2px; font-weight: 700; color: #000000;">
                        <tr>
                            <td style="width: 32%; background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">DV Activated More Times:</td>
                            <td style="width: 18%; font-weight: 700; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">${dvActivation}</td>
                            <td style="width: 32%; background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">Continuous Fault Axle:</td>
                            <td style="width: 18%; font-weight: 700; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">${faultAxle}</td>
                        </tr>
                        <tr>
                            <td style="background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">Date/Time Synchronisation:</td>
                            <td style="font-weight: 700; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">${dateTimeSync}</td>
                            <td style="background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">Power On Issues Noticed:</td>
                            <td style="font-weight: 700; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">${powerOnIssues}</td>
                        </tr>
                        <tr>
                            <td style="background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">Speed Variation in Axle:</td>
                            <td colspan="3" style="font-weight: 700; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">${speedVariation}</td>
                        </tr>
                        <tr>
                            <td style="background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">Downloading Observation:</td>
                            <td colspan="3" style="font-weight: 700; color: #000000; padding: 2px 4px; border: 1px solid #cbd5e1;">${observation}</td>
                        </tr>
                    </table>
                </div>
            </div>
        </div>

        <!-- Section 6: Conclusion (FULL WIDTH ACROSS BOTTOM) -->
        <div style="margin-bottom: 6px;">
            <div style="background: #1e3a8a !important; color: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; font-weight: 800; font-size: 9.8px; padding: 2.5px 8px; border-radius: 3px 3px 0 0; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #1e3a8a;">
                Section 6: Conclusion
            </div>
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #94a3b8; font-size: 9.3px; font-weight: 700; color: #000000;">
                <tr>
                    <td style="width: 13%; background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 5px; border: 1px solid #cbd5e1;">Defect Category:</td>
                    <td style="width: 20%; font-weight: 800; color: #b91c1c; padding: 2px 5px; border: 1px solid #cbd5e1;">${defectCat}</td>
                    <td style="width: 17%; background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 5px; border: 1px solid #cbd5e1;">Correlated with WSPD:</td>
                    <td style="width: 10%; font-weight: 700; color: #000000; padding: 2px 5px; border: 1px solid #cbd5e1;">${correlated}</td>
                    <td style="width: 14%; background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 5px; border: 1px solid #cbd5e1;">Any Work Pending:</td>
                    <td style="width: 14%; font-weight: 800; color: ${anyPending === 'Yes' ? '#b91c1c' : '#15803d'}; padding: 2px 5px; border: 1px solid #cbd5e1;">${anyPending}${anyPending === 'Yes' && pendingDesc && pendingDesc !== '-' ? ' (' + pendingDesc + ')' : ''}</td>
                    <td style="width: 7%; background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 5px; border: 1px solid #cbd5e1;">Staff ID:</td>
                    <td style="width: 5%; font-weight: 700; color: #000000; padding: 2px 5px; border: 1px solid #cbd5e1;">${dataEntryBy}</td>
                </tr>
                <tr>
                    <td style="background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 5px; border: 1px solid #cbd5e1;">Attention Given:</td>
                    <td colspan="3" style="font-weight: 700; color: #000000; padding: 2px 5px; border: 1px solid #cbd5e1;">${attention}</td>
                    <td style="background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 5px; border: 1px solid #cbd5e1;">Item Required / Used:</td>
                    <td colspan="3" style="font-weight: 700; color: #000000; padding: 2px 5px; border: 1px solid #cbd5e1;">${itemRequired}</td>
                </tr>
                <tr>
                    <td style="background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 5px; border: 1px solid #cbd5e1;">Other Observation:</td>
                    <td colspan="7" style="font-weight: 700; color: #000000; padding: 2px 5px; border: 1px solid #cbd5e1;">${otherObs}</td>
                </tr>
                <tr>
                    <td style="background: #f1f5f9; font-weight: 800; color: #000000; padding: 2px 5px; border: 1px solid #cbd5e1;">Defect Description:</td>
                    <td colspan="7" style="font-weight: 700; color: #000000; padding: 2px 5px; border: 1px solid #cbd5e1;">${desc}</td>
                </tr>
            </table>
        </div>

        <!-- Signatures Block -->
        <div style="margin-top: 6px; border-top: 1px dashed #94a3b8; padding-top: 4px; display: flex; justify-content: space-around; align-items: flex-end;">
            <div style="text-align: center; width: 30%;">
                <div style="height: 20px; border-bottom: 1px solid #94a3b8; margin-bottom: 2px;"></div>
                <div style="font-weight: 800; font-size: 10px; color: #000000; letter-spacing: 0.3px;">SSE/WSPD</div>
            </div>
            <div style="text-align: center; width: 30%;">
                <div style="height: 20px; border-bottom: 1px solid #94a3b8; margin-bottom: 2px;"></div>
                <div style="font-weight: 800; font-size: 10px; color: #000000; letter-spacing: 0.3px;">SSE/BATCH</div>
            </div>
        </div>

        <!-- Footer Meta -->
        <div style="margin-top: 5px; display: flex; justify-content: space-between; font-size: 8.5px; color: #475569; font-weight: 600; padding-top: 2px; border-top: 1px solid #e2e8f0;">
            <span>Generated from Coach Database PWA &bull; SBC Coaching Depot</span>
            <span>Generated on: ${generatedOn} &bull; Page 1 of 1</span>
        </div>
    </div>
    `;    }

    function buildWspShareText(data) {
        if (!data) return '';
        const fVal = (...keys) => getPdfFieldVal(data, ...keys);
        const coachNo = fVal('Coach No', 'COACH NO', 'coachNumber', 'coach no', 'coach num');
        const coachType = fVal('Coach Type', 'coachType', 'coach type');
        const trainNum = fVal('DB Train No', 'Train Number', 'trainNumber', 'train no');
        const wspMake = fVal('Type of WSPD', 'WSP Make', 'wspMake', 'type of wspd');
        const rawDate = fVal('Download Date', 'downloadDate', 'download date');
        const downloadDate = rawDate !== '-' ? formatDateDMY(rawDate) : 'Today';
        const wheelCondition = fVal('Wheel condition', 'wheelCondition', 'wheel condition');
        const defectCat = fVal('defect category', 'Defect Category', 'defectCategory');
        const wspCode = fVal('wsp code', 'wspCode');
        const psStatus = fVal('PS status', 'psStatus');
        const attention = fVal('ATTENTION IF ANY', 'attention');
        const anyPending = fVal('Pending Work', 'ANY WORK PENDING', 'anyWorkPending');
        const pendingDesc = fVal('PENDING WORK DESCRIPTION', 'pendingWorkDesc');
        const staffId = fVal('Data Entry By', 'dataEntryBy');

        return `🚆 *SOUTH WESTERN RAILWAY • SBC COACHING DEPOT*
📋 *WSP SYSTEM DEFECT & INSPECTION REPORT*
━━━━━━━━━━━━━━━━━━━━━
🔹 *Coach:* ${coachNo} ${coachType && coachType !== '-' ? `(${coachType})` : ''}
🔹 *Train No:* ${trainNum}
🔹 *WSPD Make:* ${wspMake}
🔹 *Download Date:* ${downloadDate}
🔹 *Wheel Condition:* ${wheelCondition}
🔹 *WSP Code / PS:* ${wspCode} / ${psStatus}
🔹 *Defect Category:* ${defectCat}
🔹 *Attention Given:* ${attention}
🔹 *Pending Work:* ${anyPending}${anyPending === 'Yes' && pendingDesc && pendingDesc !== '-' ? ` (${pendingDesc})` : ''}
🔹 *Inspected By:* Staff ID ${staffId}
━━━━━━━━━━━━━━━━━━━━━
_Generated from Coach Database PWA_`;
    }

    async function generateWspPdfBlob(contentElement, filename) {
        if (!contentElement || typeof html2pdf === 'undefined') return null;

        const targetEl = document.getElementById('wspPdfPage1') || contentElement;

        try {
            const opt = {
                margin: [4, 4, 4, 4],
                filename: filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff',
                    scrollY: 0,
                    scrollX: 0
                },
                jsPDF: {
                    unit: 'mm',
                    format: 'a4',
                    orientation: 'landscape'
                },
                pagebreak: { mode: 'avoid-all' }
            };

            const blob = await html2pdf().set(opt).from(targetEl).outputPdf('blob');
            return blob;
        } catch (err) {
            console.error('PDF Blob generation error:', err);
            return null;
        }
    }

    async function openWspPdfPreviewModal(recordOrRowIndex) {
        let data = null;
        if (typeof recordOrRowIndex === 'string' || typeof recordOrRowIndex === 'number') {
            const key = String(recordOrRowIndex);
            data = (window.wspHistoryMap && (window.wspHistoryMap[key] || window.wspHistoryMap[Number(key)] || window.wspHistoryMap['coach_' + key])) ||
                (window.pendingWorkMap && (window.pendingWorkMap[key] || window.pendingWorkMap[Number(key)])) ||
                window.latestCoachHistoryEntry;
        } else if (recordOrRowIndex && typeof recordOrRowIndex === 'object') {
            data = recordOrRowIndex;
        }

        // Fallback to active form or window.latestCoachHistoryEntry if data is missing or empty
        if (!data) {
            data = window.latestCoachHistoryEntry || getFormDataAsObject();
        }

        let coachNo = getPdfFieldVal(data, 'Coach No', 'COACH NO', 'coachNumber', 'coach no', 'coach num');
        if (!coachNo || coachNo === '-' || coachNo === 'COACH') {
            coachNo = document.getElementById('wspResultCoachId')?.innerText?.trim() ||
                document.getElementById('wspCoachNumberInput')?.value?.trim() ||
                document.getElementById('wspDefectCoachNum')?.value?.trim() ||
                document.getElementById('chkCoachNum')?.value?.trim() ||
                (window.activeWspCoachData && window.activeWspCoachData.coachNum) ||
                (window.latestCoachHistoryEntry && getWspField(window.latestCoachHistoryEntry, 'COACH NO', 'Coach No')) || '';
            if (coachNo && coachNo !== 'Coach WSP') {
                data['COACH NO'] = coachNo;
            }
        }

        if (!coachNo || coachNo === '-' || coachNo === 'Coach WSP') {
            showWarningAlert("No coach defect data available to generate PDF.");
            return;
        }

        // Ensure metadata is filled
        if (!getPdfFieldVal(data, 'Coach Type', 'coachType', 'coach type') || getPdfFieldVal(data, 'Coach Type') === '-') {
            if (window.activeWspCoachData?.type) data['Coach Type'] = window.activeWspCoachData.type;
            else if (window.latestCoachHistoryEntry) data['Coach Type'] = getWspField(window.latestCoachHistoryEntry, 'COACH TYPE', 'coach type', 'type');
        }
        if (!getPdfFieldVal(data, 'DB Train No', 'Train Number', 'trainNumber', 'train no') || getPdfFieldVal(data, 'DB Train No') === '-') {
            if (window.activeWspCoachData?.trainNo) data['DB Train No'] = window.activeWspCoachData.trainNo;
            else if (window.latestCoachHistoryEntry) data['DB Train No'] = getWspField(window.latestCoachHistoryEntry, 'TRAIN NO', 'train no');
        }
        if (!getPdfFieldVal(data, 'Type of WSPD', 'WSP Make', 'wspMake', 'type of wspd') || getPdfFieldVal(data, 'Type of WSPD') === '-') {
            if (window.activeWspCoachData?.typeOfWspd) data['Type of WSPD'] = window.activeWspCoachData.typeOfWspd;
            else if (window.latestCoachHistoryEntry) data['Type of WSPD'] = getWspField(window.latestCoachHistoryEntry, 'WSP MAKE', 'wsp make', 'Type of WSPD');
        }
        const checkPdfGap = getPdfFieldVal(data, 'Sensor gap', 'sensorGap', 'sensor gap', 'Sensor Gap', 'Air Gap between Phonic Wheel & Sensor (sensor gap)');
        if (!checkPdfGap || checkPdfGap === '-') {
            const gapFromChk = document.getElementById('chkSensorGap')?.value?.trim();
            const gapFromWsp = document.getElementById('wspSensorGap')?.value?.trim();
            if (gapFromChk && gapFromChk !== '-') data['Sensor gap'] = gapFromChk;
            else if (gapFromWsp && gapFromWsp !== '-') data['Sensor gap'] = gapFromWsp;
        }

        window.currentPdfReportData = data;
        window.currentPdfBlob = null;
        window.currentPdfFile = null;

        const modal = document.getElementById('wspPdfPreviewModal');
        const content = document.getElementById('wspPdfReportContent');
        const titleEl = document.getElementById('wspPdfPreviewTitle');
        const subtitleEl = document.getElementById('wspPdfPreviewSubtitle');

        const rawDate = getPdfFieldVal(data, 'Download Date', 'download date', 'downloadDate');
        const formattedDate = rawDate !== '-' ? formatDateDMY(rawDate) : 'Today';
        const coachType = getPdfFieldVal(data, 'Coach Type', 'coachType', 'coach type');
        const trainNum = getPdfFieldVal(data, 'DB Train No', 'Train Number', 'trainNumber', 'train no');

        if (titleEl) titleEl.textContent = `WSP Checklist Report - Coach ${coachNo}`;
        if (subtitleEl) subtitleEl.innerHTML = `Coach: <strong style="color:#38bdf8;">${coachNo}</strong> ${coachType && coachType !== '-' ? `(${coachType})` : ''} &bull; Date: <strong>${formattedDate}</strong> ${trainNum && trainNum !== '-' ? `&bull; Train: <strong>${trainNum}</strong>` : ''}`;

        if (content) {
            content.innerHTML = buildWspPdfReportHtml(data);
        }

        if (modal) {
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            pushModalState('wspPdfPreviewModal');
        }

        // Prepare PDF file in the background for instant downloading or sharing
        const safeCoach = coachNo.replace(/[^\w-]/g, '_');
        const todayStr = new Date().toISOString().split('T')[0];
        const safeDate = rawDate && rawDate !== '-' ? rawDate.replace(/[^\w-]/g, '_') : todayStr;
        const filename = `WSP_CHECKLIST_${safeCoach}_${safeDate}.pdf`;
        preparePdfBlobInBackground(filename);
    }
    window.openWspPdfPreviewModal = openWspPdfPreviewModal;

    function closeWspPdfPreviewModal(fromBack = false) {
        const modal = document.getElementById('wspPdfPreviewModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }
        document.body.style.overflow = '';
        if (!fromBack && !isHandlingPopState && window.history.state && window.history.state.modal === 'wspPdfPreviewModal') {
            window.history.back();
        }
    }
    window.closeWspPdfPreviewModal = closeWspPdfPreviewModal;

    async function preparePdfBlobInBackground(filename) {
        setTimeout(async () => {
            try {
                const targetEl = document.getElementById('wspPdfPage1') || document.getElementById('wspPdfReportContent');
                if (!targetEl) return;
                const pdfBlob = await generateWspPdfBlob(targetEl, filename);
                if (pdfBlob && pdfBlob.size > 2000) {
                    window.currentPdfBlob = pdfBlob;
                    window.currentPdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });
                }
            } catch (e) {
                console.warn('Background PDF preparation note:', e);
            }
        }, 350);
    }

    async function downloadGeneratedWspPdf() {
        const targetEl = document.getElementById('wspPdfPage1') || document.getElementById('wspPdfReportContent');
        if (!targetEl) return;

        const data = window.currentPdfReportData || getFormDataAsObject();
        const coachNo = getPdfFieldVal(data, 'Coach No', 'COACH NO', 'coachNumber', 'coach no', 'coach num') || 'COACH';
        const rawDate = getPdfFieldVal(data, 'Download Date', 'download date', 'downloadDate');
        const safeCoach = coachNo.replace(/[^\w-]/g, '_');
        const todayStr = new Date().toISOString().split('T')[0];
        const safeDate = rawDate && rawDate !== '-' ? rawDate.replace(/[^\w-]/g, '_') : todayStr;
        const filename = `WSP_CHECKLIST_${safeCoach}_${safeDate}.pdf`;

        const dlBtn = document.getElementById('wspPdfDownloadBtn');
        const origHtml = dlBtn ? dlBtn.innerHTML : '';
        if (dlBtn) {
            dlBtn.disabled = true;
            dlBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Downloading...`;
        }

        try {
            const opt = {
                margin: [4, 4, 4, 4],
                filename: filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff',
                    scrollY: 0,
                    scrollX: 0
                },
                jsPDF: {
                    unit: 'mm',
                    format: 'a4',
                    orientation: 'landscape'
                },
                pagebreak: { mode: 'avoid-all' }
            };

            // Direct save guarantees full rendering and crisp download
            await html2pdf().set(opt).from(targetEl).save(filename);

            Swal.fire({
                icon: 'success',
                title: 'PDF Downloaded!',
                text: `Saved as ${filename}`,
                timer: 2000,
                showConfirmButton: false,
                background: 'var(--surface)',
                color: 'var(--text)'
            });
        } catch (err) {
            console.error('PDF download error:', err);
            Swal.fire({
                icon: 'error',
                title: 'Download Failed',
                text: err.message || 'Could not download PDF. Try the Print button to Save as PDF.',
                background: 'var(--surface)',
                color: 'var(--text)'
            });
        } finally {
            if (dlBtn) {
                dlBtn.disabled = false;
                dlBtn.innerHTML = origHtml;
            }
        }
    }
    window.downloadGeneratedWspPdf = downloadGeneratedWspPdf;

    function shareWspToWhatsApp() {
        const data = window.currentPdfReportData || getFormDataAsObject();
        const text = buildWspShareText(data);
        const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    }
    window.shareWspToWhatsApp = shareWspToWhatsApp;

    function shareWspToTelegram() {
        const data = window.currentPdfReportData || getFormDataAsObject();
        const text = buildWspShareText(data);
        const url = `https://t.me/share/url?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    }
    window.shareWspToTelegram = shareWspToTelegram;

    async function shareWspNative() {
        const shareBtn = document.getElementById('wspPdfShareBtn');
        const origBtnHtml = shareBtn ? shareBtn.innerHTML : '';
        if (shareBtn) {
            shareBtn.disabled = true;
            shareBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Sharing...</span>`;
        }

        try {
            const data = window.currentPdfReportData || getFormDataAsObject();
            const coachNo = getPdfFieldVal(data, 'Coach No', 'COACH NO', 'coachNumber', 'coach no', 'coach num') || 'COACH';
            const rawDate = getPdfFieldVal(data, 'Download Date', 'download date', 'downloadDate');
            const formattedDate = rawDate && rawDate !== '-' ? formatDateDMY(rawDate) : 'Today';
            const text = buildWspShareText(data);
            const safeCoach = coachNo.replace(/[^\w-]/g, '_');
            const todayStr = new Date().toISOString().split('T')[0];
            const safeDate = rawDate && rawDate !== '-' ? rawDate.replace(/[^\w-]/g, '_') : todayStr;
            const filename = `WSP_CHECKLIST_${safeCoach}_${safeDate}.pdf`;

            // Ensure PDF Blob and File are ready for attachment
            let file = window.currentPdfFile;
            if (!file) {
                const content = document.getElementById('wspPdfReportContent');
                let blob = window.currentPdfBlob;
                if (!blob || blob.size < 2000) {
                    if (content) {
                        blob = await generateWspPdfBlob(content, filename);
                    }
                }
                if (blob && blob.size > 2000) {
                    window.currentPdfBlob = blob;
                    file = new File([blob], filename, { type: 'application/pdf' });
                    window.currentPdfFile = file;
                }
            }

            // 1. If Web Share API is available on device/browser
            if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
                // Check if file sharing is supported
                let canShareFiles = false;
                if (file && typeof navigator.canShare === 'function') {
                    try {
                        canShareFiles = navigator.canShare({ files: [file] });
                    } catch (e) {
                        canShareFiles = false;
                    }
                }

                // If file sharing is supported, share the PDF file directly to any app
                if (canShareFiles) {
                    try {
                        await navigator.share({
                            files: [file],
                            title: `WSP Checklist Report - Coach ${coachNo}`,
                            text: `WSP Checklist Report - Coach ${coachNo} (${formattedDate})`
                        });
                        return;
                    } catch (shareErr) {
                        if (shareErr.name === 'AbortError') {
                            // User simply closed or dismissed the share sheet
                            return;
                        }
                        console.warn('File share attempt failed, trying text share fallback:', shareErr);
                    }
                }

                // Fallback to text share sheet if file share is unsupported or failed
                try {
                    await navigator.share({
                        title: `WSP Checklist Report - Coach ${coachNo}`,
                        text: text
                    });
                    return;
                } catch (textErr) {
                    if (textErr.name === 'AbortError') return;
                    console.warn('Text share attempt failed, trying clipboard fallback:', textErr);
                }
            }

            // 2. Desktop fallback (when Web Share API is not supported by browser)
            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                await navigator.clipboard.writeText(text);
                Swal.fire({
                    icon: 'success',
                    title: 'Summary Copied to Clipboard!',
                    text: 'The complete report summary has been copied. You can paste it into WhatsApp, Telegram, Email, or any other app.',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    confirmButtonColor: '#6366f1'
                });
            } else {
                throw new Error("Sharing is not supported on this browser.");
            }
        } catch (err) {
            console.error('Native share error:', err);
            Swal.fire({
                icon: 'warning',
                title: 'Share',
                text: err.message || 'Unable to open share sheet.',
                background: 'var(--surface)',
                color: 'var(--text)'
            });
        } finally {
            if (shareBtn) {
                shareBtn.disabled = false;
                shareBtn.innerHTML = origBtnHtml;
            }
        }
    }
    window.shareWspNative = shareWspNative;

    function printWspPdfReport() {
        window.print();
    }
    window.printWspPdfReport = printWspPdfReport;

    // Map legacy and form calls to the preview modal
    function generateWspDefectPdfFromForm() {
        const data = getFormDataAsObject();
        openWspPdfPreviewModal(data);
    }
    window.generateWspDefectPdfFromForm = generateWspDefectPdfFromForm;

    function generateWspDefectPdf(recordOrRowIndex) {
        openWspPdfPreviewModal(recordOrRowIndex);
    }
    window.generateWspDefectPdf = generateWspDefectPdf;

    // ==========================================
    // SS2 / POH SURVEY MODULE LOGIC & PDF ENGINE
    // ==========================================

    const DEFAULT_POH_SURVEY_HEADERS = [
        "Email address", "Timestamp", "RAILWAY", "COACH TYPE", "COACH NUMBER", "PU",
        "DOM/DOC", "SS2/SS3 SHOP", "RD", "TARE", "KMPH", "CCTV MAKE / number of CCTV",
        "DUAL WATER FILLING", "TYPE OF TOILET", "PFS MAKE",
        "PROVISION OF BYPASS ARRANGEMENT IN FLUSHING",
        "EPPFS/PPFS WATER PRESSURIZER LOCATION", "NRV IN FO LINE",
        "WASHBASIN DRAIN OUT PIPE MOD.", "RFID", "TYPE OF WATER REFILLING",
        "PROVISION OF PAPIS & STATUS", "HASP/SMOKE SAMPLING POINTS  LAVOTORY",
        "PROVISION OF VENTURI ARRAGEMENT", "FIRE DETECTION SYSTEM/FDSS MAKE",
        "FIRE SUPPSSION SYSTEM TYPE", "BRAKE VALVE", "PROVISION OF BRAILLE SIGNAGE",
        "TYPE OF WINDOW", "DOG BOX IN POWER CAR & SLRD",
        "PROVISION OF ODOUR CONTROL SYSTEM", "PROVISION OF ANY SMART MIRROR",
        "N2 CYLINDER OPERATION PROTECTION", "EMERGENCY WINDOW HANDLE", "ACP COVER",
        "RUBBER WASHER BETWEEN S TRAP AND COMMODE CHUTE", "BRAKE SYSTEM MAKE & DV N0",
        "TYPE OF SPRING SECONDARY SUSPENSION", "AIR SPRING MAKE & CAPACITY",
        "LEVELING VALVE MAKE", "FIBA PIPE LINE MODIFICATION IN UF", "TPU IN PS",
        "TPU IN SS", "PROVISION OF FIBA PIPE LINE R1 TO R3", "FIBA DC MODIFICATION",
        "BOGIE FRAME IDENTIFICATION BASED ON PRIMARY VERTICAL BUMP STOP HEIGHT",
        "FIBA MAKE", "WIRE ROPE MOD. FOR QRV", "AIRBRAKE HOSE MOD.", "CBC MAKE",
        "PROVISION OF TRANSITION COUPLING FOR LWLRRM",
        "PROVISION OF TERTIARY LOCKING PIN FOR CBC",
        "PROJECTION OF BP(140MM),FP(200MM)METAL PIPES FROM HEADSTOCK",
        "SPEED SENSOR J.B. ORIENTATION", "SPEED SENSOR J.B. ROUTING",
        "SS JB PROTECTION COVER MODIFICATION", "PROVISION OF MIL GRADE CONNECTOR",
        "MINI PANTRY", "FDS VESDA BEDROLL COMPARTMENT MOD.", "DEFICIENCY IF ANY",
        "ANY NEW FEATURE", "REMARKS", "SS2/SS3 Date"
    ];

    const DEFAULT_CAI_HEADERS = [
        "CAI - Retrofitment of additional water filling arrangement in LHB type coaches",
        "CAI - Standardization of water filling assembly for LHB type AC and including power car and SCN EOG coaches to avoid the problem of spillage of water on platform",
        "CAI - Modification for shifting of EPPFS from underslung to onboard",
        "CAI - Modification of foot operated valve fitted inside and outside to pressmatic type in LWACCNE coaches and Amrit Bharat coaches",
        "CAI - Retrofitment of NRV- 1/4\" in between the isolating cock and air filter regulator lubricator (AFRL) unit of EPPFS in LHB coach for preventing water ingress from EPPFS to air brake pipeline",
        "CAI - Retrofitment of metallic Y Strainer in SS water inlet line for the water pressurization system of EPPFS of MCF Specs MMDTS 19027 Rev-1 to Rev-3",
        "CAI - Provision of isolation cock in plumbing lines of FRP modular toilet",
        "CAI - Provision of locking strip with Hexogonal Head Screw to avoid loosening of Roof Ventilator in RCF made coaches",
        "CAI - Provision of protection cover over Passenger Emergency Alarm Pull Box in LHB coaches",
        "CAI - Tail Lamp Bracket on End wall of LHB SLR, Power Car & LVPH",
        "CAI - Replacement of catch arrangement of backrest cum berth in LFAC coaches",
        "CAI - Standardization of 2 Amp circuit breaker in FSDS system for IR AC Coaches",
        "CAI - Segregation of positive and negative cables in separate conduits for FSDSsystems",
        "CAI - Power supply from SBC panel for FSDS System.",
        "CAI - Standardized location for fitment of automatic FSDS system in AC coaches. (Partition of Linen Cabinet for FSDS)",
        "CAI - Retrofitment/fitment of aspiration type Automatic Smoke/Fire Detection with Alarm System in IR AC Coaches.",
        "CAI - Locking arrangement of isolating cock of FDAS in LHB AC coaches",
        "CAI - 100% conversion from manual to automatic FDSS/FSDS in pantry cars, power cars and AC Coaches.",
        "CAI - Integration of FSDS with Braking System in AC Coaches",
        "CAI - Revised wiring scheme for WSP system of LHB Coaches",
        "CAI - Standardized installation of WSP junction box & Speed sensor cables in LHB coaches",
        "CAI - Implementation of CAI regarding lavatory wash basin drain outlet pipe laying for waste water",
        "CAI - Provision of wire rope mechanism for QRV of DV in LHB coaches",
        "CAI - Projection of BP and FP metal pipe from headstock as specified",
        "CAI - Modification of Wheelset Earthing Equipment - Provision of double threaded Stainless steel insert in front cover and brush holder assembly mounting arrangement",
        "CAI - Covering of gap above doorway partitiion frame for LHB GS coaches",
        "CAI - Relocation of Chlorine filter in IR DRDO BioDigester in LHB type coaches",
        "CAI - Provision of additional brake indicator inside the coaches fitted with hand brake arrangement",
        "CAI - Provision of additional dirt collector in BP line before FIBA",
        "CAI - Implementation of modified Pneumatic Piping arrangement to relocate ACP isolation cock / valve in order to make it accessible with in a hand-stretch distance",
        "CAI - Change of material of vestibule footplate to AISI304 in LHB Type Coaches (RCF Built)",
        "CAI - LHB coaches with provision of TPU rings in suspension arrangements.",
        "CAI - Material specification altered from MS to Stainless steel for Foot plates (ICF Built)",
        "CAI - Additional lifting pad blocks to be welded adjacent ot the existing lifting pad in underframe",
        "CAI - Modification of primary suspension of LWACCN coaches",
        "CAI - Installation of lookout glass for DETC/US observation window",
        "CAI - Closing of louvre of cab door in DTC of Vande Bharat, to prevent entry of outside air",
        "CAI - Provision of space for parking of Serving Trolley Arrangement except DTC coaches",
        "CAI - Replacement of valves in water pipeline (suction and supply line) USBRL Coaches",
        "CAI - Provision of mesh cover on the reservoir of the brake panel in LHB coaches",
        "CAI - Improvement in Reliability of Stiffener plate to prevent blanking",
        "CAI - Provision of locking arrangement in saloon sliding door of LHB 1st AC coach - swivel type lock",
        "CAI - Door handle set & latch indicators arrangement replacement work in all lavatory doors",
        "CAI - Ensuring provision of tertiary locking pin arrangement in AAR H type tight lock CBC with BDG",
        "CAI - Closing of holes around plumbing pipeline in Underframe for modular toilet and pantry equipments",
        "CAI - Retro fitment /fitment of Aspiration type Automatic FDAS in IR AC coaches to RDSO spec no. RDSO-2008-CG-04 (Rev. 5)",
        "CAI - Provision of additional foldable berth in Non-LHB (ICF) AC coaches",
        "CAI - SAE 100 R3 type hose pipes in place of SAE 100 R1 AT (less flexible) to be used",
        "CAI - Provision of Dog Box in guard room of LHB power car coaches",
        "CAI - Provision of FRP cover sheet to avoid passing of waste material outside of dust bin area between attachment wall and modular wall near outside wash basin area",
        "CAI - Modification in AEFG2 WSP system of Ms FTRTIPL make of LHB coaches"
    ];

    const ALL_POH_SURVEY_HEADERS = DEFAULT_POH_SURVEY_HEADERS.concat(DEFAULT_CAI_HEADERS);

    function getPohAppsScriptUrl() {
        return localStorage.getItem('poh_survey_app_script_url') || '';
    }

    function getPohSpreadsheetId() {
        return localStorage.getItem('poh_survey_spreadsheet_id') || '';
    }

    async function autoFillPohSurveyFromDb() {
        const quickInput = document.getElementById('pohQuickCoachInput');
        const coachNumberInput = document.getElementById('pohCoachNumber');
        const coachNo = (quickInput ? quickInput.value.trim() : '') || (coachNumberInput ? coachNumberInput.value.trim() : '');

        if (!coachNo || (coachNo.length !== 6 && coachNo !== '91223')) {
            showWarningAlert('Please enter a valid 6-digit coach number.');
            return;
        }

        const fetchBtn = document.getElementById('pohQuickFetchBtn');
        const statusBox = document.getElementById('pohAutoFillStatus');
        const statusText = document.getElementById('pohAutoFillStatusText');

        if (fetchBtn) fetchBtn.disabled = true;
        if (statusBox) statusBox.classList.add('hidden');

        try {
            const data = await fetchFromDatabase('coach', coachNo);
            if (data && data.status === 'success' && data.data && data.data.length > 0) {
                const coach = data.data[0];

                // Auto-fill fields in form
                if (coachNumberInput) coachNumberInput.value = coachNo;
                if (quickInput) quickInput.value = coachNo;

                const setField = (id, val) => {
                    const el = document.getElementById(id);
                    if (el && val && val !== '-') el.value = val;
                };

                setField('pohRailway', coach['RLY'] || coach['Rly'] || '');
                setField('pohCoachType', coach['TYPE'] || coach['Coach Type'] || '');
                const rawDom = coach['POH/DOM'] || coach['DOM'] || coach['DOC'] || '';
                if (rawDom) {
                    const isoDom = parseToIsoDate(rawDom);
                    if (isoDom) setField('pohDomDoc', isoDom);
                    else setField('pohDomDoc', rawDom);
                }
                setField('pohShop', coach['SHOP/DOC'] || coach['DOC'] || '');
                const rawRd = coach['R/DATE'] || coach['RD'] || '';
                if (rawRd) {
                    const isoRd = parseToIsoDate(rawRd);
                    if (isoRd) setField('pohRD', isoRd);
                    else setField('pohRD', rawRd);
                }

                const rawSs2 = coach['Next SS2 Due'] || coach['SS2'] || coach['SS2 Date'] || '';
                if (rawSs2) {
                    const isoDate = parseToIsoDate(rawSs2);
                    if (isoDate) setField('pohSs2Ss3Date', isoDate);
                }

                setField('pohTare', coach['TARE'] || coach['Tare'] || '');
                setField('pohKmph', coach['KMPH'] || coach['Speed'] || '');

                if (statusBox && statusText) {
                    statusText.innerText = `Loaded Coach #${coachNo} (${coach['RLY'] || ''} ${coach['TYPE'] || ''})`;
                    statusBox.classList.remove('hidden');
                }

                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: `Coach ${coachNo} details auto-filled!`,
                    showConfirmButton: false,
                    timer: 2500,
                    background: 'rgba(30, 41, 59, 0.95)',
                    color: 'var(--text)'
                });
            } else {
                showWarningAlert(`No database entry found for Coach #${coachNo}. Please fill survey manually.`);
            }
        } catch (err) {
            console.error('Error auto-filling coach details:', err);
            showErrorAlert('Could not auto-fill coach details. Please check connection.');
        } finally {
            if (fetchBtn) fetchBtn.disabled = false;
        }
    }
    window.autoFillPohSurveyFromDb = autoFillPohSurveyFromDb;

    function collectPohSurveyFormData() {
        const form = document.getElementById('pohSurveyForm');
        const data = {};

        // Timestamp
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        data['Timestamp'] = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

        // Map inputs by exact header name
        DEFAULT_POH_SURVEY_HEADERS.forEach((header) => {
            if (header === 'Timestamp') return;
            const el = form ? form.querySelector(`[name="${header}"]`) : null;
            data[header] = el ? el.value.trim() : '';
        });

        // Map CAI inputs
        DEFAULT_CAI_HEADERS.forEach((header) => {
            const rawHeader = header.replace(/^CAI - /, '');
            const el = form ? (form.querySelector(`[name="${header}"]`) || form.querySelector(`[name="${rawHeader}"]`)) : null;
            data[header] = el ? el.value.trim() : '';
        });

        // Ensure coach number
        if (!data['COACH NUMBER']) {
            data['COACH NUMBER'] = document.getElementById('pohQuickCoachInput')?.value.trim() || '';
        }

        return data;
    }
    window.collectPohSurveyFormData = collectPohSurveyFormData;

    function setPohAllCai(status) {
        const selects = document.querySelectorAll('.poh-cai-select');
        selects.forEach(sel => {
            sel.value = status;
        });
        if (typeof Swal !== 'undefined' && Swal.fire) {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'info',
                title: status ? `All 51 CAI items set to "${status}"` : 'CAI items reset',
                showConfirmButton: false,
                timer: 1500,
                background: 'rgba(30, 41, 59, 0.95)',
                color: 'var(--text)'
            });
        }
    }
    window.setPohAllCai = setPohAllCai;

    function filterPohCaiList(query) {
        const q = (query || '').toLowerCase().trim();
        const items = document.querySelectorAll('.poh-cai-item');
        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            if (!q || text.includes(q)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }
    window.filterPohCaiList = filterPohCaiList;


    async function submitPohSurveyForm() {
        const data = collectPohSurveyFormData();
        const coachNo = data['COACH NUMBER'];

        if (!coachNo || (coachNo.length !== 6 && coachNo !== '91223')) {
            showWarningAlert('Please enter a valid 6-digit coach number.');
            document.getElementById('pohCoachNumber')?.focus();
            return;
        }

        // Cache survey locally
        localStorage.setItem('poh_survey_last_entry', JSON.stringify(data));

        // Action Modal: Save to Google Sheet / Generate PDF / Both
        Swal.fire({
            title: 'SS2 / POH Survey Actions',
            html: `
                <div style="text-align: left; font-size: 0.9rem; line-height: 1.6;">
                    <p style="margin-bottom: 0.5rem;">Survey for Coach <strong>${escapeHtml(coachNo)}</strong> (${escapeHtml(data['COACH TYPE'] || 'Coach')}) is ready!</p>
                    <p style="color: var(--text-muted); font-size: 0.82rem; margin-bottom: 0;">Choose how you want to process this survey:</p>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: '<i class="fa-solid fa-cloud-arrow-up"></i> Save to Google Sheet',
            denyButtonText: '<i class="fa-solid fa-file-pdf"></i> Generate PDF',
            cancelButtonText: '<i class="fa-solid fa-check-double"></i> Save & Generate PDF',
            confirmButtonColor: '#be185d',
            denyButtonColor: '#2563eb',
            cancelButtonColor: '#059669',
            background: 'rgba(30, 41, 59, 0.98)',
            color: 'var(--text)',
            customClass: { popup: 'glass-card' }
        }).then(async (result) => {
            if (result.isConfirmed) {
                // Save to Google Sheet
                await savePohSurveyToGoogleSheet(data);
            } else if (result.isDenied) {
                // Generate PDF
                openPohPdfPreviewModal(data);
            } else if (result.dismiss === Swal.DismissReason.cancel) {
                // Save to Sheet AND Generate PDF
                await savePohSurveyToGoogleSheet(data, false);
                openPohPdfPreviewModal(data);
            }
        });
    }
    window.submitPohSurveyForm = submitPohSurveyForm;

    async function savePohSurveyToGoogleSheet(surveyData, showDialogOnDone = true) {
        let appScriptUrl = getPohAppsScriptUrl();

        if (!appScriptUrl) {
            const promptResult = await Swal.fire({
                title: 'Connect Google Sheet Web App',
                html: `
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.75rem; text-align: left;">
                        Please enter the <strong>Web App URL</strong> deployed from <code>appscript_POH survey.js</code>:
                    </p>
                    <input type="url" id="swalPohUrl" class="swal2-input" placeholder="https://script.google.com/macros/s/.../exec" style="margin: 0 0 0.5rem 0; width: 100%;">
                `,
                showCancelButton: true,
                confirmButtonText: 'Save & Continue',
                confirmButtonColor: '#be185d',
                background: 'rgba(30, 41, 59, 0.98)',
                color: 'var(--text)',
                preConfirm: () => {
                    const url = document.getElementById('swalPohUrl')?.value?.trim();
                    if (!url || !url.startsWith('http')) {
                        Swal.showValidationMessage('Please enter a valid Google Apps Script Web App URL.');
                        return false;
                    }
                    return url;
                }
            });

            if (promptResult.isConfirmed && promptResult.value) {
                appScriptUrl = promptResult.value;
                localStorage.setItem('poh_survey_app_script_url', appScriptUrl);
            } else {
                return;
            }
        }

        const payload = Object.assign({}, surveyData);
        const customSheetId = getPohSpreadsheetId();
        if (customSheetId) payload.spreadsheetId = customSheetId;

        // Show loading
        Swal.fire({
            title: 'Saving to Google Sheet...',
            text: 'Submitting SS2/POH Survey data...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); },
            background: 'rgba(30, 41, 59, 0.98)',
            color: 'var(--text)'
        });

        try {
            const resp = await fetch(appScriptUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            });
            const res = await resp.json();

            if (res.status === 'success') {
                if (showDialogOnDone) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Saved to Google Sheet!',
                        text: `Survey recorded successfully (Row #${res.rowIndex || 'New'}) for Coach ${payload['COACH NUMBER']}.`,
                        confirmButtonColor: '#be185d',
                        background: 'rgba(30, 41, 59, 0.98)',
                        color: 'var(--text)'
                    });
                }
                return true;
            } else {
                throw new Error(res.message || 'Error reported by Apps Script');
            }
        } catch (e) {
            console.error('Error saving survey to Google Sheet:', e);
            Swal.fire({
                icon: 'warning',
                title: 'Network / Script Notice',
                text: 'Survey is safely preserved in local offline memory. If using a newly deployed script, ensure "Who has access: Anyone" is selected.',
                confirmButtonColor: '#be185d',
                background: 'rgba(30, 41, 59, 0.98)',
                color: 'var(--text)'
            });
            return false;
        }
    }
    window.savePohSurveyToGoogleSheet = savePohSurveyToGoogleSheet;

    function openPohPdfPreviewModal(surveyData) {
        const data = surveyData || collectPohSurveyFormData();
        const coachNo = data['COACH NUMBER'] || 'UNKNOWN';

        const modal = document.getElementById('pohPdfPreviewModal');
        const contentContainer = document.getElementById('pohPdfReportContent');
        const titleEl = document.getElementById('pohPdfPreviewTitle');

        if (titleEl) {
            titleEl.innerText = `SS2 / POH Survey - Coach ${coachNo}`;
        }

        if (contentContainer) {
            contentContainer.innerHTML = buildPohSurveyPdfHtml(data);
        }

        if (modal) {
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
            pushModalState('pohPdfPreviewModal');
        }
        document.body.style.overflow = 'hidden';

        window.currentPohSurveyData = data;
    }
    window.openPohPdfPreviewModal = openPohPdfPreviewModal;

    function closePohPdfPreviewModal(fromBack = false) {
        const modal = document.getElementById('pohPdfPreviewModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }
        document.body.style.overflow = '';
        if (!fromBack && !isHandlingPopState && window.history.state && window.history.state.modal === 'pohPdfPreviewModal') {
            window.history.back();
        }
    }
    window.closePohPdfPreviewModal = closePohPdfPreviewModal;

    function previewPohSurveyPdf() {
        const data = collectPohSurveyFormData();
        openPohPdfPreviewModal(data);
    }
    window.previewPohSurveyPdf = previewPohSurveyPdf;

    function buildPohSurveyPdfHtml(data) {
        const esc = (v) => escapeHtml(v || '-');

        const formatPdfDate = (v) => {
            if (!v || v === '-') return '-';
            return typeof formatDateDMY === 'function' ? formatDateDMY(v) : v;
        };

        // Part 1: Base 63 General Survey Fields
        const baseRowsHtml = DEFAULT_POH_SURVEY_HEADERS.map((key, idx) => {
            const val = data[key] || '-';
            const isHighlight = ['COACH NUMBER', 'RAILWAY', 'COACH TYPE', 'DEFICIENCY IF ANY', 'REMARKS'].includes(key);
            const valStyle = isHighlight ? 'font-weight: 700; color: #831843;' : 'font-weight: 500;';
            return `
                <tr>
                    <td style="width: 6%; text-align: center; color: #64748b; font-weight: 700;">${idx + 1}</td>
                    <td class="poh-pdf-td-label">${esc(key)}</td>
                    <td class="poh-pdf-td-val" style="${valStyle}">${esc((['DOM/DOC', 'RD', 'SS2/SS3 Date'].includes(key) && val && val !== '-') ? formatPdfDate(val) : val)}</td>
                </tr>
            `;
        }).join('');

        // Part 2: 51 Carriage Alteration Instructions (CAI)
        const caiRowsHtml = DEFAULT_CAI_HEADERS.map((key, idx) => {
            const rawKey = key.replace(/^CAI - /, '');
            const val = data[key] || data[rawKey] || '-';
            let badgeStyle = 'color: #475569; font-weight: 600;';
                        if (val === 'Modified') badgeStyle = 'color: #059669; font-weight: 700;';
            else if (val === 'Not Modified') badgeStyle = 'color: #dc2626; font-weight: 700;';
            else if (val === 'Not Applicable' || val.includes('NA') || val.includes('Not Applicable')) badgeStyle = 'color: #64748b; font-weight: 500;';

            return `
                <tr>
                    <td style="width: 6%; text-align: center; color: #0284c7; font-weight: 700;">${idx + 1}</td>
                    <td style="font-weight: 600; color: #1e293b; padding: 4px 8px;">${esc(rawKey)}</td>
                    <td style="${badgeStyle}; text-align: center; width: 24%; padding: 4px 8px;">${esc(val)}</td>
                </tr>
            `;
        }).join('');

        return `
            <div class="poh-pdf-page" id="pohPdfPrintablePage">
                <!-- Document Header -->
                <div class="poh-pdf-header">
                    <h2>SOUTH WESTERN RAILWAY &bull; BENGALURU DIVISION</h2>
                    <h3>SBC COACHING DEPOT &bull; SS2 / POH CONDITION SURVEY REPORT</h3>
                    <p>Pre-Maintenance Technical Condition, Modification Compliance &amp; Inspection Record</p>
                </div>

                <!-- Meta Summary Ribbon -->
                <div class="poh-pdf-meta-box">
                    <span>COACH: <strong>${esc(data['COACH NUMBER'])} (${esc(data['RAILWAY'])} ${esc(data['COACH TYPE'])})</strong></span>
                    <span>SHOP: <strong>${esc(data['SS2/SS3 SHOP'])}</strong></span>
                    <span>DOM/DOC: <strong>${esc(formatPdfDate(data['DOM/DOC']))}</strong></span>
                    <span>SURVEY DATE: <strong>${esc(data['Timestamp'])}</strong></span>
                </div>

                <!-- Part 1: General Parameters -->
                <div style="background: #be185d; color: #fff; padding: 6px 12px; font-weight: 700; font-size: 9pt; border-radius: 4px 4px 0 0; margin-top: 10px; display: flex; justify-content: space-between;">
                    <span>PART 1: GENERAL COACH CONDITION &amp; TECHNICAL PARAMETERS</span>
                    <span>63 ITEMS</span>
                </div>
                <table class="poh-pdf-table" style="margin-bottom: 16px;">
                    <thead>
                        <tr>
                            <th style="width: 6%; text-align: center;">S.N.</th>
                            <th style="width: 44%;">Survey Parameter</th>
                            <th style="width: 50%;">Recorded Observation / Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${baseRowsHtml}
                    </tbody>
                </table>

                <!-- Part 2: Carriage Alteration Instructions (CAI) -->
                <div style="background: #0284c7; color: #fff; padding: 6px 12px; font-weight: 700; font-size: 9pt; border-radius: 4px 4px 0 0; margin-top: 16px; display: flex; justify-content: space-between;">
                    <span>PART 2: CARRIAGE ALTERATION INSTRUCTIONS (CAI) COMPLIANCE</span>
                    <span>51 ITEMS</span>
                </div>
                <table class="poh-pdf-table" style="margin-bottom: 14px;">
                    <thead>
                        <tr style="background: #0284c7;">
                            <th style="width: 6%; text-align: center; background: #0284c7;">CAI #</th>
                            <th style="width: 70%; background: #0284c7;">Carriage Alteration Instruction / Technical Modification</th>
                            <th style="width: 24%; text-align: center; background: #0284c7;">Compliance Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${caiRowsHtml}
                    </tbody>
                </table>

                <!-- Supervisory Signatures -->
                <div class="poh-pdf-signatures">
                    <div>
                        <p style="margin: 0; text-decoration: underline;">INSPECTED BY</p>
                        <p style="margin: 4px 0 0; color: #64748b; font-size: 8pt;">JE / SE (C&amp;W) SBC</p>
                    </div>
                    <div style="text-align: center;">
                        <p style="margin: 0; text-decoration: underline;">SURVEY INCHARGE</p>
                        <p style="margin: 4px 0 0; color: #64748b; font-size: 8pt;">SSE / C&amp;W Coaching Depot</p>
                    </div>
                    <div style="text-align: right;">
                        <p style="margin: 0; text-decoration: underline;">FORWARDED TO SHOP</p>
                        <p style="margin: 4px 0 0; color: #64748b; font-size: 8pt;">CDO / SBC &bull; South Western Railway</p>
                    </div>
                </div>
            </div>
        `;
    }

    async function downloadPohSurveyPdf() {
        const data = window.currentPohSurveyData || collectPohSurveyFormData();
        const coachNo = data['COACH NUMBER'] || 'Coach';
        const dateStr = (data['Timestamp'] || '').split(' ')[0] || new Date().toISOString().slice(0, 10);
        const filename = `SS2_POH_Survey_${coachNo}_${dateStr}.pdf`;

        const targetEl = document.getElementById('pohPdfReportContent');
        if (!targetEl) return;

        const downloadBtn = document.getElementById('pohPdfDownloadBtn');
        const origHtml = downloadBtn ? downloadBtn.innerHTML : '';
        if (downloadBtn) {
            downloadBtn.disabled = true;
            downloadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';
        }

        try {
            if (typeof html2pdf !== 'function') {
                throw new Error('html2pdf library not loaded');
            }

            const opt = {
                margin: [6, 6, 6, 6],
                filename: filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, letterRendering: true, backgroundColor: '#ffffff' },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
            };

            await html2pdf().set(opt).from(targetEl).save();

            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'PDF Downloaded successfully!',
                showConfirmButton: false,
                timer: 2500,
                background: 'rgba(30, 41, 59, 0.95)',
                color: 'var(--text)'
            });
        } catch (err) {
            console.error('Error generating PDF:', err);
            window.print();
        } finally {
            if (downloadBtn) {
                downloadBtn.disabled = false;
                downloadBtn.innerHTML = origHtml;
            }
        }
    }
    window.downloadPohSurveyPdf = downloadPohSurveyPdf;

    function printPohSurveyPdf() {
        window.print();
    }
    window.printPohSurveyPdf = printPohSurveyPdf;

    async function sharePohSurveyPdf() {
        const data = window.currentPohSurveyData || collectPohSurveyFormData();
        const coachNo = data['COACH NUMBER'] || 'Coach';
        const filename = `SS2_POH_Survey_${coachNo}.pdf`;

        const targetEl = document.getElementById('pohPdfReportContent');
        if (!targetEl) return;

        if (!navigator.canShare) {
            downloadPohSurveyPdf();
            return;
        }

        try {
            const opt = {
                margin: [6, 6, 6, 6],
                filename: filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            const pdfBlob = await html2pdf().set(opt).from(targetEl).output('blob');
            const file = new File([pdfBlob], filename, { type: 'application/pdf' });

            if (navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: `SS2 / POH Survey - Coach ${coachNo}`,
                    text: `Official SS2 / POH Pre-Maintenance Condition Survey Report for Coach ${coachNo}`,
                    files: [file]
                });
            } else {
                downloadPohSurveyPdf();
            }
        } catch (e) {
            if (e.name !== 'AbortError') {
                downloadPohSurveyPdf();
            }
        }
    }
    window.sharePohSurveyPdf = sharePohSurveyPdf;

    function resetPohSurveyForm() {
        const form = document.getElementById('pohSurveyForm');
        if (form) form.reset();
        const quickInput = document.getElementById('pohQuickCoachInput');
        if (quickInput) quickInput.value = '';
        const statusBox = document.getElementById('pohAutoFillStatus');
        if (statusBox) statusBox.classList.add('hidden');
    }
    window.resetPohSurveyForm = resetPohSurveyForm;

    function openPohSettingsModal() {
        const modal = document.getElementById('pohSettingsModal');
        const urlInput = document.getElementById('pohAppsScriptUrlInput');
        const sheetIdInput = document.getElementById('pohSpreadsheetIdInput');

        if (urlInput) urlInput.value = getPohAppsScriptUrl();
        if (sheetIdInput) sheetIdInput.value = getPohSpreadsheetId();

        if (modal) {
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
        }
    }
    window.openPohSettingsModal = openPohSettingsModal;

    function closePohSettingsModal() {
        const modal = document.getElementById('pohSettingsModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }
    }
    window.closePohSettingsModal = closePohSettingsModal;

    function savePohSettings() {
        const urlInput = document.getElementById('pohAppsScriptUrlInput');
        const sheetIdInput = document.getElementById('pohSpreadsheetIdInput');

        if (urlInput) {
            localStorage.setItem('poh_survey_app_script_url', urlInput.value.trim());
        }
        if (sheetIdInput) {
            localStorage.setItem('poh_survey_spreadsheet_id', sheetIdInput.value.trim());
        }

        closePohSettingsModal();
        Swal.fire({
            icon: 'success',
            title: 'Settings Saved',
            text: 'Google Sheet and Web App connection details have been saved locally.',
            timer: 2000,
            showConfirmButton: false,
            background: 'rgba(30, 41, 59, 0.98)',
            color: 'var(--text)'
        });
    }
    window.savePohSettings = savePohSettings;

