const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');

const ROOT = path.resolve(__dirname, '..');
const TEMPLATE = path.join(ROOT, '20231211_180401_resource.docx');
const OUT = path.join(ROOT, 'Final_Project_Report.docx');

const FILES = [
    'README.md',
    'DEPLOY.md',
    'server.js',
    'package.json',
    'wifi-gateway.ino',
    'livestock-monitor.ino',
    path.join('js', 'farmer-data.js'),
    path.join('js', 'farmer-dashboard.js'),
    'farmer-dashboard.html',
];

function readFileSafe(p) {
    try {
        return fs.readFileSync(p, 'utf8');
    } catch (e) {
        return null;
    }
}

(async function main() {
    const doc = new Document();

    doc.addSection({
        properties: {},
        children: [
            new Paragraph({ text: 'Final Year Project Report: IoT Livestock Health Monitor', heading: HeadingLevel.TITLE }),
            new Paragraph({ text: '' }),
            new Paragraph({ text: 'Abstract', heading: HeadingLevel.HEADING_2 }),
            new Paragraph('This report documents the design and implementation of an IoT-based Livestock Health Monitoring System. It covers hardware firmware, backend server integration, and frontend dashboard work. The implementation includes live MQTT-based telemetry ingestion, sensor data processing, and a real-time dashboard that subscribes to sensor topics via MQTT over WebSockets.'),
            new Paragraph({ text: 'Implementation Summary', heading: HeadingLevel.HEADING_2 }),
            new Paragraph('- ESP32 WiFi gateway firmware that collects sensor data and publishes to MQTT topics.'),
            new Paragraph('- Node.js backend (server.js) that subscribes to the MQTT broker and persists sensor records.'),
            new Paragraph('- Browser dashboards updated to consume MQTT via MQTT.js and maintain a live telemetry cache.'),
            new Paragraph('- Integration with EMQX public broker for WebSocket access and HTTPS fallback handling.'),
            new Paragraph({ text: 'Included Artifacts', heading: HeadingLevel.HEADING_2 }),
        ],
    });

    for (const rel of FILES) {
        const abs = path.join(ROOT, rel);
        const content = readFileSafe(abs);
        doc.addSection({ children: [new Paragraph({ text: rel, heading: HeadingLevel.HEADING_3 })] });
        if (!content) {
            doc.addSection({ children: [new Paragraph('(file not found)')] });
            continue;
        }
        const lines = content.split(/\r?\n/);
        const children = [];
        for (const line of lines) {
            children.push(new Paragraph({
                children: [new TextRun({ text: line || '\u00A0', font: 'Courier New', size: 18 })],
            }));
            // Limit doc size sanity: avoid extremely long files? We'll include full content as requested.
        }
        doc.addSection({ children });
    }

    // Appendix
    doc.addSection({ children: [
        new Paragraph({ text: 'Appendix: Recent Frontend Changes', heading: HeadingLevel.HEADING_2 }),
        new Paragraph('The farmer dashboard was modified to include the MQTT.js browser bundle and to replace HTTP polling with a live MQTT telemetry cache maintained in js/farmer-data.js. The dashboard now subscribes to telemetry updates and schedules a debounced refresh to render new data. Key files changed include farmer-dashboard.html, js/farmer-data.js, and js/farmer-dashboard.js.'),
    ]});

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(OUT, buffer);
    console.log('Saved', OUT);
})();
