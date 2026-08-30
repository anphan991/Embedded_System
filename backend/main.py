"""
Module: Vision Feedback & Fall Detection API (Phase 4: Mission-Critical)
Description: Commercial-grade distributed backend with Watchdog, SQLite, Telegram & Gestures.
"""

import asyncio
import logging
import multiprocessing as mp
import os
import queue
import time
import threading
import requests
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import cv2
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv

from database import init_db, log_alert

# Load environment variables (Telegram config)
load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Constants
VIDEO_SOURCE = 0
FALL_DURATION_THRESHOLD_SEC = 1.5
FALL_VELOCITY_THRESHOLD = 300.0

# Tạo thư mục chứa ảnh Snapshot nếu chưa có
os.makedirs("snapshots", exist_ok=True)
init_db()

# ---------------------------------------------------------
# TIẾN TRÌNH 1: CAMERA PRODUCER (Độc lập phần cứng)
# ---------------------------------------------------------
def camera_process(raw_q: mp.Queue, shutdown_flag):
    logger.info("Process 1 (Camera): Started.")
    cap = cv2.VideoCapture(VIDEO_SOURCE)
    while not shutdown_flag.value:
        ret, frame = cap.read()
        if ret:
            if raw_q.full():
                try: raw_q.get_nowait()
                except: pass
            raw_q.put(frame)
        else:
            time.sleep(0.01)
    cap.release()
    logger.info("Process 1 (Camera): Exited gracefully.")


