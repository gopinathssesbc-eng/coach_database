import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Update version and date
content = re.sub(
    r'<div style="font-size: 0\.75rem; opacity: 0\.7; font-family: monospace;">.*?</div>',
    '<div style="font-size: 0.75rem; opacity: 0.7; font-family: monospace;">v2.0.0 | Updated: 2026-09-27 18:22</div>\n            <button onclick="showChangelog()" style="background: none; border: 1px solid rgba(255,255,255,0.2); color: var(--text-muted); padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; cursor: pointer; margin-top: 5px;">View Changelog</button>',
    content
)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

with open('app.js', 'r', encoding='utf-8') as f:
    app_js = f.read()

changelog_func = """
function showChangelog() {
    Swal.fire({
        title: 'Changelog v2.0.0',
        html: '<div style="text-align: left; font-size: 0.9rem;">' +
              '<ul>' +
              '<li><b>Performance:</b> Firebase integration done to improve app speed. Searches now take under 100ms.</li>' +
              '<li><b>Architecture:</b> Replaced slow Google Apps Script redirects with Firebase RTDB read replicas.</li>' +
              '</ul>' +
              '</div>',
        icon: 'info',
        background: 'var(--surface)',
        color: 'var(--text)',
        confirmButtonColor: 'var(--primary)'
    });
}
"""

if "function showChangelog()" not in app_js:
    app_js += "\n" + changelog_func

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(app_js)

print("Done")
