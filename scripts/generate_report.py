import os
from docx import Document
from docx.shared import Pt
from docx.oxml.ns import qn

ROOT = os.path.dirname(os.path.dirname(__file__))
TEMPLATE = os.path.join(ROOT, '20231211_180401_resource.docx')
OUT = os.path.join(ROOT, 'Final_Project_Report.docx')

# Files to include (relative to ROOT)
FILES = [
    'README.md',
    'DEPLOY.md',
    'server.js',
    'package.json',
    'wifi-gateway.ino',
    'livestock-monitor.ino',
    os.path.join('js', 'farmer-data.js'),
    os.path.join('js', 'farmer-dashboard.js'),
    os.path.join('farmer-dashboard.html'),
]

def read_file(path):
    try:
        with open(path, 'r', encoding='utf-8', errors='replace') as f:
            return f.read()
    except Exception as e:
        return None

# Try to use template if available
if os.path.exists(TEMPLATE):
    doc = Document(TEMPLATE)
else:
    doc = Document()

# Title
if not doc.paragraphs or not doc.paragraphs[0].text.strip():
    doc.add_heading('Final Year Project Report: IoT Livestock Health Monitor', level=1)
else:
    doc.add_paragraph('\n')

# Summary / Abstract
doc.add_heading('Abstract', level=2)
abstract = (
    'This report documents the design and implementation of an IoT-based Livestock Health Monitoring System. '
    'It covers hardware firmware, backend server integration, and frontend (web) dashboard work. The implementation '
    'includes live MQTT-based telemetry ingestion, sensor data processing, and a real-time dashboard that subscribes to '
    'sensor topics via MQTT over WebSockets.'
)
doc.add_paragraph(abstract)

# Implementation Summary
doc.add_heading('Implementation Summary', level=2)
summary = (
    'Key components implemented:
'
    '- ESP32 WiFi gateway firmware that collects sensor data and publishes to MQTT topics.
'
    '- Node.js backend (server.js) that subscribes to the MQTT broker and persists sensor records to a database.
'
    '- Browser-based dashboards and pages (Farmer and Ministry) that previously polled HTTP endpoints; frontend code '
    'was updated to subscribe to an MQTT broker using MQTT.js and maintain an in-memory telemetry cache for real-time updates.
'
    '- Integration with EMQX public broker for WebSocket access and fallback handling for HTTP vs HTTPS environments.
'
)
doc.add_paragraph(summary)

# Included artifacts
doc.add_heading('Included Artifacts', level=2)
for rel in FILES:
    path = os.path.join(ROOT, rel)
    doc.add_heading(rel, level=3)
    content = read_file(path)
    if content is None:
        doc.add_paragraph('(file not found)')
        continue
    # Add a short excerpt and full content in monospaced style
    p = doc.add_paragraph()
    run = p.add_run('Full file content follows:')
    run.font.size = Pt(10)

    # Add content as preformatted paragraphs
    for line in content.splitlines():
        p = doc.add_paragraph(line)
        r = p.runs[0]
        try:
            r.font.name = 'Courier New'
            r._element.rPr.rFonts.set(qn('w:eastAsia'), 'Courier New')
        except Exception:
            pass
        r.font.size = Pt(9)

# Appendix: Notes on recent frontend changes
doc.add_heading('Appendix: Recent Frontend Changes', level=2)
notes = (
    'The farmer dashboard was modified to include the MQTT.js browser bundle and to replace HTTP polling with a live MQTT ' 
    'telemetry cache maintained in `js/farmer-data.js`. The dashboard now subscribes to telemetry updates and schedules a debounced ' 
    'refresh to render new data. Key files changed include `farmer-dashboard.html`, `js/farmer-data.js`, and `js/farmer-dashboard.js`.'
)
doc.add_paragraph(notes)

# Save output
try:
    doc.save(OUT)
    print('Saved', OUT)
except Exception as e:
    print('Failed to save:', e)
