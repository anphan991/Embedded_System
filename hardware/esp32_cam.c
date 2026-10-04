#include "esp_camera.h"
#include <WiFi.h>
#include "esp_http_server.h"
#include "esp_system.h"
#include <stdlib.h>
#include <string.h>

// Upload to the camera board matching the selected profile. The camera
// carrier board, not just the WROOM module, determines these GPIOs.
// Confirm the carrier schematic/silkscreen first.
#define CAMERA_PROFILE_UNSELECTED 0
#define CAMERA_PROFILE_S3_EYE_COMPAT 1
#define CAMERA_PROFILE_S3_WROOM_PWDN38 2
#define CAMERA_PROFILE_AI_THINKER_ESP32 3
#ifndef CAMERA_BOARD_PROFILE
// The owner reports successful upload and visible low-FPS video with Arduino
// board "AI Thinker ESP32-CAM". Use that proven target as the working default.
// Re-select a profile only if the physical carrier/sensor is verified later.
#define CAMERA_BOARD_PROFILE CAMERA_PROFILE_AI_THINKER_ESP32
#endif

#if CAMERA_BOARD_PROFILE == CAMERA_PROFILE_UNSELECTED
#error "Confirm actual camera carrier board and sensor, then set CAMERA_BOARD_PROFILE to 1, 2, or 3."
#elif CAMERA_BOARD_PROFILE == CAMERA_PROFILE_S3_EYE_COMPAT
#if !defined(CONFIG_IDF_TARGET_ESP32S3)
#error "S3_EYE_COMPAT requires an ESP32-S3 board target in Arduino IDE."
#endif
// Espressif Arduino CameraWebServer CAMERA_MODEL_ESP32S3_EYE.
// Freenove-like boards often use this data map and leave PWDN unconnected.
#define CAMERA_PROFILE_NAME "S3_EYE_COMPAT"
#define CAMERA_EXPECTED_PID OV5640_PID
#define CAM_PWDN  -1
#define CAM_RESET -1
#define CAM_XCLK  15
#define CAM_SIOD   4
#define CAM_SIOC   5
#define CAM_D0    11
#define CAM_D1     9
#define CAM_D2     8
#define CAM_D3    10
#define CAM_D4    12
#define CAM_D5    18
#define CAM_D6    17
#define CAM_D7    16
#define CAM_VSYNC  6
#define CAM_HREF   7
#define CAM_PCLK  13
#elif CAMERA_BOARD_PROFILE == CAMERA_PROFILE_S3_WROOM_PWDN38
#if !defined(CONFIG_IDF_TARGET_ESP32S3)
#error "S3_WROOM_PWDN38 requires an ESP32-S3 board target in Arduino IDE."
#endif
// Espressif esp32-camera camera_example BOARD_ESP32S3_WROOM.
// GPIO38 can be an SD-card pin on other boards: select only if schematic agrees.
#define CAMERA_PROFILE_NAME "S3_WROOM_PWDN38"
#define CAMERA_EXPECTED_PID OV5640_PID
#define CAM_PWDN  38
#define CAM_RESET -1
#define CAM_XCLK  15
#define CAM_SIOD   4
#define CAM_SIOC   5
#define CAM_D0    11
#define CAM_D1     9
#define CAM_D2     8
#define CAM_D3    10
#define CAM_D4    12
#define CAM_D5    18
#define CAM_D6    17
#define CAM_D7    16
#define CAM_VSYNC  6
#define CAM_HREF   7
#define CAM_PCLK  13
#elif CAMERA_BOARD_PROFILE == CAMERA_PROFILE_AI_THINKER_ESP32
#if !defined(CONFIG_IDF_TARGET_ESP32)
#error "AI_THINKER_ESP32 requires the AI Thinker ESP32-CAM board target, not ESP32-S3."
#endif
// Espressif Arduino CameraWebServer CAMERA_MODEL_AI_THINKER pin map.
// The owner's ESP32-CAM has an ESP-32S module and TY-OV3660 camera flex.
// Board pin map and sensor model are separate choices: OV3660 works with
// this pin map when its SCCB PID is reported by the camera driver.
#define CAMERA_PROFILE_NAME "AI_THINKER_ESP32"
#define CAMERA_EXPECTED_PID OV3660_PID
#define CAM_PWDN  32
#define CAM_RESET -1
#define CAM_XCLK   0
#define CAM_SIOD  26
#define CAM_SIOC  27
#define CAM_D0     5
#define CAM_D1    18
#define CAM_D2    19
#define CAM_D3    21
#define CAM_D4    36
#define CAM_D5    39
#define CAM_D6    34
#define CAM_D7    35
#define CAM_VSYNC 25
#define CAM_HREF  23
#define CAM_PCLK  22
#else
#error "Unknown CAMERA_BOARD_PROFILE."
#endif

