import asyncio
import logging
import multiprocessing as mp
import os
import queue
import time
import threading
import requests
import math
import ipaddress
import json
import socket
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator
from urllib.parse import urlsplit

import cv2
import uvicorn
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv, set_key
from pydantic import BaseModel, Field

from database import DB_PATH, init_db, log_alert, log_vitals, point_in_zone
from fall_detection import FallDetector, FallObservation
from servo_protocol import (PROTOCOLS, STEP_COMMANDS, LEGACY_STEP_INTERVAL,
                            LEGACY_TRACKING_INTERVAL, capabilities, tracking_payload)

# Load environment variables (Telegram config)
load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Constants
VIDEO_SOURCE = os.getenv("VIDEO_SOURCE", "http://10.214.79.12:81/stream")
CONTROL_MQTT_BROKER = os.getenv("MQTT_BROKER", "10.214.79.55")
SERVO_PROTOCOL = os.getenv("SERVO_PROTOCOL", "sequenced_hold").strip().lower()
if SERVO_PROTOCOL not in PROTOCOLS:
    raise ValueError(f"SERVO_PROTOCOL must be one of {PROTOCOLS}; got {SERVO_PROTOCOL!r}")
POSE_MODEL_PATH = os.getenv("POSE_MODEL_PATH", "yolov8m-pose.pt")
try:
    AI_FPS_LIMIT = max(1, min(30, int(os.getenv("AI_FPS_LIMIT", "15"))))
except ValueError:
    AI_FPS_LIMIT = 15
    logger.warning("Invalid AI_FPS_LIMIT; using 15 FPS")

# Begin conservatively; measured inference cost sets the later decode rate.
AI_INITIAL_FPS = min(AI_FPS_LIMIT, 15)

# Indexes in the two small shared-memory diagnostic arrays. Rates represent
# frames completed by that stage, not the browser's rendered frame rate.
CAM_FPS, CAM_KBPS, CAM_JPEG_KB, CAM_DECODE_MS, CAM_PREVIEW_DROPS, CAM_AI_INPUT_DROPS, CAM_RECONNECTS, CAM_AI_DECODE_FPS = range(8)
AI_FPS, AI_INFER_MS, AI_ENCODE_MS, AI_PIPELINE_MS, AI_OUTPUT_DROPS, AI_LAST_RADAR_AT, AI_RADAR_ERRORS, AI_WORK_MS = range(8)
AI_RADAR_X, AI_RADAR_Y, AI_RADAR_SPEED = range(8, 11)
VIDEO_DIAG_INTERVAL_SEC = 5.0
FALL_DURATION_THRESHOLD_SEC = 1.5

# Tạo thư mục chứa ảnh Snapshot nếu chưa có
os.makedirs("snapshots", exist_ok=True)
init_db()

# ---------------------------------------------------------
# TIẾN TRÌNH 1: CAMERA PRODUCER (Độc lập phần cứng)
# ---------------------------------------------------------
def put_latest_frame(frame_q: mp.Queue, frame):
    """Keep the newest frame so a slow consumer cannot create seconds of lag."""
    try:
        frame_q.put_nowait(frame)
        return False
    except queue.Full:
        try:
            frame_q.get_nowait()
        except queue.Empty:
            pass
        try:
            frame_q.put_nowait(frame)
        except queue.Full:
            pass
        return True


def camera_process(raw_q: mp.Queue, preview_q: mp.Queue, last_frame_at,
                   camera_source_ref, camera_generation_ref, camera_metrics_ref,
                   ai_target_fps_ref, shutdown_flag):
    logger.info("Process 1 (Camera): Started (urllib HTTP mode).")
    import urllib.request
    import numpy as np

    stream = None
    active_source = None
    active_generation = -1
    bytes_data = bytearray()
    # OV5640 can produce larger JPEGs than OV2640. Bound malformed streams
    # without discarding valid high-resolution frames at 1 MiB.
    max_jpeg_bytes = 4 * 1024 * 1024
    last_ai_decode = 0.0
    end_search_from = 2
    diag_started = time.monotonic()
    frames_in = bytes_in = frames_decoded = 0
    decode_ms_sum = 0.0
    preview_drops = ai_input_drops = reconnects = 0
    while not shutdown_flag.value:
        now = time.monotonic()
        window = now - diag_started
        if window >= VIDEO_DIAG_INTERVAL_SEC:
            with camera_metrics_ref.get_lock():
                camera_metrics_ref[CAM_FPS] = frames_in / window
                camera_metrics_ref[CAM_AI_DECODE_FPS] = frames_decoded / window
                camera_metrics_ref[CAM_KBPS] = bytes_in / window / 1024.0
                camera_metrics_ref[CAM_JPEG_KB] = bytes_in / frames_in / 1024.0 if frames_in else 0.0
                camera_metrics_ref[CAM_DECODE_MS] = decode_ms_sum / frames_decoded if frames_decoded else 0.0
                camera_metrics_ref[CAM_PREVIEW_DROPS] += preview_drops
                camera_metrics_ref[CAM_AI_INPUT_DROPS] += ai_input_drops
                camera_metrics_ref[CAM_RECONNECTS] += reconnects
                cumulative_reconnects = int(camera_metrics_ref[CAM_RECONNECTS])
            logger.info("[VIDEO-INGEST] raw_fps=%.1f ai_decode_fps=%.1f KB/s=%.1f jpeg_kB=%.1f decode_ms=%.1f preview_drop=%d ai_input_drop=%d reconnects=%d",
                        frames_in / window, frames_decoded / window,
                        bytes_in / window / 1024.0,
                        bytes_in / frames_in / 1024.0 if frames_in else 0.0,
                        decode_ms_sum / frames_decoded if frames_decoded else 0.0,
                        preview_drops, ai_input_drops, cumulative_reconnects)
            diag_started = now
            frames_in = bytes_in = frames_decoded = 0
            decode_ms_sum = 0.0
            preview_drops = ai_input_drops = reconnects = 0
        with camera_source_ref.get_lock():
            configured_source = camera_source_ref.get_obj().value
            configured_generation = camera_generation_ref.value
        if stream is not None and (configured_source != active_source or
                                   configured_generation != active_generation):
            try:
                stream.close()
            except Exception:
                pass
            stream = None
            bytes_data.clear()
            last_ai_decode = 0.0
            end_search_from = 2
            diag_started = time.monotonic()
            frames_in = bytes_in = frames_decoded = 0
            decode_ms_sum = 0.0
            preview_drops = ai_input_drops = 0
        if stream is None:
            try:
                stream = urllib.request.urlopen(configured_source, timeout=2)
                if active_source is not None:
                    reconnects += 1
                active_source = configured_source
                active_generation = configured_generation
                bytes_data.clear()
                end_search_from = 2
                logger.info("Camera stream connected: %s", active_source)
            except Exception as e:
                logger.warning("Camera connect error: %s", e)
                time.sleep(1)
                continue

        try:
            chunk = stream.read1(8192)
            if not chunk:
                raise ConnectionError("camera stream closed")
            bytes_data.extend(chunk)

            while True:
                start = bytes_data.find(b'\xff\xd8')
                if start < 0:
                    if len(bytes_data) > max_jpeg_bytes:
                        del bytes_data[:-1]
                    break
                if start:
                    del bytes_data[:start]
                    end_search_from = max(2, end_search_from - start)
                end = bytes_data.find(b'\xff\xd9', end_search_from)
                if end < 0:
                    end_search_from = max(2, len(bytes_data) - 1)
                    if len(bytes_data) > max_jpeg_bytes:
                        logger.warning("Discarding oversized/incomplete camera JPEG")
                        bytes_data.clear()
                        end_search_from = 2
                    break

                jpg = bytes(bytes_data[:end + 2])
                del bytes_data[:end + 2]
                end_search_from = 2
                ingested_at = time.monotonic()
                frames_in += 1
                bytes_in += len(jpg)
                with camera_source_ref.get_lock():
                    if camera_generation_ref.value != active_generation:
                        break
                    preview_drops += put_latest_frame(preview_q, (active_generation, jpg))
                    with last_frame_at.get_lock():
                        last_frame_at.value = time.time()

                if ingested_at - last_ai_decode >= 1.0 / max(1.0, ai_target_fps_ref.value):
                    decode_started = time.perf_counter()
                    frame = cv2.imdecode(np.frombuffer(jpg, dtype=np.uint8), cv2.IMREAD_COLOR)
                    if frame is not None:
                        frames_decoded += 1
                        decode_ms_sum += (time.perf_counter() - decode_started) * 1000.0
                        last_ai_decode = ingested_at
                        frame = cv2.flip(frame, 1)
                        with camera_source_ref.get_lock():
                            if camera_generation_ref.value == active_generation:
                                ai_input_drops += put_latest_frame(raw_q, (active_generation, frame, ingested_at))
        except Exception as e:
            logger.warning("Camera stream interrupted: %s", e)
            try:
                stream.close()
            except Exception:
                pass
            stream = None
            bytes_data.clear()
            end_search_from = 2
            time.sleep(0.5)

    if stream is not None:
        stream.close()
    logger.info("Process 1 (Camera): Exited gracefully.")


