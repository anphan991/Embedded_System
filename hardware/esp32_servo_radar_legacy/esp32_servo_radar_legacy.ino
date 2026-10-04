#include <WiFi.h>
#include <PubSubClient.h>
#include <ESP32Servo.h>
#include <math.h>

// ================= CẤU HÌNH HỆ THỐNG =================
const char* ssid        = "YOUR_WIFI_SSID";
const char* password    = "YOUR_WIFI_PASSWORD";
const char* mqtt_server = "192.168.1.10";
const int   mqtt_port   = 1883;

// Chân cắm Servo
const int PAN_PIN  = 13;
const int TILT_PIN = 27;

// Chiều cao camera và điểm ngắm trên người tính từ sàn (mm).
const float CAMERA_HEIGHT_MM = 1500.0;
const float TARGET_HEIGHT_MM = 900.0;

// Đối tượng hệ thống
WiFiClient   espClient;
PubSubClient client(espClient);
Servo        servoPan;
Servo        servoTilt;

// ---- Trạng thái Servo ----
float currentPan  = 90.0, targetPan  = 90.0;
float currentTilt = 90.0, targetTilt = 90.0;
const float SMOOTHING_FACTOR = 0.12;
bool isMoving = false;

// ---- Trạng thái chế độ ----
bool isManualMode = true;
unsigned long lastManualCmd = 0;
const unsigned long MANUAL_TIMEOUT_MS = 3600000; // 1 tiếng

// ---- Lọc nhiễu tọa độ Radar (EMA) ----
float smoothX = 0.0, smoothY = 0.0;
const float RADAR_SMOOTH = 0.25;
bool  hasTarget = false;
unsigned long lastTargetTime = 0;
const unsigned long TARGET_LOST_TIMEOUT = 3000;
const unsigned long RADAR_PRIORITY_MS = 1200;
unsigned long lastWifiAttempt = 0;
unsigned long lastMqttAttempt = 0;

// Buffer đọc Radar (Cơ chế chống trôi khung hình mới nhất)
byte radarBuffer[30];
unsigned long radarBytesReceived = 0;
unsigned long radarFramesReceived = 0;
unsigned long radarTargetFramesReceived = 0;
unsigned long lastRadarDiagnostics = 0;
byte radarLastByte = 0;

// ================= CHUYỂN ĐỔI TỌA ĐỘ RADAR → GÓC SERVO =================
void radarToServoAngles(float xMm, float yMm) {
  if (yMm <= 50) return; // Bỏ qua tín hiệu nhiễu quá gần (< 5cm)

  float theta_rad = atan2(xMm, yMm);
  float theta_deg = theta_rad * (180.0 / M_PI);
  targetPan = 90.0 - theta_deg;

  if (CAMERA_HEIGHT_MM > 0) {
    float D = sqrt(xMm * xMm + yMm * yMm);
    float heightDifference = CAMERA_HEIGHT_MM - TARGET_HEIGHT_MM;
    float tilt_rad = atan2(heightDifference, D);
    float tilt_deg = tilt_rad * (180.0 / M_PI);
    targetTilt = 90.0 - tilt_deg;
  }

  targetPan  = constrain(targetPan,  10, 170);
  targetTilt = constrain(targetTilt, 10, 170);

  Serial.print("[AUTO] Pan="); Serial.print(targetPan, 1);
  Serial.print("  Tilt="); Serial.print(targetTilt, 1);
  Serial.print("  (X="); Serial.print(xMm);
  Serial.print(" Y="); Serial.print(yMm); Serial.println(")");
}

// LD2450 stores sign in bit 15 (1 = positive, 0 = negative),
// while bits 0..14 store the magnitude. This is not two's-complement.
int16_t decodeLd2450Signed(uint8_t lowByte, uint8_t highByte) {
  const uint16_t raw = (static_cast<uint16_t>(highByte) << 8) | lowByte;
  const int16_t magnitude = static_cast<int16_t>(raw & 0x7FFF);
  return (raw & 0x8000) ? magnitude : -magnitude;
}

// ================= KẾT NỐI MẠNG =================
void setup_wifi() {
  Serial.print("\nKet noi WiFi: "); Serial.println(ssid);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  lastWifiAttempt = millis();
  unsigned long t = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t < 20000) {
    delay(500); Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi OK! IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\n[LOI] Khong ket noi duoc WiFi!");
  }
}