#if CAMERA_BOARD_PROFILE >= CAMERA_PROFILE_S3_EYE_COMPAT && CAMERA_BOARD_PROFILE <= CAMERA_PROFILE_AI_THINKER_ESP32

const char* ssid = "No Internet";
const char* password = "10022006";

// VGA balances detail for AI and transfer time. Set QVGA for slower Wi-Fi.
static const framesize_t STREAM_FRAME_SIZE = FRAMESIZE_VGA;
static const int STREAM_JPEG_QUALITY = 16; // Larger value -> smaller JPEG.
static const uint32_t WIFI_RETRY_MS = 10000;
static const uint32_t LOG_INTERVAL_MS = 5000;

#define PART_BOUNDARY "123456789000000000000987654321"
static const char* STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=" PART_BOUNDARY;
static const char* FIRST_STREAM_PART = "--" PART_BOUNDARY "\r\nContent-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";
static const char* NEXT_STREAM_PART = "\r\n--" PART_BOUNDARY "\r\nContent-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

static httpd_handle_t stream_httpd = nullptr;
static httpd_handle_t status_httpd = nullptr;
static bool camera_ready = false;
static bool servers_started = false;
static bool status_ready = false;
static bool wifi_was_connected = false;
static uint32_t last_wifi_retry_ms = 0;
static uint32_t last_server_retry_ms = 0;
static uint32_t last_idle_log_ms = 0;
static uint32_t wifi_reconnects = 0;
static esp_err_t camera_init_error = ESP_OK;
static uint16_t sensor_pid = 0;

struct CameraStats {
  bool stream_active;
  uint32_t client_count;
  uint32_t frames_sent;
  uint32_t capture_errors;
  uint32_t send_errors;
  uint32_t last_frame_ms;
  uint32_t last_jpeg_bytes;
  uint32_t fps_x10;
  uint32_t avg_capture_ms;
  uint32_t avg_send_ms;
  esp_err_t last_send_error;
};
static CameraStats stats = {};
static portMUX_TYPE stats_mux = portMUX_INITIALIZER_UNLOCKED;

struct CameraTuning {
  framesize_t requested_size;
  int requested_quality;
  framesize_t applied_size;
  int applied_quality;
  bool pending;
  int last_error;
};
static CameraTuning tuning = {};

static const char* sensor_name(uint16_t pid) {
  if (pid == OV3660_PID) return "OV3660";
  if (pid == OV2640_PID) return "OV2640";
  if (pid == OV5640_PID) return "OV5640";
  return "UNKNOWN";
}

static const char* size_name(framesize_t size) {
  return size == FRAMESIZE_QVGA ? "QVGA" : "VGA";
}

// Apply from the stream task between frames, rather than changing sensor
// registers concurrently with esp_camera_fb_get() in the status HTTP task.
static void apply_pending_tuning() {
  CameraTuning requested;
  portENTER_CRITICAL(&stats_mux);
  const bool pending = tuning.pending;
  requested = tuning;
  tuning.pending = false;
  portEXIT_CRITICAL(&stats_mux);
  if (!pending) return;

  sensor_t* sensor = esp_camera_sensor_get();
  int error = sensor ? ESP_OK : ESP_FAIL;
  if (sensor && requested.requested_size != requested.applied_size) {
    error = sensor->set_framesize(sensor, requested.requested_size);
  }
  if (sensor && error == ESP_OK && requested.requested_quality != requested.applied_quality) {
    error = sensor->set_quality(sensor, requested.requested_quality);
  }
  portENTER_CRITICAL(&stats_mux);
  tuning.last_error = error;
  if (sensor) {
    tuning.applied_size = sensor->status.framesize;
    tuning.applied_quality = sensor->status.quality;
  }
  portEXIT_CRITICAL(&stats_mux);
  Serial.printf("[CAM-TUNE] requested=%s quality=%d applied=%s quality=%d err=%d\n",
                size_name(requested.requested_size), requested.requested_quality,
                size_name(tuning.applied_size), tuning.applied_quality, error);
}

