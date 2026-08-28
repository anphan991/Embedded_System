# Hướng dẫn Khởi chạy Dự án: Hệ thống Giám sát & Bám sát Mục tiêu

Tài liệu cung cấp quy trình chuẩn để thiết lập môi trường phát triển cục bộ (Local Development). 
*Lưu ý: Dự án đã được nâng cấp lên kiến trúc YOLO-Pose (Ultralytics) để hỗ trợ đa mục tiêu và tương thích hoàn toàn với Python 3.13+ / NumPy 2.x.*

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
*Ghi chú: Lần chạy đầu tiên sẽ tốn khoảng 5 giây để tải mô hình `yolov8n-pose.pt`. Máy chủ AI lắng nghe tại: `http://localhost:8000` (Hỗ trợ thoát an toàn / Graceful Shutdown bằng phím Ctrl+C).*

## 4. Khởi chạy Giao diện (Frontend)
Mở một cửa sổ Terminal mới (giữ nguyên Terminal Backend đang chạy):
```powershell
cd frontend
npm install
npm run dev
```
*Ghi chú: Giao diện quản trị hoạt động tại: `http://localhost:3000`.*

## 5. Xử lý Sự cố Thường gặp (Troubleshooting)
- **Không bắt được luồng Camera (MSMF Error):** OpenCV yêu cầu quyền truy cập Webcam độc quyền. Hãy đảm bảo bạn đã tắt các ứng dụng khác đang dùng Camera (Zoom, Meet, Camera App...).
- **Lỗi ngắt kết nối WebSocket:** Đảm bảo Backend đang chạy. Mã nguồn đã được cấu hình chống tràn luồng (Memory Leak) và triệt tiêu lỗi vòng lặp của React Strict Mode.
