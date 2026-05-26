const express = require('express');
const mqtt = require('mqtt');
const { Pool } = require('pg');

const app = express();
const port = 3000;

// --- Database Configuration ---
const pool = new Pool({
  user: 'nassor_admin',      // Your PostgreSQL username
  host: 'localhost',
  database: 'livestock_db',       // Your PostgreSQL database name
  password: 'wataru', // Your PostgreSQL password
  port: 5432,
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
      timestamp TIMESTAMPTZ DEFAULT NOW(),
      body_temp REAL,
      ambient_temp REAL,
      humidity REAL,
      activity INTEGER,
      heart_rate INTEGER,
      thi REAL
    );
  `;
  try {
    await pool.query(createTableQuery);
    console.log('Table "sensor_data" is ready.');
  } catch (err) {
    console.error('Error creating table:', err);
  }
}

// --- MQTT Configuration ---
const mqttClient = mqtt.connect('mqtt://YOUR_MQTT_BROKER_IP'); // Replace with your MQTT broker IP

mqttClient.on('connect', () => {
  console.log('Connected to MQTT broker.');
  mqttClient.subscribe('livestock/data', (err) => {
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

      const insertQuery = 'INSERT INTO sensor_data(body_temp, ambient_temp, humidity, activity, heart_rate, thi) VALUES($1, $2, $3, $4, $5, $6) RETURNING id';
      const values = [
        data.bodyTemp,
        data.ambientTemp,
        data.humidity,
        data.activity,
        data.heartRate,
        data.thi
      ];

      const result = await pool.query(insertQuery, values);
      console.log('Data inserted into database, ID:', result.rows[0].id);

    } catch (e) {
      console.error('Error processing MQTT message:', e);
    }
  }
});

// --- API Endpoints (Optional) ---
app.get('/data', async (req, res) => {
    const query = 'SELECT * FROM sensor_data ORDER BY timestamp DESC LIMIT 100';
    try {
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (err) {
        console.error('Error retrieving data', err);
        res.status(500).send('Error retrieving data');
    }
});


app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