static esp_err_t stream_handler(httpd_req_t* req) {
  if (!camera_ready) {
    httpd_resp_set_status(req, "503 Service Unavailable");
    return httpd_resp_send(req, "Camera initialization failed; see :82/status and Serial", HTTPD_RESP_USE_STRLEN);
  }
  portENTER_CRITICAL(&stats_mux);
  const bool busy = stats.stream_active;
  if (!busy) {
    stats.stream_active = true;
    ++stats.client_count;
  }
  portEXIT_CRITICAL(&stats_mux);
  if (busy) {
    httpd_resp_set_status(req, "503 Service Unavailable");
    return httpd_resp_send(req, "Camera stream already in use by backend", HTTPD_RESP_USE_STRLEN);
  }

  esp_err_t res = httpd_resp_set_type(req, STREAM_CONTENT_TYPE);
  if (res == ESP_OK) res = httpd_resp_set_hdr(req, "Cache-Control", "no-store, no-cache, must-revalidate");
  if (res == ESP_OK) res = httpd_resp_set_hdr(req, "X-Accel-Buffering", "no");
  uint32_t window_start = millis();
  uint32_t window_frames = 0;
  uint32_t window_capture_ms = 0;
  uint32_t window_send_ms = 0;
  uint64_t window_bytes = 0;
  char part_buf[128];
  bool first_frame = true;

  while (res == ESP_OK && WiFi.status() == WL_CONNECTED) {
    apply_pending_tuning();
    const uint32_t capture_start = millis();
    camera_fb_t* fb = esp_camera_fb_get();
    const uint32_t capture_ms = millis() - capture_start;
    if (!fb) {
      portENTER_CRITICAL(&stats_mux);
      ++stats.capture_errors;
      portEXIT_CRITICAL(&stats_mux);
      Serial.printf("[CAM-ERROR] capture failed after %lu ms; reconnecting stream\n",
                    static_cast<unsigned long>(capture_ms));
      res = ESP_FAIL;
      break;
    }

    const int header_len = snprintf(part_buf, sizeof(part_buf),
                                    first_frame ? FIRST_STREAM_PART : NEXT_STREAM_PART,
                                    static_cast<unsigned int>(fb->len));
    const uint32_t send_start = millis();
    if (header_len < 0 || header_len >= static_cast<int>(sizeof(part_buf))) {
      res = ESP_ERR_INVALID_SIZE;
    } else {
      res = httpd_resp_send_chunk(req, part_buf, header_len);
      if (res == ESP_OK) res = httpd_resp_send_chunk(req, reinterpret_cast<const char*>(fb->buf), fb->len);
    }
    const uint32_t send_ms = millis() - send_start;
    const uint32_t jpeg_bytes = static_cast<uint32_t>(fb->len);
    esp_camera_fb_return(fb);

    if (res != ESP_OK) {
      portENTER_CRITICAL(&stats_mux);
      ++stats.send_errors;
      stats.last_send_error = res;
      portEXIT_CRITICAL(&stats_mux);
      Serial.printf("[CAM-ERROR] send failed err=0x%x send_ms=%lu jpeg=%lu B rssi=%d\n",
                    static_cast<unsigned>(res), static_cast<unsigned long>(send_ms),
                    static_cast<unsigned long>(jpeg_bytes), WiFi.RSSI());
      break;
    }

    ++window_frames;
    first_frame = false;
    window_bytes += jpeg_bytes;
    window_capture_ms += capture_ms;
    window_send_ms += send_ms;
    portENTER_CRITICAL(&stats_mux);
    ++stats.frames_sent;
    stats.last_frame_ms = millis();
    stats.last_jpeg_bytes = jpeg_bytes;
    portEXIT_CRITICAL(&stats_mux);

    const uint32_t elapsed = millis() - window_start;
    if (elapsed >= LOG_INTERVAL_MS) {
      const uint32_t fps_x10 = window_frames * 10000UL / elapsed;
      const uint32_t avg_capture_ms = window_frames ? window_capture_ms / window_frames : 0;
      const uint32_t avg_send_ms = window_frames ? window_send_ms / window_frames : 0;
      const unsigned long avg_jpeg = window_frames ? static_cast<unsigned long>(window_bytes / window_frames) : 0;
      portENTER_CRITICAL(&stats_mux);
      stats.fps_x10 = fps_x10;
      stats.avg_capture_ms = avg_capture_ms;
      stats.avg_send_ms = avg_send_ms;
      portEXIT_CRITICAL(&stats_mux);
      Serial.printf("[CAM-DIAG] fps=%lu.%lu jpeg=%lu B capture=%lu ms send=%lu ms rssi=%d dBm heap=%lu psram=%lu\n",
                    static_cast<unsigned long>(fps_x10 / 10), static_cast<unsigned long>(fps_x10 % 10),
                    avg_jpeg, static_cast<unsigned long>(avg_capture_ms),
                    static_cast<unsigned long>(avg_send_ms), WiFi.RSSI(),
                    static_cast<unsigned long>(ESP.getFreeHeap()),
                    static_cast<unsigned long>(ESP.getFreePsram()));
      window_start = millis();
      window_frames = 0;
      window_capture_ms = 0;
      window_send_ms = 0;
      window_bytes = 0;
    }
  }

  portENTER_CRITICAL(&stats_mux);
  stats.stream_active = false;
  stats.fps_x10 = 0;
  portEXIT_CRITICAL(&stats_mux);
  if (WiFi.status() != WL_CONNECTED && res == ESP_OK) res = ESP_FAIL;
  Serial.printf("[CAM] stream closed err=0x%x wifi=%d\n", static_cast<unsigned>(res), WiFi.status());
  return res;
}

