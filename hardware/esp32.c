#include <WiFi.h>
#include <PubSubClient.h>
#include <ESP32Servo.h>

// ================= CẤU HÌNH HỆ THỐNG =================
const char* ssid = "No Internet";
const char* password = "10022006";
const char* mqtt_server = "10.28.125.55"; // IP của máy tính (Đã chốt)
const int mqtt_port = 1883;

// Chân cắm
const int PAN_PIN = 13;
const int TILT_PIN = 27;

// Đối tượng hệ thống
WiFiClient espClient;
PubSubClient client(espClient);
Servo servoPan;
Servo servoTilt;

// Biến điều khiển Servo Mượt (Thuật toán Bộ lọc trung bình động - EMA)
float currentPan = 90.0, targetPan = 90.0;
float currentTilt = 90.0, targetTilt = 90.0;
const float SMOOTHING_FACTOR = 0.08; // Càng nhỏ servo quay càng mượt
bool isMoving = false;
bool isManualMode = false;
unsigned long lastManualCmd = 0;

// ================= HÀM KẾT NỐI MẠNG =================
void setup_wifi() {
  Serial.print("\nKet noi Wifi: "); Serial.println(ssid);
  WiFi.begin(ssid, password);
  unsigned long startAttemptTime = millis();
  const unsigned long WIFI_TIMEOUT = 60000;
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    if (millis() - startAttemptTime > WIFI_TIMEOUT) {
      Serial.println("\n[LỖI] Khong the ket noi WiFi trong thoi gian cho!");
      break; 
    }
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi OK!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
  }
}

void reconnect() {
  int attempts = 0;
  while (!client.connected() && attempts < 5) {
    Serial.print("Ket noi MQTT Broker... ");
    if (client.connect("ESP32_AI_Tracking")) {
      Serial.println("OK!");
      // Đăng ký lắng nghe các kênh:
      client.subscribe("embedded/servo/tracking");
      client.subscribe("embedded/servo/manual");
      client.subscribe("embedded/servo/buzzer");
      return;
    } else {
      Serial.print("Loi, ma loi: ");
      Serial.println(client.state());
      attempts++;
      delay(3000);
    }
  }
}

// ================= XỬ LÝ LỆNH TỪ MÁY TÍNH =================
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String msg = "";
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
  String currentTopic = String(topic);
  
  // IN RA ĐỂ KIỂM TRA MẠCH CÓ NHẬN LỆNH KHÔNG
  Serial.print("NHAN LENH TỪ KÊNH [");
  Serial.print(currentTopic);
  Serial.print("]: ");
  Serial.println(msg);

  // Đề phòng frontend gửi chữ thường, ép tất cả thành chữ HOA
  msg.toUpperCase();

  // 1. Chế độ điều khiển bằng tay (Joystick)
  if (currentTopic == "embedded/servo/manual") {
    isManualMode = true;
    lastManualCmd = millis();
    
    if (msg == "LEFT") targetPan += 10;
    else if (msg == "RIGHT") targetPan -= 10;
    else if (msg == "UP") targetTilt -= 10;
    else if (msg == "DOWN") targetTilt += 10;
  }
  
  // 2. Chế độ AI Tracking bám sát
  else if (currentTopic == "embedded/servo/tracking" && !isManualMode) {
    if (msg != "LOST") {
      int commaIdx = msg.indexOf(',');
      if (commaIdx > 0) {
        int xPixel = msg.substring(0, commaIdx).toInt();
        int yPixel = msg.substring(commaIdx + 1).toInt();
        
        float errorX = xPixel - 320; 
        float errorY = yPixel - 240;
        
        targetPan -= errorX * 0.02;  
        targetTilt += errorY * 0.02; 
      }
    }
  }
  
  // Không cho Servo quay quá giới hạn kẹt bánh răng (10 -> 170 độ)
  targetPan = constrain(targetPan, 10, 170);
  targetTilt = constrain(targetTilt, 10, 170);
}

// ================= XỬ LÝ RADAR LD2450 =================
void readRadar() {
  while (Serial2.available() >= 30) {
    if (Serial2.read() == 0xAA && Serial2.peek() == 0xFF) {
      Serial2.read(); 
      byte data[28];
      Serial2.readBytes(data, 28);
      
      if (data[0] == 0x03 && data[1] == 0x00 && data[26] == 0x55 && data[27] == 0xCC) {
        int16_t xPos = (int16_t)(data[2] | (data[3] << 8));
        int16_t yPos = (int16_t)(data[4] | (data[5] << 8));
        int16_t speed = (int16_t)(data[6] | (data[7] << 8));
        if (yPos > 0) {
          float x_meter = xPos / 1000.0;
          float y_meter = yPos / 1000.0;
          float speed_ms = abs(speed) / 100.0;
          
          char payload[100];
          snprintf(payload, sizeof(payload), "{\"x\":%.2f, \"y\":%.2f, \"speed\":%.2f}", x_meter, y_meter, speed_ms);
          
          if (client.connected()) {
            client.publish("embedded/radar/data", payload);
          }
        }
      }
    }
  }
}

// ================= UPDATE SERVO MƯỢT MÀ =================
void updateServoSmoothly() {
  if (abs(targetPan - currentPan) > 0.5 || abs(targetTilt - currentTilt) > 0.5) {
    if (!isMoving) {
      if (client.connected()) client.publish("embedded/servo/status", "MOVING");
      isMoving = true;
    }
    
    currentPan += (targetPan - currentPan) * SMOOTHING_FACTOR;
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

// ================= HÀM MAIN =================
void setup() {
  Serial.begin(115200);
  Serial2.begin(256000, SERIAL_8N1, 16, 17);
  
  // BẮT BUỘC PHẢI CÓ ĐOẠN NÀY ĐỂ KÍCH HOẠT XUNG PWM CHO SERVO
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  ESP32PWM::allocateTimer(2);
  ESP32PWM::allocateTimer(3);
  servoPan.setPeriodHertz(50);
  servoTilt.setPeriodHertz(50);
  
  // Gắn chân Servo
  servoPan.attach(PAN_PIN, 500, 2400);
  servoTilt.attach(TILT_PIN, 500, 2400);
  servoPan.write(currentPan);
  servoTilt.write(currentTilt);
  
  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(mqttCallback);
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    if (!client.connected()) reconnect();
    
    client.loop(); // HÀM QUAN TRỌNG NHẤT ĐỂ NGHE LỆNH
  }
  
  // Tự động nhả điều khiển tay sau 3 giây không bấm
  if (isManualMode && (millis() - lastManualCmd > 3000)) {
    isManualMode = false;
  }
  
  readRadar();
  updateServoSmoothly();
  
  delay(15);
}