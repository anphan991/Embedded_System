#include <WiFi.h>
#include <PubSubClient.h>
#include <esp_arduino_version.h>
#include <esp_heap_caps.h>
#include <atomic>
#include <stdarg.h>
#include <Preferences.h>
#include <esp_system.h>
#include <esp_attr.h>
#include <ctype.h>
#include <math.h>
#include <stdint.h>
#include <stdlib.h>

// Arduino generates prototypes before the first function in this .ino.
enum LoopStage : uint8_t;
struct ServoConfig;

// ================= CẤU HÌNH HỆ THỐNG =================
const char* FW_VERSION = "servo-radar-2026-10-04-r5";
const char* ssid        = "No Internet";
const char* password    = "10022006";
String mqttHost = "10.28.125.55";
const int   mqtt_port   = 1883;
bool mqttHostChanged = false;

// This sketch is for the separate ESP32 DevKit, with PAN=13 and TILT=27.
#if !defined(CONFIG_IDF_TARGET_ESP32)
#error "Select ESP32 Dev Module for the servo/radar board, not ESP32-CAM or ESP32-S3."
#endif

// Fixed storage: no growing command/log queues, and no network calls in loop().
template <typename T, size_t N> class FixedQueue {
  StaticQueue_t state;
  uint8_t storage[sizeof(T) * N];
  QueueHandle_t queue = nullptr;
public:
  void begin() { queue = xQueueCreateStatic(N, sizeof(T), storage, &state); }
  bool send(const T& value) { return xQueueSend(queue, &value, 0) == pdTRUE; }
  bool receive(T& value) { return xQueueReceive(queue, &value, 0) == pdTRUE; }
  void latest(const T& value) { static_assert(N == 1, "mailbox must have one slot"); xQueueOverwrite(queue, &value); }
};

struct LogRecord { char text[256]; };
struct IncomingCommand { char topic[48]; char payload[128]; uint32_t receivedAt; };
struct Publication { char topic[48]; char payload[1400]; bool retained; };
struct BrokerSetting { char host[64]; };
FixedQueue<LogRecord, 16> logQueue;
FixedQueue<IncomingCommand, 8> commandQueue;
FixedQueue<IncomingCommand, 1> manualMailbox, visionMailbox;
FixedQueue<Publication, 8> publicationQueue;
FixedQueue<Publication, 1> diagMailbox, radarMailbox;
FixedQueue<BrokerSetting, 1> brokerMailbox;
std::atomic<bool> mqttConnected{false}, mqttJustConnected{false};
std::atomic<int> mqttState{-1};
std::atomic<uint32_t> logDropped{0}, mqttRxDropped{0}, mqttTxDropped{0};
TaskHandle_t networkTaskHandle = nullptr, loggerTaskHandle = nullptr;
char networkBroker[64];
char mqttClientId[40];
RTC_DATA_ATTR uint8_t rtcNetworkStage = 0;
uint8_t bootNetworkStage = 0;
bool runtimeReady = false;

void logPrintf(const char* format, ...) {
  LogRecord record;
  va_list args;
  va_start(args, format);
  const int count = vsnprintf(record.text, sizeof(record.text), format, args);
  va_end(args);
  if (count < 0) return;
  if (count >= static_cast<int>(sizeof(record.text))) {
    record.text[sizeof(record.text) - 2] = '\n';
    record.text[sizeof(record.text) - 1] = '\0';
  }
  if (!logQueue.send(record)) logDropped++;
}
void logLine(const char* text) { logPrintf("%s\n", text); }
void logLine(const String& text) { logLine(text.c_str()); }

void serialLoggerTask(void*) {
  LogRecord record;
  for (;;) {
    if (logQueue.receive(record)) {
      const size_t length = strlen(record.text);
      size_t offset = 0;
      while (offset < length) {
        const int available = Serial.availableForWrite();
        if (available > 0) {
          const size_t chunk = min(static_cast<size_t>(available), length - offset);
          offset += Serial.write(reinterpret_cast<const uint8_t*>(record.text + offset), chunk);
        }
        vTaskDelay(1);
      }
    } else vTaskDelay(1);
  }
}

class QueuedMqtt {
public:
  bool connected() const { return mqttConnected.load(); }
  int state() const { return mqttState.load(); }
  bool publish(const char* topic, const char* payload, bool retained = false) {
    if (!connected()) return false;
    Publication packet{};
    if (strlen(topic) >= sizeof(packet.topic) || strlen(payload) >= sizeof(packet.payload)) {
      mqttTxDropped++;
      return false;
    }
    strcpy(packet.topic, topic);
    strcpy(packet.payload, payload);
    packet.retained = retained;
    // Telemetry is a snapshot; a slow link must never create a stale backlog.
    if (!strcmp(topic, "embedded/servo/diag")) { diagMailbox.latest(packet); return true; }
    if (!strcmp(topic, "embedded/radar/data")) { radarMailbox.latest(packet); return true; }
    if (publicationQueue.send(packet)) return true;
    mqttTxDropped++;
    return false;
  }
};

