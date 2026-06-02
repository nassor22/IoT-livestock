#include <WiFi.h>
#include <HTTPClient.h>

// --- Hardware Pin Configurations ---
const int DHT11_PIN  = 4;   // Connected to DHT Out
const int PULSE_PIN  = 3;   // Connected to Pulse Sensor S (ADC1 Channel 3)
const int GPS_RX_PIN = 13;  // Connected to Neo-6M TX -> (Switch wires if data doesn't flow)
const int GPS_TX_PIN = 12;  // Connected to Neo-6M RX -> (Switch wires if data doesn't flow)

// --- Firebase Cloud Database Configuration ---
// Formatted exactly from your screenshot. Note the HTTP protocol and trailing .json!
const char* firebaseUrl = "http://iot-livestock-439f2-default-rtdb.asia-southeast1.firebasedatabase.app/livestock/COW-001.json";

// --- Wi-Fi Network Credentials ---
const char* ssid     = "The Lord of the PINGS";
const char* password = "987667890";

// --- Global Telemetry Variables ---
volatile int g_pulse_raw = 0;
String g_gps_raw_string  = "No Fix";
float g_temperature_c    = 24.0; // Baseline initial variable state

// Forward declaration of the pulse monitoring background worker
void pulseSensorTask(void *pvParameters);

// --- Non-Blocking Software DHT11 Driver Routine ---
float readDHT11Temperature() {
    uint8_t bits[5] = {0, 0, 0, 0, 0};
    uint8_t cnt = 7;
    uint8_t idx = 0;

    // Send Handshake / Trigger pulse down the wire
    pinMode(DHT11_PIN, OUTPUT);
    digitalWrite(DHT11_PIN, LOW);
    delay(18); 
    digitalWrite(DHT11_PIN, HIGH);
    delayMicroseconds(40);
    pinMode(DHT11_PIN, INPUT);

    // Watch for response timeout windows
    unsigned int timeoutCheck = 10000;
    while(digitalRead(DHT11_PIN) == LOW) if (timeoutCheck-- == 0) return g_temperature_c;
    timeoutCheck = 10000;
    while(digitalRead(DHT11_PIN) == HIGH) if (timeoutCheck-- == 0) return g_temperature_c;

    // Capture and reconstruct the 40-bit transmission train
    for (int i = 0; i < 40; i++) {
        timeoutCheck = 10000;
        while(digitalRead(DHT11_PIN) == LOW) if (timeoutCheck-- == 0) return g_temperature_c;
        
        unsigned long timingBit = micros();
        timeoutCheck = 10000;
        while(digitalRead(DHT11_PIN) == HIGH) if (timeoutCheck-- == 0) return g_temperature_c;

        if ((micros() - timingBit) > 40) {
            bits[idx] |= (1 << cnt);
        }
        if (cnt == 0) {   
            cnt = 7;     
            idx++;      
        } else {
            cnt--;
        }
    }

    // Process basic arithmetic checksum validation
    if ((bits[0] + bits[1] + bits[2] + bits[3]) == bits[4]) {
        return (float)bits[2]; // Return validated byte structure integer data
    }
    return g_temperature_c; 
}

void setup() {
  // Spawn main tracking diagnostic USB port
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n--- Initiating Firebase Production Firmware Node ---");

  // Spin up dedicated hardware serial abstraction (UART1) for GPS parsing
  Serial1.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

  // Establish stable network link
  Serial.print("Connecting to Wi-Fi Access Point: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWi-Fi Handshake Success!");
  Serial.print("Local Network Assigned IP: ");
  Serial.println(WiFi.localIP());

  // Instantiate parallel core FreeRTOS task layer targeting heart rate values
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
      Serial.print("[GPS Stream] Captured NMEA: ");
      Serial.println(g_gps_raw_string);
    }
  }

  // --- 2. Check DHT11 Microclimate Core Metrics (Every 10 Seconds) ---
  static unsigned long lastDhtReadTime = 0;
  if (millis() - lastDhtReadTime >= 10000) { 
    lastDhtReadTime = millis();
    float currentTemp = readDHT11Temperature();
    if (currentTemp > 0) {
        g_temperature_c = currentTemp;
    }
    Serial.print("[DHT11 State] Environmental Reading: ");
    Serial.print(g_temperature_c, 1);
    Serial.println(" °C");
  }

  // --- 3. Stream Telemetry Directly to Firebase Realtime Database (Every 5 Seconds) ---
  static unsigned long lastFirebaseSyncTime = 0;
  if (millis() - lastFirebaseSyncTime >= 5000) { 
    lastFirebaseSyncTime = millis();

    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      
      // Initialize endpoint connection to Firebase REST structure
      http.begin(firebaseUrl);
      
      // Declare pure application/json data structure configuration header
      http.addHeader("Content-Type", "application/json");
      
      // Calculate contextual logic for animal behavior categories
      String behaviorState = (g_pulse_raw > 2200) ? "High" : "Normal";
      
      // Build a clean, properly escaped JSON payload configuration format block
      String jsonPayload = "{\"cowId\":\"COW-001\""
                           ",\"bodyTemperature\":" + String(g_temperature_c, 1) + 
                           ",\"pulseRate\":" + String(g_pulse_raw) + 
                           ",\"activityLevel\":\"" + behaviorState + "\"" +
                           ",\"gpsData\":\"" + g_gps_raw_string + "\"}";
      
      Serial.println("[Firebase Outbound] Uploading sensor array block directly to cloud node...");
      
      // Execute an HTTP PUT to cleanly rewrite and maintain the single track point structure
      int httpResponseCode = http.PUT(jsonPayload); 
      
      if (httpResponseCode > 0) {
        Serial.print("[Firebase API Code] Packet synced successfully! Code: ");
        Serial.println(httpResponseCode); // Expect an HTTP 200 OK from Firebase
      } else {
        Serial.print("[Firebase Warning] Transport layer drop out: ");
        Serial.println(http.errorToString(httpResponseCode).c_str());
      }
      
      http.end(); 
    } else {
      Serial.println("[Network Alert] Execution halted: Wi-Fi connection link unavailable.");
    }
  }
}

// --- Dedicated Asynchronous Core Sampling Worker Stack ---
void pulseSensorTask(void *pvParameters) {
  while (1) {
    g_pulse_raw = analogRead(PULSE_PIN);
    vTaskDelay(pdMS_TO_TICKS(200)); // Sleep thread cleanly for 200 milliseconds to avoid thrashing
  }
}