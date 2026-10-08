#include <WiFi.h>
#include <PubSubClient.h>
#include <ESP32Servo.h>
#include <math.h>
#include <ctype.h>
#include <stdlib.h>
#include <string.h>

// ================= CẤU HÌNH HỆ THỐNG =================
const char* FW_VERSION  = "ld2450-uart-health-rx32-2026-10-08";
const char* ssid        = "YOUR_WIFI_SSID";
const char* password    = "YOUR_WIFI_PASSWORD";
const char* mqtt_server = "192.168.1.10";
const int   mqtt_port   = 1883;

// Chân cắm Servo
const int PAN_PIN  = 13;
const int TILT_PIN = 27;
const int RADAR_RX_PIN = 32; // LD2450 TX -> ESP32 GPIO32 (UART RX)
const int RADAR_TX_PIN = 17; // LD2450 RX -> ESP32 TX (optional for receive-only operation)

// LD2450 saves UART baud changes across power cycles. Probe only documented rates.
const uint32_t RADAR_BAUDS[] = {256000, 115200, 230400, 460800, 57600, 38400, 19200, 9600};
const size_t RADAR_BAUD_COUNT = sizeof(RADAR_BAUDS) / sizeof(RADAR_BAUDS[0]);
// Stay at the LD2450 factory baud. Some ESP32 cores stop receiving after
// updateBaudRate() while Wi-Fi is active; disabling scans avoids that path.
constexpr bool RADAR_USE_AUTOBAUD = false;
const unsigned long RADAR_PROBE_MS = 2500;
const unsigned long RADAR_STREAM_STALE_MS = 6000;
const size_t RADAR_READ_BUDGET = 512;

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

// A fixed 30-byte sliding window resynchronizes after noise or a partial frame.
byte radarBuffer[30] = {};
unsigned long radarBytesReceived = 0;
unsigned long radarFramesReceived = 0;
unsigned long radarTargetFramesReceived = 0;
unsigned long radarPublished = 0;
unsigned long radarPublishFailed = 0;
unsigned long radarPublishSkipped = 0;
unsigned long lastRadarDiagnostics = 0;
unsigned long lastRadarDiagnosticsBytes = 0;
unsigned long lastRadarTargetLog = 0;
unsigned long lastAutoLog = 0;
unsigned long lastTrackingLog = 0;
byte radarLastByte = 0;
size_t radarBaudIndex = 0;
unsigned long radarBaudStartedAt = 0;
unsigned long radarLastFrameAt = 0;
unsigned long radarBytesAtBaud = 0;
unsigned long radarFramesAtBaud = 0;
unsigned long radarHeadersAtBaud = 0;
unsigned long radarFootersAtBaud = 0;
int16_t radarLastCandidateY[3] = {};
bool radarUartStarted = false;
bool radarBaudLocked = false;

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

  if (millis() - lastAutoLog >= 1000) {
    lastAutoLog = millis();
    Serial.printf("[AUTO] Pan=%.1f Tilt=%.1f X=%.0f Y=%.0f\n",
                  targetPan, targetTilt, xMm, yMm);
  }
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
  // Connection continues in the main loop so UART frames are never left unread
  // during the old 20-second startup wait.
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
  char msg[64];
  if (length >= sizeof(msg)) {
    Serial.println("[MQTT-WARN] Command exceeds 63 bytes; ignored");
    return;
  }
  for (unsigned int i = 0; i < length; i++) {
    msg[i] = static_cast<char>(toupper(static_cast<unsigned char>(payload[i])));
  }
  msg[length] = '\0';

  const bool trackingTopic = strcmp(topic, "embedded/servo/tracking") == 0;
  if (!trackingTopic || millis() - lastTrackingLog >= 1000) {
    if (trackingTopic) lastTrackingLog = millis();
    Serial.printf("[MQTT] Kenh: %s | Lenh: %s\n", topic, msg);
  }

  if (strcmp(topic, "embedded/servo/mode") == 0) {
    if (strcmp(msg, "MANUAL") == 0) {
      isManualMode = true;
      lastManualCmd = millis();
      Serial.println("[MODE] >> THU CONG (Manual)");
    } else if (strcmp(msg, "AUTO") == 0) {
      isManualMode = false;
      Serial.println("[MODE] >> TU DONG (Radar Auto-Tracking)");
    }
    return;
  }

  if (strcmp(topic, "embedded/servo/manual") == 0) {
    isManualMode = true;
    lastManualCmd = millis();

    if      (strcmp(msg, "LEFT") == 0)  targetPan  += 12;
    else if (strcmp(msg, "RIGHT") == 0) targetPan  -= 12;
    else if (strcmp(msg, "UP") == 0)    targetTilt -= 7;
    else if (strcmp(msg, "DOWN") == 0)  targetTilt += 7;
    else if (strcmp(msg, "RESET") == 0) { targetPan = 90.0; targetTilt = 90.0; }

    targetPan  = constrain(targetPan,  10, 170);
    targetTilt = constrain(targetTilt, 10, 170);
    return;
  }

  if (trackingTopic && !isManualMode) {
    // Radar is the primary source while it is reporting a live target.
    // Vision tracking remains available as a fallback when radar data goes stale.
    if (hasTarget && millis() - lastTargetTime < RADAR_PRIORITY_MS) return;
    if (strcmp(msg, "LOST") == 0) return;
    char* comma = strchr(msg, ',');
    if (!comma) return;
    *comma = '\0';
    char* xEnd = nullptr;
    char* yEnd = nullptr;
    const float pixelX = strtof(msg, &xEnd);
    const float pixelY = strtof(comma + 1, &yEnd);
    if (xEnd == msg || *xEnd != '\0' || yEnd == comma + 1 || *yEnd != '\0' ||
        !isfinite(pixelX) || !isfinite(pixelY)) return;
    targetPan  -= (pixelX - 320.0f) * 0.02f;
    targetTilt += (pixelY - 240.0f) * 0.02f;
    targetPan  = constrain(targetPan,  10, 170);
    targetTilt = constrain(targetTilt, 10, 170);
    return;
  }
}