// Fixed LEDC channels on separate timers. No attach/detach or timer allocation
// while moving; PAN and TILT cannot change one another's PWM resolution.
class ServoOutput {
  int pin = -1, channel = -1, pulse = 1450;
  bool ready = false;
public:
  bool attach(int gpio, int pwmChannel) {
    pin = gpio; channel = pwmChannel;
#if ESP_ARDUINO_VERSION_MAJOR >= 3
    ready = ledcAttachChannel(pin, 50, 16, channel);
#else
    ready = ledcSetup(channel, 50, 16) > 0;
    if (ready) ledcAttachPin(pin, channel);
#endif
    return ready;
  }
  void write(int angle) {
    pulse = 500 + constrain(angle, 0, 180) * 1900 / 180;
    if (!ready) return;
    const uint32_t duty = (static_cast<uint32_t>(pulse) * 65536UL + 10000UL) / 20000UL;
#if ESP_ARDUINO_VERSION_MAJOR >= 3
    if (!ledcWriteChannel(channel, duty)) ready = false;
#else
    ledcWrite(channel, duty);
#endif
  }
  bool attached() const { return ready; }
  int read() const { return (pulse - 500) * 180 / 1900; }
  int readMicroseconds() const { return ready ? pulse : 0; }
  int readTimerWidth() const { return 16; }
};

enum LoopStage : uint8_t {
  LOOP_STAGE_IDLE = 0,
  LOOP_STAGE_SERIAL = 1,
  LOOP_STAGE_SENSOR_AND_SERVO = 2,
  LOOP_STAGE_WIFI_RECONNECT = 3,
  LOOP_STAGE_MQTT_CONNECT = 4,
  LOOP_STAGE_MQTT_LOOP = 5,
  LOOP_STAGE_TELEMETRY = 6,
  LOOP_STAGE_MQTT_RECONFIGURE = 7,
  LOOP_STAGE_COMMANDS = 8
};

// RTC memory keeps the last active loop stage across a watchdog reset.
const uint32_t RTC_DIAGNOSTICS_MAGIC = 0x57445434UL;
RTC_DATA_ATTR uint32_t rtcDiagnosticsMagic = 0;
RTC_DATA_ATTR uint8_t rtcLastActiveLoopStage = LOOP_STAGE_IDLE;
RTC_DATA_ATTR uint32_t rtcTaskWatchdogResetCount = 0;
const char* bootResetReason = "UNKNOWN";
const char* bootResetStage = "UNKNOWN";
unsigned long loopStageStartedAt = 0;
unsigned long slowestLoopStageMs = 0;
LoopStage slowestLoopStage = LOOP_STAGE_IDLE;

// Chân cắm Servo
const int PAN_PIN  = 13;
const int TILT_PIN = 27;

// Giữ giới hạn hiệu chuẩn hiện có: 45..135 là vùng khởi đầu.
// Hành trình phụ thuộc servo và giá đỡ; đo cơ khí trước khi mở rộng.
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
PubSubClient networkClient(espClient); // Only networkTask accesses this instance.
QueuedMqtt   client;
ServoOutput  servoPan;
ServoOutput  servoTilt;

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
const unsigned long HOLD_TIMEOUT_MS = 400;
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
std::atomic<unsigned long> mqttConnectDurationMs{0};
std::atomic<unsigned long> mqttReconnectFailures{0};
unsigned long holdHeartbeats = 0;
unsigned long manualLogWindowCount = 0;
unsigned long manualStopWindowCount = 0;
unsigned long lastManualLog = 0;
bool hasLoggedManualSummary = false;
char lastManualLogCommand[128] = "";

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

const char* resetReasonName(esp_reset_reason_t reason) {
  switch (reason) {
    case ESP_RST_UNKNOWN: return "UNKNOWN";
    case ESP_RST_POWERON: return "POWERON";
    case ESP_RST_EXT: return "EXTERNAL";
    case ESP_RST_SW: return "SOFTWARE";
    case ESP_RST_PANIC: return "PANIC";
    case ESP_RST_INT_WDT: return "INT_WDT";
    case ESP_RST_TASK_WDT: return "TASK_WDT";
    case ESP_RST_WDT: return "WDT";
    case ESP_RST_DEEPSLEEP: return "DEEPSLEEP";
    case ESP_RST_BROWNOUT: return "BROWNOUT";
    case ESP_RST_SDIO: return "SDIO";
    default: return "OTHER";
  }
}

const char* loopStageName(uint8_t stage) {
  switch (stage) {
    case LOOP_STAGE_IDLE: return "IDLE";
    case LOOP_STAGE_SERIAL: return "SERIAL";
    case LOOP_STAGE_SENSOR_AND_SERVO: return "SENSOR_SERVO";
    case LOOP_STAGE_WIFI_RECONNECT: return "WIFI_RECONNECT";
    case LOOP_STAGE_MQTT_CONNECT: return "MQTT_CONNECT";
    case LOOP_STAGE_MQTT_LOOP: return "MQTT_LOOP";
    case LOOP_STAGE_TELEMETRY: return "TELEMETRY";
    case LOOP_STAGE_MQTT_RECONFIGURE: return "MQTT_RECONFIGURE";
    case LOOP_STAGE_COMMANDS: return "COMMANDS";
    default: return "UNKNOWN";
  }
}