static esp_err_t status_handler(httpd_req_t* req) {
  CameraStats copy;
  CameraTuning tune_copy;
  portENTER_CRITICAL(&stats_mux);
  copy = stats;
  tune_copy = tuning;
  portEXIT_CRITICAL(&stats_mux);

  const uint32_t age_ms = copy.last_frame_ms ? millis() - copy.last_frame_ms : 0;
  char json[768];
  const int n = snprintf(json, sizeof(json),
    "{\"profile\":\"%s\",\"sensor\":\"%s\",\"sensor_pid\":%u,\"sensor_match\":%s,\"camera_ready\":%s,\"camera_init_error\":%d,"
    "\"psram_bytes\":%lu,\"psram_free\":%lu,\"wifi_connected\":%s,\"rssi_dbm\":%d,"
    "\"wifi_reconnects\":%lu,\"stream_active\":%s,\"clients\":%lu,\"frames\":%lu,"
    "\"capture_errors\":%lu,\"send_errors\":%lu,\"fps_x10\":%lu,\"last_jpeg_bytes\":%lu,"
    "\"frame_age_ms\":%lu,\"avg_capture_ms\":%lu,\"avg_send_ms\":%lu,\"last_send_error\":%d,"
    "\"framesize\":\"%s\",\"jpeg_quality\":%d,\"tuning_pending\":%s,\"tuning_error\":%d}",
    CAMERA_PROFILE_NAME, sensor_name(sensor_pid), static_cast<unsigned>(sensor_pid),
    sensor_pid == CAMERA_EXPECTED_PID ? "true" : "false", camera_ready ? "true" : "false",
    static_cast<int>(camera_init_error), static_cast<unsigned long>(ESP.getPsramSize()),
    static_cast<unsigned long>(ESP.getFreePsram()), WiFi.status() == WL_CONNECTED ? "true" : "false",
    WiFi.RSSI(), static_cast<unsigned long>(wifi_reconnects), copy.stream_active ? "true" : "false",
    static_cast<unsigned long>(copy.client_count), static_cast<unsigned long>(copy.frames_sent),
    static_cast<unsigned long>(copy.capture_errors), static_cast<unsigned long>(copy.send_errors),
    static_cast<unsigned long>(copy.fps_x10), static_cast<unsigned long>(copy.last_jpeg_bytes),
    static_cast<unsigned long>(age_ms), static_cast<unsigned long>(copy.avg_capture_ms),
    static_cast<unsigned long>(copy.avg_send_ms), static_cast<int>(copy.last_send_error),
    size_name(tune_copy.applied_size), tune_copy.applied_quality,
    tune_copy.pending ? "true" : "false", tune_copy.last_error);
  if (n < 0 || n >= static_cast<int>(sizeof(json))) return ESP_FAIL;
  httpd_resp_set_type(req, "application/json");
  httpd_resp_set_hdr(req, "Cache-Control", "no-store");
  return httpd_resp_send(req, json, n);
}

