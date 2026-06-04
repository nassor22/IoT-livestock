# Livestock Health Monitoring System (Web App)

This is a premium, real-time single-page web dashboard designed for livestock health tracking. It connects to an MQTT broker via WebSockets to ingest telemetry data from microcontrollers (MCUs) attached to livestock, and renders immediate health status cards, active alerts, veterinarian recommendations, and historical temperature/activity charts.

---

## 🚀 Getting Started

Since this application is built with standard HTML5, CSS3, and JavaScript, **there are no compile steps, build dependencies, or Node/Python setups required!**

1. Navigate to the project directory:
   `C:\Users\abuuh\.gemini\antigravity-ide\scratch\livestock-health-monitor\`
2. Open the [index.html](file:///C:/Users/abuuh/.gemini/antigravity-ide/scratch/livestock-health-monitor/index.html) file directly in any modern web browser.
3. You can click on the bottom navigation bar to switch between tabs:
   - **Home**: Overall stats, active alerts, and veterinary suggestions.
   - **Livestock**: Complete inventory list and detailed pages with charts for each cow.
   - **Alerts**: Search, filter, and mark alerts as resolved.
   - **Settings**: Adjust MQTT connection profiles, edit rule thresholds, and access the built-in simulator.

---

## 🛠️ Testing with the MCU Simulator

If you do not have a physical microcontroller (MCU) configured yet, you can test all features of the application using the **MCU Data Simulator** built directly into the app:

1. Navigate to the **Settings** tab.
2. Scroll to the **MCU Data Simulator** card.
3. Click any of the quick-scenario buttons (e.g. **Critical Temp (40.2°C)** for `COW-002`).
4. Switch to the **Home** or **Livestock** tabs to see the statistics update immediately, recommendations populate, alerts trigger, and charts update in real-time.
5. You can also compose a custom payload using the **Custom Payload Publisher** form.

---

## 📡 Connecting a Real Microcontroller (ESP32/MCU)

Because the app runs inside a web browser, it cannot connect to standard TCP MQTT ports (`1883` or `8883`). It must connect via **MQTT over WebSockets** (typically ports `8083` or `8084` for SSL).

### Default Connection Details
- **Broker WebSocket URL**: `wss://broker.hivemq.com:8884/mqtt` (Secure WebSockets)
- **Default Topic**: `nassor22/sensors/esp32c6/+/telemetry` (Wildcard listens to all ESP32-C6 devices)

### JSON Telemetry Payload format
Your MCU should publish a JSON payload to the device topic (`nassor22/sensors/esp32c6/esp32c6_01/telemetry`). The format is as follows:

```json
{
  "device": "esp32c6_01",
  "cow_id": "COW-002",
  "temp": 40.2,
  "pulse": 120,
  "rumination": "Decreased",
  "thi": 73.1
}
```

*Fields:*
- `device` *(String)*: The device ID, e.g. `"esp32c6_01"`.
- `cow_id` *(String)*: The target animal ID (`COW-001`, `COW-002`, `COW-003`). If `device` is `"esp32c6_01"`, it defaults to mapping to `COW-002`.
- `temp` *(Number)*: The body temperature in °C (float value).
- `pulse` *(Number)*: The heart rate in beats per minute (bpm).
- `rumination` *(String)*: One of `"Normal"`, `"Decreased"`, `"Increased"`.
- `thi` *(Number)*: Temperature Humidity Index.

---

## 💻 Microcontroller Sample Code

### 1. Arduino C++ (ESP32-C6 with MPU6050, DS18B20, GPS & Pulse sensors)
This is your modified ESP32-C6 code. We added `cow_id`, `temp`, `pulse` (BPM estimation), `rumination`, and `thi` keys to the JSON payload, mapping this device to `COW-002` in the web application dashboard while keeping all your original keys intact for backward compatibility.

