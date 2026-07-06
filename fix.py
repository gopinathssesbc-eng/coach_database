import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix the WSP Entry card in dashboard
dashboard_fix = """<button class="dashboard-card" onclick="navigateTo('wspSearchScreen')">
                <div class="card-icon"><i class="fa-solid fa-clipboard-list"></i></div>
                <div class="card-content">
                    <h3>WSP Entry</h3>
                    <p>Log defects</p>
                </div>
                <i class="fa-solid fa-chevron-right chevron"></i>
            </button>
        </main>
    </div>"""

content = re.sub(
    r'<button class="dashboard-card disabled" onclick="alert\(\'Module under development\'\)">.*?</div>\n    </div>', 
    dashboard_fix, 
    content, 
    flags=re.DOTALL
)

# 2. Fix Coach Search Screen which was overwritten
coach_search_screen = """
    <!-- Search Screen -->
    <div id="searchScreen" class="screen hidden">
        <header class="app-header fade-in">
            <button class="icon-btn back-btn" onclick="navigateTo('dashboardScreen')"><i class="fa-solid fa-arrow-left"></i></button>
            <div>
                <h1>Search Coach</h1>
                <p class="subtitle">Enter coach identifiers</p>
            </div>
        </header>

        <main class="slide-up">
            <div class="glass-card form-card">
                <div class="search-tabs">
                    <button class="tab-btn active" id="tabCoach" onclick="switchSearchTab('coach')">Coach Number</button>
                    <button class="tab-btn" id="tabRake" onclick="switchSearchTab('rake')">By Rake</button>
                </div>

                <!-- Coach Search Form -->
                <form id="searchCoachForm">
                    <div class="form-group">
                        <label for="coachNumberInput">Coach Number</label>
                        <div class="input-group">
                            <i class="fa-solid fa-hashtag input-icon"></i>
                            <input type="number" id="coachNumberInput" placeholder="6 digit number (e.g. 123456)" required>
                        </div>
                    </div>
                    
                    <button type="submit" class="btn primary-btn btn-block" id="searchSubmitBtn">
                        <span class="btn-text">Search</span>
                        <div class="spinner hidden"></div>
                    </button>
                </form>

                <!-- Rake Search Form -->
                <form id="searchRakeForm" class="hidden">
                    <div class="form-group">
                        <label for="trainSelect">Train</label>
                        <div class="input-group">
                            <i class="fa-solid fa-train input-icon"></i>
                            <select id="trainSelect" required>
                                <option value="" disabled selected>Select Train</option>
                            </select>
                        </div>
                    </div>
                    
                    <button type="button" class="btn primary-btn btn-block" id="fetchRakesBtn" onclick="fetchRakes()">
                        <span class="btn-text">Find Rakes</span>
                        <div class="spinner hidden"></div>
                    </button>

                    <div id="rakeSelectionArea" class="hidden" style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid rgba(255,255,255,0.1);">
                        <div class="form-group">
                            <label for="rakeSelect">Select Rake</label>
                            <div class="input-group">
                                <i class="fa-solid fa-list-ol input-icon"></i>
                                <select id="rakeSelect">
                                    <option value="" disabled selected>Select Rake</option>
                                </select>
                            </div>
                        </div>
                        <button type="button" class="btn secondary-btn btn-block" onclick="viewRakeCoaches()">
                            View Coaches
                        </button>
                    </div>
                </form>
            </div>
        </main>
    </div>
"""

content = re.sub(
    r'<!-- Coach Search Screen -->.*?<!-- Selection Screen -->',
    coach_search_screen + '\n    <!-- Selection Screen -->',
    content,
    flags=re.DOTALL
)