static esp_err_t tune_handler(httpd_req_t* req) {
  if (!camera_ready) {
    httpd_resp_set_status(req, "503 Service Unavailable");
    return httpd_resp_send(req, "Camera initialization failed", HTTPD_RESP_USE_STRLEN);
  }
  const size_t query_len = httpd_req_get_url_query_len(req);
  if (!query_len || query_len >= 128) {
    httpd_resp_set_status(req, "400 Bad Request");
    return httpd_resp_send(req, "Use /tune?framesize=QVGA|VGA&quality=10..30", HTTPD_RESP_USE_STRLEN);
  }
  char query[128];
  if (httpd_req_get_url_query_str(req, query, sizeof(query)) != ESP_OK) return ESP_FAIL;
  CameraTuning next;
  portENTER_CRITICAL(&stats_mux);
  next = tuning;
  portEXIT_CRITICAL(&stats_mux);
  char value[16];
  bool change_requested = false;
  if (httpd_query_key_value(query, "framesize", value, sizeof(value)) == ESP_OK) {
    if (!strcmp(value, "QVGA")) next.requested_size = FRAMESIZE_QVGA;
    else if (!strcmp(value, "VGA") && psramFound()) next.requested_size = FRAMESIZE_VGA;
    else {
      httpd_resp_set_status(req, "400 Bad Request");
      return httpd_resp_send(req, "framesize must be QVGA, or VGA with PSRAM", HTTPD_RESP_USE_STRLEN);
    }
    change_requested = true;
  }
  if (httpd_query_key_value(query, "quality", value, sizeof(value)) == ESP_OK) {
    char* end = nullptr;
    const long quality = strtol(value, &end, 10);
    if (!value[0] || *end || quality < 10 || quality > 30) {
      httpd_resp_set_status(req, "400 Bad Request");
      return httpd_resp_send(req, "quality must be an integer from 10 to 30", HTTPD_RESP_USE_STRLEN);
    }
    next.requested_quality = static_cast<int>(quality);
    change_requested = true;
  }
  if (!change_requested) {
    httpd_resp_set_status(req, "400 Bad Request");
    return httpd_resp_send(req, "Provide framesize or quality", HTTPD_RESP_USE_STRLEN);
  }
  portENTER_CRITICAL(&stats_mux);
  tuning.requested_size = next.requested_size;
  tuning.requested_quality = next.requested_quality;
  tuning.pending = true;
  portEXIT_CRITICAL(&stats_mux);
  char json[96];
  const int n = snprintf(json, sizeof(json), "{\"status\":\"queued\",\"framesize\":\"%s\",\"quality\":%d}",
                         size_name(next.requested_size), next.requested_quality);
  httpd_resp_set_type(req, "application/json");
  return httpd_resp_send(req, json, n);
}