void beginLoopStage(LoopStage stage) {
  rtcLastActiveLoopStage = static_cast<uint8_t>(stage);
  loopStageStartedAt = millis();
}

void endLoopStage(LoopStage stage) {
  const unsigned long elapsed = millis() - loopStageStartedAt;
  if (elapsed > slowestLoopStageMs) {
    slowestLoopStageMs = elapsed;
    slowestLoopStage = stage;
  }
  rtcLastActiveLoopStage = LOOP_STAGE_IDLE;
}

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
    logLine("[CONFIG] NVS unavailable; defaults in RAM");
  } else if (preferences.getBytesLength("cfg") == sizeof(ServoConfig)) {
    ServoConfig saved;
    if (preferences.getBytes("cfg", &saved, sizeof(saved)) == sizeof(saved) && configIsValid(saved)) {
      config = saved;
      logLine("[CONFIG] Loaded saved calibration from NVS");
    } else {
      logLine("[CONFIG] Invalid saved calibration; using safe defaults");
    }
  } else {
    logLine("[CONFIG] Using safe defaults");
  }
  if (preferencesReady) {
    const String savedHost = preferences.getString("mqtt_host", "");
    if (validMqttHost(savedHost)) mqttHost = savedHost;
  }
  currentPan = targetPan = clampPan(config.panCenter + config.panOffset);
  currentTilt = targetTilt = clampTilt(config.tiltCenter + config.tiltOffset);
}

void printConfig() {
  logPrintf("[CONFIG] broker=%s:%d\n", mqttHost.c_str(), mqtt_port);
  logPrintf("[CONFIG] pan=%.1f..%.1f center=%.1f offset=%.1f dir=%d | tilt=%.1f..%.1f center=%.1f offset=%.1f dir=%d\n",
                config.panMin, config.panMax, config.panCenter, config.panOffset, config.panDirection,
                config.tiltMin, config.tiltMax, config.tiltCenter, config.tiltOffset, config.tiltDirection);
  logPrintf("[CONFIG] speed=%.0f deg/s radar_alpha=%.2f camera_height=%.0f target_height=%.0f mm lost=%s\n",
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
    logPrintf("[CONFIG] MQTT state publish failed, bytes=%d state=%d\n", count, client.state());
  }
}