# ---------------------------------------------------------
# TIẾN TRÌNH 2: AI & MQTT CONSUMER (Tính toán song song)
# ---------------------------------------------------------
def ai_process(raw_q: mp.Queue, mjpeg_q: mp.Queue, alert_q: mp.Queue, shutdown_flag):
    logger.info("Process 2 (AI Core & MQTT): Started.")
    
    # 1. Khởi tạo MQTT (Giao tiếp với ESP32)
    import paho.mqtt.client as mqtt
    mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    try:
        mqtt_client.connect("broker.emqx.io", 1883, 60)
        mqtt_client.loop_start()
    except Exception as e:
        logger.warning(f"Process 2: MQTT Connection failed: {e}")

    # 2. Khởi tạo YOLO
    from ultralytics import YOLO
    model_path = "yolov8n-pose.pt"
    onnx_path = "yolov8n-pose.onnx"
    int8_path = "yolov8n-pose_int8.onnx"
    
    if not os.path.exists(onnx_path):
        temp_model = YOLO(model_path)
        temp_model.export(format="onnx", dynamic=False)
        
    try:
        from onnxruntime.quantization import quantize_dynamic, QuantType
        if not os.path.exists(int8_path):
            quantize_dynamic(onnx_path, int8_path, weight_type=QuantType.QUInt8)
        pose_estimator = YOLO(int8_path, task='pose')
    except Exception:
        pose_estimator = YOLO(onnx_path, task='pose')

    track_history = {}
    last_heartbeat = 0
    
    while not shutdown_flag.value:
        # Heartbeat Ping cho ESP32 mỗi giây
        if time.time() - last_heartbeat > 1.0:
            mqtt_client.publish("embedded/system/heartbeat", "PING")
            last_heartbeat = time.time()
            
        try:
            frame = raw_q.get(timeout=0.5)
        except queue.Empty:
            continue

        results = pose_estimator.track(frame, persist=True, verbose=False, tracker="bytetrack.yaml")
        annotated_frame = results[0].plot()
        anyone_falling = False

        if len(results) > 0 and results[0].boxes and results[0].boxes.id is not None:
            boxes = results[0].boxes
            keypoints = results[0].keypoints

            for i in range(len(boxes.id)):
                obj_id = int(boxes.id[i].item())
                x1, y1, x2, y2 = boxes.xyxy[i].tolist()
                
                # Bắn tọa độ mục tiêu (Bù vùng mù: Nếu kẹt ngã, Servo vẫn khóa tọa độ cuối cùng)
                if i == 0:
                    target_x = int((x1 + x2) / 2)
                    target_y = int((y1 + y2) / 2)
                    mqtt_client.publish("embedded/servo/tracking", f"{target_x},{target_y}")
                
                width = x2 - x1
                height = y2 - y1
                aspect_ratio = width / height if height > 0 else 0
                
                # Phân tích Keypoints
                kp = keypoints.xy[i]
                nose_y = kp[0][1].item() if len(kp) > 0 else 0
                left_knee_y = kp[13][1].item() if len(kp) > 13 else 0
                right_knee_y = kp[14][1].item() if len(kp) > 14 else 0
                
                # Thuật toán: Nhận diện Cử chỉ Hình Chữ X (Hủy Báo động)
                is_x_gesture = False
                if len(kp) > 10:
                    wrist_l = kp[9]
                    wrist_r = kp[10]
                    shoulder_l = kp[5]
                    shoulder_r = kp[6]
                    
                    # 2 tay đưa lên cao hơn vai
                    if wrist_l[1] > 0 and wrist_r[1] > 0 and shoulder_l[1] > 0 and shoulder_r[1] > 0:
                        arms_raised = (wrist_l[1] < shoulder_l[1]) and (wrist_r[1] < shoulder_r[1])
                        # 2 cổ tay bắt chéo nhau (Khoảng cách X cực nhỏ hoặc đảo ngược)
                        wrists_crossed = abs(wrist_l[0] - wrist_r[0]) < 40
                        if arms_raised and wrists_crossed:
                            is_x_gesture = True

                # Quản lý Trạng thái & Vận tốc
                current_t = time.time()
                if obj_id not in track_history:
                    track_history[obj_id] = {"y_history": [], "status": "normal", "gesture_cooldown": 0}
                
                history = track_history[obj_id]["y_history"]
                if nose_y > 0: history.append((current_t, nose_y))
                if len(history) > 10: history.pop(0)
                    
                y_velocity = 0.0
                if len(history) >= 3:
                    dt = history[-1][0] - history[0][0]
                    dy = history[-1][1] - history[0][1]
                    y_velocity = dy / dt if dt > 0 else 0.0
                    
                is_horizontal = aspect_ratio > 1.2
                is_head_low = False
                if left_knee_y > 0 and right_knee_y > 0 and nose_y > 0:
                    is_head_low = nose_y > ((left_knee_y + right_knee_y) / 2.0)
                    
                is_falling_fast = y_velocity > FALL_VELOCITY_THRESHOLD
                
                # LOGIC CỐT LÕI (Ngã + Cử chỉ Hủy)
                if is_x_gesture:
                    track_history[obj_id]["status"] = "normal"
                    track_history[obj_id]["gesture_cooldown"] = time.time() + 5.0 # Miễn nhiễm báo ngã 5 giây
                    cv2.putText(annotated_frame, "ALARM CANCELED", (int(x1), int(y1)-30), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 0), 3)
                    mqtt_client.publish("embedded/servo/buzzer", "OFF")
                elif time.time() > track_history[obj_id]["gesture_cooldown"]:
                    if (is_horizontal and is_head_low) or (is_falling_fast and is_head_low):
                        track_history[obj_id]["status"] = "falling"
                        anyone_falling = True
                        mqtt_client.publish("embedded/servo/buzzer", "ON")
                        cv2.rectangle(annotated_frame, (int(x1), int(y1)), (int(x2), int(y2)), (0, 0, 255), 4)
                        cv2.putText(annotated_frame, f"ID:{obj_id} FALLING", (int(x1), int(y1)-10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 255), 2)
                    else:
                        track_history[obj_id]["status"] = "normal"
                        cv2.putText(annotated_frame, f"ID:{obj_id} Normal", (int(x1), int(y1)-10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

        # Gửi cảnh báo sang FastAPI
        try:
            if alert_q.full(): alert_q.get_nowait()
            alert_q.put_nowait(anyone_falling)
        except: pass

        # Gửi Frame hiển thị sang FastAPI
        success, buffer = cv2.imencode('.jpg', annotated_frame)
        if success:
            if mjpeg_q.full():
                try: mjpeg_q.get_nowait()
                except: pass
            mjpeg_q.put_nowait(buffer.tobytes())

    mqtt_client.loop_stop()
    logger.info("Process 2 (AI/MQTT): Exited gracefully.")


# ---------------------------------------------------------
# TIẾN TRÌNH 3: FASTAPI WEBSERVER & WATCHDOG
# ---------------------------------------------------------
raw_q = None
mjpeg_q = None
alert_q = None
shutdown_flag = None
p_cam = None
p_ai = None
latest_mjpeg_bytes = b""
alert_active = False

def send_telegram_alert(image_bytes, message):
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")
    if not token or token == "your_bot_token_here":
        logger.warning("Bỏ qua Telegram (Chưa cấu hình Token)")
        return
    try:
        url = f"https://api.telegram.org/bot{token}/sendPhoto"
        files = {"photo": ("snapshot.jpg", image_bytes, "image/jpeg")}
        data = {"chat_id": chat_id, "caption": message}
        resp = requests.post(url, data=data, files=files, timeout=5)
        if resp.status_code == 200:
            logger.info("Telegram Alert Sent Successfully!")
        else:
            logger.error(f"Telegram Failed: {resp.text}")
    except Exception as e:
        logger.error(f"Telegram API Error: {e}")

def watchdog_task():
    global p_cam, p_ai
    logger.info("System Watchdog Started. Monitoring processes...")
    while not shutdown_flag.value:
        time.sleep(3)
        if shutdown_flag.value: break
        
        # Tự phục hồi Camera
        if p_cam and not p_cam.is_alive():
            logger.error("WATCHDOG: Camera Process Died! Restarting...")
            p_cam = mp.Process(target=camera_process, args=(raw_q, shutdown_flag))
            p_cam.start()
            
        # Tự phục hồi AI
        if p_ai and not p_ai.is_alive():
            logger.error("WATCHDOG: AI Process Died! Restarting...")
            p_ai = mp.Process(target=ai_process, args=(raw_q, mjpeg_q, alert_q, shutdown_flag))
            p_ai.start()

@asynccontextmanager
async def lifespan(app: FastAPI):
    global raw_q, mjpeg_q, alert_q, shutdown_flag, p_cam, p_ai
    
    raw_q = mp.Queue(maxsize=1)
    mjpeg_q = mp.Queue(maxsize=1)
    alert_q = mp.Queue(maxsize=1)
    shutdown_flag = mp.Value('i', 0)
    
    p_cam = mp.Process(target=camera_process, args=(raw_q, shutdown_flag))
    p_ai = mp.Process(target=ai_process, args=(raw_q, mjpeg_q, alert_q, shutdown_flag))
    p_cam.start()
    p_ai.start()
    
    # Khởi động Watchdog ở luồng nền của FastAPI
    threading.Thread(target=watchdog_task, daemon=True).start()
    
    yield
    
    logger.info("Shutting down Distributed System...")
    shutdown_flag.value = 1
    p_cam.join(timeout=3)
    p_ai.join(timeout=3)
    if p_cam.is_alive(): p_cam.terminate()
    if p_ai.is_alive(): p_ai.terminate()

app = FastAPI(title="Mission-Critical Vision Server", version="4.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def video_frame_generator() -> AsyncGenerator[bytes, None]:
    global latest_mjpeg_bytes
    while True:
        try:
            latest_mjpeg_bytes = mjpeg_q.get_nowait()
        except queue.Empty:
            pass
            
        if latest_mjpeg_bytes:
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + latest_mjpeg_bytes + b'\r\n')
        await asyncio.sleep(0.033)

@app.get("/api/v1/video/stream")
async def video_feed() -> StreamingResponse:
    return StreamingResponse(video_frame_generator(), media_type="multipart/x-mixed-replace; boundary=frame")

@app.websocket("/api/v1/ws/alerts")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    logger.info("Web Dashboard connected.")
    
    fall_start_time = 0.0
    global alert_active
    
    try:
        while True:
            # Mô phỏng trạng thái phần cứng để UI hiển thị nếu chết Camera
            if not p_cam.is_alive() or not p_ai.is_alive():
                await websocket.send_json({"type": "SYSTEM_ERROR", "event_code": "SENSOR_DISCONNECTED", "message": "Hardware connection lost! Watchdog is attempting to reconnect."})
                await asyncio.sleep(2.0)
                continue

            try:
                is_falling = alert_q.get_nowait()
            except queue.Empty:
                is_falling = False if fall_start_time == 0.0 else True
                
            if is_falling:
                if fall_start_time == 0.0:
                    fall_start_time = time.time()
                elif (time.time() - fall_start_time) > FALL_DURATION_THRESHOLD_SEC:
                    if not alert_active:
                        alert_active = True
                        
                        # 1. Báo động WebSocket cho Frontend
                        alert_payload = {
                            "type": "CRITICAL_ALERT",
                            "event_code": "FALL_DETECTED",
                            "message": "Cảnh báo khẩn cấp: Bệnh nhân đã ngã và bất tỉnh!",
                            "timestamp": time.time()
                        }
                        await websocket.send_json(alert_payload)
                        
                        # 2. Lưu Database & Lưu file cục bộ
                        image_path = f"snapshots/fall_{int(time.time())}.jpg"
                        with open(image_path, "wb") as f:
                            f.write(latest_mjpeg_bytes)
                        log_alert("FALL_DETECTED", "Bệnh nhân ngã", image_path)
                        
                        # 3. Kích hoạt Telegram Bot (Chạy luồng riêng để không nghẽn Web)
                        threading.Thread(target=send_telegram_alert, args=(latest_mjpeg_bytes, "🚨 CẢNH BÁO TÉ NGÃ KHẨN CẤP! Vui lòng kiểm tra ngay lập tức."), daemon=True).start()
                        
                    await asyncio.sleep(2.0)
            else:
                fall_start_time = 0.0
                alert_active = False
            
            await asyncio.sleep(0.2)
    except WebSocketDisconnect:
        pass

if __name__ == "__main__":
    mp.freeze_support()
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False, ws="websockets")