# ---------------------------------------------------------
# TIẾN TRÌNH 2: AI & MQTT CONSUMER (Tính toán song song)
# ---------------------------------------------------------
def ai_process(raw_q: mp.Queue, mjpeg_q: mp.Queue, alert_q: mp.Queue,
               camera_generation_ref, ai_metrics_ref, ai_target_fps_ref,
               shutdown_flag, overlay_q: mp.Queue):
    logger.info("Process 2 (AI Core & MQTT): Started. Optimizing for Host/VPS...")
    global global_person_count
    
    # 1. Khởi tạo MQTT (Giao tiếp với ESP32)
    import paho.mqtt.client as mqtt
    mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    
    is_camera_moving = False
    camera_motion_epoch = 0
    current_radar_x = 0.0
    current_radar_y = 0.0
    current_radar_speed = 0.0
    radar_safe_zone_state = (0.0, False)
    last_radar_log = 0
    last_danger_log = 0.0
    last_zone_status_log = 0.0
    active_danger_zone = None
    
    last_zones_fetch = 0
    cached_safe_zones = []
    cached_danger_zones = []
    cached_room_config = {"width": 6.0, "length": 6.0, "radar_x": 3.0, "radar_y": 0.0}
    
    wandering_start = 0.0
    wandering_alert_sent = False
    last_mqtt_warning = 0.0
    tracking_auto_requested = False

    def on_mqtt_connect(client, userdata, flags, reason_code, properties):
        if reason_code != 0:
            logger.warning("AI MQTT connection refused: %s", reason_code)
            return
        client.subscribe("embedded/servo/status")
        client.subscribe("embedded/radar/data")
        if SERVO_PROTOCOL == "legacy_step":
            client.subscribe("embedded/servo/mode")
        logger.info("AI MQTT connected and subscribed to radar/servo status")

    def on_mqtt_disconnect(client, userdata, disconnect_flags, reason_code, properties):
        nonlocal tracking_auto_requested
        tracking_auto_requested = False
        logger.warning("AI MQTT disconnected: %s", reason_code)

    def on_mqtt_message(client, userdata, msg):
        nonlocal is_camera_moving, camera_motion_epoch, current_radar_x, current_radar_y, current_radar_speed
        nonlocal radar_safe_zone_state, last_radar_log, last_danger_log, last_zone_status_log
        nonlocal wandering_start, wandering_alert_sent, last_zones_fetch, cached_safe_zones, cached_danger_zones, cached_room_config
        nonlocal last_mqtt_warning, tracking_auto_requested, active_danger_zone

        def enqueue_zone_alert(event_code, message, zone_name=""):
            event = {
                "kind": "zone",
                "event_code": event_code,
                "message": message,
                "zone_name": zone_name,
                "pos_x": current_radar_x,
                "pos_y": current_radar_y,
                "timestamp": time.time(),
            }
            try:
                alert_q.put_nowait(event)
                logger.warning("[ZONE-ALERT] %s: %s at (%.2f, %.2f)m",
                               event_code, zone_name or message,
                               current_radar_x, current_radar_y)
            except queue.Full:
                logger.error("[ZONE-ALERT] Alert queue is full; dropped %s", event_code)

        try:
            if msg.topic == "embedded/servo/mode":
                tracking_auto_requested = msg.payload.decode("utf-8").strip().upper() == "AUTO"
            elif msg.topic == "embedded/servo/status":
                payload = msg.payload.decode('utf-8').strip().upper()
                if payload == "MOVING":
                    is_camera_moving = True
                    camera_motion_epoch += 1
                elif payload == "STOPPED":
                    is_camera_moving = False
            elif msg.topic == "embedded/radar/data":
                try:
                    data = json.loads(msg.payload.decode('utf-8'))
                    raw_x = float(data.get("x", 0.0))
                    raw_y = float(data.get("y", 0.0))
                    current_radar_speed = float(data.get("speed", 0.0))
                    if not all(math.isfinite(v) for v in (raw_x, raw_y, current_radar_speed)):
                        raise ValueError("non-finite radar value")
                    # Reload configuration quickly after a dashboard save.
                    if time.time() - last_zones_fetch > 1:
                        from database import get_all_zones, get_room_config
                        all_zones = get_all_zones()
                        next_safe_zones = [z for z in all_zones if z["type"] == "SAFE"]
                        next_danger_zones = [z for z in all_zones if z["type"] == "DANGER"]
                        next_room_config = get_room_config()
                        changed = (next_safe_zones != cached_safe_zones or
                                   next_danger_zones != cached_danger_zones or
                                   next_room_config != cached_room_config)
                        cached_safe_zones = next_safe_zones
                        cached_danger_zones = next_danger_zones
                        cached_room_config = next_room_config
                        last_zones_fetch = time.time()
                        if changed:
                            logger.info("[ZONE-CONFIG] applied safe=%d danger=%d room=%.2fx%.2fm",
                                        len(cached_safe_zones), len(cached_danger_zones),
                                        cached_room_config["width"], cached_room_config["length"])

                    # Lấy góc xoay (Yaw)
                    angle = float(cached_room_config.get("radar_angle", 0.0))
                    theta = math.radians(angle)
                    
                    # Phép xoay 2D
                    rot_x = raw_x * math.cos(theta) + raw_y * math.sin(theta)
                    rot_y = -raw_x * math.sin(theta) + raw_y * math.cos(theta)

                    # ÁP DỤNG PHÉP TỊNH TIẾN TỌA ĐỘ (Coordinate Translation)
                    current_radar_x = cached_room_config["radar_x"] + rot_x
                    current_radar_y = cached_room_config["radar_y"] + rot_y

                    radar_received_at = time.time()
                    with ai_metrics_ref.get_lock():
                        ai_metrics_ref[AI_LAST_RADAR_AT] = radar_received_at
                        ai_metrics_ref[AI_RADAR_X] = current_radar_x
                        ai_metrics_ref[AI_RADAR_Y] = current_radar_y
                        ai_metrics_ref[AI_RADAR_SPEED] = current_radar_speed

                    safe_zone = next((sz for sz in cached_safe_zones
                                      if point_in_zone(current_radar_x, current_radar_y, sz)), None)

                    # Kiểm tra Danger Zone (Cảnh báo NGAY LẬP TỨC nếu dẫm vào vùng cấm)
                    danger_zone = next((dz for dz in cached_danger_zones
                                        if point_in_zone(current_radar_x, current_radar_y, dz)), None)
                    radar_safe_zone_state = (radar_received_at, safe_zone is not None and danger_zone is None)
                    danger_name = danger_zone.get("name", "Danger zone") if danger_zone else None
                    danger_key = ((danger_name, danger_zone["x_min"], danger_zone["x_max"],
                                   danger_zone["y_min"], danger_zone["y_max"])
                                  if danger_zone else None)
                    if danger_key != active_danger_zone:
                        active_danger_zone = danger_key
                        if danger_zone:
                            enqueue_zone_alert(
                                "DANGER_ZONE",
                                f"Phát hiện mục tiêu đi vào vùng nguy hiểm: {danger_name}",
                                danger_name,
                            )
                    if danger_zone and time.time() - last_danger_log > 30:
                        logger.warning("[ZONE] Target remains in danger zone %s at (%.2f, %.2f)m",
                                       danger_name, current_radar_x, current_radar_y)
                        last_danger_log = time.time()

                    # Report the evaluated point and effective zone at a low rate so
                    # zone setup can be diagnosed without flooding the serial/log stream.
                    if time.time() - last_zone_status_log >= 5.0:
                        zone_state = (f"DANGER:{danger_name}" if danger_zone else
                                      f"SAFE:{safe_zone.get('name', 'Safe zone')}" if safe_zone else
                                      "OUTSIDE")
                        logger.info("[ZONE-STATE] state=%s room=(%.2f,%.2f)m radar=(%.2f,%.2f)m speed=%.2fm/s safe_zones=%d danger_zones=%d",
                                    zone_state, current_radar_x, current_radar_y,
                                    raw_x, raw_y, current_radar_speed, len(cached_safe_zones),
                                    len(cached_danger_zones))
                        last_zone_status_log = time.time()
                    
                    # Logic Cảnh báo Đi lang thang ban đêm (Dementia/Wandering)
                    # Khung giờ: 23:00 đêm đến 05:00 sáng
                    current_hour = int(time.strftime("%H"))
                    if current_hour >= 23 or current_hour < 5:
                        # Kiểm tra xem có đang ở trong Safe Zone không
                        # An empty safe-zone list disables the wandering alert.
                        in_safe = bool(safe_zone) if cached_safe_zones else True
                        
                        # Ra khỏi giường (NOT in_safe) và Đang di chuyển (speed > 0.1)
                        if not in_safe and current_radar_speed > 0.1:
                            # TÍNH NĂNG: Nếu phòng có >= 2 người, tắt báo động lang thang
                            if 'global_person_count' in globals() and global_person_count >= 2:
                                # Bỏ qua báo động vì có người nhà giám sát
                                wandering_start = 0.0
                                wandering_alert_sent = False
                            elif wandering_start == 0.0:
                                wandering_start = time.time()
                            elif time.time() - wandering_start > 300: # 5 phút liên tục
                                if not wandering_alert_sent:
                                    enqueue_zone_alert(
                                        "NIGHT_WANDERING",
                                        "Phát hiện di chuyển liên tục ngoài vùng an toàn trong khung giờ ban đêm",
                                        "Safe zone",
                                    )
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
                except (ValueError, UnicodeDecodeError, TypeError) as e:
                    with ai_metrics_ref.get_lock():
                        ai_metrics_ref[AI_RADAR_ERRORS] += 1
                    if time.monotonic() - last_mqtt_warning > 5.0:
                        logger.warning("[RADAR-MQTT] Invalid payload: %s", e)
                        last_mqtt_warning = time.monotonic()
        except Exception as e:
            with ai_metrics_ref.get_lock():
                ai_metrics_ref[AI_RADAR_ERRORS] += 1
            if time.monotonic() - last_mqtt_warning > 5.0:
                logger.warning("[RADAR-MQTT] Processing error: %s", e)
                last_mqtt_warning = time.monotonic()

    mqtt_client.on_connect = on_mqtt_connect
    mqtt_client.on_disconnect = on_mqtt_disconnect
    mqtt_client.on_message = on_mqtt_message
    
    broker = CONTROL_MQTT_BROKER
    try:
        mqtt_client.connect_async(broker, 1883, 60)
        mqtt_client.loop_start()
        logger.info("AI MQTT connecting to broker at %s", broker)
    except Exception as e:
        logger.warning(f"Process 2: MQTT Connection failed: {e}")

    # 2. Khởi tạo YOLO (Tự động nhận diện GPU/CPU)
    import torch
    from ultralytics import YOLO
    
    model_path = POSE_MODEL_PATH
    logger.info("[VIDEO-AI] model=%s max_fps=%d initial_target_fps=%d",
                model_path, AI_FPS_LIMIT, AI_INITIAL_FPS)

    if not model_path.lower().endswith(".pt"):
        # Explicit engine/OpenVINO models can be selected without exporting.
        pose_estimator = YOLO(model_path, task='pose')
    elif torch.cuda.is_available():
        logger.info("NVIDIA GPU Detected! Optimizing with TensorRT/CUDA...")
        trt_path = str(Path(model_path).with_suffix(".engine"))
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
        ov_path = str(Path(model_path).with_suffix("")) + "_openvino_model"
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
    last_single_person = None
    last_heartbeat = 0
    last_target_seen = time.time()
    target_lost_sent = False
    processed_generation = -1
    last_tracking_publish_at = 0.0
    
    # AI_FPS_LIMIT is a ceiling. Decode only as many frames as inference can
    # process, leaving CPU/GPU headroom and retaining the newest queued frame.
    ai_target_fps_ref.value = float(AI_INITIAL_FPS)
    diag_started = time.monotonic()
    ai_frames = output_drops = 0
    inference_ms_sum = encode_ms_sum = pipeline_ms_sum = work_ms_sum = 0.0
    last_encode_warning = 0.0
    
    while not shutdown_flag.value:
        loop_start = time.monotonic()
        diag_window = loop_start - diag_started
        if diag_window >= VIDEO_DIAG_INTERVAL_SEC:
            avg_work_ms = work_ms_sum / ai_frames if ai_frames else 0.0
            if avg_work_ms > 0.0:
                # Reserve ~20% of compute time for scheduling jitter and other
                # tasks. Increase gradually, but lower the target promptly.
                sustainable_fps = max(1.0, min(float(AI_FPS_LIMIT), 800.0 / avg_work_ms))
                previous_target = ai_target_fps_ref.value
                ai_target_fps_ref.value = min(sustainable_fps, previous_target + 5.0)
            with ai_metrics_ref.get_lock():
                ai_metrics_ref[AI_FPS] = ai_frames / diag_window
                ai_metrics_ref[AI_WORK_MS] = avg_work_ms
                ai_metrics_ref[AI_INFER_MS] = inference_ms_sum / ai_frames if ai_frames else 0.0
                ai_metrics_ref[AI_ENCODE_MS] = encode_ms_sum / ai_frames if ai_frames else 0.0
                ai_metrics_ref[AI_PIPELINE_MS] = pipeline_ms_sum / ai_frames if ai_frames else 0.0
                ai_metrics_ref[AI_OUTPUT_DROPS] += output_drops
            logger.info("[VIDEO-AI] fps=%.1f target=%.1f max=%d work_ms=%.0f inference_ms=%.0f encode_ms=%.0f pipeline_ms=%.0f output_drop=%d",
                        ai_frames / diag_window, ai_target_fps_ref.value,
                        AI_FPS_LIMIT, avg_work_ms,
                        inference_ms_sum / ai_frames if ai_frames else 0.0,
                        encode_ms_sum / ai_frames if ai_frames else 0.0,
                        pipeline_ms_sum / ai_frames if ai_frames else 0.0,
                        output_drops)
            diag_started = loop_start
            ai_frames = output_drops = 0
            inference_ms_sum = encode_ms_sum = pipeline_ms_sum = work_ms_sum = 0.0

        current_generation = camera_generation_ref.value
        if current_generation != processed_generation:
            fall_detector.reset()
            previous_features.clear()
            last_single_person = None
            last_target_seen = time.time()
            target_lost_sent = False
            global_person_count = 0
            wandering_start = 0.0
            wandering_alert_sent = False
            predictor = getattr(pose_estimator, "predictor", None)
            tracker_reset_failed = False
            for tracker in (getattr(predictor, "trackers", None) or ()):
                try:
                    tracker.reset()
                except Exception as e:
                    logger.warning("Could not reset camera tracker: %s", e)
                    tracker_reset_failed = True
            if tracker_reset_failed:
                try:
                    delattr(predictor, "trackers")
                except (AttributeError, TypeError):
                    pass
            processed_generation = current_generation
            ai_target_fps_ref.value = float(AI_INITIAL_FPS)
            diag_started = time.monotonic()
            ai_frames = output_drops = 0
            inference_ms_sum = encode_ms_sum = pipeline_ms_sum = work_ms_sum = 0.0
            logger.info("AI tracker reset for camera source generation %s", current_generation)
        
        # Heartbeat Ping cho ESP32 mỗi giây
        if time.time() - last_heartbeat > 1.0:
            try:
                mqtt_client.publish("embedded/system/heartbeat", "PING")
            except Exception: pass
            last_heartbeat = time.time()
            
        try:
            frame_generation, frame, ingested_at = raw_q.get(timeout=0.5)
        except queue.Empty:
            continue

        # The producer may outrun CPU inference. Process only its newest frame.
        while True:
            try:
                frame_generation, frame, ingested_at = raw_q.get_nowait()
            except queue.Empty:
                break
        if frame_generation != camera_generation_ref.value:
            continue
        if frame_generation != processed_generation:
            # Source changed after the loop-top reset check. Reset first.
            continue

        work_started = time.perf_counter()
        frame_motion_epoch = camera_motion_epoch

        # Dùng tracker mạnh hơn (botsort), conf=0.5 lọc nhiễu
        try:
            inference_started = time.perf_counter()
            results = pose_estimator.track(frame, persist=True, verbose=False, tracker="botsort.yaml", conf=0.5)
            inference_ms = (time.perf_counter() - inference_started) * 1000.0
        except Exception as e:
            logger.error(f"Inference error: {e}")
            time.sleep(1)
            continue
        # A source switch can happen during the expensive inference call.
        # Never publish detections, movement or alarms from that old image.
        if frame_generation != camera_generation_ref.value:
            continue
        
        annotated_frame = results[0].plot()
        # Publish compact detection coordinates separately from JPEG encoding.
        # The dashboard can draw these over the high-rate raw stream instead
        # of waiting for a full annotated frame after every inference.
        frame_height, frame_width = frame.shape[:2]
        overlay_boxes = []
        detected_boxes = results[0].boxes if len(results) > 0 else None
        if detected_boxes is not None:
            box_coordinates = detected_boxes.xyxy.tolist()
            track_ids = detected_boxes.id
            confidences = detected_boxes.conf
            for box_index, coordinates in enumerate(box_coordinates):
                track_id = None
                if track_ids is not None and box_index < len(track_ids):
                    track_id = int(track_ids[box_index].item())
                confidence = 0.0
                if confidences is not None and box_index < len(confidences):
                    confidence = float(confidences[box_index].item())
                overlay_boxes.append({
                    "x1": float(coordinates[0]), "y1": float(coordinates[1]),
                    "x2": float(coordinates[2]), "y2": float(coordinates[3]),
                    "track_id": track_id, "confidence": confidence,
                    "fall_state": "TRACKING", "fall_confirmed": False,
                })
        pose_data = results[0].keypoints if len(results) > 0 else None
        if pose_data is not None:
            pose_coordinates = pose_data.xy.tolist()
            pose_confidences = pose_data.conf.tolist() if pose_data.conf is not None else None
            for person_index, points in enumerate(pose_coordinates):
                if person_index >= len(overlay_boxes):
                    break
                confidences = pose_confidences[person_index] if pose_confidences is not None else None
                overlay_boxes[person_index]["keypoints"] = [
                    {
                        "x": float(point[0]),
                        "y": float(point[1]),
                        "confidence": float(confidences[point_index]) if confidences is not None and point_index < len(confidences) else 1.0,
                    }
                    for point_index, point in enumerate(points)
                ]
        fall_event = None
        current_active_persons = []

        # Khai báo biến toàn cục đếm người cho MQTT callback
        global_person_count = 0
        safe_zone_timestamp, radar_target_in_safe_zone = radar_safe_zone_state
        if radar_target_in_safe_zone and time.time() - safe_zone_timestamp <= 2.0:
            last_single_person = None
        
        if len(results) > 0 and results[0].boxes and results[0].boxes.id is not None:
            # Count people whose pose is usable by the fall detector. A stray
            # high-confidence box without a torso must not mute a real fall.
            valid_boxes = []
            pose_confidences = (results[0].keypoints.conf
                                if results[0].keypoints is not None else None)
            if pose_confidences is not None:
                for box_index, confidence in enumerate(results[0].boxes.conf):
                    if (float(confidence.item()) < fall_detector.config.min_detection_confidence
                            or box_index >= len(pose_confidences)):
                        continue
                    pose_confidence = pose_confidences[box_index]
                    torso = [float(pose_confidence[j].item()) for j in (5, 6, 11, 12)
                             if j < len(pose_confidence)]
                    if (torso and sum(torso) / len(torso)
                            >= fall_detector.config.min_keypoint_confidence):
                        valid_boxes.append(box_index)
            global_person_count = len(valid_boxes)
            overlay_message = "FALL ALERT MUTED · MULTIPLE PEOPLE" if global_person_count >= 2 else ""
            
            if global_person_count >= 2:
                # Vẽ thông báo MUTED lên giữa màn hình
                cv2.putText(annotated_frame, "MUTED: MULTIPLE PEOPLE PRESENT", (50, 80), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 255, 255), 3)

            last_target_seen = time.time()
            target_lost_sent = False
            boxes = results[0].boxes
            keypoints = results[0].keypoints
            # A handoff is only meaningful while exactly one person is visible
            # and the camera is stationary. Never carry a fall baseline through
            # an ambiguous multi-person frame.
            if global_person_count != 1 or len(boxes.id) != 1 or is_camera_moving:
                last_single_person = None

            for i in range(len(boxes.id)):
                if frame_generation != camera_generation_ref.value:
                    break
                obj_id = int(boxes.id[i].item())
                x1, y1, x2, y2 = boxes.xyxy[i].tolist()
                cv2.putText(annotated_frame, f"Person {obj_id}", (int(x1), max(0, int(y1)-10)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

                
                # Bắn tọa độ mục tiêu với Deadband 15%
                if i == 0:
                    target_x = int((x1 + x2) / 2)
                    target_y = int((y1 + y2) / 2)
                    
                    frame_h, frame_w = frame.shape[:2]
                    center_x, center_y = frame_w / 2.0, frame_h / 2.0
                    deadband_x = frame_w * 0.15
                    deadband_y = frame_h * 0.15
                    
                    # Chỉ gửi lệnh quay Servo nếu mục tiêu ra khỏi vùng an toàn
                    if (frame_generation == camera_generation_ref.value and
                            (SERVO_PROTOCOL != "legacy_step" or tracking_auto_requested) and
                            (abs(target_x - center_x) > deadband_x or abs(target_y - center_y) > deadband_y)):
                        now_tracking = time.monotonic()
                        if (SERVO_PROTOCOL != "legacy_step" or
                                now_tracking - last_tracking_publish_at >= LEGACY_TRACKING_INTERVAL):
                            last_tracking_publish_at = now_tracking
                            try:
                                mqtt_client.publish("embedded/servo/tracking", tracking_payload(
                                    SERVO_PROTOCOL, target_x, target_y, frame_w, frame_h))
                            except Exception:
                                pass
                
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
                    last_single_person = None
                    overlay_boxes[i]["fall_state"] = "ALARM CANCELED"
                    track = fall_detector.tracks.get(obj_id)
                    if track:
                        # Reset trạng thái báo động nhưng giữ lại lịch sử để không bị mù với lần ngã sau
                        track.state = "unknown"
                        track.candidate_since = None
                        track.confirmed_at = 0.0
                        track.cooldown_until = 0.0
                    cv2.putText(annotated_frame, "ALARM CANCELED", (int(x1), int(y1)-30), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 0), 3)
                    try:
                        if frame_generation == camera_generation_ref.value:
                            mqtt_client.publish("embedded/servo/buzzer", "OFF")
                    except Exception: pass
                    # Không xoá previous_features để giữ liền mạch tracking
                    continue

                safe_zone_timestamp, radar_target_in_safe_zone = radar_safe_zone_state
                if radar_target_in_safe_zone and time.time() - safe_zone_timestamp <= 2.0:
                    # A fresh radar point in a configured SAFE zone represents
                    # intentional rest (for example, lying on the bed). Reset
                    # the temporal fall track so that pose changes there cannot
                    # become a fall alarm, or carry a candidate out of the zone.
                    fall_detector.tracks.pop(obj_id, None)
                    previous_features.pop(obj_id, None)
                    last_single_person = None
                    overlay_boxes[i]["fall_state"] = "SAFE ZONE"
                    overlay_boxes[i]["fall_confirmed"] = False
                    cv2.rectangle(annotated_frame, (int(x1), int(y1)), (int(x2), int(y2)), (0, 200, 120), 2)
                    cv2.putText(annotated_frame, "SAFE ZONE", (int(x1), max(20, int(y1)-10)), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 200, 120), 2)
                    continue

                current_t = time.monotonic()
                detection_confidence = float(boxes.conf[i].item()) if boxes.conf is not None else 0.0
                valid_pose = (detection_confidence >= fall_detector.config.min_detection_confidence
                              and keypoint_confidence >= fall_detector.config.min_keypoint_confidence
                              and height > 8.0
                              and all(math.isfinite(value) for value in (com_y, head_y, hip_y)))
                if (valid_pose and global_person_count == 1 and len(boxes.id) == 1
                        and not is_camera_moving and frame_motion_epoch == camera_motion_epoch
                        and obj_id not in fall_detector.tracks
                        and last_single_person is not None):
                    old_id, old_box, old_generation, old_motion_epoch = last_single_person
                    eligible_ids = [
                        track_id for track_id, track in fall_detector.tracks.items()
                        if track_id != obj_id and track.state in ("upright", "candidate")
                        and track.observations
                        and 0.0 <= current_t - track.observations[-1].timestamp
                        <= fall_detector.config.max_observation_gap
                    ]
                    if (old_generation == frame_generation and old_motion_epoch == camera_motion_epoch
                            and old_id != obj_id
                            and eligible_ids == [old_id]):
                        overlap_w = max(0.0, min(old_box[2], x2) - max(old_box[0], x1))
                        overlap_h = max(0.0, min(old_box[3], y2) - max(old_box[1], y1))
                        overlap = overlap_w * overlap_h
                        old_area = max(1.0, (old_box[2] - old_box[0]) * (old_box[3] - old_box[1]))
                        new_area = max(1.0, (x2 - x1) * (y2 - y1))
                        iou = overlap / max(1.0, old_area + new_area - overlap)
                        center_distance = math.hypot(
                            (x1 + x2 - old_box[0] - old_box[2]) / 2.0,
                            (y1 + y2 - old_box[1] - old_box[3]) / 2.0,
                        )
                        box_scale = max(old_box[2] - old_box[0], old_box[3] - old_box[1])
                        if iou >= 0.10 or (overlap > 0.0 and center_distance <= 0.45 * box_scale):
                            fall_detector.tracks[obj_id] = fall_detector.tracks.pop(old_id)
                            if old_id in previous_features:
                                previous_features[obj_id] = previous_features.pop(old_id)
                            logger.info("[FALL-TRACK] Continued single person from ID %s to ID %s", old_id, obj_id)

                prior = previous_features.get(obj_id)
                posture_motion = 0.0
                if prior:
                    # Áp dụng bộ lọc Low-pass (EMA) để khử nhiễu (Jitter) khi nằm nghiêng bị che khuất khớp
                    spine_angle = 0.6 * spine_angle + 0.4 * prior[1]
                    com_y = 0.7 * com_y + 0.3 * prior[2]
                    
                    dt = max(1e-3, current_t - prior[0])
                    posture_motion = abs(spine_angle - prior[1]) / 90.0 / dt
                previous_features[obj_id] = (current_t, spine_angle, com_y)
                # Chỉ chạy Fall Detector nếu có đúng 1 người trong phòng (tiết kiệm CPU)
                if global_person_count >= 2:
                    overlay_boxes[i]["fall_state"] = "MUTED"
                    continue
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
                if (valid_pose and global_person_count == 1 and len(boxes.id) == 1
                        and not is_camera_moving and frame_motion_epoch == camera_motion_epoch
                        and decision.state in ("upright", "candidate")
                        and fall_detector.tracks[obj_id].observations
                        and fall_detector.tracks[obj_id].observations[-1].timestamp == current_t):
                    last_single_person = (obj_id, (x1, y1, x2, y2), frame_generation,
                                          frame_motion_epoch)
                else:
                    last_single_person = None
                overlay_boxes[i]["fall_state"] = str(decision.state).upper()
                overlay_boxes[i]["fall_confirmed"] = bool(decision.confirmed)
                if (decision.newly_confirmed and global_person_count == 1 and
                        frame_generation == camera_generation_ref.value):
                    logger.warning(f"CẢNH BÁO KHẨN CẤP: BỆNH NHÂN ĐƠN ĐỘC TÉ NGÃ (Track ID {obj_id})!")
                    fall_event = {
                        "person_type": "PATIENT",
                        "track_id": obj_id, 
                        "camera_generation": frame_generation,
                        "reason": decision.reason, 
                        "timestamp": time.time(),
                        "pos_x": current_radar_x,
                        "pos_y": current_radar_y,
                        "speed": current_radar_speed,
                    }
                    try: mqtt_client.publish("embedded/servo/buzzer", "ON")
                    except Exception: pass
                color = (0, 0, 255) if decision.confirmed else ((0, 165, 255) if decision.state == "candidate" else (0, 255, 0))
                cv2.rectangle(annotated_frame, (int(x1), int(y1)), (int(x2), int(y2)), color, 3 if decision.confirmed else 2)
                label = f"ID:{obj_id} {decision.state.upper()}"
                cv2.putText(annotated_frame, label, (int(x1), max(20, int(y1)-10)), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
        else:
            # Không thấy người nào trong khung hình
            if is_camera_moving:
                last_single_person = None
            if (frame_generation == camera_generation_ref.value and not target_lost_sent and
                    time.time() - last_target_seen > 3.0):
                try: 
                    mqtt_client.publish("embedded/servo/tracking", "LOST")
                    target_lost_sent = True
                except Exception: pass

        fall_detector.prune(time.monotonic())
        
        # Only show a position while the radar is sending fresh readings.
        with ai_metrics_ref.get_lock():
            last_radar_at = ai_metrics_ref[AI_LAST_RADAR_AT]
        radar_online = last_radar_at > 0.0 and 0.0 <= time.time() - last_radar_at <= 5.0
        if radar_online or last_radar_at > 0.0:
            hud_text = (f"X: {current_radar_x:.1f}m | Y: {current_radar_y:.1f}m | V: {current_radar_speed:.2f}m/s"
                        if radar_online else "RADAR: STALE")
            frame_h, frame_w = annotated_frame.shape[:2]
            text_size = cv2.getTextSize(hud_text, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)[0]
            text_x = frame_w - text_size[0] - 20
            color = (0, 255, 255) if radar_online else (0, 165, 255)
            cv2.putText(annotated_frame, hud_text, (text_x, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
        # --------------------------------------------------------

        # Publish the pose/fall overlay after per-person state is known. The
        # payload stays small compared with another full-resolution JPEG.
        if overlay_q is not None and frame_generation == camera_generation_ref.value:
            put_latest_frame(overlay_q, (frame_generation, {
                "timestamp": time.time(),
                "width": int(frame_width),
                "height": int(frame_height),
                "message": overlay_message if global_person_count >= 2 else "",
                "radar": {
                    "x": float(current_radar_x),
                    "y": float(current_radar_y),
                    "speed": float(current_radar_speed),
                } if radar_online else None,
                "detections": overlay_boxes,
            }))

        # Tối ưu hóa nén luồng hình ảnh để giảm băng thông VPS (JPEG Quality 65%)
        encode_started = time.perf_counter()
        try:
            success, buffer = cv2.imencode('.jpg', annotated_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 65])
            encoded_jpeg = buffer.tobytes() if success else None
        except cv2.error as e:
            if time.monotonic() - last_encode_warning > 5.0:
                logger.warning("[VIDEO-AI] JPEG encode failed: %s", e)
                last_encode_warning = time.monotonic()
            success = False
            encoded_jpeg = None
        encode_ms = (time.perf_counter() - encode_started) * 1000.0
        if success and frame_generation == camera_generation_ref.value:
            output_drops += put_latest_frame(mjpeg_q, (frame_generation, encoded_jpeg))
            ai_frames += 1
            work_ms_sum += (time.perf_counter() - work_started) * 1000.0
            inference_ms_sum += inference_ms
            encode_ms_sum += encode_ms
            pipeline_ms_sum += (time.monotonic() - ingested_at) * 1000.0

        # Attach this exact annotated frame to its alert. The alert consumer
        # must not depend on the video pump having updated its JPEG cache yet.
        if fall_event is not None and frame_generation == camera_generation_ref.value:
            if encoded_jpeg is not None:
                fall_event["snapshot_jpeg"] = encoded_jpeg
            try:
                alert_q.put_nowait(fall_event)
            except queue.Full:
                logger.error("[ALERT] Alert queue is full; fall event could not be queued")
            
        

        # Match the adaptive producer ceiling. The one-slot queue discards old
        # input on slower hosts, so this sleep never creates a growing backlog.
        elapsed = time.monotonic() - loop_start
        frame_time = 1.0 / max(1.0, ai_target_fps_ref.value)
        if elapsed < frame_time:
            time.sleep(frame_time - elapsed)

    mqtt_client.loop_stop()
    logger.info("Process 2 (AI/MQTT): Exited gracefully.")


# ---------------------------------------------------------
# TIẾN TRÌNH 3: FASTAPI WEBSERVER & WATCHDOG
# ---------------------------------------------------------
raw_q = None
preview_q = None
mjpeg_q = None
alert_q = None
shutdown_flag = None
last_camera_frame_at = None
camera_source_ref = None
camera_generation_ref = None
camera_metrics_ref = None
ai_metrics_ref = None
ai_target_fps_ref = None
p_cam = None
p_ai = None
ai_overlay_q = None
latest_mjpeg_bytes = b""
latest_preview_bytes = b""
latest_ai_overlay = {
    "timestamp": 0.0,
    "width": 0,
    "height": 0,
    "message": "",
    "radar": {"x": 0.0, "y": 0.0, "speed": 0.0},
    "detections": [],
    "generation": -1,
}
ai_frame_version = 0
preview_frame_version = 0
last_ai_frame_at = 0.0
active_live_viewers = 0
active_ai_viewers = 0
alert_active = False
last_alert_signature = None
last_telegram_sent = 0
alert_websockets: dict[WebSocket, asyncio.Lock] = {}
camera_mode = "MANUAL"
hardware_mode = None
hardware_online = False
control_mqtt_client = None
control_mqtt_connected = threading.Event()
control_mqtt_lock = threading.Lock()
camera_mode_request_lock = threading.Lock()
manual_last_sequence = {}
manual_command_epoch = time.time_ns()
manual_command_sequence = 0
legacy_last_move_at = 0.0
camera_config_update_lock = threading.Lock()
servo_diag_lock = threading.Lock()
servo_diag_payload = None
servo_diag_received_at = 0.0
servo_config_state = None
servo_config_result = None
servo_config_result_at = 0.0
servo_config_result_event = threading.Event()
# Configuration ACKs have no request ID, so serialize only config calls.
# Joystick/mode commands must not wait behind an ESP32 config response.
servo_config_request_lock = threading.Lock()


def on_control_mqtt_connect(client, userdata, flags, reason_code, properties):
    if reason_code != 0:
        control_mqtt_connected.clear()
        logger.warning("Control MQTT connection refused: %s", reason_code)
        return
    if SERVO_PROTOCOL == "sequenced_hold":
        client.subscribe("embedded/servo/state", qos=1)
        client.subscribe("embedded/servo/online", qos=1)
        client.subscribe("embedded/servo/diag", qos=0)
        client.subscribe("embedded/servo/config/state", qos=1)
        client.subscribe("embedded/servo/config/result", qos=1)
    info = client.publish("embedded/servo/mode", camera_mode, qos=1, retain=True)
    if info.rc == 0:
        control_mqtt_connected.set()
        logger.info("Control MQTT connected; requested servo mode: %s", camera_mode)
    else:
        control_mqtt_connected.clear()
        logger.error("Control MQTT mode sync failed with code %s", info.rc)


def on_control_mqtt_disconnect(client, userdata, disconnect_flags, reason_code, properties):
    global hardware_mode, hardware_online
    control_mqtt_connected.clear()
    hardware_mode = None
    hardware_online = False
    logger.warning("Control MQTT disconnected: %s", reason_code)


def on_control_socket_open(client, userdata, connection):
    # Send small joystick packets immediately instead of coalescing TCP writes.
    connection.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)


def on_control_mqtt_message(client, userdata, message):
    global hardware_mode, hardware_online, servo_diag_payload, servo_diag_received_at
    global servo_config_state, servo_config_result, servo_config_result_at
    if message.topic == "embedded/servo/state":
        reported = message.payload.decode("utf-8", errors="replace").strip().upper()
        if reported in ("AUTO", "MANUAL"):
            hardware_mode = reported
    elif message.topic == "embedded/servo/online":
        hardware_online = message.payload.decode("utf-8", errors="replace").strip().upper() == "ONLINE"
        if not hardware_online:
            hardware_mode = None
    elif message.topic == "embedded/servo/diag":
        try:
            parsed = json.loads(message.payload)
            if isinstance(parsed, dict):
                with servo_diag_lock:
                    servo_diag_payload = parsed
                    servo_diag_received_at = time.time()
        except (ValueError, UnicodeDecodeError) as e:
            logger.warning("Invalid servo diagnostic JSON: %s", e)
    elif message.topic == "embedded/servo/config/state":
        try:
            parsed = json.loads(message.payload)
            if isinstance(parsed, dict):
                with servo_diag_lock:
                    servo_config_state = parsed
        except (ValueError, UnicodeDecodeError) as e:
            logger.warning("Invalid servo config state JSON: %s", e)
    elif message.topic == "embedded/servo/config/result":
        result = message.payload.decode("utf-8", errors="replace").strip()
        with servo_diag_lock:
            servo_config_result = result
            servo_config_result_at = time.time()
            servo_config_result_event.set()

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

async def send_alert_websocket_message(websocket: WebSocket, payload: dict) -> bool:
    """Serialize status and alert writes to each dashboard connection."""
    send_lock = alert_websockets.get(websocket)
    if send_lock is None:
        return False
    try:
        async with send_lock:
            await asyncio.wait_for(websocket.send_json(payload), timeout=2.0)
        return True
    except Exception as e:
        alert_websockets.pop(websocket, None)
        logger.info("Dashboard WebSocket closed during send: %s", e)
        return False


async def broadcast_alert(payload: dict) -> None:
    # A failed or slow browser must not prevent the other dashboards from
    # receiving an alert or prevent the snapshot/Telegram side effects.
    if alert_websockets:
        await asyncio.gather(
            *(send_alert_websocket_message(websocket, payload)
              for websocket in tuple(alert_websockets))
        )


async def pump_alert_events() -> None:
    """Consume AI alerts once even when no dashboard is open."""
    global alert_active, last_alert_signature, last_telegram_sent

    while not shutdown_flag.value:
        try:
            fall_event = alert_q.get_nowait()
        except queue.Empty:
            await asyncio.sleep(0.2)
            continue
        except Exception as e:
            logger.error("Alert queue read failed: %s", e)
            await asyncio.sleep(1.0)
            continue

        try:
            if not isinstance(fall_event, dict):
                continue
            if fall_event.get("kind") == "zone":
                event_code = str(fall_event.get("event_code", "ZONE_ALERT"))
                message = str(fall_event.get("message", "Zone boundary event"))
                event_timestamp = float(fall_event.get("timestamp", time.time()))
                log_alert(event_code, message, "")
                await broadcast_alert({
                    "type": "CRITICAL_ALERT",
                    "event_code": event_code,
                    "message": message,
                    "zone_name": fall_event.get("zone_name", ""),
                    "pos_x": fall_event.get("pos_x"),
                    "pos_y": fall_event.get("pos_y"),
                    "timestamp": event_timestamp,
                })
                continue
            with camera_source_ref.get_lock():
                if fall_event.get("camera_generation") != camera_generation_ref.value:
                    continue
                snapshot_jpeg = fall_event.get("snapshot_jpeg")
                image_bytes = snapshot_jpeg if isinstance(snapshot_jpeg, bytes) else latest_mjpeg_bytes
            event_signature = (fall_event.get("track_id"), fall_event.get("timestamp"))
            if event_signature == last_alert_signature:
                continue
            alert_active = True
            last_alert_signature = event_signature
            alert_payload = {
                "type": "CRITICAL_ALERT",
                "event_code": "FALL_DETECTED",
                "track_id": fall_event.get("track_id"),
                "message": f"Cảnh báo: {fall_event.get('person_type', 'PATIENT')} vừa bị ngã!",
                "timestamp": fall_event.get("timestamp", time.time()),
            }
            image_path = f"snapshots/fall_{int(time.time())}_{fall_event.get('track_id', 'unknown')}.jpg"
            try:
                with open(image_path, "wb") as f:
                    f.write(image_bytes)
                log_alert("FALL_DETECTED", f"Phát hiện ngã ở track {fall_event.get('track_id')}", image_path)
            except Exception as e:
                logger.error("File/Database Write Error: %s", e)

            # Preserve the existing Telegram debounce across all dashboards.
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
                        f"⚠️ Tốc độ: 0 m/s \n\n"
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
                    args=(image_bytes, msg_text),
                    daemon=True,
                ).start()
            else:
                logger.warning("Bỏ qua gửi Telegram do đang trong thời gian Cooldown (60s).")
            await broadcast_alert(alert_payload)
        except Exception as e:
            logger.error("Alert processing failed: %s", e)