// ================= ĐỌC VÀ XỬ LÝ KHUNG RADAR LD2450 =================
void beginRadarBaud(size_t index) {
  radarBaudIndex = index;
  memset(radarBuffer, 0, sizeof(radarBuffer));
  radarBytesAtBaud = 0;
  radarFramesAtBaud = 0;
  radarHeadersAtBaud = 0;
  radarFootersAtBaud = 0;
  radarBaudStartedAt = millis();
  if (radarUartStarted) {
    // Change the divisor in place. Repeated end()/begin() would reallocate the
    // UART driver and RX buffer every probe cycle on a disconnected sensor.
    Serial2.flush(false); // Also discard RX bytes captured at the old rate.
    Serial2.updateBaudRate(RADAR_BAUDS[index]);
    Serial2.flush(false);
  } else {
    Serial2.begin(RADAR_BAUDS[index], SERIAL_8N1, RADAR_RX_PIN, RADAR_TX_PIN);
    // A 30-byte radar frame should reach the driver without waiting for the
    // default 120-byte FIFO threshold or a receive-timeout interrupt.
    Serial2.setRxFIFOFull(16);
    radarUartStarted = true;
  }
  Serial.printf("[RADAR-UART] trying baud=%lu RX=GPIO%d TX=GPIO%d\n",
                (unsigned long)RADAR_BAUDS[index], RADAR_RX_PIN, RADAR_TX_PIN);
}

