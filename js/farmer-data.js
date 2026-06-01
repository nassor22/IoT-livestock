/**
 * Farmer Data Module
 * Live sensor-backed helper functions for farmer pages
 */

const SENSOR_API_BASE = 'http://localhost:8000';

async function fetchSensorReadings(animalId = null, limit = 500) {
    const url = animalId
        ? `${SENSOR_API_BASE}/api/livestock/${encodeURIComponent(animalId)}/readings?limit=${limit}`
        : `${SENSOR_API_BASE}/data?limit=${limit}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            return [];
        }

        const payload = await response.json();
        return Array.isArray(payload) ? payload : [];
    } catch (error) {
        console.warn('Unable to load live sensor readings.', error);
        return [];
    }
}

function resolveAnimalId(reading) {
    return reading.animal_id || reading.animalId || reading.cowId || reading.id || 'UNKNOWN';
}

function getNumericValue(value) {
    if (value === undefined || value === null || value === '') {
        return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function getTemperatureClass(temperature) {
    if (temperature == null) return 'status-value';
    if (temperature > 39.5) return 'status-value high';
    if (temperature < 38) return 'status-value low';
    return 'status-value normal';
}

function getPulseClass(pulseRate) {
    if (pulseRate == null) return 'status-value';
    if (pulseRate > 100) return 'status-value high';
    if (pulseRate < 50) return 'status-value low';
    return 'status-value normal';
}

function getReadingStatus(bodyTemp, pulseRate, thi) {
    if ((bodyTemp != null && bodyTemp > 39.8) || (pulseRate != null && pulseRate > 110) || (thi != null && thi >= 72)) {
        return 'alert';
    }

    if ((bodyTemp != null && bodyTemp > 39.2) || (pulseRate != null && (pulseRate < 50 || pulseRate > 100))) {
        return 'warning';
    }

    return 'normal';
}

function toReadableStatus(status) {
    if (status === 'alert') return 'Alert';
    if (status === 'warning') return 'Warning';
    return 'Normal';
}

function formatRelativeTime(timestamp) {
    if (!timestamp) {
        return 'Just now';
    }

    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
        return 'Just now';
    }

    const diffMinutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} min ago`;

    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hr ago`;

    const diffDays = Math.round(diffHours / 24);
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

function buildLivestockRecord(reading) {
    const bodyTemp = getNumericValue(reading.body_temp ?? reading.bodyTemperature);
    const pulseRate = getNumericValue(reading.pulse_rate ?? reading.heart_rate ?? reading.activity);
    const thi = getNumericValue(reading.thi);
    const status = getReadingStatus(bodyTemp, pulseRate, thi);
    const timestamp = reading.timestamp ? new Date(reading.timestamp) : null;

    return {
        id: resolveAnimalId(reading),
        type: 'Sensor Node',
        age: 'Unknown',
        icon: 'fa-cow',
        status,
        statusText: toReadableStatus(status),
        temperature: bodyTemp,
        pulseRate,
        ambientTemp: getNumericValue(reading.ambient_temp),
        humidity: getNumericValue(reading.humidity),
        thi,
        gpsData: reading.gps_data ?? reading.gpsData ?? null,
        activity: pulseRate == null ? 'Unknown' : `${Math.round(pulseRate)} bpm`,
        rumination: 'Unknown',
        lastUpdate: timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp.toLocaleString() : formatRelativeTime(reading.timestamp),
        latestReading: reading
    };
}

function buildAlertRecord(reading) {
    const record = buildLivestockRecord(reading);
    if (record.status === 'normal') {
        return null;
    }

    const title = record.status === 'alert' ? 'Sensor Alert' : 'Sensor Warning';
    const detailParts = [];

    if (record.temperature != null) {
        detailParts.push(`Body temp ${record.temperature.toFixed(1)}°C`);
    }
    if (record.pulseRate != null) {
        detailParts.push(`Pulse ${Math.round(record.pulseRate)} bpm`);
    }
    if (record.thi != null) {
        detailParts.push(`THI ${record.thi.toFixed(1)}`);
    }

    return {
        id: `${record.id}-${record.lastUpdate}`,
        type: record.status,
        icon: record.status === 'alert' ? 'fa-temperature-high' : 'fa-exclamation-triangle',
        title: `${title} - ${record.id}`,
        description: detailParts.length > 0 ? detailParts.join(' · ') : `Latest reading for ${record.id} requires attention`,
        time: record.lastUpdate,
        animalId: record.id,
        smsSent: false
    };
}

function sortByLatestTimestamp(readings) {
    return [...readings].sort((left, right) => {
        const leftTime = new Date(left.timestamp || 0).getTime();
        const rightTime = new Date(right.timestamp || 0).getTime();
        return rightTime - leftTime;
    });
}

function collapseLatestReadings(readings) {
    const latestByAnimal = new Map();

    for (const reading of sortByLatestTimestamp(readings)) {
        const animalId = resolveAnimalId(reading);
        if (!latestByAnimal.has(animalId)) {
            latestByAnimal.set(animalId, reading);
        }
    }

    return Array.from(latestByAnimal.values()).map(buildLivestockRecord);
}

async function getLivestockStats() {
    const livestock = await getLiveLivestock('all');
    const total = livestock.length;
    const normal = livestock.filter(animal => animal.status === 'normal').length;
    const warning = livestock.filter(animal => animal.status === 'warning').length;
    const alert = livestock.filter(animal => animal.status === 'alert').length;

    return { total, normal, warning, alert };
}

async function getLiveLivestock(filter = 'all') {
    const readings = await fetchSensorReadings(null, 500);
    const livestock = collapseLatestReadings(readings);

    if (filter === 'all') {
        return livestock;
    }

    return livestock.filter(animal => animal.status === filter);
}

async function getLivestockById(id) {
    const readings = await fetchSensorReadings(id, 7);
    if (!readings.length) {
        return null;
    }

    return buildLivestockRecord(sortByLatestTimestamp(readings)[0]);
}

async function getAlertsByFilter(filter = 'all') {
    const readings = await fetchSensorReadings(null, 250);
    const alerts = readings.map(buildAlertRecord).filter(Boolean);

    if (filter === 'all') {
        return alerts;
    }

    return alerts.filter(alert => alert.type === filter);
}
