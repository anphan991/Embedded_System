#include <WiFi.h>
#include <PubSubClient.h>
#include <ESP32Servo.h>
#include <Preferences.h>
#include <esp_system.h>
#include <ctype.h>
#include <math.h>
#include <stdint.h>
#include <stdlib.h>

// ================= CẤU HÌNH HỆ THỐNG =================
const char* FW_VERSION = "servo-radar-2026-10-03-r3";
const char* ssid        = "No Internet";
const char* password    = "10022006";
String mqttHost = "10.28.125.55";
const int   mqtt_port   = 1883;
bool mqttHostChanged = false;

// Chân cắm Servo
const int PAN_PIN  = 13;
const int TILT_PIN = 27;

// MG996R chính hãng chỉ quay khoảng 0..159 độ. Giới hạn 45..135 là vùng
// khởi đầu thận trọng; đo hành trình cơ khí thực tế trước khi mở rộng.
struct ServoConfig {
  uint32_t magic;
  float panMin, panMax, tiltMin, tiltMax;
  float panCenter, tiltCenter, panOffset, tiltOffset;
  float speedDps, radarAlpha, cameraHeightMm, targetHeightMm;
  int8_t panDirection, tiltDirection, returnOnLost;
};
const ServoConfig DEFAULT_CONFIG = {
  0x53525631UL, 45.0f, 135.0f, 45.0f, 135.0f,
  90.0f, 90.0f, 0.0f, 0.0f,
  220.0f, 0.45f, 1500.0f, 900.0f, -1, -1, 0
};
ServoConfig config = DEFAULT_CONFIG;
Preferences preferences;
bool preferencesReady = false;

// Đối tượng hệ thống
WiFiClient   espClient;
PubSubClient client(espClient);
Servo        servoPan;
Servo        servoTilt;

// ---- Trạng thái Servo ----
float currentPan  = 90.0f;
float targetPan   = 90.0f;
float currentTilt = 90.0f;
float targetTilt  = 90.0f;
const unsigned long SERVO_UPDATE_MS = 20;
unsigned long lastServoUpdate = 0;
unsigned long lastServoDiagnostics = 0;
bool isMoving = false;
char servoTestAxis = 0;
float servoTestReturnAngle = 0.0f;
unsigned long servoTestReturnAt = 0;
char serialCommandBuffer[96];
size_t serialCommandLength = 0;
bool discardSerialLine = false;
unsigned long lastLoopAt = 0;
unsigned long maxLoopGapMs = 0;
unsigned long lastNetDiagnostics = 0;
unsigned long lastManualCommandAt = 0;
unsigned long manualCommandsAccepted = 0;
enum HoldDirection { HOLD_NONE, HOLD_LEFT, HOLD_RIGHT, HOLD_UP, HOLD_DOWN };
HoldDirection holdDirection = HOLD_NONE;
unsigned long lastHoldHeartbeat = 0;
unsigned long lastHoldTick = 0;
const unsigned long HOLD_TIMEOUT_MS = 300;
const float PAN_HOLD_DPS = 150.0f;
const float TILT_HOLD_DPS = 100.0f;

// ---- Trạng thái chế độ ----
bool isManualMode = true;
bool hasSequencedManualCommand = false;
uint64_t lastManualEpoch = 0;
uint64_t lastManualSequence = 0;

// ---- Lọc nhiễu tọa độ Radar (EMA) ----
float smoothX = 0.0, smoothY = 0.0;
bool  hasTarget = false;
unsigned long lastTargetTime = 0;
const unsigned long TARGET_LOST_TIMEOUT = 3000;
const unsigned long RADAR_PRIORITY_MS = 1200;
const unsigned long RADAR_PUBLISH_MS = 100;
const unsigned long RADAR_LOG_MS = 500;
unsigned long lastRadarPublish = 0;
unsigned long lastRadarLog = 0;
unsigned long lastAutoLog = 0;
unsigned long lastVisionTargetTime = 0;
float radarSpeedMs = 0.0;
int16_t radarXRaw = 0, radarYRaw = 0;
unsigned long lastWifiAttempt = 0;
unsigned long lastMqttAttempt = 0;
bool wifiWasConnected = false;
unsigned long holdHeartbeats = 0;
unsigned long lastHoldLog = 0;

// Buffer đọc Radar (Cơ chế chống trôi khung hình mới nhất)
byte radarBuffer[30];
unsigned long radarBytesReceived = 0;
unsigned long radarFramesReceived = 0;
unsigned long radarTargetFramesReceived = 0;
unsigned long radarBadFooterCandidates = 0;
unsigned long lastRadarDiagnostics = 0;
unsigned long lastRadarFrameSnapshot = 0;
float lastRadarFps = 0.0f;
byte radarLastByte = 0;

float clampPan(float angle) { return constrain(angle, config.panMin, config.panMax); }
float clampTilt(float angle) { return constrain(angle, config.tiltMin, config.tiltMax); }

bool configIsValid(const ServoConfig& c) {
  return c.magic == DEFAULT_CONFIG.magic &&
         isfinite(c.panMin) && isfinite(c.panMax) && c.panMin >= 0 && c.panMax <= 159 &&
         c.panMax - c.panMin >= 10 &&
         isfinite(c.tiltMin) && isfinite(c.tiltMax) && c.tiltMin >= 0 && c.tiltMax <= 159 &&
         c.tiltMax - c.tiltMin >= 10 &&
         isfinite(c.panCenter) && c.panCenter >= c.panMin && c.panCenter <= c.panMax &&
         isfinite(c.tiltCenter) && c.tiltCenter >= c.tiltMin && c.tiltCenter <= c.tiltMax &&
         isfinite(c.panOffset) && fabsf(c.panOffset) <= 45 &&
         isfinite(c.tiltOffset) && fabsf(c.tiltOffset) <= 45 &&
         isfinite(c.speedDps) && c.speedDps >= 30 && c.speedDps <= 300 &&
         isfinite(c.radarAlpha) && c.radarAlpha >= 0.05f && c.radarAlpha <= 1.0f &&
         isfinite(c.cameraHeightMm) && c.cameraHeightMm >= 0 && c.cameraHeightMm <= 4000 &&
         isfinite(c.targetHeightMm) && c.targetHeightMm >= 0 && c.targetHeightMm <= 4000 &&
         (c.panDirection == -1 || c.panDirection == 1) &&
         (c.tiltDirection == -1 || c.tiltDirection == 1) &&
         (c.returnOnLost == 0 || c.returnOnLost == 1);
}