void reconnect() {
  if (client.connected() || WiFi.status() != WL_CONNECTED) return;

  lastMqttAttempt = millis();
  Serial.print("Ket noi MQTT... ");
  if (client.connect("ESP32_AI_Tracking")) {
    Serial.println("OK!");
    client.subscribe("embedded/servo/manual");
    client.subscribe("embedded/servo/tracking");
    client.subscribe("embedded/servo/mode");
    client.subscribe("embedded/servo/buzzer");
  } else {
    Serial.print("That bai, ma loi: ");
    Serial.println(client.state());
  }
}

// ================= XỬ LÝ LỆNH MQTT =================
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String msg = "";
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
  msg.toUpperCase();
  String t = String(topic);

  Serial.print("[MQTT] Kenh: "); Serial.print(t);
  Serial.print(" | Lenh: "); Serial.println(msg);

  if (t == "embedded/servo/mode") {
    if (msg == "MANUAL") {
      isManualMode = true;
      lastManualCmd = millis();
      Serial.println("[MODE] >> THU CONG (Manual)");
    } else if (msg == "AUTO") {
      isManualMode = false;
      Serial.println("[MODE] >> TU DONG (Radar Auto-Tracking)");
    }
    return;
  }

  if (t == "embedded/servo/manual") {
    isManualMode = true;
    lastManualCmd = millis();

    if      (msg == "LEFT")  targetPan  += 12;
    else if (msg == "RIGHT") targetPan  -= 12;
    else if (msg == "UP")    targetTilt -= 7;
    else if (msg == "DOWN")  targetTilt += 7;
    else if (msg == "RESET") { targetPan = 90.0; targetTilt = 90.0; }

    targetPan  = constrain(targetPan,  10, 170);
    targetTilt = constrain(targetTilt, 10, 170);
    return;
  }

  if (t == "embedded/servo/tracking" && !isManualMode) {
    // Radar is the primary source while it is reporting a live target.
    // Vision tracking remains available as a fallback when radar data goes stale.
    if (hasTarget && millis() - lastTargetTime < RADAR_PRIORITY_MS) return;
    if (msg == "LOST") return;
    int comma = msg.indexOf(',');
    if (comma > 0) {
      float errorX = msg.substring(0, comma).toFloat() - 320.0;
      float errorY = msg.substring(comma + 1).toFloat() - 240.0;
      targetPan  -= errorX * 0.02;
      targetTilt += errorY * 0.02;
      targetPan  = constrain(targetPan,  10, 170);
      targetTilt = constrain(targetTilt, 10, 170);
    }
    return;
  }
}

// ================= ĐỌC VÀ XỬ LÝ KHUNG RADAR LD2450 =================
void readRadar() {
  while (Serial2.available()) {
    byte b = Serial2.read();
    radarBytesReceived++;
    radarLastByte = b;
    
    // Dịch toàn bộ mảng sang trái 1 byte
    for (int i = 0; i < 29; i++) {
      radarBuffer[i] = radarBuffer[i+1];
    }
    // Chèn byte mới nhất vào cuối mảng
    radarBuffer[29] = b;

    // Khung LD2450 dài 30 byte: header AA FF 03 00, ba target x 8 byte, footer 55 CC.
    if (radarBuffer[0] == 0xAA && radarBuffer[1] == 0xFF &&
        radarBuffer[2] == 0x03 && radarBuffer[3] == 0x00 &&
        radarBuffer[28] == 0x55 && radarBuffer[29] == 0xCC) {
        radarFramesReceived++;
        int targetOffset = -1;
        int16_t xRaw = 0, yRaw = 0, speedRaw = 0;

        // Use the first valid target, falling back to target 2 or 3 if slot 1 is empty.
        for (int target = 0; target < 3; target++) {
          const int offset = 4 + target * 8;
          const int16_t candidateX = decodeLd2450Signed(radarBuffer[offset], radarBuffer[offset + 1]);
          const int16_t candidateY = decodeLd2450Signed(radarBuffer[offset + 2], radarBuffer[offset + 3]);
          if (candidateY > 50 && candidateY <= 6000) {
            targetOffset = offset;
            xRaw = candidateX;
            yRaw = candidateY;
            speedRaw = decodeLd2450Signed(radarBuffer[offset + 4], radarBuffer[offset + 5]);
            break;
          }
        }

        if (targetOffset >= 0) {
          radarTargetFramesReceived++;
          // Start the EMA at the measured position so the first angle is not biased toward (0, 0).
          if (!hasTarget) {
            smoothX = static_cast<float>(xRaw);
            smoothY = static_cast<float>(yRaw);
          } else {
            smoothX += RADAR_SMOOTH * (static_cast<float>(xRaw) - smoothX);
            smoothY += RADAR_SMOOTH * (static_cast<float>(yRaw) - smoothY);
          }

          hasTarget = true;
          lastTargetTime = millis();
          Serial.printf("[RADAR] X=%d mm Y=%d mm speed=%.2f m/s\n", xRaw, yRaw, abs(speedRaw) / 100.0f);

          if (client.connected()) {
            char payload[100];
            snprintf(payload, sizeof(payload), "{\"x\":%.2f,\"y\":%.2f,\"speed\":%.2f}", smoothX / 1000.0f, smoothY / 1000.0f, abs(speedRaw) / 100.0f);
            client.publish("embedded/radar/data", payload);
          }

          if (!isManualMode) radarToServoAngles(smoothX, smoothY);
        }

        // Reset the window after a complete frame to avoid parsing it repeatedly.
        memset(radarBuffer, 0, 30);
    }
  }
}

