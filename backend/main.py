"""
Module: Vision Feedback & Fall Detection API (YOLO-Pose Edition)
Description: FastAPI backend for computer vision processing and pose estimation.
"""

import asyncio
import logging
import threading
import time
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import cv2
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from ultralytics import YOLO

# Logging Configuration
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Configuration Constants
VIDEO_SOURCE: int = 0  
FALL_DURATION_THRESHOLD_SEC: float = 1.5

# Global State Management
global_state = {
    "latest_frame": None,
    "is_falling": False,
    "fall_start_time": 0.0
}

# Quản lý luồng tắt an toàn (Graceful Shutdown)
shutdown_event = threading.Event()

# Khởi tạo Camera ở luồng chính (Main Thread)
cap = cv2.VideoCapture(VIDEO_SOURCE)
if not cap.isOpened():
    logger.error("Failed to initialize video capture device.")

def process_video_stream() -> None:
    """
    Background Thread handling frame acquisition and AI processing via YOLO.
    """
    if not cap.isOpened():
        return

    logger.info("Loading YOLO model...")
    pose_estimator = YOLO("yolov8n-pose.pt")
    logger.info("Vision processing thread initialized successfully.")

    # Sử dụng cờ shutdown_event để thoát vòng lặp an toàn khi nhấn Ctrl+C
    while not shutdown_event.is_set():
        ret, frame = cap.read()
        if not ret:
            logger.warning("Frame acquisition failed. Retrying...")
            time.sleep(0.1)
            continue

        results = pose_estimator(frame, verbose=False)
        annotated_frame = results[0].plot()

        if len(results) > 0 and results[0].keypoints is not None and len(results[0].keypoints.xy) > 0:
            keypoints = results[0].keypoints.xy[0] 
            
            if len(keypoints) >= 15:
                nose_y = keypoints[0][1].item()
                left_knee_y = keypoints[13][1].item()
                right_knee_y = keypoints[14][1].item()

                if nose_y > 0 and left_knee_y > 0 and right_knee_y > 0:
                    avg_knee_y = (left_knee_y + right_knee_y) / 2.0

                    if nose_y > avg_knee_y:
                        if not global_state["is_falling"]:
                            global_state["is_falling"] = True
                            global_state["fall_start_time"] = time.time()
                        elif (time.time() - global_state["fall_start_time"]) > FALL_DURATION_THRESHOLD_SEC:
                            cv2.putText(
                                annotated_frame, 
                                "WARNING: FALL EVENT DETECTED", 
                                (30, 50), 
                                cv2.FONT_HERSHEY_SIMPLEX, 
                                1.0, 
                                (0, 0, 255), 
                                2
                            )
                    else:
                        global_state["is_falling"] = False
                        global_state["fall_start_time"] = 0.0

        success, buffer = cv2.imencode('.jpg', annotated_frame)
        if success:
            global_state["latest_frame"] = buffer.tobytes()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Quản lý vòng đời của ứng dụng, đảm bảo nhả tài nguyên Camera khi thoát"""
    video_thread = threading.Thread(target=process_video_stream, daemon=True)
    video_thread.start()
    yield
    logger.info("Shutting down... Releasing camera hardware.")
    shutdown_event.set()
    if cap.isOpened():
        cap.release()

app = FastAPI(title="Vision Feedback Server", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def video_frame_generator() -> AsyncGenerator[bytes, None]:
    while True:
        frame = global_state.get("latest_frame")
        if frame is not None:
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
        await asyncio.sleep(0.033)

@app.get("/api/v1/video/stream")
async def video_feed() -> StreamingResponse:
    return StreamingResponse(
        video_frame_generator(), 
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

@app.websocket("/api/v1/ws/alerts")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    logger.info("Client successfully connected to WebSocket.")
    try:
        while True:
            is_falling = global_state.get("is_falling", False)
            start_time = global_state.get("fall_start_time", 0.0)
            
            if is_falling and (time.time() - start_time > FALL_DURATION_THRESHOLD_SEC):
                alert_payload = {
                    "type": "CRITICAL_ALERT",
                    "event_code": "FALL_DETECTED",
                    "message": "Critical Alert: Fall behavior detected.",
                    "timestamp": time.time()
                }
                await websocket.send_json(alert_payload)
                await asyncio.sleep(2.0)
            
            await asyncio.sleep(0.2)
    except WebSocketDisconnect:
        logger.info("Client disconnected from WebSocket.")
    except Exception as e:
        logger.error(f"WebSocket protocol error: {e}")

if __name__ == "__main__":
    # Ép buộc sử dụng thư viện websockets gốc thay vì tự động nhận diện
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False, ws="websockets")