static void start_servers() {
  if (servers_started) return;
  httpd_config_t stream_config = HTTPD_DEFAULT_CONFIG();
  stream_config.server_port = 81;
  stream_config.send_wait_timeout = 2;
  const httpd_uri_t stream_uri = {
    .uri = "/stream", .method = HTTP_GET, .handler = stream_handler, .user_ctx = nullptr
  };
  if (!stream_httpd) {
    if (httpd_start(&stream_httpd, &stream_config) != ESP_OK) {
      Serial.println("[CAM-ERROR] failed to start :81/stream HTTP server");
      return;
    }
    if (httpd_register_uri_handler(stream_httpd, &stream_uri) != ESP_OK) {
      Serial.println("[CAM-ERROR] failed to register :81/stream");
      httpd_stop(stream_httpd);
      stream_httpd = nullptr;
      return;
    }
  }

  // Long-running MJPEG holds the first HTTP task; status uses a second port.
  httpd_config_t status_config = HTTPD_DEFAULT_CONFIG();
  status_config.server_port = 82;
  status_config.ctrl_port = stream_config.ctrl_port + 1;
  const httpd_uri_t status_uri = {
    .uri = "/status", .method = HTTP_GET, .handler = status_handler, .user_ctx = nullptr
  };
  const httpd_uri_t tune_uri = {
    .uri = "/tune", .method = HTTP_GET, .handler = tune_handler, .user_ctx = nullptr
  };
  if (httpd_start(&status_httpd, &status_config) != ESP_OK) {
    Serial.println("[CAM-ERROR] failed to start :82/status HTTP server");
  } else if (httpd_register_uri_handler(status_httpd, &status_uri) != ESP_OK ||
             httpd_register_uri_handler(status_httpd, &tune_uri) != ESP_OK) {
    Serial.println("[CAM-ERROR] failed to register :82/status or :82/tune");
    httpd_stop(status_httpd);
    status_httpd = nullptr;
  } else {
    status_ready = true;
  }
  // Retry only the missing status server on the next scheduled attempt;
  // avoid restarting an active MJPEG stream when its diagnostics failed.
  servers_started = stream_httpd != nullptr && status_ready;
}

void setup() {
  Serial.begin(115200);
  Serial.setDebugOutput(false);
  delay(200);
  Serial.printf("\n[CAM-BOOT] profile=%s reset_reason=%d xclk=20MHz expected_pid=0x%04x\n",
                CAMERA_PROFILE_NAME, static_cast<int>(esp_reset_reason()), CAMERA_EXPECTED_PID);
  Serial.printf("[CAM-PINS] pwdn=%d reset=%d xclk=%d sda=%d scl=%d d0..d7=%d,%d,%d,%d,%d,%d,%d,%d vsync=%d href=%d pclk=%d\n",
                CAM_PWDN, CAM_RESET, CAM_XCLK, CAM_SIOD, CAM_SIOC,
                CAM_D0, CAM_D1, CAM_D2, CAM_D3, CAM_D4, CAM_D5, CAM_D6, CAM_D7,
                CAM_VSYNC, CAM_HREF, CAM_PCLK);

  camera_config_t config = {};
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = CAM_D0;
  config.pin_d1 = CAM_D1;
  config.pin_d2 = CAM_D2;
  config.pin_d3 = CAM_D3;
  config.pin_d4 = CAM_D4;
  config.pin_d5 = CAM_D5;
  config.pin_d6 = CAM_D6;
  config.pin_d7 = CAM_D7;
  config.pin_xclk = CAM_XCLK;
  config.pin_pclk = CAM_PCLK;
  config.pin_vsync = CAM_VSYNC;
  config.pin_href = CAM_HREF;
  config.pin_sccb_sda = CAM_SIOD;
  config.pin_sccb_scl = CAM_SIOC;
  config.pin_pwdn = CAM_PWDN;
  config.pin_reset = CAM_RESET;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.jpeg_quality = STREAM_JPEG_QUALITY;
  if (psramFound()) {
    config.frame_size = STREAM_FRAME_SIZE;
    config.fb_count = 2;
    config.fb_location = CAMERA_FB_IN_PSRAM;
    config.grab_mode = CAMERA_GRAB_LATEST;
  } else {
    config.frame_size = FRAMESIZE_QVGA;
    config.fb_count = 1;
    config.fb_location = CAMERA_FB_IN_DRAM;
    config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
    Serial.println("[CAM-CONFIG] PSRAM missing: QVGA fallback; check Arduino IDE PSRAM setting and actual module variant");
  }
  Serial.printf("[CAM-CONFIG] psram=%lu B fb_count=%d frame=%s jpeg_quality=%d\n",
                static_cast<unsigned long>(ESP.getPsramSize()), config.fb_count,
                psramFound() ? "VGA" : "QVGA", config.jpeg_quality);

  camera_init_error = esp_camera_init(&config);
  camera_ready = camera_init_error == ESP_OK;
  tuning.requested_size = config.frame_size;
  tuning.applied_size = config.frame_size;
  tuning.requested_quality = config.jpeg_quality;
  tuning.applied_quality = config.jpeg_quality;
  if (camera_ready) {
    sensor_t* sensor = esp_camera_sensor_get();
    sensor_pid = sensor ? sensor->id.PID : 0;
    Serial.printf("[CAM-SENSOR] model=%s pid=0x%04x expected_pid=0x%04x\n",
                  sensor_name(sensor_pid), sensor_pid, CAMERA_EXPECTED_PID);
    if (sensor) {
      Serial.printf("[CAM-SENSOR] auto_exposure=%u auto_gain=%u (sensor settings, not measured shutter time)\n",
                    sensor->status.aec, sensor->status.agc);
      // Xoay 180 độ ở mức phần cứng cảm biến OV2640 (0% CPU, giữ nguyên FPS tối đa):
      sensor->set_vflip(sensor, 1);    // 1 = Lật dọc (Vertical flip)
      sensor->set_hmirror(sensor, 1);  // 1 = Lật ngang (Horizontal mirror)
      Serial.println("[CAM-SENSOR] Hardware 180-degree rotation enabled (vflip=1, hmirror=1).");
    }
    if (sensor_pid != CAMERA_EXPECTED_PID) Serial.println("[CAM-WARN] sensor PID differs from selected profile; verify actual board and camera module");
  } else {
    Serial.printf("[CAM-ERROR] esp_camera_init failed err=0x%x; check selected profile, ribbon, 3.3V supply, PSRAM\n",
                  static_cast<unsigned>(camera_init_error));
  }

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.setAutoReconnect(true);
  WiFi.begin(ssid, password);
  last_wifi_retry_ms = millis();
  Serial.println("[CAM-WIFI] connecting...");
}

