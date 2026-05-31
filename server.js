const express = require('express');
const mqtt = require('mqtt');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = process.env.PORT || 8000;

// Parse incoming requests and allow CORS for simple deployments
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
});

// --- Database Configuration ---
const pool = new Pool({
  user: process.env.DB_USER || 'nassor_admin',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'livestock_db',
  password: process.env.DB_PASSWORD || 'wataru',
  port: Number(process.env.DB_PORT) || 5432,
  max: Number(process.env.DB_MAX_CLIENTS) || 10,
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT) || 30000,
});

pool.on('connect', () => {
  console.log('Connected to PostgreSQL database.');
  createTable();
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});


async function createTable() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS sensor_data (
      id SERIAL PRIMARY KEY,
      animal_id TEXT,
      timestamp TIMESTAMPTZ DEFAULT NOW(),
      body_temp REAL,
      ambient_temp REAL,
      humidity REAL,
      activity INTEGER,
      heart_rate INTEGER,
      thi REAL,
      pulse_rate INTEGER,
      gps_data TEXT,
      source TEXT DEFAULT 'mqtt'
    );
  `;
  try {
    await pool.query(createTableQuery);
    await pool.query('ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS animal_id TEXT');
    await pool.query('ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS pulse_rate INTEGER');
    await pool.query('ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS gps_data TEXT');
    await pool.query("ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'mqtt'");
    await pool.query('CREATE INDEX IF NOT EXISTS sensor_data_animal_timestamp_idx ON sensor_data(animal_id, timestamp DESC)');
    console.log('Table "sensor_data" is ready.');
  } catch (err) {
    console.error('Error creating table:', err);
  }
}

function parseNumber(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveAnimalId(payload) {
  return payload.animalId || payload.cowId || payload.id || 'UNKNOWN';
}

async function insertSensorReading(payload, source) {
  const animalId = resolveAnimalId(payload);
  const insertQuery = `
    INSERT INTO sensor_data (
      animal_id,
      body_temp,
      ambient_temp,
      humidity,
      activity,
      heart_rate,
      thi,
      pulse_rate,
      gps_data,
      source
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id
  `;

  const values = [
    animalId,
    parseNumber(payload.bodyTemp ?? payload.bodyTemperature),
    parseNumber(payload.ambientTemp),
    parseNumber(payload.humidity),
    parseNumber(payload.activity),
    parseNumber(payload.heartRate ?? payload.heart_rate),
    parseNumber(payload.thi),
    parseNumber(payload.pulseRate ?? payload.pulse_rate),
    payload.gpsData ?? payload.gps ?? null,
    source
  ];

  const result = await pool.query(insertQuery, values);
  return { id: result.rows[0].id, animalId };
}

// --- MQTT Configuration ---
const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://YOUR_MQTT_BROKER_IP';
const MQTT_TOPIC = process.env.MQTT_TOPIC || 'livestock/data';
const mqttClient = mqtt.connect(MQTT_BROKER);

mqttClient.on('connect', () => {
  console.log('Connected to MQTT broker:', MQTT_BROKER);
  mqttClient.subscribe(MQTT_TOPIC, (err) => {
    if (err) {
      console.error('MQTT subscription error:', err);
    }
  });
});

mqttClient.on('message', async (topic, message) => {
  if (topic === 'livestock/data') {
    try {
      const data = JSON.parse(message.toString());
      console.log('Received data:', data);
      const inserted = await insertSensorReading(data, 'mqtt');
      console.log('Data inserted into database, ID:', inserted.id, 'Animal:', inserted.animalId);

    } catch (e) {
      console.error('Error processing MQTT message:', e);
    }
  }
});

app.post('/api/livestock', async (req, res) => {
  try {
    const inserted = await insertSensorReading(req.body, 'http');
    res.status(201).json(inserted);
  } catch (err) {
    console.error('Error saving livestock reading', err);
    res.status(500).json({ error: 'Error saving livestock reading' });
  }
});

// --- API Endpoints (Optional) ---
app.get('/data', async (req, res) => {
    const animalId = req.query.animalId;
    const limit = Math.min(Number(req.query.limit) || 100, 500);

    try {
        const query = animalId
          ? 'SELECT * FROM sensor_data WHERE animal_id = $1 ORDER BY timestamp DESC LIMIT $2'
          : 'SELECT * FROM sensor_data ORDER BY timestamp DESC LIMIT $1';
        const values = animalId ? [animalId, limit] : [limit];
        const { rows } = await pool.query(query, values);
        res.json(rows);
    } catch (err) {
        console.error('Error retrieving data', err);
        res.status(500).send('Error retrieving data');
    }
});

app.get('/api/livestock/:animalId/latest', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM sensor_data WHERE animal_id = $1 ORDER BY timestamp DESC LIMIT 1',
      [req.params.animalId]
    );

    res.json(rows[0] || null);
  } catch (err) {
    console.error('Error retrieving latest livestock reading', err);
    res.status(500).json({ error: 'Error retrieving latest livestock reading' });
  }
});

app.get('/api/livestock/:animalId/readings', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 7, 50);
    const { rows } = await pool.query(
      'SELECT * FROM sensor_data WHERE animal_id = $1 ORDER BY timestamp DESC LIMIT $2',
      [req.params.animalId, limit]
    );

    res.json(rows);
  } catch (err) {
    console.error('Error retrieving livestock history', err);
    res.status(500).json({ error: 'Error retrieving livestock history' });
  }
});

// Serve frontend static files and return index.html for non-API routes
app.use(express.static(path.join(__dirname)));

app.get('*', (req, res, next) => {
  // Let API routes pass through
  if (req.path.startsWith('/api') || req.path === '/data') return next();
  res.sendFile(path.join(__dirname, 'index.html'));
});


app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