async def pump_video_frames():
    """One queue reader fans each fresh JPEG out to every browser client."""
    global latest_mjpeg_bytes, latest_preview_bytes, latest_ai_overlay
    global ai_frame_version, preview_frame_version, last_ai_frame_at
    while not shutdown_flag.value:
        for frame_q, kind in ((preview_q, "preview"), (mjpeg_q, "ai")):
            newest = None
            while True:
                try:
                    newest = frame_q.get_nowait()
                except queue.Empty:
                    break
            if newest is not None:
                frame_generation, jpeg = newest
                with camera_source_ref.get_lock():
                    if frame_generation != camera_generation_ref.value:
                        continue
                    if kind == "preview":
                        latest_preview_bytes = jpeg
                        preview_frame_version += 1
                    else:
                        latest_mjpeg_bytes = jpeg
                        ai_frame_version += 1
                        last_ai_frame_at = time.time()

        newest_overlay = None
        while True:
            try:
                newest_overlay = ai_overlay_q.get_nowait()
            except queue.Empty:
                break
        if newest_overlay is not None:
            frame_generation, overlay = newest_overlay
            with camera_source_ref.get_lock():
                if frame_generation == camera_generation_ref.value:
                    latest_ai_overlay = {**overlay, "generation": frame_generation}
        await asyncio.sleep(0.01)


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
            p_cam = mp.Process(target=camera_process, args=(raw_q, preview_q, last_camera_frame_at,
                                                            camera_source_ref, camera_generation_ref,
                                                            camera_metrics_ref, ai_target_fps_ref,
                                                            shutdown_flag))
            p_cam.daemon = True
            p_cam.start()
            
        # Tự phục hồi AI
        if p_ai and not p_ai.is_alive():
            logger.error("WATCHDOG: AI Process Died! Restarting...")
            p_ai = mp.Process(target=ai_process, args=(raw_q, mjpeg_q, alert_q,
                                                        camera_generation_ref, ai_metrics_ref,
                                                        ai_target_fps_ref,
                                                        shutdown_flag, ai_overlay_q))
            p_ai.daemon = True
            p_ai.start()

