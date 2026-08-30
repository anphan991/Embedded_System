# Hướng dẫn Khởi chạy Dự án: Hệ thống Giám sát & Bám sát Mục tiêu

Tài liệu cung cấp quy trình chuẩn để thiết lập môi trường phát triển cục bộ (Local Development). 
*Lưu ý: Dự án đã được nâng cấp lên kiến trúc YOLO-Pose (Ultralytics) đa tiến trình (Multiprocessing), tích hợp chuẩn giao tiếp MQTT công nghiệp và bộ phản ứng khẩn cấp.*

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
