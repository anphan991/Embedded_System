import time
import os
import paho.mqtt.client as mqtt
import logging
import random

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(message)s")

broker = os.getenv("MQTT_BROKER", "localhost")
client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)

def on_connect(client, userdata, flags, reason_code, properties):
    if reason_code == 0:
        logging.info(f"Đã kết nối tới Mock Broker tại {broker}")
        client.subscribe("embedded/servo/tracking")
        client.subscribe("embedded/servo/buzzer")
        client.subscribe("embedded/system/heartbeat")
    else:
        logging.error(f"Lỗi kết nối: {reason_code}")

def on_message(client, userdata, msg):
    payload = msg.payload.decode('utf-8')
    if msg.topic == "embedded/servo/tracking":
        logging.info(f"[NHẬN LỆNH QUAY] Tọa độ: {payload}")
    elif msg.topic == "embedded/servo/buzzer":
        logging.warning(f"[CÒI BÁO ĐỘNG] Trạng thái: {payload}")
    elif msg.topic == "embedded/system/heartbeat":
        logging.info(f"Ping")

client.on_connect = on_connect
client.on_message = on_message

try:
    client.connect(broker, 1883, 60)
except Exception as e:
    logging.error(f"Không thể kết nối Mosquitto: {e}. Bạn đã cài Mosquitto chưa?")
    exit(1)

client.loop_start()

logging.info("=========================================")
logging.info("     CÔNG CỤ GIẢ LẬP PHẦN CỨNG ESP32     ")
logging.info("=========================================")
logging.info("Nhấn 3: Tọa độ NGẪU NHIÊN (X=0.5 -> 3.0, Speed=0.3 -> 1.2)")
logging.info("Nhấn 4: Tọa độ ĐỨNG YÊN (X=1.5, Y=2.0, Speed=0.0)")
logging.info("Nhấn 5: Kịch bản NGỦ TRÊN GIƯỜNG (Safe Zone: X = -1.5, Speed = 0.0)")
logging.info("Nhấn 6: Kịch bản ĐI LANG THANG (Danger Zone: X = 2.5, Speed = 0.5)")
logging.info("Nhấn Ctrl+C để thoát")

import threading
import time

# Trạng thái giả lập hiện tại
current_mock_state = None

def mock_publisher():
    while True:
        if current_mock_state == "3":
            x = round(random.uniform(0.5, 3.0), 2)
            y = round(random.uniform(1.0, 5.0), 2)
            speed = round(random.uniform(0.3, 1.2), 2)
            client.publish("embedded/radar/data", f'{{"x": {x}, "y": {y}, "speed": {speed}}}')
        elif current_mock_state == "4":
            client.publish("embedded/radar/data", '{"x": 1.5, "y": 2.0, "speed": 0.0}')
        elif current_mock_state == "5":
            client.publish("embedded/radar/data", '{"x": -1.5, "y": 3.0, "speed": 0.0}')
        elif current_mock_state == "6":
            # Thêm nhiễu ngẫu nhiên nhỏ để điểm chấm di chuyển và biểu đồ tốc độ nhảy múa
            x = round(random.uniform(2.2, 2.8), 2)
            y = round(random.uniform(2.8, 3.2), 2)
            speed = round(random.uniform(0.4, 0.7), 2)
            client.publish("embedded/radar/data", f'{{"x": {x}, "y": {y}, "speed": {speed}}}')
        time.sleep(1)

# Chạy luồng gửi dữ liệu ngầm
threading.Thread(target=mock_publisher, daemon=True).start()

try:
    while True:
        cmd = input("Lệnh (1/2/3/4/5/6/0 để dừng): ").strip()
        if cmd == "1":
            client.publish("embedded/servo/status", "MOVING")
            logging.info("Đã gửi: MOVING (Chỉ gửi 1 lần)")
        elif cmd == "2":
            client.publish("embedded/servo/status", "STOPPED")
            logging.info("Đã gửi: STOPPED (Chỉ gửi 1 lần)")
        elif cmd in ["3", "4", "5", "6"]:
            current_mock_state = cmd
            logging.info(f"Đã chuyển sang chế độ liên tục: {cmd}")
        elif cmd == "0":
            current_mock_state = None
            logging.info("Đã DỪNG gửi dữ liệu Radar.")
        else:
            logging.info("Lệnh không hợp lệ.")
except KeyboardInterrupt:
    logging.info("Thoát công cụ giả lập.")
    client.loop_stop()
    client.disconnect()
