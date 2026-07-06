import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

wsp_logic = """
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
                loadTrainOptions().then(() => {
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
    
    spinner.classList.remove('hidden');
    btnText.style.opacity = '0';
    fetchBtn.disabled = true;

    try {
        const url = `${GOOGLE_APP_SCRIPT_URL}?train=${encodeURIComponent(trainSelect)}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        
        if (data.status === 'success' && data.data.length > 0) {
            currentWspTrainCoaches = data.data;
            
            const rakeSelect = document.getElementById('wspRakeSelect');
            rakeSelect.innerHTML = '<option value="" disabled selected>Select Rake Number</option>';
            const rakeSet = new Set();
            
            currentWspTrainCoaches.forEach(coach => {
                const rakeStr = coach['_colO'];
                if (rakeStr) {
                    let match = rakeStr.match(/\\d+/);
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
        } else {
            throw new Error(data.message || 'No rakes found for this train');
        }
    } catch (error) {
        console.error('Error fetching rakes:', error);
        showErrorAlert(error.message);
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
        let match = rakeStr.match(/\\d+/);
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
            let positionMatch = rakeStr.match(/\\d+$/);
            if(selectedTrain === 'CLONE') positionMatch = rakeStr.match(/0(\\d+)$/);
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
                fetchWspHistory(coachNum);
            };
            
            tbody.appendChild(tr);
        });
    }
    
    navigateTo('wspRakeResultsScreen');
}

async function fetchWspHistory(coachNumber) {
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
        const url = `${GOOGLE_APP_SCRIPT_URL}?coachNumber=${encodeURIComponent(coachNumber)}&sheetName=wsp_wheel_status`;
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
                
                let html = '<div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.5rem;">';
                for (const [key, value] of Object.entries(entry)) {
                    if (key.startsWith('_')) continue;
                    html += `<div><span style="font-size:0.75rem; color:var(--text-muted); display:block;">${key}</span>
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
"""

if "// --- WSP Entry Logic ---" not in content:
    content += "\n" + wsp_logic

# Attach Event Listeners for WSP
listeners_patch = """
    // WSP Event Listeners
    const wspCoachForm = document.getElementById('wspSearchCoachForm');
    if(wspCoachForm) {
        wspCoachForm.addEventListener('submit', (e) => {
            e.preventDefault();
            fetchWspHistory(document.getElementById('wspCoachNumberInput').value);
        });
    }
    
    const wspDefectForm = document.getElementById('wspDefectForm');
    if(wspDefectForm) {
        wspDefectForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const btn = document.getElementById('wspSubmitDefectBtn');
            btn.disabled = true;
            btn.querySelector('.spinner').classList.remove('hidden');
            btn.querySelector('.btn-text').style.opacity = '0';
            
            const formData = {
                action: 'addWspEntry',
                coachNumber: document.getElementById('wspDefectCoachNum').value,
                date: document.getElementById('wspDate').value,
                enteredBy: document.getElementById('wspEnteredBy').value,
                wspMake: document.getElementById('wspMake').value,
                location: document.getElementById('wspLocation').value,
                description: document.getElementById('wspDescription').value,
                wspCode: document.getElementById('wspCode').value,
                pressure: document.getElementById('wspPressure').value,
                dump: document.getElementById('wspDump').value,
                speed: document.getElementById('wspSpeed').value,
                observation: document.getElementById('wspObservation').value
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
"""

if "WSP Event Listeners" not in content:
    content = content.replace("});\n\n// --- Navigation ---", listeners_patch + "\n});\n\n// --- Navigation ---")


with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done!')
