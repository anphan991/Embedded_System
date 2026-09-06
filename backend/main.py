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
import math
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
            # Lật ảnh để sửa lỗi bị ngược. 
            # Dùng 1 để lật ngang (như gương), 0 để lật dọc (nếu camera gắn ngược trên trần), -1 để lật cả ngang và dọc.
            frame = cv2.flip(frame, 1)
            
            if raw_q.full():
                try: raw_q.get_nowait()
                except: pass
            
            try:
                raw_q.put(frame, timeout=0.1)
            except:
                pass
        else:
            time.sleep(0.01)
    cap.release()
    logger.info("Process 1 (Camera): Exited gracefully.")


# ---------------------------------------------------------
# TIẾN TRÌNH 2: AI & MQTT CONSUMER (Tính toán song song)
# ---------------------------------------------------------
def ai_process(raw_q: mp.Queue, mjpeg_q: mp.Queue, alert_q: mp.Queue, shutdown_flag):
    logger.info("Process 2 (AI Core & MQTT): Started. Optimizing for Host/VPS...")
    
    # 1. Khởi tạo MQTT (Giao tiếp với ESP32)
    import paho.mqtt.client as mqtt
    mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    try:
        mqtt_client.connect("broker.emqx.io", 1883, 60)
        mqtt_client.loop_start()
    except Exception as e:
        logger.warning(f"Process 2: MQTT Connection failed: {e}")

    # 2. Khởi tạo YOLO (Tự động nhận diện GPU/CPU)
    import torch
    from ultralytics import YOLO
    
    model_path = "yolov8m-pose.pt"
    
    if torch.cuda.is_available():
        logger.info("NVIDIA GPU Detected! Optimizing with TensorRT/CUDA...")
        trt_path = "yolov8m-pose.engine"
        if not os.path.exists(trt_path):
            logger.info("Exporting YOLO model to TensorRT engine for max performance...")
            try:
                temp_model = YOLO(model_path)
                temp_model.export(format="engine", dynamic=False, half=True)
            except Exception as e:
                logger.warning(f"TensorRT export failed: {e}. Falling back to PyTorch CUDA.")
        
        try:
            logger.info("Loading TensorRT model...")
            pose_estimator = YOLO(trt_path, task='pose')
        except Exception:
            logger.info("Loading PyTorch CUDA model...")
            pose_estimator = YOLO(model_path, task='pose')
    else:
        logger.info("No GPU detected. Optimizing for CPU with OpenVINO...")
        ov_path = "yolov8m-pose_openvino_model"
        if not os.path.exists(ov_path):
            logger.info("Exporting YOLO model to OpenVINO...")
            try:
                temp_model = YOLO(model_path)
                temp_model.export(format="openvino", dynamic=False)
            except Exception as e:
                logger.warning(f"OpenVINO export failed: {e}. Falling back to PyTorch CPU.")
                
        try:
            logger.info("Loading OpenVINO model...")
            pose_estimator = YOLO(ov_path, task='pose')
        except Exception:
            logger.info("Loading PyTorch CPU model...")
            pose_estimator = YOLO(model_path, task='pose')

    track_history = {}
    last_heartbeat = 0
    
    # Giới hạn FPS AI để giảm tải VPS (15 FPS)
    target_fps = 15
    frame_time = 1.0 / target_fps
    
    while not shutdown_flag.value:
        loop_start = time.time()
        
        # Heartbeat Ping cho ESP32 mỗi giây
        if time.time() - last_heartbeat > 1.0:
            try:
                mqtt_client.publish("embedded/system/heartbeat", "PING")
            except Exception: pass
            last_heartbeat = time.time()
            
        try:
            frame = raw_q.get(timeout=0.5)
        except queue.Empty:
            continue

        # Dùng tracker mạnh hơn (botsort), conf=0.5 lọc nhiễu
        try:
            results = pose_estimator.track(frame, persist=True, verbose=False, tracker="botsort.yaml", conf=0.5)
        except Exception as e:
            logger.error(f"Inference error: {e}")
            time.sleep(1)
            continue
        
        annotated_frame = results[0].plot()
        anyone_falling = False

        if len(results) > 0 and results[0].boxes and results[0].boxes.id is not None:
            boxes = results[0].boxes
            keypoints = results[0].keypoints

            for i in range(len(boxes.id)):
                obj_id = int(boxes.id[i].item())
                x1, y1, x2, y2 = boxes.xyxy[i].tolist()
                
                # Bắn tọa độ mục tiêu
                if i == 0:
                    target_x = int((x1 + x2) / 2)
                    target_y = int((y1 + y2) / 2)
                    try: mqtt_client.publish("embedded/servo/tracking", f"{target_x},{target_y}")
                    except Exception: pass
                
                width = x2 - x1
                height = y2 - y1
                aspect_ratio = width / height if height > 0 else 0
                
                # Phân tích Keypoints (Spine Angle & Center of Mass)
                kp = keypoints.xy[i]
                nose_y = kp[0][1].item() if len(kp) > 0 else 0
                left_knee_y = kp[13][1].item() if len(kp) > 13 else 0
                right_knee_y = kp[14][1].item() if len(kp) > 14 else 0
                
                spine_angle = 90.0 # Mặc định đứng thẳng
                com_y = nose_y # Default Center of Mass (CoM)
                
                if len(kp) > 12:
                    shoulder_l = kp[5]
                    shoulder_r = kp[6]
                    hip_l = kp[11]
                    hip_r = kp[12]
                    
                    if shoulder_l[1] > 0 and shoulder_r[1] > 0 and hip_l[1] > 0 and hip_r[1] > 0:
                        shoulder_center_x = (shoulder_l[0].item() + shoulder_r[0].item()) / 2.0
                        shoulder_center_y = (shoulder_l[1].item() + shoulder_r[1].item()) / 2.0
                        hip_center_x = (hip_l[0].item() + hip_r[0].item()) / 2.0
                        hip_center_y = (hip_l[1].item() + hip_r[1].item()) / 2.0
                        
                        dx = hip_center_x - shoulder_center_x
                        dy = hip_center_y - shoulder_center_y
                        
                        if dy != 0 or dx != 0:
                            spine_angle = math.degrees(math.atan2(abs(dy), abs(dx)))
                        com_y = hip_center_y # Lấy hông làm trọng tâm cơ thể
                
                # Cử chỉ Hủy (X-Gesture) được tối ưu: Mở rộng vùng dung sai tay
                is_x_gesture = False
                if len(kp) > 10:
                    wrist_l = kp[9]
                    wrist_r = kp[10]
                    shoulder_l = kp[5]
                    shoulder_r = kp[6]
                    
                    if wrist_l[1] > 0 and wrist_r[1] > 0 and shoulder_l[1] > 0 and shoulder_r[1] > 0:
                        arms_raised = (wrist_l[1].item() < shoulder_l[1].item()) and (wrist_r[1].item() < shoulder_r[1].item())
                        wrists_crossed = abs(wrist_l[0].item() - wrist_r[0].item()) < 60 # Tăng dung sai bắt chéo tay
                        if arms_raised and wrists_crossed:
                            is_x_gesture = True

                # Trạng thái & Vận tốc rơi (Dựa trên CoM)
                current_t = time.time()
                if obj_id not in track_history:
                    track_history[obj_id] = {"y_history": [], "status": "normal", "gesture_cooldown": 0, "fall_frames": 0}
                
                history = track_history[obj_id]["y_history"]
                if com_y > 0: history.append((current_t, com_y))
                if len(history) > 10: history.pop(0)
                    
                y_velocity = 0.0
                if len(history) >= 3:
                    dt = history[-1][0] - history[0][0]
                    dy = history[-1][1] - history[0][1]
                    y_velocity = dy / dt if dt > 0 else 0.0
                    
                is_horizontal = aspect_ratio > 1.2
                is_spine_horizontal = spine_angle < 45.0
                is_falling_fast = y_velocity > FALL_VELOCITY_THRESHOLD
                
                # LOGIC CỐT LÕI (Ngã + Cử chỉ Hủy)
                if is_x_gesture:
                    track_history[obj_id]["status"] = "normal"
                    track_history[obj_id]["fall_frames"] = 0
                    track_history[obj_id]["gesture_cooldown"] = time.time() + 5.0 # Miễn nhiễm 5s
                    cv2.putText(annotated_frame, "ALARM CANCELED", (int(x1), int(y1)-30), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 0), 3)
                    try: mqtt_client.publish("embedded/servo/buzzer", "OFF")
                    except Exception: pass
                elif time.time() > track_history[obj_id]["gesture_cooldown"]:
                    # Ngã khi: (Dáng nằm ngang + Cột sống thấp) HOẶC (Rơi nhanh + Cột sống thấp)
                    if (is_horizontal and is_spine_horizontal) or (is_falling_fast and is_spine_horizontal):
                        track_history[obj_id]["fall_frames"] += 1
                    else:
                        # Phục hồi từ từ thay vì reset (Lưới lọc Temporal Confidence)
                        track_history[obj_id]["fall_frames"] = max(0, track_history[obj_id]["fall_frames"] - 1)
                    
                    # Yêu cầu ngã duy trì ít nhất 3 frame liên tục
                    if track_history[obj_id]["fall_frames"] >= 3:
                        track_history[obj_id]["status"] = "falling"
                        anyone_falling = True
                        try: mqtt_client.publish("embedded/servo/buzzer", "ON")
                        except Exception: pass
                        cv2.rectangle(annotated_frame, (int(x1), int(y1)), (int(x2), int(y2)), (0, 0, 255), 4)
                        cv2.putText(annotated_frame, f"ID:{obj_id} FALLING", (int(x1), int(y1)-10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 255), 2)
                    else:
                        track_history[obj_id]["status"] = "normal"
                        cv2.putText(annotated_frame, f"ID:{obj_id} Normal (Spine: {int(spine_angle)}deg)", (int(x1), int(y1)-10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

        # Gửi cảnh báo sang FastAPI
        try:
            if alert_q.full(): alert_q.get_nowait()
            alert_q.put_nowait(anyone_falling)
        except: pass

        # Tối ưu hóa nén luồng hình ảnh để giảm băng thông VPS (JPEG Quality 65%)
        success, buffer = cv2.imencode('.jpg', annotated_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 65])
        if success:
            if mjpeg_q.full():
                try: mjpeg_q.get_nowait()
                except: pass
            mjpeg_q.put_nowait(buffer.tobytes())
            
        # Kiểm soát FPS
        elapsed = time.time() - loop_start
        if elapsed < frame_time:
            time.sleep(frame_time - elapsed)

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
        # Tăng timeout để phục hồi lỗi mạng
        resp = requests.post(url, data=data, files=files, timeout=10)
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
        # Sleep in small chunks to allow quick shutdown
        for _ in range(30):
            if shutdown_flag.value: break
            time.sleep(0.1)
        if shutdown_flag.value: break
        
        # Tự phục hồi Camera
        if p_cam and not p_cam.is_alive():
            logger.error("WATCHDOG: Camera Process Died! Restarting...")
            p_cam = mp.Process(target=camera_process, args=(raw_q, shutdown_flag))
            p_cam.daemon = True
            p_cam.start()
            
        # Tự phục hồi AI
        if p_ai and not p_ai.is_alive():
            logger.error("WATCHDOG: AI Process Died! Restarting...")
            p_ai = mp.Process(target=ai_process, args=(raw_q, mjpeg_q, alert_q, shutdown_flag))
            p_ai.daemon = True
            p_ai.start()

@asynccontextmanager
async def lifespan(app: FastAPI):
    global raw_q, mjpeg_q, alert_q, shutdown_flag, p_cam, p_ai
    
    raw_q = mp.Queue(maxsize=1)
    mjpeg_q = mp.Queue(maxsize=1)
    alert_q = mp.Queue(maxsize=1)
    shutdown_flag = mp.Value('i', 0)
    
    p_cam = mp.Process(target=camera_process, args=(raw_q, shutdown_flag))
    p_cam.daemon = True
    p_ai = mp.Process(target=ai_process, args=(raw_q, mjpeg_q, alert_q, shutdown_flag))
    p_ai.daemon = True
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
                        
                        # 2. Lưu Database & Lưu file cục bộ (Xử lý an toàn)
                        image_path = f"snapshots/fall_{int(time.time())}.jpg"
                        try:
                            with open(image_path, "wb") as f:
                                f.write(latest_mjpeg_bytes)
                            log_alert("FALL_DETECTED", "Bệnh nhân ngã", image_path)
                        except Exception as e:
                            logger.error(f"File/Database Write Error: {e}")
                            
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