bool validMqttHost(const String& host) {
  if (host.length() == 0 || host.length() > 63) return false;
  if (host[0] == '.' || host[0] == '-' ||
      host[host.length() - 1] == '.' || host[host.length() - 1] == '-') return false;
  bool digitsAndDotsOnly = true;
  for (unsigned int i = 0; i < host.length(); i++) {
    const char ch = host[i];
    if (ch == '.' && i > 0 && host[i - 1] == '.') return false;
    const unsigned char ascii = static_cast<unsigned char>(ch);
    if (!(isalpha(ascii) || isdigit(ascii) || ch == '.' || ch == '-')) return false;
    if (!isdigit(ascii) && ch != '.') digitsAndDotsOnly = false;
  }
  if (!digitsAndDotsOnly) return true;  // DNS name, e.g. broker.local
  IPAddress ip;
  return ip.fromString(host);            // Strict dotted IPv4, no invalid octets.
}

void loadConfig() {
  preferencesReady = preferences.begin("servo_cfg", false);
  if (!preferencesReady) {
    Serial.println("[CONFIG] NVS unavailable; defaults in RAM");
  } else if (preferences.getBytesLength("cfg") == sizeof(ServoConfig)) {
    ServoConfig saved;
    if (preferences.getBytes("cfg", &saved, sizeof(saved)) == sizeof(saved) && configIsValid(saved)) {
      config = saved;
      Serial.println("[CONFIG] Loaded saved calibration from NVS");
    } else {
      Serial.println("[CONFIG] Invalid saved calibration; using safe defaults");
    }
  } else {
    Serial.println("[CONFIG] Using safe defaults");
  }
  if (preferencesReady) {
    const String savedHost = preferences.getString("mqtt_host", "");
    if (validMqttHost(savedHost)) mqttHost = savedHost;
  }
  currentPan = targetPan = clampPan(config.panCenter + config.panOffset);
  currentTilt = targetTilt = clampTilt(config.tiltCenter + config.tiltOffset);
}

void printConfig() {
  Serial.printf("[CONFIG] broker=%s:%d\n", mqttHost.c_str(), mqtt_port);
  Serial.printf("[CONFIG] pan=%.1f..%.1f center=%.1f offset=%.1f dir=%d | tilt=%.1f..%.1f center=%.1f offset=%.1f dir=%d\n",
                config.panMin, config.panMax, config.panCenter, config.panOffset, config.panDirection,
                config.tiltMin, config.tiltMax, config.tiltCenter, config.tiltOffset, config.tiltDirection);
  Serial.printf("[CONFIG] speed=%.0f deg/s radar_alpha=%.2f camera_height=%.0f target_height=%.0f mm lost=%s\n",
                config.speedDps, config.radarAlpha, config.cameraHeightMm, config.targetHeightMm,
                config.returnOnLost ? "CENTER" : "HOLD");
}

void publishConfigState() {
  if (!client.connected()) return;
  char payload[512];
  const int count = snprintf(payload, sizeof(payload),
           "{\"pan_min\":%.1f,\"pan_max\":%.1f,\"tilt_min\":%.1f,\"tilt_max\":%.1f,"
           "\"pan_center\":%.1f,\"tilt_center\":%.1f,\"pan_offset\":%.1f,\"tilt_offset\":%.1f,"
           "\"pan_dir\":%d,\"tilt_dir\":%d,\"speed_dps\":%.0f,\"radar_alpha\":%.2f,"
           "\"camera_height_mm\":%.0f,\"target_height_mm\":%.0f,\"lost_action\":\"%s\","
           "\"mqtt_host\":\"%s\"}",
           config.panMin, config.panMax, config.tiltMin, config.tiltMax,
           config.panCenter, config.tiltCenter, config.panOffset, config.tiltOffset,
           config.panDirection, config.tiltDirection, config.speedDps, config.radarAlpha,
           config.cameraHeightMm, config.targetHeightMm,
           config.returnOnLost ? "CENTER" : "HOLD", mqttHost.c_str());
  if (count <= 0 || count >= static_cast<int>(sizeof(payload)) ||
      !client.publish("embedded/servo/config/state", payload, true)) {
    Serial.printf("[CONFIG] MQTT state publish failed, bytes=%d state=%d\n", count, client.state());
  }
}

bool saveConfig() {
  const bool saved = preferencesReady &&
                     preferences.putBytes("cfg", &config, sizeof(config)) == sizeof(config);
  if (!saved) Serial.println("[CONFIG] NVS save failed; values valid only until restart");
  printConfig();
  publishConfigState();
  return saved;
}

