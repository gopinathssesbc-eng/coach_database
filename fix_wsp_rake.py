import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

wsp_rake_results = """
    <!-- WSP Rake Results Screen -->
    <div id="wspRakeResultsScreen" class="screen hidden">
        <header class="app-header fade-in">
            <button class="icon-btn back-btn" onclick="navigateTo('wspSearchScreen')"><i class="fa-solid fa-arrow-left"></i></button>
            <div>
                <h1 id="wspRakeResultTitle">Rake Details</h1>
                <p class="subtitle">Select a coach for WSP entry</p>
            </div>
        </header>

        <main class="slide-up">
            <div class="glass-card" style="padding: 0; overflow: hidden;">
                <div class="table-responsive">
                    <table class="rake-table">
                        <thead>
                            <tr>
                                <th>Pos</th>
                                <th>RLY</th>
                                <th>Coach No</th>
                                <th>Type</th>
                                <th>Indication</th>
                            </tr>
                        </thead>
                        <tbody id="wspRakeTableBody">
                            <!-- Rows injected here -->
                        </tbody>
                    </table>
                </div>
            </div>
        </main>
    </div>
"""

content = content.replace('<!-- WSP Results Screen -->', wsp_rake_results + '\n    <!-- WSP Results Screen -->')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done!')
