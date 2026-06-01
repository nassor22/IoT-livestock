/**
 * Ministry Data Module
 * Live sensor aggregation helpers for ministry pages
 */

const SENSOR_API_BASE = 'http://localhost:8000';

async function fetchSensorReadings(limit = 500) {
    try {
        const response = await fetch(`${SENSOR_API_BASE}/data?limit=${limit}`);
        if (!response.ok) {
            return [];
        }

        const payload = await response.json();
        return Array.isArray(payload) ? payload : [];
    } catch (error) {
        console.warn('Unable to load live ministry sensor data.', error);
        return [];
    }
}

function getNumericValue(value) {
    if (value === undefined || value === null || value === '') {
        return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function resolveAnimalId(reading) {
    return reading.animal_id || reading.animalId || reading.cowId || reading.id || 'UNKNOWN';
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

function buildLatestAnimalMap(readings) {
    const latestByAnimal = new Map();

    const orderedReadings = [...readings].sort((left, right) => {
        const leftTime = new Date(left.timestamp || 0).getTime();
        const rightTime = new Date(right.timestamp || 0).getTime();
        return rightTime - leftTime;
    });

    for (const reading of orderedReadings) {
        const animalId = resolveAnimalId(reading);
        if (!latestByAnimal.has(animalId)) {
            latestByAnimal.set(animalId, reading);
        }
    }

    return Array.from(latestByAnimal.values());
}

function deriveDailySeries(readings) {
    const days = new Map();

    for (const reading of readings) {
        const timestamp = reading.timestamp ? new Date(reading.timestamp) : null;
        if (!timestamp || Number.isNaN(timestamp.getTime())) {
            continue;
        }

        const key = timestamp.toISOString().slice(0, 10);
        const entry = days.get(key) || {
            bodyTemps: [],
            pulseRates: [],
            alerts: 0
        };

        const bodyTemp = getNumericValue(reading.body_temp ?? reading.bodyTemperature);
        const pulseRate = getNumericValue(reading.pulse_rate ?? reading.heart_rate ?? reading.activity);
        const thi = getNumericValue(reading.thi);
        const status = getReadingStatus(bodyTemp, pulseRate, thi);

        if (bodyTemp != null) {
            entry.bodyTemps.push(bodyTemp);
        }
        if (pulseRate != null) {
            entry.pulseRates.push(pulseRate);
        }
        if (status !== 'normal') {
            entry.alerts += 1;
        }

        days.set(key, entry);
    }

    const labels = Array.from(days.keys()).sort();
    return {
        labels,
        datasets: {
            bodyTemp: labels.map(label => {
                const entry = days.get(label);
                if (!entry.bodyTemps.length) return null;
                const total = entry.bodyTemps.reduce((sum, value) => sum + value, 0);
                return Number((total / entry.bodyTemps.length).toFixed(1));
            }),
            pulseRate: labels.map(label => {
                const entry = days.get(label);
                if (!entry.pulseRates.length) return null;
                const total = entry.pulseRates.reduce((sum, value) => sum + value, 0);
                return Math.round(total / entry.pulseRates.length);
            }),
            alerts: labels.map(label => days.get(label).alerts)
        }
    };
}

async function getNationalStats() {
    const readings = await fetchSensorReadings(500);
    const latestAnimals = buildLatestAnimalMap(readings);
    const healthyAnimals = latestAnimals.filter(reading => getReadingStatus(
        getNumericValue(reading.body_temp ?? reading.bodyTemperature),
        getNumericValue(reading.pulse_rate ?? reading.heart_rate ?? reading.activity),
        getNumericValue(reading.thi)
    ) === 'normal').length;
    const activeAlerts = latestAnimals.filter(reading => getReadingStatus(
        getNumericValue(reading.body_temp ?? reading.bodyTemperature),
        getNumericValue(reading.pulse_rate ?? reading.heart_rate ?? reading.activity),
        getNumericValue(reading.thi)
    ) !== 'normal').length;

    return {
        totalMonitored: latestAnimals.length,
        healthyAnimals,
        activeAlerts,
        highRiskAreas: activeAlerts
    };
}

function getRegionalData() {
    return null;
}

function getAllRegionalData() {
    return [];
}

async function getDiseaseTrends() {
    const readings = await fetchSensorReadings(500);
    const series = deriveDailySeries(readings);

    return {
        labels: series.labels,
        datasets: {
            bodyTemp: series.datasets.bodyTemp,
            pulseRate: series.datasets.pulseRate,
            alerts: series.datasets.alerts
        }
    };
}

async function getAlertDistribution() {
    const readings = await fetchSensorReadings(500);
    const latestAnimals = buildLatestAnimalMap(readings);
    const normal = latestAnimals.filter(reading => getReadingStatus(
        getNumericValue(reading.body_temp ?? reading.bodyTemperature),
        getNumericValue(reading.pulse_rate ?? reading.heart_rate ?? reading.activity),
        getNumericValue(reading.thi)
    ) === 'normal').length;
    const warning = latestAnimals.filter(reading => getReadingStatus(
        getNumericValue(reading.body_temp ?? reading.bodyTemperature),
        getNumericValue(reading.pulse_rate ?? reading.heart_rate ?? reading.activity),
        getNumericValue(reading.thi)
    ) === 'warning').length;
    const alert = latestAnimals.filter(reading => getReadingStatus(
        getNumericValue(reading.body_temp ?? reading.bodyTemperature),
        getNumericValue(reading.pulse_rate ?? reading.heart_rate ?? reading.activity),
        getNumericValue(reading.thi)
    ) === 'alert').length;

    return {
        labels: ['Normal', 'Warning', 'Alert'],
        data: [normal, warning, alert]
    };
}