bool saveConfig() {
  const bool saved = preferencesReady &&
                     preferences.putBytes("cfg", &config, sizeof(config)) == sizeof(config);
  if (!saved) logLine("[CONFIG] NVS save failed; values valid only until restart");
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
    logPrintf("[AUTO] targetPan=%.1f targetTilt=%.1f requested=%.1f/%.1f limit=%s%s (X=%.0f Y=%.0f)\n",
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
  logPrintf("[WiFi] Connecting to %s\n", ssid);
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.begin(ssid, password);
  lastWifiAttempt = millis();
  lastMqttAttempt = millis() - 5000UL;
}

// Parse manual commands without Arduino String allocations on the hot path.
bool parseDecimalToken(const char*& cursor, uint64_t& value) {
  value = 0;
  if (*cursor < '0' || *cursor > '9') return false;
  while (*cursor >= '0' && *cursor <= '9') {
    const unsigned int digit = *cursor++ - '0';
    if (value > (UINT64_MAX - digit) / 10) return false;
    value = value * 10 + digit;
  }
  if (*cursor != ':') return false;
  ++cursor;
  return true;
}

bool parseManualPacket(const char* payload, uint64_t& epoch, uint64_t& sequence, const char*& direction) {
  direction = payload;
  epoch = sequence = 0;
  if (*direction == '@') {
    ++direction;
    if (!parseDecimalToken(direction, epoch) || !parseDecimalToken(direction, sequence)) return false;
  }
  return !strcmp(direction, "LEFT") || !strcmp(direction, "RIGHT") ||
         !strcmp(direction, "UP") || !strcmp(direction, "DOWN") ||
         !strcmp(direction, "RESET") || !strcmp(direction, "STOP") ||
         !strcmp(direction, "HOLD_LEFT") || !strcmp(direction, "HOLD_RIGHT") ||
         !strcmp(direction, "HOLD_UP") || !strcmp(direction, "HOLD_DOWN");
}

void captureMqttCommand(char* topic, byte* payload, unsigned int length) {
  IncomingCommand command{};
  if (length >= sizeof(command.payload) || strlen(topic) >= sizeof(command.topic) || memchr(payload, 0, length)) {
    mqttRxDropped++;
    return;
  }
  strcpy(command.topic, topic);
  for (unsigned int i = 0; i < length; ++i) command.payload[i] = toupper(static_cast<unsigned char>(payload[i]));
  command.receivedAt = millis();
  if (!strcmp(topic, "embedded/servo/manual")) {
    // Filter stale sequences BEFORE overwriting the one-slot mailbox, so an
    // old HOLD can never replace a newer STOP that loop() has not read yet.
    static uint64_t epochSeen = 0, sequenceSeen = 0;
    static bool sequencedSeen = false;
    uint64_t epoch, sequence;
    const char* direction;
    if (!parseManualPacket(command.payload, epoch, sequence, direction)) { mqttRxDropped++; return; }
    if (command.payload[0] == '@') {
      if (sequencedSeen && (epoch < epochSeen || (epoch == epochSeen && sequence <= sequenceSeen))) {
        mqttRxDropped++;
        return;
      }
      epochSeen = epoch; sequenceSeen = sequence; sequencedSeen = true;
    }
    manualMailbox.latest(command);
  } else if (!strcmp(topic, "embedded/servo/tracking")) {
    visionMailbox.latest(command);
  } else if (!commandQueue.send(command)) mqttRxDropped++;
}

void networkTask(void*) {
  // This is the ONLY task allowed to access networkClient/espClient.
  networkClient.setServer(networkBroker, mqtt_port);
  networkClient.setSocketTimeout(1);
  networkClient.setKeepAlive(15);
  if (!networkClient.setBufferSize(1536)) {
    logLine("[FATAL] MQTT buffer allocation failed; network disabled");
    for (;;) vTaskDelay(pdMS_TO_TICKS(1000));
  }
  networkClient.setCallback(captureMqttCommand);
  espClient.setConnectionTimeout(300);
  Publication packet;
  BrokerSetting setting;
  bool previouslyConnected = false;
  for (;;) {
    if (brokerMailbox.receive(setting)) {
      mqttConnected = false;
      if (networkClient.connected()) networkClient.publish("embedded/servo/online", "OFFLINE", true);
      networkClient.disconnect();
      strcpy(networkBroker, setting.host);
      networkClient.setServer(networkBroker, mqtt_port);
      lastMqttAttempt = millis() - 5000UL;
      logPrintf("[MQTT] Broker=%s; reconnect scheduled\n", networkBroker);
    }
    if (WiFi.status() != WL_CONNECTED) {
      if (wifiWasConnected) {
        wifiWasConnected = false;
        mqttConnected = false;
        networkClient.disconnect();
        logLine("[WiFi] Disconnected; local servo/radar loop remains active");
      }
      if (millis() - lastWifiAttempt >= 10000) {
        rtcNetworkStage = LOOP_STAGE_WIFI_RECONNECT;
        lastWifiAttempt = millis();
        WiFi.disconnect();
        WiFi.begin(ssid, password);
      }
    } else {
      if (!wifiWasConnected) {
        wifiWasConnected = true;
        logPrintf("[WiFi] Connected IP=%s\n", WiFi.localIP().toString().c_str());
      }
      if (!networkClient.connected() && millis() - lastMqttAttempt >= 5000) {
        rtcNetworkStage = LOOP_STAGE_MQTT_CONNECT;
        lastMqttAttempt = millis();
        const uint32_t started = millis();
        const bool connected = networkClient.connect(mqttClientId, "embedded/servo/online", 1, true, "OFFLINE");
        mqttConnectDurationMs = millis() - started;
        if (connected) {
          espClient.setNoDelay(true);
          networkClient.publish("embedded/servo/online", "ONLINE", true);
          networkClient.subscribe("embedded/servo/manual", 1);
          networkClient.subscribe("embedded/servo/tracking");
          networkClient.subscribe("embedded/servo/mode", 1);
          networkClient.subscribe("embedded/servo/buzzer");
          networkClient.subscribe("embedded/servo/config", 1);
          mqttConnected = true;
          mqttJustConnected = true;
        } else mqttReconnectFailures++;
        logPrintf("[MQTT] id=%s broker=%s connected=%d state=%d connect_ms=%lu\n",
                  mqttClientId, networkBroker, connected, networkClient.state(), mqttConnectDurationMs.load());
      }
      if (networkClient.connected()) {
        rtcNetworkStage = LOOP_STAGE_MQTT_LOOP;
        networkClient.loop();
        // Bound work per turn and service inbound commands between publications.
        for (int i = 0; i < 2 && publicationQueue.receive(packet); ++i) {
          if (!networkClient.publish(packet.topic, packet.payload, packet.retained)) mqttTxDropped++;
          networkClient.loop();
        }
        if (diagMailbox.receive(packet) && !networkClient.publish(packet.topic, packet.payload)) mqttTxDropped++;
        if (radarMailbox.receive(packet) && !networkClient.publish(packet.topic, packet.payload)) mqttTxDropped++;
      }
    }
    mqttConnected = networkClient.connected();
    mqttState = networkClient.state();
    if (!mqttConnected.load() && previouslyConnected) {
      // Never replay an old configuration response/telemetry after reconnect.
      while (publicationQueue.receive(packet)) {}
      diagMailbox.receive(packet);
      radarMailbox.receive(packet);
    }
    previouslyConnected = mqttConnected.load();
    rtcNetworkStage = LOOP_STAGE_IDLE;
    vTaskDelay(1);
  }
}

// ================= XỬ LÝ LỆNH MQTT =================
void printServoDiagnostics(bool force = false);

void reportConfigResult(bool ok, const String& message) {
  logPrintf("[CONFIG] %s %s\n", ok ? "OK" : "ERR", message.c_str());
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
    logLine("[CONFIG] STATUS TEST_PAN TEST_TILT CENTER DEFAULTS; KEY=VALUE: PAN/TILT_MIN/MAX/CENTER/OFFSET/DIR, SPEED_DPS, RADAR_ALPHA, CAMERA_HEIGHT_MM, TARGET_HEIGHT_MM, LOST_ACTION, MQTT_HOST");
    reportConfigResult(true, "HELP");
    return;
  }
  if (!isManualMode) {
    reportConfigResult(false, "switch to MANUAL before calibration");
    return;
  }
  if (command == "TEST_PAN" || command == "TEST_TILT") {
    const bool pan = command == "TEST_PAN";
    ServoOutput& servo = pan ? servoPan : servoTilt;
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
    if (!saved) logLine("[CONFIG] MQTT host NVS save failed; value valid only until restart");
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
      logLine("[CONFIG] Serial command too long; discarded");
    }
  }
}