void printRadarDiagnostics() {
  if (millis() - lastRadarDiagnostics < 2000) return;
  lastRadarDiagnostics = millis();
  Serial.printf(
    "[RADAR-DIAG] bytes=%lu frames=%lu frames_with_target=%lu active_target=%s last=0x%02X mode=%s\n",
    radarBytesReceived,
    radarFramesReceived,
    radarTargetFramesReceived,
    hasTarget ? "YES" : "NO",
    radarLastByte,
    isManualMode ? "MANUAL" : "AUTO"
  );
}

void updateTargetTimeout() {
  if (!hasTarget || millis() - lastTargetTime <= TARGET_LOST_TIMEOUT) return;

  hasTarget = false;
  if (!isManualMode) {
    targetPan = 90.0;
    targetTilt = 90.0;
    Serial.println("[AUTO] Mat muc tieu -> Ve trung tam.");
  }
}

// ================= CẬP NHẬT SERVO MƯỢT MÀ =================
void updateServoSmoothly() {
  if (abs(targetPan - currentPan) > 0.3 || abs(targetTilt - currentTilt) > 0.3) {
    if (!isMoving) {
      if (client.connected()) client.publish("embedded/servo/status", "MOVING");
      isMoving = true;
    }
    currentPan  += (targetPan  - currentPan)  * SMOOTHING_FACTOR;
    currentTilt += (targetTilt - currentTilt) * SMOOTHING_FACTOR;
    servoPan.write((int)currentPan);
    servoTilt.write((int)currentTilt);
  } else {
    if (isMoving) {
      if (client.connected()) client.publish("embedded/servo/status", "STOPPED");
      isMoving = false;
    }
  }
}

// ================= SETUP =================
void setup() {
  Serial.begin(115200);
  
  // Bạn có thể đổi số 16, 17 thành 32, 33 nếu đổi chân trên ESP32
  Serial2.begin(256000, SERIAL_8N1, 16, 17); 

  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  ESP32PWM::allocateTimer(2);
  ESP32PWM::allocateTimer(3);
  servoPan.setPeriodHertz(50);
  servoTilt.setPeriodHertz(50);
  servoPan.attach(PAN_PIN,  500, 2400);
  servoTilt.attach(TILT_PIN, 500, 2400);

  servoPan.write(90);
  servoTilt.write(90);

  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
  client.setSocketTimeout(2);
  client.setCallback(mqttCallback);

  Serial.println("\n=== HE THONG SAN SANG (Version Chong-nhieu-Radar) ===");
}

// ================= LOOP =================
void loop() {
  // Retry Wi-Fi/MQTT without blocking radar parsing and servo updates.
  if (WiFi.status() != WL_CONNECTED) {
    if (millis() - lastWifiAttempt >= 10000) {
      lastWifiAttempt = millis();
      WiFi.disconnect();
      WiFi.begin(ssid, password);
      Serial.println("[WiFi] Dang thu ket noi lai...");
    }
  } else {
    if (!client.connected() && millis() - lastMqttAttempt >= 5000) reconnect();
    if (client.connected()) client.loop();
  }

  if (isManualMode && (millis() - lastManualCmd > MANUAL_TIMEOUT_MS)) {
    isManualMode = false;
  }

  readRadar();
  updateTargetTimeout();
  updateServoSmoothly();
  printRadarDiagnostics();
  delay(15);
}