void serviceRadarBaud() {
  const unsigned long now = millis();
  if (!RADAR_USE_AUTOBAUD) {
    if (radarBaudLocked && now - radarLastFrameAt > RADAR_STREAM_STALE_MS) {
      radarBaudLocked = false;
      radarFramesAtBaud = 0;
      memset(radarBuffer, 0, sizeof(radarBuffer));
      Serial.println("[RADAR-UART] fixed 256000 baud; waiting for frames again");
    }
    return;
  }
  if (radarBaudLocked) {
    if (now - radarLastFrameAt <= RADAR_STREAM_STALE_MS) return;
    Serial.printf("[RADAR-UART] stream stopped at %lu baud; scanning again\n",
                  (unsigned long)RADAR_BAUDS[radarBaudIndex]);
    radarBaudLocked = false;
    beginRadarBaud(radarBaudIndex); // Recheck the last working baud first.
    return;
  }

  if (now - radarBaudStartedAt < RADAR_PROBE_MS) return;
  Serial.printf("[RADAR-UART] probe baud=%lu bytes=%lu headers=%lu footers=%lu frames=%lu\n",
                (unsigned long)RADAR_BAUDS[radarBaudIndex], radarBytesAtBaud,
                radarHeadersAtBaud, radarFootersAtBaud, radarFramesAtBaud);
  beginRadarBaud((radarBaudIndex + 1) % RADAR_BAUD_COUNT);
}

void readRadar() {
  size_t budget = RADAR_READ_BUDGET;
  while (budget-- > 0 && Serial2.available()) {
    const int received = Serial2.read();
    if (received < 0) break;
    const byte b = static_cast<byte>(received);
    radarBytesReceived++;
    radarBytesAtBaud++;
    radarLastByte = b;
    memmove(radarBuffer, radarBuffer + 1, sizeof(radarBuffer) - 1);
    radarBuffer[29] = b;

    if (radarBuffer[26] == 0xAA && radarBuffer[27] == 0xFF &&
        radarBuffer[28] == 0x03 && radarBuffer[29] == 0x00) radarHeadersAtBaud++;
    if (radarBuffer[28] == 0x55 && radarBuffer[29] == 0xCC) radarFootersAtBaud++;

    // Khung LD2450 dài 30 byte: header AA FF 03 00, ba target x 8 byte, footer 55 CC.
    if (radarBuffer[0] == 0xAA && radarBuffer[1] == 0xFF &&
        radarBuffer[2] == 0x03 && radarBuffer[3] == 0x00 &&
        radarBuffer[28] == 0x55 && radarBuffer[29] == 0xCC) {
        radarFramesReceived++;
        radarFramesAtBaud++;
        radarLastFrameAt = millis();
        // Require two well-formed frames before trusting a newly probed baud.
        if (!radarBaudLocked && radarFramesAtBaud >= 2) {
          radarBaudLocked = true;
          Serial.printf("[RADAR-UART] LOCKED baud=%lu; valid LD2450 frames received\n",
                        (unsigned long)RADAR_BAUDS[radarBaudIndex]);
        }
        if (!radarBaudLocked) {
          memset(radarBuffer, 0, sizeof(radarBuffer));
          continue;
        }

        int targetOffset = -1;
        int16_t xRaw = 0, yRaw = 0, speedRaw = 0;

        // Use the first valid target, falling back to target 2 or 3 if slot 1 is empty.
        for (int target = 0; target < 3; target++) {
          const int offset = 4 + target * 8;
          const int16_t candidateX = decodeLd2450Signed(radarBuffer[offset], radarBuffer[offset + 1]);
          const int16_t candidateY = decodeLd2450Signed(radarBuffer[offset + 2], radarBuffer[offset + 3]);
          radarLastCandidateY[target] = candidateY;
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
          if (millis() - lastRadarTargetLog >= 1000) {
            lastRadarTargetLog = millis();
            Serial.printf("[RADAR] X=%d mm Y=%d mm speed=%.2f m/s\n",
                          xRaw, yRaw, abs(speedRaw) / 100.0f);
          }

          if (client.connected()) {
            char payload[96];
            const int length = snprintf(payload, sizeof(payload),
                                        "{\"x\":%.3f,\"y\":%.3f,\"speed\":%.2f}",
                                        smoothX / 1000.0f, smoothY / 1000.0f,
                                        abs(speedRaw) / 100.0f);
            if (length > 0 && static_cast<size_t>(length) < sizeof(payload) &&
                client.publish("embedded/radar/data", payload)) {
              radarPublished++;
            } else {
              radarPublishFailed++;
            }
          } else {
            radarPublishSkipped++;
          }

          if (!isManualMode) radarToServoAngles(smoothX, smoothY);
        }

        // Reset the window after a complete frame to avoid parsing it repeatedly.
        memset(radarBuffer, 0, sizeof(radarBuffer));
    }
  }
}