void handleManualCommand(const IncomingCommand& packet) {
  uint64_t epoch, sequence;
  const char* direction;
  if (!parseManualPacket(packet.payload, epoch, sequence, direction)) { mqttRxDropped++; return; }
  const bool stop = !strcmp(direction, "STOP");
  if ((!isManualMode && !stop) || (!stop && millis() - packet.receivedAt > HOLD_TIMEOUT_MS)) {
    mqttRxDropped++;
    return;
  }
  if (packet.payload[0] == '@') {
    if (hasSequencedManualCommand &&
        (epoch < lastManualEpoch || (epoch == lastManualEpoch && sequence <= lastManualSequence))) {
      mqttRxDropped++;
      return;
    }
    lastManualEpoch = epoch; lastManualSequence = sequence; hasSequencedManualCommand = true;
  }
  manualLogWindowCount++;
  if (stop) manualStopWindowCount++;
  snprintf(lastManualLogCommand, sizeof(lastManualLogCommand), "%s", packet.payload);
  lastManualCommandAt = millis();
  manualCommandsAccepted++;
  servoTestAxis = 0;
  if (!strncmp(direction, "HOLD_", 5)) {
    holdHeartbeats++;
    const HoldDirection requested = !strcmp(direction, "HOLD_LEFT") ? HOLD_LEFT :
                                    !strcmp(direction, "HOLD_RIGHT") ? HOLD_RIGHT :
                                    !strcmp(direction, "HOLD_UP") ? HOLD_UP : HOLD_DOWN;
    if (holdDirection != requested) {
      targetPan = currentPan; targetTilt = currentTilt;
      lastHoldTick = millis() - SERVO_UPDATE_MS;
    }
    holdDirection = requested;
    lastHoldHeartbeat = packet.receivedAt;
    return;
  }
  holdDirection = HOLD_NONE;
  if      (!strcmp(direction, "LEFT"))  targetPan += 12;
  else if (!strcmp(direction, "RIGHT")) targetPan -= 12;
  else if (!strcmp(direction, "UP"))    targetTilt -= 7;
  else if (!strcmp(direction, "DOWN"))  targetTilt += 7;
  else if (stop) { targetPan = currentPan; targetTilt = currentTilt; }
  else if (!strcmp(direction, "RESET")) {
    targetPan = config.panCenter + config.panOffset;
    targetTilt = config.tiltCenter + config.tiltOffset;
  }
  targetPan = clampPan(targetPan);
  targetTilt = clampTilt(targetTilt);
}