@asynccontextmanager
async def lifespan(app: FastAPI):
    global raw_q, preview_q, mjpeg_q, alert_q, shutdown_flag, last_camera_frame_at
    global camera_source_ref, camera_generation_ref, camera_metrics_ref, ai_metrics_ref, ai_target_fps_ref
    global p_cam, p_ai, ai_overlay_q, latest_ai_overlay, control_mqtt_client
    
    raw_q = mp.Queue(maxsize=1)
    preview_q = mp.Queue(maxsize=1)
    mjpeg_q = mp.Queue(maxsize=1)
    ai_overlay_q = mp.Queue(maxsize=1)
    latest_ai_overlay = {
        "timestamp": 0.0,
        "width": 0,
        "height": 0,
        "message": "",
        "radar": {"x": 0.0, "y": 0.0, "speed": 0.0},
        "detections": [],
        "generation": -1,
    }
    # Fall events are sparse but must not be discarded just because a second
    # person triggers while a snapshot or a slow dashboard is being handled.
    # Keep this queue bounded because each event can carry one JPEG snapshot.
    alert_q = mp.Queue(maxsize=16)
    shutdown_flag = mp.Value('i', 0)
    last_camera_frame_at = mp.Value('d', 0.0)
    camera_source_ref = mp.Array('u', 1024)
    camera_source_ref.get_obj().value = VIDEO_SOURCE
    camera_generation_ref = mp.Value('L', 0)
    camera_metrics_ref = mp.Array('d', 8)
    ai_metrics_ref = mp.Array('d', 11)
    ai_target_fps_ref = mp.Value('d', float(AI_INITIAL_FPS))
    
    p_cam = mp.Process(target=camera_process, args=(raw_q, preview_q, last_camera_frame_at,
                                                    camera_source_ref, camera_generation_ref,
                                                    camera_metrics_ref, ai_target_fps_ref,
                                                    shutdown_flag))
    p_cam.daemon = True
    p_ai = mp.Process(target=ai_process, args=(raw_q, mjpeg_q, alert_q,
                                                camera_generation_ref, ai_metrics_ref,
                                                ai_target_fps_ref,
                                                shutdown_flag, ai_overlay_q))
    p_ai.daemon = True
    p_cam.start()
    p_ai.start()
    video_pump = asyncio.create_task(pump_video_frames())
    alert_pump = asyncio.create_task(pump_alert_events())
    
    # Khởi động Watchdog ở luồng nền của FastAPI
    threading.Thread(target=watchdog_task, daemon=True).start()

    # Maintain one MQTT connection for all web control commands.
    try:
        import paho.mqtt.client as mqtt
        if not os.getenv("MQTT_BROKER"):
            logger.warning("MQTT_BROKER is not configured; set it in backend/.env on this PC instead of relying on the legacy default")
        logger.info("Control MQTT broker target: %s:1883; servo protocol=%s", CONTROL_MQTT_BROKER, SERVO_PROTOCOL)
        control_id = f"FallGuard_Web_{socket.gethostname()[:16]}_{os.getpid()}"
        control_mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=control_id)
        control_mqtt_client.max_queued_messages_set(32)
        control_mqtt_client.max_inflight_messages_set(8)
        control_mqtt_client.on_socket_open = on_control_socket_open
        control_mqtt_client.on_connect = on_control_mqtt_connect
        control_mqtt_client.on_disconnect = on_control_mqtt_disconnect
        control_mqtt_client.on_message = on_control_mqtt_message
        control_mqtt_client.connect_async(CONTROL_MQTT_BROKER, 1883, 30)
        control_mqtt_client.loop_start()
    except Exception as e:
        control_mqtt_client = None
        logger.warning("Control MQTT startup failed: %s", e)
    
    yield
    
    logger.info("Shutting down Distributed System...")
    shutdown_flag.value = 1
    control_mqtt_connected.clear()
    if control_mqtt_client is not None:
        control_mqtt_client.disconnect()
        control_mqtt_client.loop_stop()
        control_mqtt_client = None
    video_pump.cancel()
    alert_pump.cancel()
    try:
        await video_pump
    except asyncio.CancelledError:
        pass
    try:
        await alert_pump
    except asyncio.CancelledError:
        pass
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