void loop() {
  const bool connected = WiFi.status() == WL_CONNECTED;
  if (connected && !wifi_was_connected) {
    Serial.printf("[CAM-WIFI] connected ip=%s rssi=%d dBm channel=%d\n",
                  WiFi.localIP().toString().c_str(), WiFi.RSSI(), WiFi.channel());
    start_servers();
    last_server_retry_ms = millis();
    Serial.printf("[CAM-URL] VIDEO_SOURCE=http://%s:81/stream\n", WiFi.localIP().toString().c_str());
    if (status_ready) {
      Serial.printf("[CAM-URL] Diagnostics=http://%s:82/status\n", WiFi.localIP().toString().c_str());
      Serial.printf("[CAM-URL] Runtime tune=http://%s:82/tune?framesize=QVGA&quality=20\n", WiFi.localIP().toString().c_str());
    }
  } else if (!connected && wifi_was_connected) {
    ++wifi_reconnects;
    Serial.printf("[CAM-WIFI] disconnected status=%d reconnects=%lu\n",
                  WiFi.status(), static_cast<unsigned long>(wifi_reconnects));
  }
  wifi_was_connected = connected;

  if (connected && !servers_started && millis() - last_server_retry_ms >= WIFI_RETRY_MS) {
    Serial.println("[CAM-HTTP] retrying HTTP server startup");
    start_servers();
    last_server_retry_ms = millis();
  }

  if (!connected && millis() - last_wifi_retry_ms >= WIFI_RETRY_MS) {
    Serial.printf("[CAM-WIFI] retry status=%d\n", WiFi.status());
    WiFi.reconnect();
    last_wifi_retry_ms = millis();
  }
  if (connected && millis() - last_idle_log_ms >= LOG_INTERVAL_MS) {
    CameraStats copy;
    portENTER_CRITICAL(&stats_mux);
    copy = stats;
    portEXIT_CRITICAL(&stats_mux);
    if (!copy.stream_active) {
      Serial.printf("[CAM-DIAG] idle camera_ready=%d clients=%lu capture_errors=%lu send_errors=%lu rssi=%d heap=%lu psram=%lu\n",
                    camera_ready, static_cast<unsigned long>(copy.client_count),
                    static_cast<unsigned long>(copy.capture_errors),
                    static_cast<unsigned long>(copy.send_errors), WiFi.RSSI(),
                    static_cast<unsigned long>(ESP.getFreeHeap()),
                    static_cast<unsigned long>(ESP.getFreePsram()));
    }
    last_idle_log_ms = millis();
  }
  delay(250);
}

#endif // selected camera board profile
