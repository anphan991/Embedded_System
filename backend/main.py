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

from database import init_db, log_alert, log_vitals
from fall_detection import FallDetector, FallObservation

# Load environment variables (Telegram config)
load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Constants
VIDEO_SOURCE = 0
FALL_DURATION_THRESHOLD_SEC = 1.5

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
    
    is_camera_moving = False
    current_radar_x = 0.0
    current_radar_y = 0.0
    current_radar_speed = 0.0
    last_radar_log = 0
    
    last_zones_fetch = 0
    cached_safe_zones = []
    cached_danger_zones = []
    cached_room_config = {"width": 6.0, "length": 6.0, "radar_x": 3.0, "radar_y": 0.0}
    
    wandering_start = 0.0
    wandering_alert_sent = False

    def on_mqtt_message(client, userdata, msg):
        nonlocal is_camera_moving, current_radar_x, current_radar_y, current_radar_speed, last_radar_log
        nonlocal wandering_start, wandering_alert_sent, last_zones_fetch, cached_safe_zones, cached_danger_zones, cached_room_config
        try:
            if msg.topic == "embedded/servo/status":
                payload = msg.payload.decode('utf-8').strip().upper()
                if payload == "MOVING":
                    is_camera_moving = True
                elif payload == "STOPPED":
                    is_camera_moving = False
            elif msg.topic == "embedded/radar/data":
                import json
                try:
                    data = json.loads(msg.payload.decode('utf-8'))
                    raw_x = float(data.get("x", 0.0))
                    raw_y = float(data.get("y", 0.0))
                    current_radar_speed = float(data.get("speed", 0.0))
                    
                    # Cập nhật cache Zones và Room mỗi 10 giây
                    if time.time() - last_zones_fetch > 10:
                        from database import get_all_zones, get_room_config
                        all_zones = get_all_zones()
                        cached_safe_zones = [z for z in all_zones if z["type"] == "SAFE"]
                        cached_danger_zones = [z for z in all_zones if z["type"] == "DANGER"]
                        cached_room_config = get_room_config()
                        last_zones_fetch = time.time()

                    # Lấy góc xoay (Yaw)
                    angle = float(cached_room_config.get("radar_angle", 0.0))
                    import math
                    theta = math.radians(angle)
                    
                    # Phép xoay 2D
                    rot_x = raw_x * math.cos(theta) + raw_y * math.sin(theta)
                    rot_y = -raw_x * math.sin(theta) + raw_y * math.cos(theta)

                    # ÁP DỤNG PHÉP TỊNH TIẾN TỌA ĐỘ (Coordinate Translation)
                    current_radar_x = cached_room_config["radar_x"] + rot_x
                    current_radar_y = cached_room_config["radar_y"] + rot_y

                    # Kiểm tra Danger Zone (Cảnh báo NGAY LẬP TỨC nếu dẫm vào vùng cấm)
                    in_danger = False
                    for dz in cached_danger_zones:
                        if dz["x_min"] <= current_radar_x <= dz["x_max"] and dz["y_min"] <= current_radar_y <= dz["y_max"]:
                            in_danger = True
                            break
                    
                    if in_danger:
                        if time.time() - last_radar_log > 5: # Tránh spam log
                            logger.warning(f"CẢNH BÁO XÂM NHẬP VÙNG NGUY HIỂM ({current_radar_x}, {current_radar_y})!")
                            # Có thể bắn Telegram luôn ở đây nếu muốn
                    
                    # Logic Cảnh báo Đi lang thang ban đêm (Dementia/Wandering)
                    # Khung giờ: 23:00 đêm đến 05:00 sáng
                    current_hour = int(time.strftime("%H"))
                    if current_hour >= 23 or current_hour < 5:
                        # Kiểm tra xem có đang ở trong Safe Zone không
                        in_safe = False
                        if not cached_safe_zones:
                            in_safe = current_radar_x < 0.0 # Fallback nếu chưa cấu hình
                        else:
                            for sz in cached_safe_zones:
                                if sz["x_min"] <= current_radar_x <= sz["x_max"] and sz["y_min"] <= current_radar_y <= sz["y_max"]:
                                    in_safe = True
                                    break
                        
                        # Ra khỏi giường (NOT in_safe) và Đang di chuyển (speed > 0.1)
                        if not in_safe and current_radar_speed > 0.1:
                            if wandering_start == 0.0:
                                wandering_start = time.time()
                            elif time.time() - wandering_start > 300: # 5 phút liên tục
                                if not wandering_alert_sent:
                                    logger.warning("PHÁT HIỆN ĐI LANG THANG BAN ĐÊM!")
                                    wandering_alert_sent = True
                        else:
                            wandering_start = 0.0
                            wandering_alert_sent = False
                    else:
                        wandering_start = 0.0
                        wandering_alert_sent = False

                    # Log vào DB mỗi 2 giây
                    if time.time() - last_radar_log > 2:
                        from database import log_radar_data
                        log_radar_data(current_radar_x, current_radar_y, current_radar_speed)
                        last_radar_log = time.time()
                except json.JSONDecodeError:
                    pass
        except Exception:
            pass

    mqtt_client.on_message = on_mqtt_message
    
    broker = os.getenv("MQTT_BROKER", "localhost")
    try:
        mqtt_client.connect(broker, 1883, 60)
        mqtt_client.subscribe("embedded/servo/status")
        mqtt_client.subscribe("embedded/radar/data")
        mqtt_client.loop_start()
        logger.info(f"Process 2: Connected to MQTT broker at {broker}")
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

    fall_detector = FallDetector()
    previous_features = {}
    last_heartbeat = 0
    last_target_seen = time.time()
    target_lost_sent = False
    
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
        fall_event = None

        if len(results) > 0 and results[0].boxes and results[0].boxes.id is not None:
            last_target_seen = time.time()
            target_lost_sent = False
            boxes = results[0].boxes
            keypoints = results[0].keypoints

            for i in range(len(boxes.id)):
                obj_id = int(boxes.id[i].item())
                x1, y1, x2, y2 = boxes.xyxy[i].tolist()
                
                # Bắn tọa độ mục tiêu với Deadband 15%
                if i == 0:
                    target_x = int((x1 + x2) / 2)
                    target_y = int((y1 + y2) / 2)
                    
                    frame_h, frame_w = frame.shape[:2]
                    center_x, center_y = frame_w / 2.0, frame_h / 2.0
                    deadband_x = frame_w * 0.15
                    deadband_y = frame_h * 0.15
                    
                    # Chỉ gửi lệnh quay Servo nếu mục tiêu ra khỏi vùng an toàn
                    if abs(target_x - center_x) > deadband_x or abs(target_y - center_y) > deadband_y:
                        try: mqtt_client.publish("embedded/servo/tracking", f"{target_x},{target_y}")
                        except Exception: pass
                
                width = max(1.0, x2 - x1)
                height = max(1.0, y2 - y1)
                aspect_ratio = width / height if height > 0 else 0
                
                # Phân tích Keypoints (Spine Angle & Center of Mass)
                kp = keypoints.xy[i]
                kp_conf = keypoints.conf[i] if keypoints.conf is not None else None
                # Torso confidence is more useful than the average of all 17
                # joints (hands/feet are often occluded in a crowded room).
                torso_indices = (5, 6, 11, 12)
                visible = [float(kp_conf[j].item()) for j in torso_indices if kp_conf is not None and j < len(kp_conf)]
                keypoint_confidence = sum(visible) / len(visible) if visible else 0.0
                
                spine_angle = 90.0 # Mặc định đứng thẳng
                com_y = (y1 + y2) / 2.0
                head_y = y1
                shoulder_y = y1
                hip_y = com_y
                
                if len(kp) > 6:
                    shoulder_l = kp[5]
                    shoulder_r = kp[6]
                    if float(shoulder_l[1]) > 0 and float(shoulder_r[1]) > 0:
                        shoulder_y = (shoulder_l[1].item() + shoulder_r[1].item()) / 2.0

                if len(kp) > 12:
                    hip_l = kp[11]
                    hip_r = kp[12]
                    
                    if all(float(p[1]) > 0 for p in (shoulder_l, shoulder_r, hip_l, hip_r)):
                        shoulder_center_x = (shoulder_l[0].item() + shoulder_r[0].item()) / 2.0
                        shoulder_center_y = (shoulder_l[1].item() + shoulder_r[1].item()) / 2.0
                        hip_center_x = (hip_l[0].item() + hip_r[0].item()) / 2.0
                        hip_center_y = (hip_l[1].item() + hip_r[1].item()) / 2.0
                        
                        dx = hip_center_x - shoulder_center_x
                        dy = hip_center_y - shoulder_center_y
                        
                        if dy != 0 or dx != 0:
                            spine_angle = math.degrees(math.atan2(abs(dy), abs(dx)))
                        com_y = hip_center_y # Lấy hông làm trọng tâm cơ thể
                        hip_y = hip_center_y

                # Trích xuất đầu (head_y) ưu tiên: Mũi -> Mắt -> Tai -> Đỉnh bbox
                face_visible = False
                for k_idx in (0, 1, 2, 3, 4):
                    if len(kp) > k_idx and float(kp[k_idx][1]) > 0:
                        head_y = float(kp[k_idx][1])
                        break
                
                if kp_conf is not None and len(kp_conf) > 2:
                    # Mũi hoặc 1 trong 2 mắt có confidence > 0.4
                    face_visible = float(kp_conf[0]) > 0.4 or float(kp_conf[1]) > 0.4 or float(kp_conf[2]) > 0.4
                
                # Cử chỉ Hủy (X-Gesture) được tối ưu: Mở rộng vùng dung sai tay
                is_x_gesture = False
                if len(kp) > 10:
                    wrist_l = kp[9]
                    wrist_r = kp[10]
                    
                    if wrist_l[1] > 0 and wrist_r[1] > 0 and shoulder_l[1] > 0 and shoulder_r[1] > 0:
                        arms_raised = (wrist_l[1].item() < shoulder_l[1].item()) and (wrist_r[1].item() < shoulder_r[1].item())
                        wrists_crossed = abs(wrist_l[0].item() - wrist_r[0].item()) < 60 # Tăng dung sai bắt chéo tay
                        if arms_raised and wrists_crossed:
                            is_x_gesture = True

                # Per-track temporal state machine. A horizontal pose alone is
                # intentionally insufficient: the track must have been upright,
                # transition with normalized downward motion, then remain stable.
                if is_x_gesture:
                    track = fall_detector.tracks.get(obj_id)
                    if track:
                        # Reset trạng thái báo động nhưng giữ lại lịch sử để không bị mù với lần ngã sau
                        track.state = "unknown"
                        track.candidate_since = None
                        track.confirmed_at = 0.0
                        track.cooldown_until = 0.0
                    cv2.putText(annotated_frame, "ALARM CANCELED", (int(x1), int(y1)-30), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 0), 3)
                    try: mqtt_client.publish("embedded/servo/buzzer", "OFF")
                    except Exception: pass
                    # Không xoá previous_features để giữ liền mạch tracking
                    continue

                current_t = time.monotonic()
                prior = previous_features.get(obj_id)
                posture_motion = 0.0
                if prior:
                    # Áp dụng bộ lọc Low-pass (EMA) để khử nhiễu (Jitter) khi nằm nghiêng bị che khuất khớp
                    spine_angle = 0.6 * spine_angle + 0.4 * prior[1]
                    com_y = 0.7 * com_y + 0.3 * prior[2]
                    
                    dt = max(1e-3, current_t - prior[0])
                    posture_motion = abs(spine_angle - prior[1]) / 90.0 / dt
                previous_features[obj_id] = (current_t, spine_angle, com_y)
                detection_confidence = float(boxes.conf[i].item()) if boxes.conf is not None else 0.0
                decision = fall_detector.update(obj_id, FallObservation(
                    timestamp=current_t,
                    detection_confidence=detection_confidence,
                    keypoint_confidence=keypoint_confidence,
                    aspect_ratio=aspect_ratio,
                    spine_angle=spine_angle,
                    com_y=com_y,
                    body_height=height,
                    posture_motion=posture_motion,
                    head_y=head_y,
                    shoulder_y=shoulder_y,
                    hip_y=hip_y,
                    face_visible=face_visible,
                    is_camera_moving=is_camera_moving
                ))
                if decision.newly_confirmed:
                    fall_event = {
                        "track_id": obj_id, 
                        "reason": decision.reason, 
                        "timestamp": time.time(),
                        "pos_x": current_radar_x,
                        "pos_y": current_radar_y,
                        "speed": current_radar_speed
                    }
                    try: mqtt_client.publish("embedded/servo/buzzer", "ON")
                    except Exception: pass
                color = (0, 0, 255) if decision.confirmed else ((0, 165, 255) if decision.state == "candidate" else (0, 255, 0))
                cv2.rectangle(annotated_frame, (int(x1), int(y1)), (int(x2), int(y2)), color, 3 if decision.confirmed else 2)
                label = f"ID:{obj_id} {decision.state.upper()}"
                cv2.putText(annotated_frame, label, (int(x1), max(20, int(y1)-10)), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
        else:
            # Không thấy người nào trong khung hình
            if not target_lost_sent and (time.time() - last_target_seen > 3.0):
                try: 
                    mqtt_client.publish("embedded/servo/tracking", "LOST")
                    target_lost_sent = True
                except Exception: pass

        fall_detector.prune(time.monotonic())
        
        # --- Vẽ HUD Radar 2D lên góc phải màn hình ---
        if current_radar_x != 0.0 or current_radar_y != 0.0:
            hud_text = f"X: {current_radar_x:.1f}m | Y: {current_radar_y:.1f}m | V: {current_radar_speed:.2f}m/s"
            frame_h, frame_w = annotated_frame.shape[:2]
            text_size = cv2.getTextSize(hud_text, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)[0]
            text_x = frame_w - text_size[0] - 20
            
            # Cảnh báo màu đỏ nếu tốc độ bằng 0 trong thời gian dài (có thể đang bất tỉnh) hoặc ở vùng rìa
            color = (0, 255, 255)
            cv2.putText(annotated_frame, hud_text, (text_x, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
        # --------------------------------------------------------

        # Gửi cảnh báo sang FastAPI
        try:
            if fall_event is not None:
                if alert_q.full(): alert_q.get_nowait()
                alert_q.put_nowait(fall_event)
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
last_alert_signature = None
last_telegram_sent = 0

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

@app.get("/api/v1/radar/history")
async def get_radar_history(limit: int = 50):
    import sqlite3
    try:
        conn = sqlite3.connect("local_alerts.db")
        c = conn.cursor()
        c.execute('SELECT timestamp, pos_x, pos_y, speed FROM radar_logs ORDER BY timestamp DESC LIMIT ?', (limit,))
        rows = c.fetchall()
        conn.close()
        data = [{"timestamp": r[0], "pos_x": r[1], "pos_y": r[2], "speed": r[3]} for r in rows[::-1]]
        return {"status": "success", "data": data}
    except Exception as e:
        return {"status": "error", "message": str(e)}

from fastapi import Request

@app.get("/api/v1/config/zones")
async def get_zones_api():
    from database import get_all_zones
    zones = get_all_zones()
    return {"status": "success", "data": zones}

@app.post("/api/v1/config/zones")
async def update_zones_api(request: Request):
    try:
        data = await request.json()
        zones = data.get("zones", [])
        from database import update_zones
        update_zones(zones)
        return {"status": "success", "message": "Zones updated successfully"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/v1/config/room")
async def get_room_config_api():
    from database import get_room_config
    config = get_room_config()
    return {"status": "success", "data": config}

@app.post("/api/v1/config/room")
async def update_room_config_api(request: Request):
    try:
        data = await request.json()
        from database import update_room_config
        update_room_config(
            width=float(data.get("width", 6.0)),
            length=float(data.get("length", 6.0)),
            radar_x=float(data.get("radar_x", 3.0)),
            radar_y=float(data.get("radar_y", 0.0)),
            radar_angle=float(data.get("radar_angle", 0.0))
        )
        return {"status": "success", "message": "Room config updated successfully"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.websocket("/api/v1/ws/alerts")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    logger.info("Web Dashboard connected.")
    
    global alert_active, last_alert_signature
    
    try:
        while True:
            # Mô phỏng trạng thái phần cứng để UI hiển thị nếu chết Camera
            if not p_cam.is_alive() or not p_ai.is_alive():
                await websocket.send_json({"type": "SYSTEM_ERROR", "event_code": "SENSOR_DISCONNECTED", "message": "Hardware connection lost! Watchdog is attempting to reconnect."})
                await asyncio.sleep(2.0)
                continue

            try:
                fall_event = alert_q.get_nowait()
            except queue.Empty:
                fall_event = None

            # The AI process emits only a newly-confirmed, per-track event.
            # This avoids duplicate alerts caused by multiple websocket clients.
            event_signature = None if not fall_event else (
                fall_event.get("track_id"), fall_event.get("timestamp")
            )
            if fall_event and event_signature != last_alert_signature:
                alert_active = True
                last_alert_signature = event_signature
                alert_payload = {
                    "type": "CRITICAL_ALERT",
                    "event_code": "FALL_DETECTED",
                    "track_id": fall_event.get("track_id"),
                    "message": "Cảnh báo khẩn cấp: phát hiện ngã hoặc gục bất thường, cần kiểm tra ngay.",
                    "timestamp": fall_event.get("timestamp", time.time()),
                }
                await websocket.send_json(alert_payload)
                image_path = f"snapshots/fall_{int(time.time())}_{fall_event.get('track_id', 'unknown')}.jpg"
                try:
                    with open(image_path, "wb") as f:
                        f.write(latest_mjpeg_bytes)
                    log_alert("FALL_DETECTED", f"Phát hiện ngã ở track {fall_event.get('track_id')}", image_path)
                except Exception as e:
                    logger.error(f"File/Database Write Error: {e}")
                
                # --- TELEGRAM DEBOUNCE (Rate limit: 1 tin nhắn mỗi 60 giây) ---
                global last_telegram_sent
                if time.time() - last_telegram_sent > 60:
                    last_telegram_sent = time.time()
                    
                    pos_x = fall_event.get("pos_x", 0.0)
                    pos_y = fall_event.get("pos_y", 0.0)
                    speed = fall_event.get("speed", 0.0)
                    dt_str = time.strftime("%H:%M - %d/%m/%Y")
                    
                    if speed == 0.0:
                        msg_text = (
                            f"🚨 [BÁO ĐỘNG] PHÁT HIỆN TÉ NGÃ/GỤC BẤT THƯỜNG!\n"
                            f"🕒 Thời gian: {dt_str}\n"
                            f"🚹 Mục tiêu: Patient #{fall_event.get('track_id')}\n\n"
                            f"📍 VỊ TRÍ (RADAR 2D):\n"
                            f"🔸 Tọa độ X: {pos_x:.2f} m\n"
                            f"🔸 Tọa độ Y: {pos_y:.2f} m\n"
                            f"⚠️ Tốc độ: 0 m/s (BẤT ĐỘNG HOÀN TOÀN)\n\n"
                            f"🚑 Yêu cầu gọi người nhà kiểm tra ngay lập tức!"
                        )
                    else:
                        msg_text = (
                            f"🚨 [BÁO ĐỘNG] PHÁT HIỆN TÉ NGÃ/GỤC BẤT THƯỜNG!\n"
                            f"🕒 Thời gian: {dt_str}\n"
                            f"🚹 Mục tiêu: Patient #{fall_event.get('track_id')}\n\n"
                            f"📍 VỊ TRÍ (RADAR 2D):\n"
                            f"🔸 Tọa độ X: {pos_x:.2f} m\n"
                            f"🔸 Tọa độ Y: {pos_y:.2f} m\n"
                            f"🔹 Tốc độ: {speed:.2f} m/s (CÒN CỬ ĐỘNG)\n\n"
                            f"🛑 Vui lòng mở Camera trực tiếp để kiểm tra!"
                        )

                    threading.Thread(
                        target=send_telegram_alert,
                        args=(latest_mjpeg_bytes, msg_text),
                        daemon=True,
                    ).start()
                else:
                    logger.warning("Bỏ qua gửi Telegram do đang trong thời gian Cooldown (60s).")
            
            await asyncio.sleep(0.2)
    except WebSocketDisconnect:
        pass

if __name__ == "__main__":
    mp.freeze_support()
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False, ws="websockets")
