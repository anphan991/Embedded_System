import time
import os
import paho.mqtt.client as mqtt
import logging

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
logging.info("Nhấn 1: Gửi trạng thái Servo MOVING (Đang xoay)")
logging.info("Nhấn 2: Gửi trạng thái Servo STOPPED (Dừng xoay)")
logging.info("Nhấn Ctrl+C để thoát")

try:
    while True:
        cmd = input("Lệnh (1/2): ").strip()
        if cmd == "1":
            client.publish("embedded/servo/status", "MOVING")
            logging.info("-> Đã phát tín hiệu MOVING. (Backend sẽ đóng băng thuật toán té ngã)")
        elif cmd == "2":
            client.publish("embedded/servo/status", "STOPPED")
            logging.info("-> Đã phát tín hiệu STOPPED. (Backend tiếp tục nhận diện té ngã)")
        else:
            logging.info("Lệnh không hợp lệ.")
except KeyboardInterrupt:
    logging.info("Thoát công cụ giả lập.")
    client.loop_stop()
    client.disconnect()
