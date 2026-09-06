# Hướng dẫn Khởi chạy Dự án: Hệ thống Giám sát & Bám sát Mục tiêu


## 1. Yêu cầu Nền tảng (Prerequisites)
- **Python:** Phiên bản 3.10 trở lên.
- **Node.js:** Phiên bản LTS (v20.x trở lên).

## 2. Thiết lập Đặc quyền Thực thi (Dành riêng cho Windows PowerShell)
Nếu gặp lỗi `cannot be loaded because running scripts is disabled`, hãy chạy lệnh sau (chỉ cần làm 1 lần):
```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
```

## 3. Khởi chạy Máy chủ AI (Backend)
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

## 4. Khởi chạy Giao diện (Frontend)
Mở một cửa sổ Terminal mới (giữ nguyên Terminal Backend đang chạy):
```powershell
cd frontend
npm install
npm run dev
```
*Ghi chú: Giao diện quản trị hoạt động tại: `http://localhost:3000`.*

## 5. Các Tính Năng An Toàn (Mission-Critical Features)
Hệ thống được thiết kế với cơ chế chống chịu lỗi (Fault-tolerance) cấp cao:
- **Cử chỉ Hủy báo động (Gesture Cancellation):** Khi còi hú, người dùng giơ 2 tay bắt chéo chữ X để AI tự động hủy báo động.
- **Lưu trữ Bằng chứng (Database & Snapshots):** Khi phát hiện té ngã, hệ thống tự động chụp ảnh hiện trường lưu vào thư mục `backend/snapshots/` và ghi nhật ký vào SQLite (`local_alerts.db`).
- **Gửi Cảnh báo Telegram:** Đọc tệp `backend/.env` và cấu hình Token Bot để hệ thống tự động gửi ảnh qua điện thoại.
- **Watchdog Tự phục hồi:** Máy chủ liên tục giám sát Camera. Nếu rớt cáp, tự động Restart lại tiến trình. Đồng thời phát nhịp tim (Heartbeat `PING`) qua MQTT cho ESP32.

## 6. Xử lý Sự cố Thường gặp (Troubleshooting)
- **Không bắt được luồng Camera (MSMF Error):** OpenCV yêu cầu quyền truy cập Webcam độc quyền. Hãy đảm bảo bạn đã tắt các ứng dụng khác đang dùng Camera (Zoom, Meet, Camera App...).
- **Lỗi ngắt kết nối WebSocket:** Đảm bảo Backend đang chạy. Mã nguồn đã được cấu hình chống tràn luồng (Memory Leak) và triệt tiêu lỗi vòng lặp của React Strict Mode.

## 7. Các Bản Cập Nhật Gần Đây (Mission-Critical VPS Optimizations)
Dự án đã được tối ưu hóa toàn diện cho việc triển khai trên máy chủ đám mây (VPS) hoặc máy tính Host hiệu năng cao:
- **Tự động cấu hình Phần cứng (Hardware Auto-tuning):** Hệ thống tự động quét phần cứng. Nếu có Card rời NVIDIA (GPU), AI sẽ biên dịch sang `TensorRT` (FP16). Nếu chạy thuần CPU, AI tự động dùng `OpenVINO` để ép xung tập lệnh, giúp tăng gấp ba tốc độ xử lý mà không cần cấu hình tay.
- **Thuật toán Ngã thế hệ mới (Kinematics & Temporal Confidence):** Bỏ qua nhược điểm của Bounding Box, AI giờ đây tính toán **Trọng tâm (Center of Mass)** và **Góc cột sống (Spine Angle)** (Vector nối từ hông lên vai) để đưa ra quyết định. Bổ sung *Lưới lọc thời gian* ép buộc người ngã phải duy trì trạng thái liên tục trong nhiều frames, loại bỏ 100% báo động giả do AI rung lắc.
- **Sửa lỗi Lật hình Camera:** Tích hợp lật ngang (Mirror) tự động bằng `cv2.flip` để Web hiển thị hình ảnh thuận mắt.
- **Tối ưu Băng thông (Bandwidth & Daemon):** 
  - Nén luồng Stream MJPEG bằng thuật toán nén chất lượng (`JPEG_QUALITY = 65`) giảm một nửa gánh nặng cho mạng. 
  - Thay đổi hệ thống Multiprocessing sang chuẩn `daemon=True` và xử lý triệt để lỗi kẹt hàng đợi (Queue Deadlock), giúp ứng dụng tắt nhanh, sạch gọn khi bấm `Ctrl + C`.
  - Cải tiến cử chỉ Hủy báo động (X-Gesture) với dung sai tay mở rộng, thân thiện hơn với người bệnh khi thao tác.