void printRadarDiagnostics() {
  if (millis() - lastRadarDiagnostics < 2000) return;
  lastRadarDiagnostics = millis();
  const unsigned long newBytes = radarBytesReceived - lastRadarDiagnosticsBytes;
  lastRadarDiagnosticsBytes = radarBytesReceived;
  const char* radarHealth = radarBaudLocked
      ? (hasTarget ? "TARGET" : "NO_TARGET")
      : (newBytes == 0 ? "NO_UART_DATA" : "INVALID_FRAME");
  Serial.printf(
    "[RADAR-DIAG] rx=GPIO%d baud=%lu locked=%d health=%s bytes=%lu new_bytes=%lu frames=%lu frames_with_target=%lu active_target=%s last=0x%02X mqtt=%d published=%lu publish_failed=%lu offline_skip=%lu mode=%s\n",
    RADAR_RX_PIN,
    (unsigned long)RADAR_BAUDS[radarBaudIndex],
    radarBaudLocked ? 1 : 0,
    radarHealth,
    radarBytesReceived,
    newBytes,
    radarFramesReceived,
    radarTargetFramesReceived,
    hasTarget ? "YES" : "NO",
    radarLastByte,
    client.connected() ? 1 : 0,
    radarPublished,
    radarPublishFailed,
    radarPublishSkipped,
    isManualMode ? "MANUAL" : "AUTO"
  );

  // This is a sample of the latest 30 bytes, not necessarily a frame boundary.
  if (!radarBaudLocked && newBytes > 0 && radarBytesAtBaud >= sizeof(radarBuffer)) {
    Serial.print("[RADAR-RAW] ");
    for (size_t i = 0; i < sizeof(radarBuffer); ++i) {
      if (i) Serial.print(' ');
      Serial.printf("%02X", radarBuffer[i]);
    }
    Serial.println();
  }
  if (radarBaudLocked && !hasTarget) {
    Serial.printf("[RADAR-NO-TARGET] last_y_mm=%d,%d,%d (accepted: 51..6000)\n",
                  radarLastCandidateY[0], radarLastCandidateY[1], radarLastCandidateY[2]);
  }
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
  Serial.printf("\n[BOOT] fw=%s pan=GPIO%d tilt=GPIO%d radar_rx=GPIO%d mqtt=%s:%d\n",
                FW_VERSION, PAN_PIN, TILT_PIN, RADAR_RX_PIN, mqtt_server, mqtt_port);
  // Large enough to keep several LD2450 frames while an MQTT connection stalls.
  Serial2.setRxBufferSize(2048);
  beginRadarBaud(0);

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
  lastMqttAttempt = millis() - 5000UL;

  Serial.println("\n=== HE THONG SAN SANG (LD2450 fixed 256000 + MQTT diagnostics) ===");
}

// ================= LOOP =================
void loop() {
  // Drain UART before and after network work to avoid losing radar frames.
  readRadar();

  static bool wifiWasConnected = false;
  const bool wifiConnected = WiFi.status() == WL_CONNECTED;
  if (!wifiConnected) {
    if (wifiWasConnected) Serial.println("[WiFi] disconnected");
    wifiWasConnected = false;
    if (millis() - lastWifiAttempt >= 10000) {
      lastWifiAttempt = millis();
      WiFi.disconnect();
      WiFi.begin(ssid, password);
      Serial.println("[WiFi] Dang thu ket noi lai...");
    }
  } else {
    if (!wifiWasConnected) {
      Serial.print("[WiFi] connected IP=");
      Serial.println(WiFi.localIP());
      wifiWasConnected = true;
    }
    if (!client.connected() && millis() - lastMqttAttempt >= 5000) reconnect();
    if (client.connected()) client.loop();
  }

  readRadar();
  serviceRadarBaud();

  if (isManualMode && (millis() - lastManualCmd > MANUAL_TIMEOUT_MS)) {
    isManualMode = false;
  }

  updateTargetTimeout();
  updateServoSmoothly();
  printRadarDiagnostics();
  delay(15);
}