// ================= CHUYỂN ĐỔI TỌA ĐỘ RADAR → GÓC SERVO =================
void radarToServoAngles(float xMm, float yMm) {
  if (yMm <= 50) return; // Bỏ qua tín hiệu nhiễu quá gần (< 5cm)

  float theta_rad = atan2(xMm, yMm);
  float theta_deg = theta_rad * (180.0 / M_PI);
  const float requestedPan = config.panCenter + config.panOffset + config.panDirection * theta_deg;

  float D = sqrt(xMm * xMm + yMm * yMm);
  float heightDifference = config.cameraHeightMm - config.targetHeightMm;
  float tilt_rad = atan2(heightDifference, D);
  float tilt_deg = tilt_rad * (180.0 / M_PI);
  const float requestedTilt = config.tiltCenter + config.tiltOffset + config.tiltDirection * tilt_deg;

  // Suppress small radar position noise without delaying a meaningful turn.
  const float nextPan = clampPan(requestedPan);
  const float nextTilt = clampTilt(requestedTilt);
  if (fabsf(nextPan - targetPan) >= 0.8f) targetPan = nextPan;
  if (fabsf(nextTilt - targetTilt) >= 0.8f) targetTilt = nextTilt;

  if (millis() - lastAutoLog >= RADAR_LOG_MS) {
    lastAutoLog = millis();
    Serial.printf("[AUTO] targetPan=%.1f targetTilt=%.1f requested=%.1f/%.1f limit=%s%s (X=%.0f Y=%.0f)\n",
                  targetPan, targetTilt, requestedPan, requestedTilt,
                  fabsf(nextPan - requestedPan) > 0.1f ? "PAN " : "",
                  fabsf(nextTilt - requestedTilt) > 0.1f ? "TILT" : "",
                  xMm, yMm);
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
void publishModeState() {
  if (client.connected()) {
    client.publish("embedded/servo/state", isManualMode ? "MANUAL" : "AUTO", true);
  }
}

void setup_wifi() {
  Serial.print("\n[WiFi] Connecting to "); Serial.println(ssid);
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.begin(ssid, password);
  lastWifiAttempt = millis();
  lastMqttAttempt = millis() - 5000UL;
}

void reconnect() {
  if (client.connected() || WiFi.status() != WL_CONNECTED) return;

  lastMqttAttempt = millis();
  Serial.print("Ket noi MQTT... ");
  if (client.connect("ESP32_AI_Tracking", "embedded/servo/online", 1, true, "OFFLINE")) {
    Serial.println("OK!");
    if (!client.publish("embedded/servo/online", "ONLINE", true)) {
      Serial.println("[MQTT] Khong gui duoc trang thai ONLINE");
    }
    client.subscribe("embedded/servo/manual", 1);
    client.subscribe("embedded/servo/tracking");
    client.subscribe("embedded/servo/mode", 1);
    client.subscribe("embedded/servo/buzzer");
    client.subscribe("embedded/servo/config", 1);
    publishModeState();
    publishConfigState();
  } else {
    Serial.print("That bai, ma loi: ");
    Serial.println(client.state());
  }
}

// ================= XỬ LÝ LỆNH MQTT =================
bool parseUint64Decimal(const String& input, uint64_t& value) {
  if (input.length() == 0) return false;
  const uint64_t maxValue = static_cast<uint64_t>(-1);
  value = 0;
  for (unsigned int i = 0; i < input.length(); i++) {
    const char digitChar = input[i];
    if (digitChar < '0' || digitChar > '9') return false;
    const uint8_t digit = static_cast<uint8_t>(digitChar - '0');
    if (value > (maxValue - digit) / 10) return false;
    value = value * 10 + digit;
  }
  return true;
}

bool parseSequencedManualCommand(const String& payload, uint64_t& epoch,
                                 uint64_t& sequence, String& direction) {
  if (!payload.startsWith("@")) return false;
  const int epochEnd = payload.indexOf(':', 1);
  const int sequenceEnd = epochEnd >= 0 ? payload.indexOf(':', epochEnd + 1) : -1;
  if (epochEnd < 0 || sequenceEnd < 0 || payload.indexOf(':', sequenceEnd + 1) >= 0) {
    return false;
  }
  if (!parseUint64Decimal(payload.substring(1, epochEnd), epoch) ||
      !parseUint64Decimal(payload.substring(epochEnd + 1, sequenceEnd), sequence)) {
    return false;
  }
  direction = payload.substring(sequenceEnd + 1);
  return direction.length() > 0;
}

void printServoDiagnostics(bool force = false);

void reportConfigResult(bool ok, const String& message) {
  Serial.printf("[CONFIG] %s %s\n", ok ? "OK" : "ERR", message.c_str());
  if (client.connected()) {
    String payload = String(ok ? "OK:" : "ERR:") + message;
    client.publish("embedded/servo/config/result", payload.c_str());
  }
}

bool parseFloatStrict(const String& input, float& value) {
  if (input.length() == 0) return false;
  char* end = nullptr;
  value = strtof(input.c_str(), &end);
  return end != input.c_str() && *end == '\0' && isfinite(value);
}

void processConfigCommand(String command) {
  command.trim();
  command.toUpperCase();
  if (command == "STATUS" || command == "DIAG") {
    printConfig();
    printServoDiagnostics(true);
    publishConfigState();
    reportConfigResult(true, "STATUS");
    return;
  }
  if (command == "HELP") {
    Serial.println("[CONFIG] STATUS TEST_PAN TEST_TILT CENTER DEFAULTS; KEY=VALUE: PAN/TILT_MIN/MAX/CENTER/OFFSET/DIR, SPEED_DPS, RADAR_ALPHA, CAMERA_HEIGHT_MM, TARGET_HEIGHT_MM, LOST_ACTION, MQTT_HOST");
    reportConfigResult(true, "HELP");
    return;
  }
  if (!isManualMode) {
    reportConfigResult(false, "switch to MANUAL before calibration");
    return;
  }
  if (command == "TEST_PAN" || command == "TEST_TILT") {
    const bool pan = command == "TEST_PAN";
    Servo& servo = pan ? servoPan : servoTilt;
    const float position = pan ? currentPan : currentTilt;
    const float low = pan ? config.panMin : config.tiltMin;
    const float high = pan ? config.panMax : config.tiltMax;
    if (!servo.attached()) {
      reportConfigResult(false, "PWM is not attached");
      return;
    }
    const float step = position + 8.0f <= high ? 8.0f :
                       (position - 8.0f >= low ? -8.0f : 0.0f);
    if (step == 0.0f) {
      reportConfigResult(false, "no room for 8 degree test within limits");
      return;
    }
    holdDirection = HOLD_NONE;
    servoTestAxis = pan ? 'P' : 'T';
    servoTestReturnAngle = position;
    servoTestReturnAt = millis() + 650;
    targetPan = currentPan;
    targetTilt = currentTilt;
    if (pan) targetPan = position + step;
    else targetTilt = position + step;
    printServoDiagnostics(true);
    reportConfigResult(true, command + " 8 degrees then return");
    return;
  }
  if (command == "CENTER") {
    holdDirection = HOLD_NONE;
    servoTestAxis = 0;
    targetPan = clampPan(config.panCenter + config.panOffset);
    targetTilt = clampTilt(config.tiltCenter + config.tiltOffset);
    printServoDiagnostics(true);
    reportConfigResult(true, "CENTER");
    return;
  }
  if (command == "DEFAULTS") {
    config = DEFAULT_CONFIG;
    holdDirection = HOLD_NONE;
    servoTestAxis = 0;
    targetPan = clampPan(targetPan);
    targetTilt = clampTilt(targetTilt);
    const bool saved = saveConfig();
    printServoDiagnostics(true);
    reportConfigResult(saved, saved ? "DEFAULTS saved" : "DEFAULTS applied in RAM; NVS save failed");
    return;
  }

  const int equals = command.indexOf('=');
  if (equals <= 0 || equals >= static_cast<int>(command.length()) - 1) {
    reportConfigResult(false, "expected KEY=VALUE; send HELP");
    return;
  }
  const String key = command.substring(0, equals);
  const String rawValue = command.substring(equals + 1);
  if (key == "MQTT_HOST") {
    if (!validMqttHost(rawValue)) {
      reportConfigResult(false, "MQTT_HOST must be a valid IPv4 or hostname");
      return;
    }
    mqttHost = rawValue;
    const bool saved = preferencesReady &&
                       preferences.putString("mqtt_host", mqttHost) == mqttHost.length();
    if (!saved) Serial.println("[CONFIG] MQTT host NVS save failed; value valid only until restart");
    printConfig();
    publishConfigState();
    printServoDiagnostics(true);
    reportConfigResult(saved, saved ? "MQTT_HOST=" + mqttHost :
                             "MQTT_HOST applied in RAM; NVS save failed");
    mqttHostChanged = true;
    return;
  }
  ServoConfig proposed = config;
  if (key == "LOST_ACTION") {
    if (rawValue == "HOLD") proposed.returnOnLost = 0;
    else if (rawValue == "CENTER") proposed.returnOnLost = 1;
    else { reportConfigResult(false, "LOST_ACTION must be HOLD or CENTER"); return; }
  } else {
    float value = 0.0f;
    if (!parseFloatStrict(rawValue, value)) {
      reportConfigResult(false, "value must be a finite number");
      return;
    }
    if      (key == "PAN_MIN")          proposed.panMin = value;
    else if (key == "PAN_MAX")          proposed.panMax = value;
    else if (key == "TILT_MIN")         proposed.tiltMin = value;
    else if (key == "TILT_MAX")         proposed.tiltMax = value;
    else if (key == "PAN_CENTER")       proposed.panCenter = value;
    else if (key == "TILT_CENTER")      proposed.tiltCenter = value;
    else if (key == "PAN_OFFSET")       proposed.panOffset = value;
    else if (key == "TILT_OFFSET")      proposed.tiltOffset = value;
    else if (key == "PAN_DIR" && (value == -1 || value == 1)) proposed.panDirection = static_cast<int8_t>(value);
    else if (key == "TILT_DIR" && (value == -1 || value == 1)) proposed.tiltDirection = static_cast<int8_t>(value);
    else if (key == "SPEED_DPS")        proposed.speedDps = value;
    else if (key == "RADAR_ALPHA")      proposed.radarAlpha = value;
    else if (key == "CAMERA_HEIGHT_MM") proposed.cameraHeightMm = value;
    else if (key == "TARGET_HEIGHT_MM") proposed.targetHeightMm = value;
    else { reportConfigResult(false, "unknown key or invalid direction"); return; }
  }
  if (!configIsValid(proposed)) {
    reportConfigResult(false, "outside safe range or conflicts with current limits/center");
    return;
  }
  config = proposed;
  targetPan = clampPan(targetPan);
  targetTilt = clampTilt(targetTilt);
  const bool saved = saveConfig();
  printServoDiagnostics(true);
  reportConfigResult(saved, saved ? key + "=" + rawValue :
                           key + " applied in RAM; NVS save failed");
}

void readSerialCommands() {
  unsigned int processed = 0;
  while (Serial.available() && processed++ < 96) {
    const char ch = static_cast<char>(Serial.read());
    if (ch == '\r' || ch == '\n') {
      if (!discardSerialLine && serialCommandLength > 0) {
        serialCommandBuffer[serialCommandLength] = '\0';
        processConfigCommand(String(serialCommandBuffer));
      }
      serialCommandLength = 0;
      discardSerialLine = false;
    } else if (discardSerialLine) {
      continue;
    } else if (serialCommandLength < sizeof(serialCommandBuffer) - 1) {
      serialCommandBuffer[serialCommandLength++] = ch;
    } else {
      serialCommandLength = 0;
      discardSerialLine = true;
      Serial.println("[CONFIG] Serial command too long; discarded");
    }
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String msg = "";
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
  msg.toUpperCase();
  String t = String(topic);

  // A held joystick sends frequent heartbeats. Log entry and a periodic count,
  // rather than printing every packet and stalling the command loop on UART.
  const bool holdHeartbeat = t == "embedded/servo/manual" && msg.indexOf("HOLD_") >= 0;
  if (!holdHeartbeat || millis() - lastHoldLog >= 2000) {
    Serial.print("[MQTT] Kenh: "); Serial.print(t);
    Serial.print(" | Lenh: "); Serial.println(msg);
    if (holdHeartbeat) lastHoldLog = millis();
  }
  if (holdHeartbeat) holdHeartbeats++;

  if (t == "embedded/servo/config") {
    processConfigCommand(msg);
    return;
  }

  if (t == "embedded/servo/mode") {
    if (msg == "MANUAL") {
      isManualMode = true;
      holdDirection = HOLD_NONE;
      servoTestAxis = 0;
      targetPan = currentPan;
      targetTilt = currentTilt;
      Serial.println("[MODE] >> THU CONG (Manual)");
    } else if (msg == "AUTO") {
      isManualMode = false;
      holdDirection = HOLD_NONE;
      servoTestAxis = 0;
      Serial.println("[MODE] >> TU DONG (Radar Auto-Tracking)");
      if (hasTarget && millis() - lastTargetTime < TARGET_LOST_TIMEOUT) {
        radarToServoAngles(smoothX, smoothY);
      }
    }
    publishModeState();
    return;
  }

  if (t == "embedded/servo/manual") {
    // A delayed joystick packet must not silently cancel an explicit AUTO command.
    if (!isManualMode) {
      Serial.println("[MANUAL] Ignored: mode is AUTO");
      return;
    }

    String direction = msg;
    const bool isSequenced = msg.startsWith("@");
    uint64_t epoch = 0, sequence = 0;
    if (isSequenced && !parseSequencedManualCommand(msg, epoch, sequence, direction)) {
      Serial.println("[MANUAL] Ignored malformed sequence");
      return;
    }
    if (direction != "LEFT" && direction != "RIGHT" && direction != "UP" &&
        direction != "DOWN" && direction != "RESET" && direction != "STOP" &&
        direction != "HOLD_LEFT" && direction != "HOLD_RIGHT" &&
        direction != "HOLD_UP" && direction != "HOLD_DOWN") {
      Serial.println("[MANUAL] Ignored unknown direction");
      return;
    }
    if (isSequenced) {
      if (hasSequencedManualCommand &&
          (epoch < lastManualEpoch || (epoch == lastManualEpoch && sequence <= lastManualSequence))) {
        Serial.println("[MANUAL] Ignored stale sequence");
        return;
      }
      lastManualEpoch = epoch;
      lastManualSequence = sequence;
      hasSequencedManualCommand = true;
    }

    lastManualCommandAt = millis();
    manualCommandsAccepted++;

    servoTestAxis = 0;
    if (direction.startsWith("HOLD_")) {
      const HoldDirection requested = direction == "HOLD_LEFT" ? HOLD_LEFT :
                                      direction == "HOLD_RIGHT" ? HOLD_RIGHT :
                                      direction == "HOLD_UP" ? HOLD_UP : HOLD_DOWN;
      if (holdDirection != requested) {
        // A new held direction starts at the last commanded position.
        targetPan = currentPan;
        targetTilt = currentTilt;
        lastHoldTick = millis();
      }
      holdDirection = requested;
      lastHoldHeartbeat = millis();
      return;
    }
    holdDirection = HOLD_NONE;
    if      (direction == "LEFT")  targetPan  += 12;
    else if (direction == "RIGHT") targetPan  -= 12;
    else if (direction == "UP")    targetTilt -= 7;
    else if (direction == "DOWN")  targetTilt += 7;
    else if (direction == "STOP")  { targetPan = currentPan; targetTilt = currentTilt; }
    else if (direction == "RESET") {
      targetPan = config.panCenter + config.panOffset;
      targetTilt = config.tiltCenter + config.tiltOffset;
    }

    targetPan = clampPan(targetPan);
    targetTilt = clampTilt(targetTilt);
    return;
  }

  if (t == "embedded/servo/tracking" && !isManualMode) {
    // Radar is the primary source while it is reporting a live target.
    // Vision tracking remains available as a fallback when radar data goes stale.
    if (hasTarget && millis() - lastTargetTime < RADAR_PRIORITY_MS) return;
    if (msg == "LOST") return;
    const int comma = msg.indexOf(',');
    if (comma > 0) {
      const int comma2 = msg.indexOf(',', comma + 1);
      const int comma3 = comma2 >= 0 ? msg.indexOf(',', comma2 + 1) : -1;
      // Accept legacy X,Y and current X,Y,width,height; reject truncated packets.
      if ((comma2 >= 0 && comma3 < 0) ||
          (comma3 >= 0 && msg.indexOf(',', comma3 + 1) >= 0)) return;
      float frameW = 640.0f;
      float frameH = 480.0f;
      float imageX = 0.0f;
      float imageY = 0.0f;
      if (!parseFloatStrict(msg.substring(0, comma), imageX) ||
          !parseFloatStrict(msg.substring(comma + 1, comma2 >= 0 ? comma2 : msg.length()), imageY) ||
          (comma3 >= 0 &&
           (!parseFloatStrict(msg.substring(comma2 + 1, comma3), frameW) ||
            !parseFloatStrict(msg.substring(comma3 + 1), frameH))) ||
          frameW < 1.0f || frameH < 1.0f || frameW > 4096.0f || frameH > 4096.0f ||
          imageX < 0.0f || imageX > frameW || imageY < 0.0f || imageY > frameH) return;
      // Scale image error to the former VGA gain, including QVGA fallback.
      const float errorX = (imageX - frameW / 2.0f) * 640.0f / frameW;
      const float errorY = (imageY - frameH / 2.0f) * 480.0f / frameH;
      targetPan  -= errorX * 0.02;
      targetTilt += errorY * 0.02;
      targetPan = clampPan(targetPan);
      targetTilt = clampTilt(targetTilt);
      lastVisionTargetTime = millis();
    }
    return;
  }
}

// ================= ĐỌC VÀ XỬ LÝ KHUNG RADAR LD2450 =================
void readRadar() {
  // Keep the UART work bounded so motor updates and MQTT commands cannot starve.
  unsigned int processed = 0;
  while (Serial2.available() && processed++ < 120) {
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
        const bool targetLocked = hasTarget && millis() - lastTargetTime < TARGET_LOST_TIMEOUT;
        float bestDistanceSquared = 1.0e20f;

        // Keep following the nearest position across LD2450 target slot changes.
        // On first acquisition, take the first valid slot.
        for (int target = 0; target < 3; target++) {
          const int offset = 4 + target * 8;
          const int16_t candidateX = decodeLd2450Signed(radarBuffer[offset], radarBuffer[offset + 1]);
          const int16_t candidateY = decodeLd2450Signed(radarBuffer[offset + 2], radarBuffer[offset + 3]);
          if (candidateY > 50 && candidateY <= 6000) {
            const float dx = static_cast<float>(candidateX) - smoothX;
            const float dy = static_cast<float>(candidateY) - smoothY;
            const float distanceSquared = dx * dx + dy * dy;
            if (targetOffset < 0 || (targetLocked && distanceSquared < bestDistanceSquared)) {
              targetOffset = offset;
              xRaw = candidateX;
              yRaw = candidateY;
              speedRaw = decodeLd2450Signed(radarBuffer[offset + 4], radarBuffer[offset + 5]);
              bestDistanceSquared = distanceSquared;
            }
            if (!targetLocked) break;
          }
        }

        if (targetOffset >= 0) {
          radarTargetFramesReceived++;
          // Start the EMA at the measured position so the first angle is not biased toward (0, 0).
          if (!targetLocked) {
            smoothX = static_cast<float>(xRaw);
            smoothY = static_cast<float>(yRaw);
          } else {
            smoothX += config.radarAlpha * (static_cast<float>(xRaw) - smoothX);
            smoothY += config.radarAlpha * (static_cast<float>(yRaw) - smoothY);
          }

          hasTarget = true;
          lastTargetTime = millis();
          radarXRaw = xRaw;
          radarYRaw = yRaw;
          radarSpeedMs = abs(speedRaw) / 100.0f;

          if (!isManualMode) radarToServoAngles(smoothX, smoothY);
        }

        // Reset the window after a complete frame to avoid parsing it repeatedly.
        memset(radarBuffer, 0, 30);
    } else if (radarBuffer[0] == 0xAA && radarBuffer[1] == 0xFF &&
               radarBuffer[2] == 0x03 && radarBuffer[3] == 0x00) {
      // One 30-byte candidate window with a matching header but bad footer.
      // This may be a false header in noise, not necessarily a lost real frame.
      radarBadFooterCandidates++;
    }
  }
}

void publishRadarTelemetry() {
  if (!hasTarget || !client.connected()) return;
  const unsigned long now = millis();
  if (now - lastRadarPublish < RADAR_PUBLISH_MS || lastTargetTime <= lastRadarPublish) return;
  lastRadarPublish = now;
  char payload[100];
  snprintf(payload, sizeof(payload), "{\"x\":%.2f,\"y\":%.2f,\"speed\":%.2f}",
           smoothX / 1000.0f, smoothY / 1000.0f, radarSpeedMs);
  client.publish("embedded/radar/data", payload);
}

void printRadarSample() {
  if (!hasTarget) return;
  const unsigned long now = millis();
  if (now - lastRadarLog < RADAR_LOG_MS || lastTargetTime <= lastRadarLog) return;
  lastRadarLog = now;
  Serial.printf("[RADAR] X=%d mm Y=%d mm speed=%.2f m/s\n",
                radarXRaw, radarYRaw, radarSpeedMs);
}

void printRadarDiagnostics() {
  if (millis() - lastRadarDiagnostics < 2000) return;
  const unsigned long interval = millis() - lastRadarDiagnostics;
  const unsigned long newFrames = radarFramesReceived - lastRadarFrameSnapshot;
  const float frameRate = interval > 0 ? 1000.0f * newFrames / interval : 0.0f;
  lastRadarFps = frameRate;
  lastRadarFrameSnapshot = radarFramesReceived;
  lastRadarDiagnostics = millis();
  Serial.printf(
    "[RADAR-DIAG] bytes=%lu frames=%lu fps=%.1f bad_footer_candidates=%lu with_target=%lu age_ms=%lu active=%s uart_pending=%d last=0x%02X mode=%s\n",
    radarBytesReceived,
    radarFramesReceived,
    frameRate,
    radarBadFooterCandidates,
    radarTargetFramesReceived,
    lastTargetTime ? millis() - lastTargetTime : 0UL,
    hasTarget ? "YES" : "NO",
    Serial2.available(),
    radarLastByte,
    isManualMode ? "MANUAL" : "AUTO"
  );
  if (millis() > 5000 && radarBytesReceived == 0) {
    Serial.println("[RADAR-WARN] No UART bytes; check LD2450 5V/GND and TX -> ESP32 GPIO16");
  } else if (radarBytesReceived > 0 && newFrames == 0) {
    Serial.println("[RADAR-WARN] UART bytes but no valid frames; check 256000 baud and wiring");
  }
}

void updateTargetTimeout() {
  if (!hasTarget || millis() - lastTargetTime <= TARGET_LOST_TIMEOUT) return;

  hasTarget = false;
  if (!isManualMode) {
    const bool visionIsFresh = lastVisionTargetTime && millis() - lastVisionTargetTime < 1200;
    if (!visionIsFresh && config.returnOnLost) {
      targetPan = clampPan(config.panCenter + config.panOffset);
      targetTilt = clampTilt(config.tiltCenter + config.tiltOffset);
    }
    Serial.printf("[AUTO] Radar target lost after %lu ms; action=%s; vision_age_ms=%lu\n",
                  millis() - lastTargetTime,
                  visionIsFresh ? "VISION" : (config.returnOnLost ? "CENTER" : "HOLD"),
                  lastVisionTargetTime ? millis() - lastVisionTargetTime : 0UL);
  }
}

// ================= CẬP NHẬT SERVO MƯỢT MÀ =================
void updateManualHold() {
  if (holdDirection == HOLD_NONE) return;
  const unsigned long now = millis();
  if (!isManualMode || now - lastHoldHeartbeat > HOLD_TIMEOUT_MS) {
    holdDirection = HOLD_NONE;
    targetPan = currentPan;
    targetTilt = currentTilt;
    Serial.println("[MANUAL] HOLD timeout/exit -> STOP");
    return;
  }
  const unsigned long elapsed = min(now - lastHoldTick, 50UL);
  if (elapsed < SERVO_UPDATE_MS) return;
  lastHoldTick = now;
  const float seconds = elapsed / 1000.0f;
  if (holdDirection == HOLD_LEFT) targetPan = clampPan(targetPan + PAN_HOLD_DPS * seconds);
  else if (holdDirection == HOLD_RIGHT) targetPan = clampPan(targetPan - PAN_HOLD_DPS * seconds);
  else if (holdDirection == HOLD_UP) targetTilt = clampTilt(targetTilt - TILT_HOLD_DPS * seconds);
  else if (holdDirection == HOLD_DOWN) targetTilt = clampTilt(targetTilt + TILT_HOLD_DPS * seconds);
}

void updateServoTest() {
  if (servoTestAxis == 0 || static_cast<int32_t>(millis() - servoTestReturnAt) < 0) return;
  if (servoTestAxis == 'P') targetPan = clampPan(servoTestReturnAngle);
  else targetTilt = clampTilt(servoTestReturnAngle);
  Serial.printf("[SERVO-TEST] %c return to %.1f deg\n", servoTestAxis, servoTestReturnAngle);
  servoTestAxis = 0;
}

void updateServoSmoothly() {
  const unsigned long now = millis();
  const unsigned long elapsed = now - lastServoUpdate;
  if (elapsed < SERVO_UPDATE_MS) return;
  lastServoUpdate = now;

  // Fixed maximum angular speed gives quick, predictable motion at any loop rate.
  const float maxStep = config.speedDps * min(elapsed, 100UL) / 1000.0f;
  const float panError = targetPan - currentPan;
  const float tiltError = targetTilt - currentTilt;
  const bool moving = fabsf(panError) > 0.5f || fabsf(tiltError) > 0.5f;

  if (moving) {
    currentPan += constrain(panError, -maxStep, maxStep);
    currentTilt += constrain(tiltError, -maxStep, maxStep);
    servoPan.write(static_cast<int>(roundf(currentPan)));
    servoTilt.write(static_cast<int>(roundf(currentTilt)));
  }

  if (moving != isMoving) {
    isMoving = moving;
    if (client.connected()) client.publish("embedded/servo/status", moving ? "MOVING" : "STOPPED");
  }
}

void printServoDiagnostics(bool force) {
  if (!force && millis() - lastServoDiagnostics < 2000) return;
  lastServoDiagnostics = millis();
  // cmd/pulse_us are values requested from the servo library, not shaft feedback.
  Serial.printf(
    "[SERVO-DIAG] mode=%s hold=%d test=%c target=%.1f/%.1f current=%.1f/%.1f cmd=%d/%d pulse_us=%d/%d attached=%d/%d\n",
    isManualMode ? "MANUAL" : "AUTO", holdDirection, servoTestAxis ? servoTestAxis : '-',
    targetPan, targetTilt, currentPan, currentTilt,
    servoPan.read(), servoTilt.read(), servoPan.readMicroseconds(), servoTilt.readMicroseconds(),
    servoPan.attached(), servoTilt.attached()
  );
  if (client.connected()) {
    char payload[640];
    const int count = snprintf(payload, sizeof(payload),
      "{\"fw\":\"%s\",\"mode\":\"%s\",\"target_pan\":%.1f,\"target_tilt\":%.1f,"
      "\"command_pan\":%.1f,\"command_tilt\":%.1f,"
      "\"pulse_pan_us\":%d,\"pulse_tilt_us\":%d,"
      "\"pan_attached\":%s,\"tilt_attached\":%s,\"hold\":%d,"
      "\"radar_age_ms\":%ld,\"radar_fps\":%.1f,\"vision_age_ms\":%ld,"
      "\"wifi_rssi\":%d,\"loop_gap_ms\":%lu,\"free_heap\":%lu,"
      "\"manual_age_ms\":%ld,\"manual_count\":%lu,\"hold_heartbeats\":%lu,"
      "\"pan_at_limit\":%s,\"tilt_at_limit\":%s}",
      FW_VERSION, isManualMode ? "MANUAL" : "AUTO", targetPan, targetTilt,
      currentPan, currentTilt, servoPan.readMicroseconds(), servoTilt.readMicroseconds(),
      servoPan.attached() ? "true" : "false", servoTilt.attached() ? "true" : "false",
      static_cast<int>(holdDirection),
      lastTargetTime ? static_cast<long>(millis() - lastTargetTime) : -1L,
      lastRadarFps,
      lastVisionTargetTime ? static_cast<long>(millis() - lastVisionTargetTime) : -1L,
      WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : -127,
      maxLoopGapMs, static_cast<unsigned long>(ESP.getFreeHeap()),
      lastManualCommandAt ? static_cast<long>(millis() - lastManualCommandAt) : -1L,
      manualCommandsAccepted, holdHeartbeats,
      (targetPan <= config.panMin + 0.5f || targetPan >= config.panMax - 0.5f) ? "true" : "false",
      (targetTilt <= config.tiltMin + 0.5f || targetTilt >= config.tiltMax - 0.5f) ? "true" : "false");
    if (count <= 0 || count >= static_cast<int>(sizeof(payload)) ||
        !client.publish("embedded/servo/diag", payload)) {
      Serial.printf("[MQTT] diag publish failed, state=%d bytes=%d\n", client.state(), count);
    }
  }
}

void printNetDiagnostics() {
  if (millis() - lastNetDiagnostics < 5000) return;
  lastNetDiagnostics = millis();
  Serial.printf("[NET-DIAG] wifi=%d rssi=%d mqtt=%d mqtt_state=%d max_loop_gap_ms=%lu free_heap=%lu manual=%lu hold_rx=%lu\n",
                WiFi.status() == WL_CONNECTED, WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : -127,
                client.connected(), client.state(), maxLoopGapMs,
                static_cast<unsigned long>(ESP.getFreeHeap()),
                manualCommandsAccepted, holdHeartbeats);
  if (maxLoopGapMs > 100) {
    Serial.println("[NET-DIAG] Loop was blocked; PWM stays active but new radar/MQTT commands waited");
  }
  if (WiFi.status() == WL_CONNECTED && WiFi.RSSI() < -75) {
    Serial.println("[NET-WARN] Weak WiFi signal may delay joystick/MQTT messages");
  }
  maxLoopGapMs = 0;
}

void applyMqttHostChange() {
  if (!mqttHostChanged) return;
  if (client.connected()) client.publish("embedded/servo/online", "OFFLINE", true);
  client.disconnect();
  client.setServer(mqttHost.c_str(), mqtt_port);
  lastMqttAttempt = millis() - 5000UL;
  mqttHostChanged = false;
  Serial.println("[MQTT] Broker updated; reconnecting to " + mqttHost);
}

// ================= SETUP =================
void setup() {
  Serial.begin(115200);
  const esp_reset_reason_t resetReason = esp_reset_reason();
  Serial.printf("[BOOT] fw=%s board=ESP32 DevKit reset_reason=%d free_heap=%lu\n",
                FW_VERSION, static_cast<int>(resetReason),
                static_cast<unsigned long>(ESP.getFreeHeap()));
  if (resetReason == ESP_RST_BROWNOUT) {
    Serial.println("[POWER-WARN] Brownout reset; measure 5V rail at servo/ESP32 during motion");
  }
  loadConfig();
  printConfig();

  // Bạn có thể đổi số 16, 17 thành 32, 33 nếu đổi chân trên ESP32
  Serial2.setRxBufferSize(1024);
  Serial2.begin(256000, SERIAL_8N1, 16, 17);

  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  ESP32PWM::allocateTimer(2);
  ESP32PWM::allocateTimer(3);
  servoPan.setPeriodHertz(50);
  servoTilt.setPeriodHertz(50);
  servoPan.attach(PAN_PIN,  500, 2400);
  servoTilt.attach(TILT_PIN, 500, 2400);
  // Installed ESP32Servo defaults to 10-bit PWM (~19.5 us at 50 Hz).
  // Raise to 16 bits after attach (attach resets the width) for <1 us steps.
  servoPan.setTimerWidth(16);
  servoTilt.setTimerWidth(16);

  servoPan.write(static_cast<int>(roundf(currentPan)));
  servoTilt.write(static_cast<int>(roundf(currentTilt)));
  Serial.printf("[SERVO-SETUP] PAN GPIO%d attached=%d, TILT GPIO%d attached=%d PWM=50Hz/%dbit/%dbit\n",
                PAN_PIN, servoPan.attached(), TILT_PIN, servoTilt.attached(),
                servoPan.readTimerWidth(), servoTilt.readTimerWidth());
  Serial.println("[POWER] Servo rail voltage/current is NOT measured by ESP32; measure 5V at MG996R under load");

  setup_wifi();
  client.setServer(mqttHost.c_str(), mqtt_port);
  espClient.setConnectionTimeout(750);
  client.setSocketTimeout(1);
  if (!client.setBufferSize(768)) Serial.println("[MQTT] Could not enlarge packet buffer");
  client.setCallback(mqttCallback);

  Serial.println("\n=== HE THONG SAN SANG (Version Chong-nhieu-Radar) ===");
}

// ================= LOOP =================
void loop() {
  const unsigned long loopAt = millis();
  if (lastLoopAt && loopAt - lastLoopAt > maxLoopGapMs) maxLoopGapMs = loopAt - lastLoopAt;
  lastLoopAt = loopAt;
  // UART and PWM must run before any potentially blocking network operation.
  readSerialCommands();
  applyMqttHostChange();
  readRadar();
  updateTargetTimeout();
  updateManualHold();
  updateServoTest();
  updateServoSmoothly();

  if (WiFi.status() != WL_CONNECTED) {
    if (wifiWasConnected) {
      wifiWasConnected = false;
      Serial.println("[WiFi] Disconnected; servo PWM and radar remain active");
    }
    if (millis() - lastWifiAttempt >= 10000) {
      lastWifiAttempt = millis();
      WiFi.disconnect();
      WiFi.begin(ssid, password);
      Serial.println("[WiFi] Dang thu ket noi lai...");
    }
  } else {
    if (!wifiWasConnected) {
      wifiWasConnected = true;
      Serial.println("[WiFi] Connected, IP=" + WiFi.localIP().toString());
    }
    if (!client.connected() && millis() - lastMqttAttempt >= 5000) reconnect();
    if (client.connected()) client.loop();
  }

  applyMqttHostChange();

  publishRadarTelemetry();
  printRadarSample();
  printRadarDiagnostics();
  printServoDiagnostics();
  printNetDiagnostics();
  delay(1);
}