# 3. Add WSP Screens before scripts
wsp_screens = """
    <!-- WSP Search Screen -->
    <div id="wspSearchScreen" class="screen hidden">
        <header class="app-header fade-in">
            <button class="icon-btn back-btn" onclick="navigateTo('dashboardScreen')"><i class="fa-solid fa-arrow-left"></i></button>
            <div>
                <h1>WSP Defect Entry</h1>
                <p class="subtitle">Search & update WSP issues</p>
            </div>
        </header>
        
        <main class="slide-up">
            <div class="glass-card form-card">
                <div class="search-tabs">
                    <button class="tab-btn active" id="wspTabCoach" onclick="switchWspTab('coach')">Coach Number</button>
                    <button class="tab-btn" id="wspTabRake" onclick="switchWspTab('rake')">By Rake</button>
                </div>
                
                <!-- Coach Number Search Form -->
                <form id="wspSearchCoachForm">
                    <div class="form-group">
                        <label for="wspCoachNumberInput">Coach Number</label>
                        <div class="input-group">
                            <i class="fa-solid fa-hashtag input-icon"></i>
                            <input type="number" id="wspCoachNumberInput" placeholder="6 digit number" required>
                        </div>
                    </div>
                    <button type="submit" class="btn primary-btn btn-block" id="wspSearchSubmitBtn" style="background: linear-gradient(135deg, #10b981, #059669);">
                        <span class="btn-text">Search</span>
                        <div class="spinner hidden"></div>
                    </button>
                </form>

                <!-- Rake Search Form -->
                <form id="wspSearchRakeForm" class="hidden">
                    <div class="form-group">
                        <label for="wspTrainSelect">Train</label>
                        <div class="input-group">
                            <i class="fa-solid fa-train input-icon"></i>
                            <select id="wspTrainSelect" required>
                                <option value="" disabled selected>Select Train</option>
                            </select>
                        </div>
                    </div>
                    
                    <button type="button" class="btn primary-btn btn-block" id="wspFetchRakesBtn" onclick="fetchWspRakes()" style="background: linear-gradient(135deg, #10b981, #059669);">
                        <span class="btn-text">Find Rakes</span>
                        <div class="spinner hidden"></div>
                    </button>

                    <div id="wspRakeSelectionArea" class="hidden" style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid rgba(255,255,255,0.1);">
                        <div class="form-group">
                            <label for="wspRakeSelect">Select Rake</label>
                            <div class="input-group">
                                <i class="fa-solid fa-list-ol input-icon"></i>
                                <select id="wspRakeSelect" required>
                                </select>
                            </div>
                        </div>
                        <button type="button" class="btn secondary-btn btn-block" onclick="viewWspRakeCoaches()" style="background: linear-gradient(135deg, #10b981, #059669);">
                            View Coaches
                        </button>
                    </div>
                </form>
            </div>
        </main>
    </div>
    
    <!-- WSP Results Screen -->
    <div id="wspResultsScreen" class="screen hidden">
        <header class="app-header fade-in">
            <button class="icon-btn back-btn" onclick="navigateTo('wspSearchScreen')"><i class="fa-solid fa-arrow-left"></i></button>
            <div>
                <h1 id="wspResultCoachId">Coach WSP</h1>
                <p class="subtitle">History & Entry</p>
            </div>
        </header>

        <main class="slide-up">
            <div class="glass-card" style="margin-bottom: 1rem;">
                <h3 class="group-title"><i class="fa-solid fa-clock-rotate-left"></i> Previous WSP Issues</h3>
                <div id="wspHistoryContainer">
                    <!-- History cards or 'no issues' message injected here -->
                </div>
            </div>

            <div class="glass-card">
                <h3 class="group-title"><i class="fa-solid fa-plus"></i> Add New Defect</h3>
                <form id="wspDefectForm">
                    <input type="hidden" id="wspDefectCoachNum">
                    
                    <div class="form-group">
                        <label>Date</label>
                        <input type="date" id="wspDate" class="styled-input" required>
                    </div>
                    
                    <div class="form-group">
                        <label>Entered By</label>
                        <select id="wspEnteredBy" class="styled-input" required>
                            <option value="" disabled selected>Select user ID</option>
                            <option value="839">839</option>
                            <option value="755">755</option>
                            <option value="294">294</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>WSP Make</label>
                        <input type="text" id="wspMake" class="styled-input" placeholder="e.g. Knorr" required>
                    </div>
                    
                    <div class="form-group">
                        <label>Wheel Issue Location</label>
                        <input type="text" id="wspLocation" class="styled-input" placeholder="e.g. Axle 1" required>
                    </div>
                    
                    <div class="form-group">
                        <label>Wheel Issue Description</label>
                        <textarea id="wspDescription" class="styled-input" rows="3" placeholder="Describe the issue..." required></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label>WSP Code</label>
                        <input type="text" id="wspCode" class="styled-input">
                    </div>
                    
                    <div class="form-group">
                        <label>Pressure Switch Condition</label>
                        <input type="text" id="wspPressure" class="styled-input">
                    </div>
                    
                    <div class="form-group">
                        <label>Dump Valve Statistics</label>
                        <input type="text" id="wspDump" class="styled-input">
                    </div>
                    
                    <div class="form-group">
                        <label>Speed Variation</label>
                        <input type="text" id="wspSpeed" class="styled-input">
                    </div>
                    
                    <div class="form-group">
                        <label>Downloading Observation</label>
                        <input type="text" id="wspObservation" class="styled-input">
                    </div>
                    
                    <button type="submit" class="btn primary-btn btn-block" id="wspSubmitDefectBtn" style="margin-top: 1rem; background: linear-gradient(135deg, #10b981, #059669);">
                        <span class="btn-text">Submit Defect</span>
                        <div class="spinner hidden"></div>
                    </button>
                </form>
            </div>
        </main>
    </div>
"""

content = content.replace('<script src="app.js"></script>', wsp_screens + '\n    <script src="app.js"></script>')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done!')