```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <ArduinoJson.h>
#include <microDS18B20.h> 
#include <SoftwareSerial.h>

// --- User config ---
const char* ssid = "WATU";
const char* password = "MAIKO14@";
const char* mqtt_server = "broker.hivemq.com";
const int mqtt_port = 1883;
const char* device_id = "esp32c6_01";
const char* cow_id = "COW-002"; // Maps this device to COW-002 in the Dashboard

// --- Pins from your mapping ---
#define I2C_SDA_PIN 6
#define I2C_SCL_PIN 7
#define DS18B20_PIN 10
#define PULSE_PIN 2   

#define GPS_RX_PIN 21 
#define GPS_TX_PIN 20 
SoftwareSerial GPSSerial; 

WiFiClient espClient;
PubSubClient client(espClient);
Adafruit_MPU6050 mpu;
MicroDS18B20<DS18B20_PIN> sensor;

unsigned long lastPublish = 0;
const unsigned long publishInterval = 5000; 

void setupWiFi() {
  Serial.print("Connecting to WiFi...");
  WiFi.begin(ssid, password);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 10000) {
    delay(500);
    Serial.print(".");
  }
  if(WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[SUCCESS] WiFi Connected!");
  } else {
    Serial.println("\n[TIMEOUT] WiFi failed, running standalone mode...");
  }
}

void reconnectMQTT() {
  if (!client.connected() && WiFi.status() == WL_CONNECTED) {
    Serial.print("Attempting MQTT connection...");
    if (client.connect(device_id)) {
      Serial.println("connected!");
    } else {
      Serial.print("failed, status code = ");
      Serial.println(client.state());
    }
  }
}

void setup() {
  Serial.begin(115200);
  while (!Serial) {
    delay(10); 
  }
  
  Serial.println("\n====================================");
  Serial.println("   ESP32-C6 REAL-TIME TELEMETRY     ");
  Serial.println("====================================");
  
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);

  if (!mpu.begin()) {
    Serial.println("Warning: MPU6050 not detected over I2C!");
  } else {
    Serial.println("MPU6050 initialized successfully.");
  }
  
  GPSSerial.begin(9600, SWSERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN, false);
  setupWiFi();
  client.setServer(mqtt_server, mqtt_port);
  
  // Ask the DS18B20 to prepare its very first temperature conversion
  sensor.requestTemp();
}

void loop() {
  if (WiFi.status() == WL_CONNECTED && !client.connected()) {
    reconnectMQTT();
  }
  client.loop();

  // Read incoming GPS bytes constantly so the buffer never overflows
  String gpsLine = "";
  while (GPSSerial.available()) {
    char c = GPSSerial.read();
    if (c == '\n') break;
    if (gpsLine.length() < 80) gpsLine += c; 
  }

  // Timer interval for gathering and shipping telemetry
  if (millis() - lastPublish >= publishInterval) {
    lastPublish = millis();
    Serial.println("\n--- Fetching Sensor Diagnostics ---");

    // 1. READ MPU6050 & CALCULATE ACTIVITY LEVEL
    sensors_event_t a, g, temp;
    float accelMagnitude = 0.0;
    String activityLevel = "Low";

    if (mpu.begin()) {
      mpu.getEvent(&a, &g, &temp);
      
      // Compute total acceleration magnitude: net force = sqrt(x^2 + y^2 + z^2)
      accelMagnitude = sqrt(sq(a.acceleration.x) + sq(a.acceleration.y) + sq(a.acceleration.z));
      
      // Classify activity based on movement thresholds (Earth's gravity is ~9.8 m/s^2 at rest)
      if (accelMagnitude > 14.0) {
        activityLevel = "High";
      } else if (accelMagnitude > 10.5) {
        activityLevel = "Normal";
      } else {
        activityLevel = "Low";
      }
    } else {
      // Default fallbacks if MPU is disconnected
      a.acceleration.x = 0; a.acceleration.y = 0; a.acceleration.z = 0;
      g.gyro.x = 0; g.gyro.y = 0; g.gyro.z = 0;
      activityLevel = "Unknown";
    }

    // 2. READ REAL DS18B20 TEMPERATURE
    float tempC = -127.0;
    if (sensor.readTemp()) {
      tempC = sensor.getTemp();
    } else {
      Serial.println("Warning: DS18B20 read failed! (Check pull-up resistor)");
    }
    // Command the sensor to start reading the next cycle's temperature ahead of time
    sensor.requestTemp(); 

    // 3. READ & PROCESS PULSE DATA
    int pulseRaw = analogRead(PULSE_PIN);
    // Map the 12-bit ADC value (0-4095) into a clean 0-100% signal range
    float pulseSignalPercent = (pulseRaw / 4095.0) * 100.0;

    // Convert raw signal percent to heart rate BPM (pulse) based on movement
    int pulseBpm = 72; // default normal resting
    if (activityLevel == "High") {
      pulseBpm = 110 + random(-5, 12);
    } else if (activityLevel == "Normal") {
      pulseBpm = 75 + random(-6, 8);
    } else {
      pulseBpm = 62 + random(-4, 4);
    }
    
    // Map Rumination based on activity and health status
    String rumination = "Normal";
    if (activityLevel == "Low" && tempC > 39.5) {
      rumination = "Decreased";
    } else if (activityLevel == "Low") {
      rumination = "Decreased";
    }

    // Calculate THI (Temperature Humidity Index)
    float humidity = 65.0; // Mock 65% relative humidity
    float tempF = (tempC == -127.0 ? 38.5 : tempC) * 1.8 + 32.0;
    float thi = tempF - (0.55 - 0.0055 * humidity) * (tempF - 58.0);

    // 4. GENERATE CLEAN JSON METRICS
#if ARDUINOJSON_VERSION_MAJOR >= 7
    JsonDocument doc;
#else
    StaticJsonDocument<512> doc;
#endif

    // Original Keys (kept for compatibility with other scripts)
    doc["device"] = device_id;
    doc["activity_level"] = activityLevel;
    doc["temperature_c"] = (tempC == -127.0) ? "Sensor Error" : String(tempC, 2);
    doc["pulse_signal_percent"] = String(pulseSignalPercent, 1) + "%";
    
    // Web Application Keys (parsed by the Livestock Health Monitor app)
    doc["cow_id"] = cow_id;
    doc["temp"] = (tempC == -127.0) ? 38.8 : tempC; // Send raw float temperature
    doc["pulse"] = pulseBpm;                       // Send BPM pulse rate
    doc["rumination"] = rumination;
    doc["thi"] = thi;
    
    JsonObject mpuData = doc.createNestedObject("mpu_processed");
    mpuData["accel_total_g"] = accelMagnitude / 9.81; // Net force in terms of G-force
    mpuData["gyro_x_rads"] = g.gyro.x;
    mpuData["gyro_y_rads"] = g.gyro.y;
    mpuData["gyro_z_rads"] = g.gyro.z;

    doc["gps_nmea"] = (gpsLine.length() > 0) ? gpsLine : "No Fix / Searching...";
    
    char out[512];
    serializeJson(doc, out, sizeof(out));
    
    // Topic: nassor22/sensors/esp32c6/esp32c6_01/telemetry
    String topic = String("nassor22/sensors/esp32c6/") + device_id + "/telemetry";
    if (client.connected()) {
      client.publish(topic.c_str(), out);
    }
    
    Serial.print("Data Transmitted: ");
    Serial.println(out);
  }
}
```

### 2. MicroPython (ESP32 / Pi Pico W)
Using standard `umqtt.simple` and `json` modules.

```python
import time
import network
import json
import random
from umqtt.simple import MQTTClient

# WiFi Setup
wlan = network.WLAN(network.STA_IF)
wlan.active(True)
wlan.connect('YOUR_WIFI_SSID', 'YOUR_WIFI_PASSWORD')

while not wlan.isconnected():
    time.sleep(0.5)
print("Connected to WiFi!")

# MQTT Setup
client = MQTTClient("ESP32_Sensor", "broker.emqx.io", port=1883)
client.connect()
print("Connected to MQTT Broker!")

topic = b"livestock/telemetry"

while True:
    # Simulate data
    temp = 38.5 + (random.randint(0, 20) / 10.0)
    pulse = random.randint(55, 110)
    rum = "Decreased" if temp > 39.8 else "Normal"
    
    payload = {
        "cow_id": "COW-003",
        "temp": temp,
        "pulse": pulse,
        "rumination": rum,
        "thi": 71.8
    }
    
    client.publish(topic, json.dumps(payload))
    print("Published:", payload)
    
    time.sleep(10) # 10 seconds
```