void handleMqttCommand(const IncomingCommand& packet) {
  if (!strcmp(packet.topic, "embedded/servo/manual")) {
    handleManualCommand(packet);
    return;
  }
  // Only low-rate configuration and vision parsing use temporary Strings.
  // Both are bounded by the fixed 127-byte input limit.
  String msg(packet.payload);
  String t(packet.topic);
  if (t == "embedded/servo/config") {
    processConfigCommand(msg);
    return;
  }
  if (t == "embedded/servo/mode") {
    if (msg != "MANUAL" && msg != "AUTO") return;
    isManualMode = msg == "MANUAL";
    holdDirection = HOLD_NONE;
    servoTestAxis = 0;
    targetPan = currentPan;
    targetTilt = currentTilt;
    if (!isManualMode && hasTarget && millis() - lastTargetTime < TARGET_LOST_TIMEOUT) {
      radarToServoAngles(smoothX, smoothY);
    }
    logPrintf("[MODE] %s\n", isManualMode ? "MANUAL" : "AUTO");
    publishModeState();
    return;
  }
  if (millis() - packet.receivedAt > 500) return;

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
  logPrintf("[RADAR] X=%d mm Y=%d mm speed=%.2f m/s\n",
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
  logPrintf(
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
    logLine("[RADAR-WARN] No UART bytes; check LD2450 5V/GND and TX -> ESP32 GPIO16");
  } else if (radarBytesReceived > 0 && newFrames == 0) {
    logLine("[RADAR-WARN] UART bytes but no valid frames; check 256000 baud and wiring");
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
    logPrintf("[AUTO] Radar target lost after %lu ms; action=%s; vision_age_ms=%lu\n",
                  millis() - lastTargetTime,
                  visionIsFresh ? "VISION" : (config.returnOnLost ? "CENTER" : "HOLD"),
                  lastVisionTargetTime ? millis() - lastVisionTargetTime : 0UL);
  }
}

// ================= CẬP NHẬT SERVO MƯỢT MÀ =================
void updateManualHold() {
  if (holdDirection == HOLD_NONE) return;
  const unsigned long now = millis();
  if (!isManualMode || !client.connected() || now - lastHoldHeartbeat > HOLD_TIMEOUT_MS) {
    holdDirection = HOLD_NONE;
    targetPan = currentPan;
    targetTilt = currentTilt;
    logLine("[MANUAL] HOLD timeout/exit -> STOP");
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
  logPrintf("[SERVO-TEST] %c return to %.1f deg\n", servoTestAxis, servoTestReturnAngle);
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
  logPrintf(
    "[SERVO-DIAG] mode=%s hold=%d test=%c target=%.1f/%.1f current=%.1f/%.1f cmd=%d/%d pulse_us=%d/%d attached=%d/%d\n",
    isManualMode ? "MANUAL" : "AUTO", holdDirection, servoTestAxis ? servoTestAxis : '-',
    targetPan, targetTilt, currentPan, currentTilt,
    servoPan.read(), servoTilt.read(), servoPan.readMicroseconds(), servoTilt.readMicroseconds(),
    servoPan.attached(), servoTilt.attached()
  );
  if (client.connected()) {
    static char payload[1400];
    const int count = snprintf(payload, sizeof(payload),
      "{\"fw\":\"%s\",\"mode\":\"%s\",\"target_pan\":%.1f,\"target_tilt\":%.1f,"
      "\"command_pan\":%.1f,\"command_tilt\":%.1f,"
      "\"pulse_pan_us\":%d,\"pulse_tilt_us\":%d,"
      "\"pan_attached\":%s,\"tilt_attached\":%s,\"hold\":%d,"
      "\"radar_age_ms\":%ld,\"radar_fps\":%.1f,\"vision_age_ms\":%ld,"
      "\"wifi_rssi\":%d,\"loop_gap_ms\":%lu,\"free_heap\":%lu,"
      "\"manual_age_ms\":%ld,\"manual_count\":%lu,\"hold_heartbeats\":%lu,"
      "\"pan_at_limit\":%s,\"tilt_at_limit\":%s,"
      "\"boot_reset_reason\":\"%s\",\"boot_reset_stage\":\"%s\","
      "\"task_wdt_count\":%lu,\"slow_loop_stage\":\"%s\",\"slow_loop_stage_ms\":%lu,"
      "\"mqtt_connect_ms\":%lu,\"mqtt_reconnect_failures\":%lu,"
      "\"uptime_ms\":%lu,\"min_free_heap\":%lu,\"largest_free_block\":%lu,"
      "\"loop_stack_free\":%lu,\"network_stack_free\":%lu,"
      "\"rx_dropped\":%lu,\"tx_dropped\":%lu,\"log_dropped\":%lu,"
      "\"boot_network_stage\":\"%s\",\"hold_timeout_ms\":%lu}",
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
      (targetTilt <= config.tiltMin + 0.5f || targetTilt >= config.tiltMax - 0.5f) ? "true" : "false",
      bootResetReason, bootResetStage,
      static_cast<unsigned long>(rtcTaskWatchdogResetCount),
      loopStageName(static_cast<uint8_t>(slowestLoopStage)), slowestLoopStageMs,
      mqttConnectDurationMs.load(), mqttReconnectFailures.load(), millis(),
      static_cast<unsigned long>(ESP.getMinFreeHeap()),
      static_cast<unsigned long>(heap_caps_get_largest_free_block(MALLOC_CAP_8BIT)),
      static_cast<unsigned long>(uxTaskGetStackHighWaterMark(nullptr)),
      networkTaskHandle ? static_cast<unsigned long>(uxTaskGetStackHighWaterMark(networkTaskHandle)) : 0UL,
      static_cast<unsigned long>(mqttRxDropped.load()), static_cast<unsigned long>(mqttTxDropped.load()),
      static_cast<unsigned long>(logDropped.load()), loopStageName(bootNetworkStage), HOLD_TIMEOUT_MS);
    if (count <= 0 || count >= static_cast<int>(sizeof(payload)) ||
        !client.publish("embedded/servo/diag", payload)) {
      logPrintf("[MQTT] diag publish failed, state=%d bytes=%d\n", client.state(), count);
    }
  }
}

void printNetDiagnostics() {
  if (millis() - lastNetDiagnostics < 5000) return;
  lastNetDiagnostics = millis();
  logPrintf("[NET-DIAG] wifi=%d rssi=%d mqtt=%d mqtt_state=%d max_loop_gap_ms=%lu slow_stage=%s/%lums free_heap=%lu manual=%lu hold_rx=%lu\n",
                WiFi.status() == WL_CONNECTED, WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : -127,
                client.connected(), client.state(), maxLoopGapMs,
                loopStageName(static_cast<uint8_t>(slowestLoopStage)), slowestLoopStageMs,
                static_cast<unsigned long>(ESP.getFreeHeap()),
                manualCommandsAccepted, holdHeartbeats);
  logPrintf("[MEM-DIAG] heap=%lu min=%lu largest=%lu loop_stack=%lu net_stack=%lu rx_drop=%lu tx_drop=%lu log_drop=%lu uptime_ms=%lu\n",
            static_cast<unsigned long>(ESP.getFreeHeap()), static_cast<unsigned long>(ESP.getMinFreeHeap()),
            static_cast<unsigned long>(heap_caps_get_largest_free_block(MALLOC_CAP_8BIT)),
            static_cast<unsigned long>(uxTaskGetStackHighWaterMark(nullptr)),
            networkTaskHandle ? static_cast<unsigned long>(uxTaskGetStackHighWaterMark(networkTaskHandle)) : 0UL,
            static_cast<unsigned long>(mqttRxDropped.load()), static_cast<unsigned long>(mqttTxDropped.load()),
            static_cast<unsigned long>(logDropped.load()), millis());
  if (maxLoopGapMs > 100) {
    logLine("[NET-DIAG] Loop was blocked; PWM stays active but new radar/MQTT commands waited");
  }
  if (WiFi.status() == WL_CONNECTED && WiFi.RSSI() < -75) {
    logLine("[NET-WARN] Weak WiFi signal may delay joystick/MQTT messages");
  }
  maxLoopGapMs = 0;
  slowestLoopStageMs = 0;
  slowestLoopStage = LOOP_STAGE_IDLE;
}

void printManualMqttSummary() {
  if (manualLogWindowCount == 0) return;
  const unsigned long now = millis();
  if (hasLoggedManualSummary && now - lastManualLog < 2000) return;

  // Queue one summary for the logger task; loop() never waits for UART TX.
  logPrintf("[MQTT-MANUAL] last=%s rx_since_log=%lu stop_since_log=%lu hold_total=%lu\n",
                lastManualLogCommand, manualLogWindowCount,
                manualStopWindowCount, holdHeartbeats);
  manualLogWindowCount = 0;
  manualStopWindowCount = 0;
  lastManualLog = now;
  hasLoggedManualSummary = true;
}

void applyMqttHostChange() {
  if (!mqttHostChanged) return;
  BrokerSetting setting{};
  mqttHost.toCharArray(setting.host, sizeof(setting.host));
  brokerMailbox.latest(setting);
  mqttHostChanged = false;
}

void serviceIncomingCommands() {
  if (mqttJustConnected.exchange(false)) {
    publishModeState();
    publishConfigState();
    printServoDiagnostics(true);
  }
  IncomingCommand command;
  for (int i = 0; i < 2 && commandQueue.receive(command); ++i) handleMqttCommand(command);
  if (manualMailbox.receive(command)) handleManualCommand(command);
  if (visionMailbox.receive(command)) handleMqttCommand(command);
}

// ================= SETUP =================
void setup() {
  Serial.setTxBufferSize(1024);
  Serial.begin(115200);
  logQueue.begin(); commandQueue.begin(); manualMailbox.begin(); visionMailbox.begin();
  publicationQueue.begin(); diagMailbox.begin(); radarMailbox.begin(); brokerMailbox.begin();
  if (xTaskCreatePinnedToCore(serialLoggerTask, "servo-log", 3072, nullptr, 1, &loggerTaskHandle, 0) != pdPASS) {
    Serial.println("[FATAL] Logger task allocation failed; setup stopped");
    return;
  }
  bootNetworkStage = rtcNetworkStage;
  rtcNetworkStage = LOOP_STAGE_IDLE;
  const esp_reset_reason_t resetReason = esp_reset_reason();
  if (rtcDiagnosticsMagic != RTC_DIAGNOSTICS_MAGIC || resetReason == ESP_RST_POWERON) {
    rtcDiagnosticsMagic = RTC_DIAGNOSTICS_MAGIC;
    rtcLastActiveLoopStage = LOOP_STAGE_IDLE;
    rtcTaskWatchdogResetCount = 0;
    bootNetworkStage = LOOP_STAGE_IDLE;
  }
  const uint8_t previousLoopStage = rtcLastActiveLoopStage;
  bootResetReason = resetReasonName(resetReason);
  bootResetStage = loopStageName(previousLoopStage);
  if (resetReason == ESP_RST_TASK_WDT) {
    rtcTaskWatchdogResetCount++;
  } else if (resetReason == ESP_RST_POWERON) {
    rtcTaskWatchdogResetCount = 0;
  }
  logPrintf("[BOOT] fw=%s board=ESP32 DevKit reset_reason=%d(%s) previous_loop_stage=%s task_wdt_count=%lu free_heap=%lu\n",
                FW_VERSION, static_cast<int>(resetReason), bootResetReason, bootResetStage,
                static_cast<unsigned long>(rtcTaskWatchdogResetCount),
                static_cast<unsigned long>(ESP.getFreeHeap()));
  rtcLastActiveLoopStage = LOOP_STAGE_IDLE;
  logPrintf("[BOOT-NET] previous_network_stage=%s\n", loopStageName(bootNetworkStage));
  if (resetReason == ESP_RST_BROWNOUT) {
    logLine("[POWER-WARN] Brownout reset; measure 5V rail at servo/ESP32 during motion");
  }
  loadConfig();
  printConfig();

  // Bạn có thể đổi số 16, 17 thành 32, 33 nếu đổi chân trên ESP32
  Serial2.setRxBufferSize(1024);
  Serial2.begin(256000, SERIAL_8N1, 16, 17);

  servoPan.attach(PAN_PIN, 0);
  servoTilt.attach(TILT_PIN, 2);

  servoPan.write(static_cast<int>(roundf(currentPan)));
  servoTilt.write(static_cast<int>(roundf(currentTilt)));
  logPrintf("[SERVO-SETUP] PAN GPIO%d attached=%d, TILT GPIO%d attached=%d PWM=50Hz/%dbit/%dbit\n",
                PAN_PIN, servoPan.attached(), TILT_PIN, servoTilt.attached(),
                servoPan.readTimerWidth(), servoTilt.readTimerWidth());
  logLine("[POWER] Servo rail voltage/current is NOT measured by ESP32; measure 5V at MG996R under load");

  mqttHost.toCharArray(networkBroker, sizeof(networkBroker));
  const uint64_t chipId = ESP.getEfuseMac();
  snprintf(mqttClientId, sizeof(mqttClientId), "servo-%04lx%08lx",
           static_cast<unsigned long>(chipId >> 32), static_cast<unsigned long>(chipId));
  setup_wifi();
  if (xTaskCreatePinnedToCore(networkTask, "servo-network", 8192, nullptr, 1, &networkTaskHandle, 0) != pdPASS) {
    networkTaskHandle = nullptr;
    logLine("[FATAL] Network task allocation failed; Serial TEST_PAN/TEST_TILT still available");
  }
  runtimeReady = true;
  logLine("[READY] r5: bounded queues, independent network and 50 Hz PAN/TILT PWM");
}

// ================= LOOP =================
void loop() {
  if (!runtimeReady) { delay(10); return; }
  const unsigned long loopAt = millis();
  if (lastLoopAt && loopAt - lastLoopAt > maxLoopGapMs) maxLoopGapMs = loopAt - lastLoopAt;
  lastLoopAt = loopAt;
  // Network I/O runs on its own task. This loop never waits for TCP or Serial TX.
  beginLoopStage(LOOP_STAGE_COMMANDS);
  serviceIncomingCommands();
  endLoopStage(LOOP_STAGE_COMMANDS);
  beginLoopStage(LOOP_STAGE_SERIAL);
  readSerialCommands();
  endLoopStage(LOOP_STAGE_SERIAL);

  beginLoopStage(LOOP_STAGE_MQTT_RECONFIGURE);
  applyMqttHostChange();
  endLoopStage(LOOP_STAGE_MQTT_RECONFIGURE);

  beginLoopStage(LOOP_STAGE_SENSOR_AND_SERVO);
  readRadar();
  updateTargetTimeout();
  updateManualHold();
  updateServoTest();
  updateServoSmoothly();
  endLoopStage(LOOP_STAGE_SENSOR_AND_SERVO);

  beginLoopStage(LOOP_STAGE_MQTT_RECONFIGURE);
  applyMqttHostChange();
  endLoopStage(LOOP_STAGE_MQTT_RECONFIGURE);

  beginLoopStage(LOOP_STAGE_TELEMETRY);
  printManualMqttSummary();
  publishRadarTelemetry();
  printRadarSample();
  printRadarDiagnostics();
  printServoDiagnostics();
  printNetDiagnostics();
  endLoopStage(LOOP_STAGE_TELEMETRY);
  rtcLastActiveLoopStage = LOOP_STAGE_IDLE;
  delay(1);
}