async def video_frame_generator(preview: bool = False) -> AsyncGenerator[bytes, None]:
    global active_live_viewers, active_ai_viewers
    last_version = -1
    if preview:
        active_live_viewers += 1
    else:
        active_ai_viewers += 1
    try:
        while True:
            if camera_source_ref is not None:
                with camera_source_ref.get_lock():
                    frame = latest_preview_bytes if preview else latest_mjpeg_bytes
                    version = preview_frame_version if preview else ai_frame_version
            else:
                frame = latest_preview_bytes if preview else latest_mjpeg_bytes
                version = preview_frame_version if preview else ai_frame_version
            if frame and version != last_version:
                last_version = version
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n'
                       + f'Content-Length: {len(frame)}\r\n\r\n'.encode()
                       + frame + b'\r\n')
            await asyncio.sleep(0.015)
    finally:
        if preview:
            active_live_viewers -= 1
        else:
            active_ai_viewers -= 1


VIDEO_STREAM_HEADERS = {"Cache-Control": "no-store", "X-Accel-Buffering": "no"}

@app.get("/api/v1/video/stream")
async def video_feed() -> StreamingResponse:
    return StreamingResponse(video_frame_generator(), media_type="multipart/x-mixed-replace; boundary=frame", headers=VIDEO_STREAM_HEADERS)


