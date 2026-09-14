# Hướng dẫn Khởi chạy Dự án: Hệ thống Giám sát & Bám sát Mục tiêu


## 1. Yêu cầu Nền tảng 
- **Python:** Phiên bản 3.10 trở lên.
- **Node.js:** Phiên bản LTS (v20.x trở lên).

## 2. Thiết lập Đặc quyền Thực thi (Dành riêng cho Windows PowerShell)
Nếu gặp lỗi `cannot be loaded because running scripts is disabled`, hãy chạy lệnh sau (chỉ cần làm 1 lần):
```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
```

## 3. Khởi chạy Backend
Mở Terminal ở thư mục gốc và cấu hình Python:
```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
python main.py
```
*Ghi chú: Máy chủ AI lắng nghe tại: `http://localhost:8000` (Hỗ trợ thoát an toàn / Graceful Shutdown bằng phím Ctrl+C).*

## 4. Khởi chạy Giao diện 
Mở một cửa sổ Terminal mới (giữ nguyên Terminal Backend đang chạy):
```powershell
cd frontend
npm install
npm run dev
```
*Ghi chú: Giao diện quản trị hoạt động tại: `http://localhost:3000`.*

## 5. Các Tính Năng An Toàn 
Hệ thống được thiết kế với cơ chế Fault-tolerance:
- **Cử chỉ Hủy báo động (Gesture Cancellation):** Khi còi hú, người dùng giơ 2 tay bắt chéo chữ X để AI tự động hủy báo động.
- **Lưu trữ (Database & Snapshots):** Khi phát hiện té ngã, hệ thống tự động chụp ảnh hiện trường lưu vào thư mục `backend/snapshots/` và ghi nhật ký vào SQLite (`local_alerts.db`).
- **Gửi Cảnh báo Telegram:** Đọc tệp `backend/.env` và cấu hình Token Bot để hệ thống tự động gửi ảnh qua điện thoại.
- **Watchdog Tự phục hồi:** Máy chủ liên tục giám sát Camera. Nếu rớt cáp, tự động Restart lại tiến trình. Đồng thời phát nhịp tim (Heartbeat `PING`) qua MQTT cho ESP32.

## 6. Xử lý Sự cố Thường gặp 
- **Không bắt được luồng Camera (MSMF Error):** OpenCV yêu cầu quyền truy cập Webcam độc quyền. Hãy đảm bảo bạn đã tắt các ứng dụng khác đang dùng Camera (Zoom, Meet, Camera App...).
- **Lỗi ngắt kết nối WebSocket:** Đảm bảo Backend đang chạy. Mã nguồn đã được cấu hình chống tràn luồng (Memory Leak) và triệt tiêu lỗi vòng lặp của React Strict Mode.

## 7. Kiểm thử Fall Detection không cần ngã thật

Có thể kiểm thử theo ba lớp:

```powershell
cd backend
python -m unittest -v test_fall_detection.py
python -m py_compile main.py fall_detection.py database.py
```

- **Unit test:** kiểm tra người nằm yên, di chuyển chậm, ngã chuyển tiếp, gục từ ghế và nhiều người độc lập theo `track_id`.
- **Video replay:** thay `VIDEO_SOURCE = 0` trong `main.py` bằng đường dẫn video thử nghiệm, ví dụ `test_videos/fall_from_chair.mp4`.
- **Kịch bản thực tế an toàn:** dùng video người đứng, ngồi, nằm sẵn, gục từ từ, té trên nệm và nhiều người che khuất nhau. Không thử ngã trên nền cứng.

Kết quả cảnh báo nên được đánh giá bằng confusion matrix, gồm tối thiểu: true fall, gradual collapse, sitting down, lying down, walking, occlusion và camera pan/tilt.

## 8. Các Bản Cập Nhật Gần Đây 
Dự án đã được tối ưu hóa toàn diện cho việc triển khai trên máy chủ đám mây hoặc máy tính Host:
- **Tự động cấu hình Phần cứng (Hardware Auto-tuning):** Hệ thống tự động quét phần cứng. Nếu có Card rời NVIDIA (GPU), AI sẽ biên dịch sang `TensorRT` (FP16). Nếu chạy thuần CPU, AI tự động dùng `OpenVINO` để ép xung tập lệnh, giúp tăng gấp ba tốc độ xử lý mà không cần cấu hình tay.
- **Thuật toán Ngã theo trạng thái (Per-track Temporal State Machine):** Mỗi người được xử lý độc lập theo `track_id`. Hệ thống yêu cầu quan sát được baseline ổn định rồi mới xác nhận chuyển tiếp bất thường; tư thế nằm ngang đơn lẻ không đủ để báo động.
- **Bao phủ nhiều kịch bản:** phát hiện chuyển tiếp đứng → nằm, ngã từ ghế, gục từ từ và đổ sụp không hoàn toàn nằm ngang bằng sự kết hợp của trọng tâm, góc thân, khoảng cách đầu–hông, dịch chuyển chuẩn hóa theo chiều cao cơ thể và bất động sau sự kiện.
- **Chống báo động giả:** người nằm sẵn, người đứng yên, di chuyển chậm và chuyển động do pan-tilt được lọc. Không khẳng định “bất tỉnh” chỉ từ RGB camera; cảnh báo được diễn đạt là sự kiện cần kiểm tra.
- **Kiểm thử tự động:** `backend/test_fall_detection.py` bao phủ các tình huống tĩnh, chuyển tiếp, gục từ ghế và multi-person.
- **Sửa lỗi Lật hình Camera:** Tích hợp lật ngang (Mirror) tự động bằng `cv2.flip` để Web hiển thị hình ảnh thuận mắt.
- **Tối ưu Băng thông:** 
  - Nén luồng Stream MJPEG bằng thuật toán nén chất lượng (`JPEG_QUALITY = 65`) giảm một nửa gánh nặng cho mạng. 
  - Thay đổi hệ thống Multiprocessing sang chuẩn `daemon=True` và xử lý triệt để lỗi kẹt hàng đợi (Queue Deadlock), giúp ứng dụng tắt nhanh, sạch gọn khi bấm `Ctrl + C`.
  - Cải tiến cử chỉ Hủy báo động (X-Gesture) với dung sai tay mở rộng, thân thiện hơn với người bệnh khi thao tác.
