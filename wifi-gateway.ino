// IoT Livestock Monitoring System - WiFi Gateway for ESP32-C6

#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>

// Pin definitions (adjust for your ESP32 board)
#define DHTPIN 2          // DHT11 data pin
#define DHTTYPE DHT11     // DHT sensor type
#define LM35_PIN A0       // LM35 analog output (BT)
#define ACTIVITY_PIN A1   // RV2 potentiometer (ACP)
#define HRP_PIN A2        // RV1 potentiometer (HRP)

// WiFi and MQTT Configuration
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* mqtt_server = "YOUR_MQTT_BROKER_IP";
const int mqtt_port = 1883;
const char* mqtt_topic = "livestock/data";

// Alert thresholds
#define BODY_TEMP_ALERT 39.5
#define ACTIVITY_LOW_PCT 20
#define HRP_LOW_BPM 15
#define HRP_HIGH_BPM 85
#define THI_STRESS_ALERT 72.0

DHT dht(DHTPIN, DHTTYPE);
WiFiClient espClient;
PubSubClient client(espClient);

float readLm35C() {
  int raw = analogRead(LM35_PIN);
  float voltage = raw * (3.3 / 4095.0); // ESP32 has 12-bit ADC and 3.3V reference
  return voltage * 100.0; // LM35: 10mV per C
}

int readActivityPercent() {
  int raw = analogRead(ACTIVITY_PIN);
  return (raw * 100) / 4095;
}

int readHeartRateBpm() {
  int raw = analogRead(HRP_PIN);
  return (raw * 100) / 4095; // Simple mapping for demo
}

float calculateThi(float ambientC, float humidityPct) {
  float tF = (1.8 * ambientC) + 32.0;
  return tF - (0.55 - (0.0055 * humidityPct)) * (tF - 58.0);
}

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
}

void reconnect() {
  // Loop until we're reconnected
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    // Attempt to connect
    if (client.connect("ESP32-C6-Client")) {
      Serial.println("connected");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      // Wait 5 seconds before retrying
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  dht.begin();
  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
  Serial.println("WiFi Gateway Started");
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  float humidity = dht.readHumidity();
  float ambientTemp = dht.readTemperature();
  float bodyTemp = readLm35C();
  int activityPct = readActivityPercent();
  int heartRate = readHeartRateBpm();

  if (isnan(humidity) || isnan(ambientTemp)) {
    Serial.println("Sensor Error: DHT11 read failed");
    delay(2000);
    return;
  }

  float thi = calculateThi(ambientTemp, humidity);

  // Create JSON payload
  String payload = "{";
  payload += "\"bodyTemp\":" + String(bodyTemp) + ",";
  payload += "\"ambientTemp\":" + String(ambientTemp) + ",";
  payload += "\"humidity\":" + String(humidity) + ",";
  payload += "\"activity\":" + String(activityPct) + ",";
  payload += "\"heartRate\":" + String(heartRate) + ",";
  payload += "\"thi\":" + String(thi);
  payload += "}";

  // Publish to MQTT
  Serial.print("Publishing message: ");
  Serial.println(payload);
  client.publish(mqtt_topic, payload.c_str());

  // Check for alerts
  bool bodyAlert = bodyTemp > BODY_TEMP_ALERT;
  bool activityLow = activityPct < ACTIVITY_LOW_PCT;
  bool hrpAlert = (heartRate < HRP_LOW_BPM || heartRate > HRP_HIGH_BPM);
  bool thiAlert = thi >= THI_STRESS_ALERT;

  if (bodyAlert || activityLow || hrpAlert || thiAlert) {
    String alert_topic = String(mqtt_topic) + "/alert";
    String alert_payload = "ALERT: ";
    if (bodyAlert) alert_payload += "HighBodyTemp ";
    if (activityLow) alert_payload += "LowActivity ";
    if (hrpAlert) alert_payload += "HeartRate ";
    if (thiAlert) alert_payload += "HeatStress ";
    
    Serial.print("Publishing alert: ");
    Serial.println(alert_payload);
    client.publish(alert_topic.c_str(), alert_payload.c_str());
  }

  delay(10000); // Send data every 10 seconds
}