@app.get("/api/v1/video/live")
async def video_live() -> StreamingResponse:
    return StreamingResponse(video_frame_generator(preview=True), media_type="multipart/x-mixed-replace; boundary=frame", headers=VIDEO_STREAM_HEADERS)


@app.get("/api/v1/video/detections")
def video_detections():
    """Return only the latest lightweight AI boxes for the raw dashboard video."""
    snapshot = latest_ai_overlay
    now = time.time()
    timestamp = float(snapshot.get("timestamp", 0.0))
    age_ms = max(0.0, (now - timestamp) * 1000.0) if timestamp else None
    if camera_source_ref is not None:
        with camera_source_ref.get_lock():
            current_generation = camera_generation_ref.value
    else:
        current_generation = 0
    fresh = (
        timestamp > 0.0
        and snapshot.get("generation") == current_generation
        and age_ms is not None
        and age_ms <= 1500.0
        and p_ai is not None
        and p_ai.is_alive()
    )
    return {
        "status": "success",
        "fresh": fresh,
        "timestamp": timestamp if fresh else None,
        "age_ms": round(age_ms, 1) if age_ms is not None else None,
        "width": int(snapshot.get("width", 0)) if fresh else 0,
        "height": int(snapshot.get("height", 0)) if fresh else 0,
        "message": snapshot.get("message", "") if fresh else "",
        "radar": snapshot.get("radar", {"x": 0.0, "y": 0.0, "speed": 0.0}) if fresh else None,
        "detections": snapshot.get("detections", []) if fresh else [],
    }


@app.get("/api/v1/video/status")
def video_status():
    if camera_source_ref is not None:
        with camera_source_ref.get_lock():
            source = camera_source_ref.get_obj().value
            generation = camera_generation_ref.value
            last_frame = last_camera_frame_at.value
            last_ai_frame = last_ai_frame_at
    else:
        source, generation = VIDEO_SOURCE, 0
        last_frame, last_ai_frame = 0.0, 0.0
    now = time.time()
    age_seconds = max(0.0, now - last_frame) if last_frame else None
    ai_age_seconds = max(0.0, now - last_ai_frame) if last_ai_frame else None
    raw_online = age_seconds is not None and age_seconds < 3.0
    ai_online = ai_age_seconds is not None and ai_age_seconds < 3.0
    overlay_snapshot = latest_ai_overlay
    overlay_timestamp = float(overlay_snapshot.get("timestamp", 0.0))
    overlay_age_ms = max(0.0, (now - overlay_timestamp) * 1000.0) if overlay_timestamp else None
    overlay_fresh = (
        overlay_timestamp > 0.0
        and overlay_snapshot.get("generation") == generation
        and overlay_age_ms is not None
        and overlay_age_ms <= 1500.0
        and p_ai is not None
        and p_ai.is_alive()
    )
    overlay_detections = overlay_snapshot.get("detections", []) if overlay_fresh else []
    camera_metrics = [0.0] * 8
    ai_metrics = [0.0] * 11
    if camera_metrics_ref is not None:
        with camera_metrics_ref.get_lock():
            camera_metrics = list(camera_metrics_ref[:])
    if ai_metrics_ref is not None:
        with ai_metrics_ref.get_lock():
            ai_metrics = list(ai_metrics_ref[:])
    return {
        "status": "success",
        "online": raw_online,
        "age_seconds": round(age_seconds, 2) if age_seconds is not None else None,
        "ai_online": ai_online,
        "ai_age_seconds": round(ai_age_seconds, 2) if ai_age_seconds is not None else None,
        "camera_worker_alive": p_cam is not None and p_cam.is_alive(),
        "ai_worker_alive": p_ai is not None and p_ai.is_alive(),
        "ai_model": Path(POSE_MODEL_PATH).name,
        "ai_overlay_fresh": overlay_fresh,
        "ai_overlay_age_ms": round(overlay_age_ms, 1) if overlay_age_ms is not None else None,
        "ai_detection_count": len(overlay_detections),
        "ai_fall_states": [item.get("fall_state", "TRACKING") for item in overlay_detections],
        "raw_fps": round(camera_metrics[CAM_FPS], 1) if raw_online else 0.0,
        "ai_decode_fps": round(camera_metrics[CAM_AI_DECODE_FPS], 1) if raw_online else 0.0,
        "raw_kBps": round(camera_metrics[CAM_KBPS], 1) if raw_online else 0.0,
        "jpeg_kB": round(camera_metrics[CAM_JPEG_KB], 1),
        "decode_ms": round(camera_metrics[CAM_DECODE_MS], 1),
        "preview_dropped": int(camera_metrics[CAM_PREVIEW_DROPS]),
        "ai_input_dropped": int(camera_metrics[CAM_AI_INPUT_DROPS]),
        "camera_reconnects": int(camera_metrics[CAM_RECONNECTS]),
        "ai_fps": round(ai_metrics[AI_FPS], 1) if ai_online else 0.0,
        "ai_target_fps": round(ai_target_fps_ref.value, 1) if ai_target_fps_ref is not None else float(AI_INITIAL_FPS),
        "ai_limit_fps": AI_FPS_LIMIT,
        "ai_work_ms": round(ai_metrics[AI_WORK_MS], 1),
        "inference_ms": round(ai_metrics[AI_INFER_MS], 1),
        "encode_ms": round(ai_metrics[AI_ENCODE_MS], 1),
        "pipeline_ms": round(ai_metrics[AI_PIPELINE_MS], 1),
        "ai_output_dropped": int(ai_metrics[AI_OUTPUT_DROPS]),
        "radar_age_seconds": round(max(0.0, now - ai_metrics[AI_LAST_RADAR_AT]), 2) if ai_metrics[AI_LAST_RADAR_AT] else None,
        "radar_parse_errors": int(ai_metrics[AI_RADAR_ERRORS]),
        "preview_frame_version": preview_frame_version,
        "ai_frame_version": ai_frame_version,
        "live_viewers": active_live_viewers,
        "ai_viewers": active_ai_viewers,
        "source": source,
        "generation": generation,
    }


class CameraIpRequest(BaseModel):
    camera_ip: str


@app.get("/api/v1/config/camera")
def get_camera_config():
    if camera_source_ref is not None:
        with camera_source_ref.get_lock():
            source = camera_source_ref.get_obj().value
            generation = camera_generation_ref.value
    else:
        source, generation = VIDEO_SOURCE, 0
    return {"status": "success", "camera_ip": urlsplit(source).hostname,
            "source": source, "generation": generation}


@app.post("/api/v1/config/camera")
def update_camera_config(request: CameraIpRequest):
    global VIDEO_SOURCE, latest_preview_bytes, latest_mjpeg_bytes
    global preview_frame_version, ai_frame_version, last_ai_frame_at
    try:
        address = ipaddress.IPv4Address(request.camera_ip.strip())
    except ipaddress.AddressValueError:
        return {"status": "error", "message": "Camera IP must be an IPv4 address"}
    local_networks = (
        ipaddress.IPv4Network("10.0.0.0/8"),
        ipaddress.IPv4Network("172.16.0.0/12"),
        ipaddress.IPv4Network("192.168.0.0/16"),
    )
    if not any(address in network for network in local_networks):
        return {"status": "error", "message": "Camera IP must be on a private LAN"}

    source = f"http://{address}:81/stream"
    with camera_config_update_lock:
        try:
            saved, _, _ = set_key(str(Path(__file__).with_name(".env")), "VIDEO_SOURCE", source, quote_mode="never")
            if not saved:
                raise OSError("dotenv.set_key failed")
        except Exception as e:
            logger.error("Could not save camera source: %s", e)
            return {"status": "error", "message": "Could not save camera source"}

        VIDEO_SOURCE = source
        if camera_source_ref is not None:
            with camera_source_ref.get_lock():
                camera_source_ref.get_obj().value = source
                with camera_generation_ref.get_lock():
                    camera_generation_ref.value += 1
                    generation = camera_generation_ref.value
                # The pump and readers share this lock, so old JPEGs cannot
                # repopulate the preview cache after a source switch.
                latest_preview_bytes = b""
                latest_mjpeg_bytes = b""
                last_ai_frame_at = 0.0
                preview_frame_version += 1
                ai_frame_version += 1
                if last_camera_frame_at is not None:
                    with last_camera_frame_at.get_lock():
                        last_camera_frame_at.value = 0.0
                if camera_metrics_ref is not None:
                    with camera_metrics_ref.get_lock():
                        for metric in (CAM_FPS, CAM_KBPS, CAM_JPEG_KB, CAM_DECODE_MS):
                            camera_metrics_ref[metric] = 0.0
                if ai_metrics_ref is not None:
                    with ai_metrics_ref.get_lock():
                        for metric in (AI_FPS, AI_INFER_MS, AI_ENCODE_MS, AI_PIPELINE_MS):
                            ai_metrics_ref[metric] = 0.0
        else:
            generation = 0
        for frame_q in (preview_q, raw_q, mjpeg_q, alert_q):
            if frame_q is None:
                continue
            while True:
                try:
                    frame_q.get_nowait()
                except queue.Empty:
                    break
    logger.info("Camera source changed to %s (generation %s)", source, generation)
    return {"status": "success", "camera_ip": str(address), "source": source,
            "generation": generation}

