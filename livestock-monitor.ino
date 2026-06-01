#include <WiFi.h>
#include <HTTPClient.h>

// --- Hardware Pin Configurations ---
const int DHT11_PIN  = 4;   // Connected to DHT Out
const int PULSE_PIN  = 3;   // Connected to Pulse Sensor S (ADC1 Channel 3)
const int GPS_RX_PIN = 13;  // Connected to Neo-6M TX
const int GPS_TX_PIN = 12;  // Connected to Neo-6M RX


const char* serverUrl = "https://iot-livestock.onrender.com/api/livestock";

// --- Wi-Fi Credentials ---
const char* ssid     = "The Lord of the PINGS";
const char* password = "987667890";

// --- Global Telemetry Variables ---
volatile int g_pulse_raw = 0;
String g_gps_raw_string  = "No Fix";
float g_temperature_c    = 24.0; // Default baseline value

// Forward declaration of the FreeRTOS background task
void pulseSensorTask(void *pvParameters);

// --- Simple Non-Blocking DHT11 Reader Function ---
float readDHT11Temperature() {
    uint8_t bits[5] = {0, 0, 0, 0, 0};
    uint8_t cnt = 7;
    uint8_t idx = 0;

    // Send Handshake / Start Signal to DHT11
    pinMode(DHT11_PIN, OUTPUT);
    digitalWrite(DHT11_PIN, LOW);
    delay(18); // Keep low for at least 18ms
    digitalWrite(DHT11_PIN, HIGH);
    delayMicroseconds(40);
    pinMode(DHT11_PIN, INPUT);

    // Acknowledge pulse timing window from sensor
    unsigned int loopCount = 10000;
    while(digitalRead(DHT11_PIN) == LOW) if (loopCount-- == 0) return g_temperature_c;
    loopCount = 10000;
    while(digitalRead(DHT11_PIN) == HIGH) if (loopCount-- == 0) return g_temperature_c;

    // Read the 40-bit data packet output stream
    for (int i = 0; i < 40; i++) {
        loopCount = 10000;
        while(digitalRead(DHT11_PIN) == LOW) if (loopCount-- == 0) return g_temperature_c;
        
        unsigned long t = micros();
        loopCount = 10000;
        while(digitalRead(DHT11_PIN) == HIGH) if (loopCount-- == 0) return g_temperature_c;

        if ((micros() - t) > 40) {
            bits[idx] |= (1 << cnt);
        }
        if (cnt == 0) {   // next byte
            cnt = 7;     
            idx++;      
        } else {
            cnt--;
        }
    }

    // Run simple checksum validation check
    if ((bits[0] + bits[1] + bits[2] + bits[3]) == bits[4]) {
        // bits[2] holds the integral temperature integer value for DHT11
        return (float)bits[2];
    }
    
    return g_temperature_c; // Return last known good temperature if checksum drops
}

void setup() {
  // Initialize Serial Monitor for USB Diagnostics
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n--- Starting COW-001 Livestock Hardware Node ---");

  // Initialize GPS on hardware serial bus (UART1) using pins 13 and 12
  Serial1.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

  // Initialize Wi-Fi connection loop
  Serial.print("Connecting to Wi-Fi Network: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWi-Fi Connected Successfully!");
  Serial.print("ESP32-C6 Local Node IP: ");
  Serial.println(WiFi.localIP());

  // Spin up background target loop on Core 0 for real-time heartbeat polling
  xTaskCreate(
    pulseSensorTask,   
    "PulseTask",       
    3000,              
    NULL,              
    1,                 
    NULL               
  );
}

void loop() {
  // --- 1. Pull Incoming Serial Telemetry from Neo-6M GPS Module ---
  if (Serial1.available() > 0) {
    String gpsLine = Serial1.readStringUntil('\n');
    if (gpsLine.startsWith("$GPRMC") || gpsLine.startsWith("$GPGGA")) {
      g_gps_raw_string = gpsLine;
      g_gps_raw_string.trim(); 
      Serial.print("[GPS Live Stream] ");
      Serial.println(g_gps_raw_string);
    }
  }

  // --- 2. Check DHT11 Environmental Status (Every 10 Seconds) ---
  static unsigned long lastDhtTime = 0;
  if (millis() - lastDhtTime >= 10000) { 
    lastDhtTime = millis();
    float localTemp = readDHT11Temperature();
    if (localTemp > 0) {
        g_temperature_c = localTemp;
    }
    Serial.print("[DHT11 Internal Check] Calculated Core Temp: ");
    Serial.concat(g_temperature_c);
    Serial.println(" °C");
  }

  // --- 3. Package and Stream Payload to Local Node.js Server (Every 5 Seconds) ---
  static unsigned long lastStreamTime = 0;
  if (millis() - lastStreamTime >= 5000) { 
    lastStreamTime = millis();

    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      http.begin(serverUrl);
      
      // Setup payload content headers matching standard key=value URL formatting
      http.addHeader("Content-Type", "application/x-www-form-urlencoded");
      
      String postData = "cowId=COW-001"
                        "&bodyTemperature=" + String(g_temperature_c, 1) + 
                        "&pulseRate=" + String(g_pulse_raw) + 
                        "&gpsData=" + g_gps_raw_string;
      
      Serial.println("[HTTP Outbound] Shipping structured data package to local server...");
      int httpResponseCode = http.POST(postData);
      
      if (httpResponseCode > 0) {
        Serial.print("[HTTP Success] Server Response Status Token: ");
        Serial.println(httpResponseCode);
      } else {
        Serial.print("[HTTP Warning] Connection dropped. Reason descriptor: ");
        Serial.println(http.errorToString(httpResponseCode).c_str());
      }
      
      http.end(); 
    } else {
      Serial.println("[Network Error] Outbound dropped: Wi-Fi link inactive.");
    }
  }
}

// --- Independent Thread Stack Execution Worker for Pulse Sensor ---
void pulseSensorTask(void *pvParameters) {
  while (1) {
    g_pulse_raw = analogRead(PULSE_PIN);
    vTaskDelay(pdMS_TO_TICKS(200)); // Sleep loop state for 200 milliseconds to balance core resource load
  }
}