@app.get("/api/v1/radar/status")
def get_radar_status_api():
    """Return the newest radar point and the zone classification used by the backend."""
    now = time.time()
    if ai_metrics_ref is None:
        return {
            "status": "success", "online": False, "age_seconds": None,
            "zone_state": "WAITING", "zone_name": None, "data": None,
            "safe_zone_count": 0, "danger_zone_count": 0,
        }

    with ai_metrics_ref.get_lock():
        metrics = list(ai_metrics_ref[:])
    timestamp = metrics[AI_LAST_RADAR_AT]
    age = max(0.0, now - timestamp) if timestamp else None
    online = age is not None and age <= 5.0
    data = None
    zone_state = "WAITING" if timestamp == 0.0 else "STALE"
    zone_name = None
    safe_zones = []
    danger_zones = []

    try:
        from database import get_all_zones
        all_zones = get_all_zones()
        safe_zones = [zone for zone in all_zones if zone["type"] == "SAFE"]
        danger_zones = [zone for zone in all_zones if zone["type"] == "DANGER"]
    except Exception as exc:
        logger.warning("Could not load radar zones for live status: %s", exc)

    if timestamp:
        point_x = metrics[AI_RADAR_X]
        point_y = metrics[AI_RADAR_Y]
        point_speed = metrics[AI_RADAR_SPEED]
        data = {
            "timestamp": timestamp,
            "pos_x": point_x,
            "pos_y": point_y,
            "speed": point_speed,
        }
        if online:
            danger_zone = next((zone for zone in danger_zones
                                if point_in_zone(point_x, point_y, zone)), None)
            safe_zone = next((zone for zone in safe_zones
                              if point_in_zone(point_x, point_y, zone)), None)
            if danger_zone:
                zone_state = "DANGER"
                zone_name = danger_zone.get("name") or "Danger zone"
            elif safe_zone:
                zone_state = "SAFE"
                zone_name = safe_zone.get("name") or "Safe zone"
            else:
                zone_state = "OUTSIDE"

    return {
        "status": "success",
        "online": online,
        "age_seconds": round(age, 2) if age is not None else None,
        "zone_state": zone_state,
        "zone_name": zone_name,
        "safe_zone_count": len(safe_zones),
        "danger_zone_count": len(danger_zones),
        "data": data,
    }


@app.get("/api/v1/radar/history")
async def get_radar_history(limit: int = 50):
    import sqlite3
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('SELECT timestamp, pos_x, pos_y, speed FROM radar_logs ORDER BY timestamp DESC LIMIT ?', (limit,))
        rows = c.fetchall()
        conn.close()
        data = [{"timestamp": r[0], "pos_x": r[1], "pos_y": r[2], "speed": r[3]} for r in rows[::-1]]
        return {"status": "success", "data": data}
    except Exception as e:
        return {"status": "error", "message": str(e)}

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



# --- CAMERA MANUAL CONTROL API ---
class CameraMoveRequest(BaseModel):
    direction: str = Field(min_length=1, max_length=16)
    session_id: str | None = Field(default=None, min_length=1, max_length=64)
    seq: int | None = Field(default=None, ge=0, le=9007199254740991)


class ServoConfigRequest(BaseModel):
    key: str
    value: str | int | float | None = None


SERVO_CONFIG_ACTIONS = {"STATUS", "HELP", "TEST_PAN", "TEST_TILT", "CENTER", "DEFAULTS"}
SERVO_CONFIG_INT_RANGES = {
    "PAN_MIN": (0, 159), "PAN_MAX": (0, 159),
    "TILT_MIN": (0, 159), "TILT_MAX": (0, 159),
    "PAN_CENTER": (0, 159), "TILT_CENTER": (0, 159),
    "PAN_DIR": (-1, 1), "TILT_DIR": (-1, 1),
    "CAMERA_HEIGHT_MM": (0, 4000), "TARGET_HEIGHT_MM": (0, 4000),
}
SERVO_CONFIG_FLOAT_RANGES = {
    "PAN_OFFSET": (-45.0, 45.0), "TILT_OFFSET": (-45.0, 45.0),
    "SPEED_DPS": (30.0, 300.0), "RADAR_ALPHA": (0.05, 1.0),
}


@app.get("/api/v1/servo/diag")
def get_servo_diagnostics():
    if SERVO_PROTOCOL == "legacy_step":
        # Retained r3/r5 messages may still exist on this broker. They cannot
        # prove the supplied firmware's current connection, mode or angles.
        return {"status": "success", "control_protocol": SERVO_PROTOCOL,
                "capabilities": capabilities(SERVO_PROTOCOL),
                "online": None, "hardware_mode": None, "fresh": False,
                "mqtt_connected": control_mqtt_connected.is_set(),
                "mqtt_broker": CONTROL_MQTT_BROKER, "age_seconds": None,
                "data": None, "config": None, "last_config_result": None,
                "last_config_result_at": None, "device_health": {"state": "UNVERIFIED"}}
    with servo_diag_lock:
        data = servo_diag_payload.copy() if servo_diag_payload is not None else None
        received_at = servo_diag_received_at
        config = servo_config_state.copy() if servo_config_state is not None else None
        result = servo_config_result
        result_at = servo_config_result_at
    age = max(0.0, time.time() - received_at) if received_at else None
    fresh = hardware_online and age is not None and age < 5.0
    device_health = {
        "state": "LIVE" if fresh else ("STALE" if hardware_online else "OFFLINE"),
        "boot_reset_reason": data.get("boot_reset_reason") if data else None,
        "boot_reset_stage": data.get("boot_reset_stage") if data else None,
        "task_wdt_count": data.get("task_wdt_count") if data else None,
        "slow_loop_stage": data.get("slow_loop_stage") if data else None,
        "slow_loop_stage_ms": data.get("slow_loop_stage_ms") if data else None,
        "mqtt_connect_ms": data.get("mqtt_connect_ms") if data else None,
        "mqtt_reconnect_failures": data.get("mqtt_reconnect_failures") if data else None,
        **{key: data.get(key) if data else None for key in (
            "uptime_ms", "free_heap", "min_free_heap", "largest_free_block",
            "loop_stack_free", "network_stack_free", "rx_dropped", "tx_dropped",
            "log_dropped", "boot_network_stage", "hold_timeout_ms",
        )},
    }
    return {
        "status": "success", "online": hardware_online,
        "control_protocol": SERVO_PROTOCOL, "capabilities": capabilities(SERVO_PROTOCOL),
        "hardware_mode": hardware_mode if hardware_online else None,
        "mqtt_connected": control_mqtt_connected.is_set(),
        "mqtt_broker": CONTROL_MQTT_BROKER,
        "fresh": fresh,
        "age_seconds": round(age, 2) if age is not None else None,
        "data": data,
        "device_health": device_health,
        "config": config,
        "last_config_result": result,
        "last_config_result_at": result_at if result_at else None,
    }


@app.post("/api/v1/servo/config")
def set_servo_config(req: ServoConfigRequest):
    global servo_config_result
    if SERVO_PROTOCOL == "legacy_step":
        return {"status": "error", "error_code": "FIRMWARE_UNSUPPORTED",
                "message": "Firmware legacy_step không hỗ trợ cấu hình qua MQTT; sửa trong sketch và nạp lại."}
    key = req.key.strip().upper()
    if key in SERVO_CONFIG_ACTIONS:
        if req.value is not None:
            return {"status": "error", "message": f"{key} takes no value"}
        command = key
    elif key == "LOST_ACTION":
        value = str(req.value).strip().upper() if req.value is not None else ""
        if value not in ("HOLD", "CENTER"):
            return {"status": "error", "message": "LOST_ACTION must be HOLD or CENTER"}
        command = f"{key}={value}"
    elif key in SERVO_CONFIG_INT_RANGES or key in SERVO_CONFIG_FLOAT_RANGES:
        try:
            value = float(str(req.value).strip())
        except (TypeError, ValueError):
            return {"status": "error", "message": f"{key} needs a number"}
        if not math.isfinite(value):
            return {"status": "error", "message": f"{key} needs a finite number"}
        if key in SERVO_CONFIG_INT_RANGES:
            minimum, maximum = SERVO_CONFIG_INT_RANGES[key]
            if not value.is_integer() or not minimum <= value <= maximum:
                return {"status": "error", "message": f"{key} must be an integer from {minimum} to {maximum}"}
            if key in ("PAN_DIR", "TILT_DIR") and value not in (-1, 1):
                return {"status": "error", "message": f"{key} must be -1 or 1"}
            rendered = str(int(value))
        else:
            minimum, maximum = SERVO_CONFIG_FLOAT_RANGES[key]
            if not minimum <= value <= maximum:
                return {"status": "error", "message": f"{key} must be from {minimum} to {maximum}"}
            rendered = f"{value:.3f}".rstrip("0").rstrip(".")
        command = f"{key}={rendered}"
    else:
        return {"status": "error", "message": "Unsupported servo config key"}

    with servo_config_request_lock:
        # Only this short section shares the control lock with joystick moves.
        with control_mqtt_lock:
            if key not in ("STATUS", "HELP") and (camera_mode != "MANUAL" or not hardware_online or hardware_mode != "MANUAL"):
                return {"status": "error", "message": "Confirm ESP32 is online and in MANUAL mode first"}
            if not control_mqtt_connected.is_set() or control_mqtt_client is None:
                return {"status": "error", "message": "Control MQTT is disconnected"}
            try:
                with servo_diag_lock:
                    servo_config_result = None
                    servo_config_result_event.clear()
                info = control_mqtt_client.publish("embedded/servo/config", command, qos=1)
                if info.rc != 0:
                    return {"status": "error", "message": f"MQTT publish failed ({info.rc})"}
            except Exception as e:
                logger.error("[SERVO-CONFIG] MQTT publish failed: %s", e)
                return {"status": "error", "message": "MQTT publish failed"}
        try:
            info.wait_for_publish(timeout=1.5)
            if not info.is_published():
                return {"status": "error", "message": "MQTT broker did not acknowledge config command"}
        except Exception as e:
            logger.error("[SERVO-CONFIG] MQTT acknowledgement failed: %s", e)
            return {"status": "error", "message": "MQTT acknowledgement failed"}
        confirmed = servo_config_result_event.wait(timeout=2.0)
        with servo_diag_lock:
            result = servo_config_result if confirmed else None
    logger.info("[SERVO-CONFIG] Queued %s", command)
    if result is None:
        return {"status": "pending", "command": command,
                "broker_acknowledged": True, "message": "ESP32 confirmation timed out; check /api/v1/servo/diag"}
    if result.startswith("ERR:"):
        # The firmware's ERR payload has no command/request ID. It could be a
        # late response to another MQTT client's command, so never claim that
        # this particular request was rejected or applied based on ERR alone.
        return {"status": "pending", "command": command, "broker_acknowledged": True,
                "device_result": result,
                "message": "ESP32 reported an error without a command ID; check /api/v1/servo/diag"}
    expected = f"OK:{command}"
    if "=" in command:
        # Value commands must match the entire echo: PAN_DIR=1 and
        # PAN_DIR=-1 are different requests even though they share a key.
        matched = result.strip().upper() == expected.upper()
    else:
        confirmed_payload = result.partition(":")[2].strip().upper()
        matched = result.startswith("OK:") and (
            confirmed_payload == key or confirmed_payload.startswith(f"{key} ")
        )
    if not matched:
        return {"status": "pending", "command": command,
                "broker_acknowledged": True, "device_result": result,
                "message": "Received a different config result; check /api/v1/servo/diag"}
    return {"status": "success", "command": command,
            "broker_acknowledged": True, "device_result": result,
            "applied_by_esp32": True}


@app.get("/api/v1/camera/mode")
def get_camera_mode():
    """Trả về chế độ hiện tại để Frontend đồng bộ khi tải trang."""
    return {
        "status": "success",
        "mode": camera_mode,
        "control_protocol": SERVO_PROTOCOL, "capabilities": capabilities(SERVO_PROTOCOL),
        "hardware_mode": hardware_mode if hardware_online and SERVO_PROTOCOL == "sequenced_hold" else None,
        "hardware_online": hardware_online if SERVO_PROTOCOL == "sequenced_hold" else None,
        "mqtt_connected": control_mqtt_connected.is_set(),
    }


@app.post("/api/v1/camera/mode")
def set_camera_mode(mode: str):
    global camera_mode
    if mode not in ("AUTO", "MANUAL"):
        return {"status": "error", "message": "Invalid mode. Use AUTO or MANUAL"}

    # Mode changes serialize with one another, never with a slow STOP ACK.
    with camera_mode_request_lock:
        with control_mqtt_lock:
            if not control_mqtt_connected.is_set() or control_mqtt_client is None:
                return {"status": "error", "message": "Control MQTT is disconnected"}
            try:
                info = control_mqtt_client.publish("embedded/servo/mode", mode, qos=1, retain=True)
                if info.rc != 0:
                    return {"status": "error", "message": f"MQTT publish failed ({info.rc})"}
                camera_mode = mode
            except Exception as e:
                logger.error("[MODE] MQTT publish failed: %s", e)
                return {"status": "error", "message": "MQTT publish failed"}
        try:
            info.wait_for_publish(timeout=1.5)
            if not info.is_published():
                return {"status": "error", "message": "MQTT broker did not acknowledge the mode command"}
        except Exception as e:
            logger.error("[MODE] MQTT acknowledgement failed: %s", e)
            return {"status": "error", "message": "MQTT acknowledgement failed"}
        logger.info("[MODE] Sent MQTT servo mode: %s", mode)
        try:
            with open("camera_mode.txt", "w") as f:
                f.write(mode)
        except OSError as e:
            logger.warning("[MODE] Could not persist camera_mode.txt: %s", e)
        return {"status": "success", "mode": mode,
                "control_protocol": SERVO_PROTOCOL, "capabilities": capabilities(SERVO_PROTOCOL),
                "broker_acknowledged": True,
                "hardware_mode": hardware_mode if hardware_online and SERVO_PROTOCOL == "sequenced_hold" else None,
                "hardware_online": hardware_online if SERVO_PROTOCOL == "sequenced_hold" else None}


@app.post("/api/v1/camera/move")
def move_camera(req: CameraMoveRequest):
    global manual_command_sequence, legacy_last_move_at
    request_started = time.perf_counter()
    direction = req.direction.strip().upper()
    if direction not in ("UP", "DOWN", "LEFT", "RIGHT", "RESET", "STOP",
                         "HOLD_UP", "HOLD_DOWN", "HOLD_LEFT", "HOLD_RIGHT"):
        return {"status": "error", "message": "Invalid direction"}
    if (req.session_id is None) != (req.seq is None):
        return {"status": "error", "message": "session_id and seq must be supplied together"}
    legacy = SERVO_PROTOCOL == "legacy_step"
    if legacy and direction not in STEP_COMMANDS:
        return {"status": "error", "error_code": "FIRMWARE_UNSUPPORTED",
                "message": "Firmware legacy_step chỉ nhận LEFT/RIGHT/UP/DOWN/RESET. Tải lại dashboard để dùng nút từng bước."}
    with control_mqtt_lock:
        if camera_mode != "MANUAL" and direction != "STOP":
            return {"status": "error", "error_code": "UI_MODE_MISMATCH",
                    "message": "Must be in MANUAL mode"}
        if not control_mqtt_connected.is_set() or control_mqtt_client is None:
            return {"status": "error", "error_code": "MQTT_DISCONNECTED",
                    "message": f"MQTT broker disconnected: {CONTROL_MQTT_BROKER}:1883"}
        # A successful publish only confirms delivery to the broker. Do not
        # report a movement as successful when the ESP32 has disappeared.
        # Always allow STOP to be published as a safety command.
        if direction != "STOP" and not legacy:
            with servo_diag_lock:
                last_servo_diag = servo_diag_received_at
            diag_age = max(0.0, time.time() - last_servo_diag) if last_servo_diag else None
            if not hardware_online:
                return {"status": "error", "error_code": "SERVO_OFFLINE",
                        "message": "ESP32 servo is offline; check /api/v1/servo/diag",
                        "mqtt_broker": CONTROL_MQTT_BROKER}
            if diag_age is None or diag_age >= 5.0:
                return {"status": "error", "error_code": "SERVO_DIAG_STALE",
                        "message": "ESP32 servo diagnostics are stale; check /api/v1/servo/diag",
                        "age_seconds": round(diag_age, 2) if diag_age is not None else None,
                        "mqtt_broker": CONTROL_MQTT_BROKER}
            if hardware_mode != "MANUAL":
                return {"status": "error", "error_code": "SERVO_MODE_MISMATCH",
                        "message": "ESP32 has not confirmed MANUAL mode"}
        sequenced_request = req.session_id is not None and req.seq is not None
        if sequenced_request:
            if not req.session_id or len(req.session_id) > 64 or req.seq < 0:
                return {"status": "error", "message": "Invalid move sequence"}
            if req.seq <= manual_last_sequence.get(req.session_id, -1):
                return {"status": "success", "ignored": True}
        if legacy and time.monotonic() - legacy_last_move_at < LEGACY_STEP_INTERVAL:
            return {"status": "error", "error_code": "MOVE_RATE_LIMIT",
                    "message": "Nhấn quá nhanh; lệnh này đã bị bỏ. Chờ một nhịp rồi nhấn lại."}
        try:
            manual_command_sequence += 1
            command = direction if legacy else f"@{manual_command_epoch}:{manual_command_sequence}:{direction}"
            # A release command must reach the broker even if Wi-Fi is busy.
            info = control_mqtt_client.publish("embedded/servo/manual", command, qos=1 if direction == "STOP" else 0)
            if info.rc != 0:
                return {"status": "error", "message": f"MQTT publish failed ({info.rc})"}
            if legacy:
                legacy_last_move_at = time.monotonic()
            # Commit the sequence once Paho accepted the packet. Do this before
            # waiting for ACK so delayed HOLD packets cannot overtake STOP.
            if sequenced_request:
                manual_last_sequence[req.session_id] = req.seq
                if len(manual_last_sequence) > 128:
                    manual_last_sequence.pop(next(iter(manual_last_sequence)))
        except Exception as e:
            logger.error("[MOVE] MQTT publish failed: %s", e)
            return {"status": "error", "message": "MQTT publish failed"}
    # ACK waiting must never own control_mqtt_lock: a slow STOP previously
    # held up every later gesture, mode change and calibration command.
    if direction == "STOP":
        try:
            info.wait_for_publish(timeout=1.0)
            if not info.is_published():
                return {"status": "error", "message": "MQTT broker did not acknowledge STOP"}
        except Exception as e:
            logger.warning("[MOVE] STOP acknowledgement failed: %s", e)
            return {"status": "error", "message": "MQTT STOP acknowledgement failed"}
    dispatch_ms = (time.perf_counter() - request_started) * 1000.0
    if dispatch_ms >= 150.0:
        logger.warning("[MOVE-LATENCY] command=%s HTTP-to-MQTT=%.0fms", direction, dispatch_ms)
    if legacy:
        logger.info("[MOVE-LEGACY] command=%s dispatched_ms=%.1f device_confirmation=unsupported", direction, dispatch_ms)
    return {"status": "success", "dispatch_ms": round(dispatch_ms, 1),
            "control_protocol": SERVO_PROTOCOL, "device_confirmed": False}

@app.websocket("/api/v1/ws/alerts")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    alert_websockets[websocket] = asyncio.Lock()
    logger.info("Web Dashboard connected.")
    reported_worker_fault = False
    last_keepalive = time.monotonic()

    try:
        while True:
            # The connection sends status transitions and an occasional
            # keepalive. The independent alert consumer broadcasts fall events.
            if time.monotonic() - last_keepalive >= 30.0:
                if not await send_alert_websocket_message(websocket, {"type": "SYSTEM_HEARTBEAT"}):
                    break
                last_keepalive = time.monotonic()

            if not p_cam.is_alive() or not p_ai.is_alive():
                if not reported_worker_fault:
                    sent = await send_alert_websocket_message(websocket, {
                        "type": "SYSTEM_ERROR",
                        "event_code": "SENSOR_DISCONNECTED",
                        "message": "Camera or AI worker stopped; watchdog is restarting it.",
                    })
                    if not sent:
                        break
                    reported_worker_fault = True
                await asyncio.sleep(2.0)
                continue

            if reported_worker_fault:
                if not await send_alert_websocket_message(websocket, {"type": "SYSTEM_OK"}):
                    break
                reported_worker_fault = False
            await asyncio.sleep(0.2)
    except WebSocketDisconnect:
        pass
    finally:
        alert_websockets.pop(websocket, None)

if __name__ == "__main__":
    mp.freeze_support()
    # Uvicorn binds after FastAPI startup; fail early so a second backend
    # cannot start expensive camera/OpenVINO workers before discovering that
    # the first backend already owns port 8000.
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as port_probe:
            port_probe.bind(("0.0.0.0", 8000))
    except OSError as e:
        logger.error("Port 8000 is already in use. Stop the existing backend before starting another: %s", e)
        raise SystemExit(1) from e
    # Holding the joystick produces about 10 requests/s. Routine access logs
    # add avoidable console I/O on Windows; stage diagnostics remain enabled.
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False,
                ws="auto", access_log=False)
