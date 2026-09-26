# Hướng dẫn khởi chạy dự án: Hệ thống giám sát & bám sát mục tiêu

## 1. Yêu cầu nền tảng
- **Python:** Phiên bản 3.10 trở lên.
- **Node.js:** Phiên bản LTS (v20.x trở lên).

## 2. Thiết lập đặc quyền thực thi (Dành riêng cho Windows PowerShell)
Nếu gặp lỗi `cannot be loaded because running scripts is disabled`, hãy chạy lệnh sau (chỉ cần làm 1 lần):
```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
```

## 3. Cài đặt và khởi chạy MQTT Broker (Mosquitto)
Hệ thống sử dụng MQTT để giao tiếp giữa máy chủ backend và phần cứng (ESP32).
1. Tải và cài đặt Mosquitto: [Link tải Windows](https://mosquitto.org/files/binary/win64/mosquitto-2.0.18-install-windows-x64.exe)
2. Mở một cửa sổ PowerShell mới tại thư mục `backend`, chạy lệnh khởi động Mosquitto cùng file cấu hình (để cho phép ESP32 kết nối):
```powershell
& "C:\Program Files\mosquitto\mosquitto.exe" -c mosquitto_local.conf -v
```
> **Lưu ý:** Khởi động MQTT trước khi khởi động backend.

## 4. Khởi chạy backend & AI
Mở một cửa sổ Terminal mới ở thư mục `backend` và cấu hình môi trường Python:
```powershell
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python main.py
```
*Ghi chú: Máy chủ AI lắng nghe tại `http://localhost:8000`. Khi chạy, AI sẽ tự động kết nối tới MQTT Broker ở localhost.*

## 5. Khởi chạy giao diện web
Mở một cửa sổ Terminal mới tại thư mục `frontend`:
```powershell
npm install
npm run dev
```
*Ghi chú: Giao diện web hoạt động tại `http://localhost:3000`.*

## 6. Mock Hardware
Để kiểm tra thuật toán giao tiếp servo mà không cần phần cứng thực tế, mở một Terminal mới tại thư mục `backend`:
```powershell
python mock_hardware.py
```
- **Kiểm tra Deadband:** Đứng trước camera và di chuyển ra mép ảnh. Cửa sổ giả lập sẽ in log lệnh quay servo. Khi đứng ở giữa ảnh, lệnh quay sẽ tự ngắt.
- **Kiểm tra che khuất chuyển động:** Nhấn phím `1` (MOVING) trên cửa sổ giả lập để mô phỏng động cơ đang quay nhanh. Cúi gập người ngã. Thuật toán té ngã sẽ bị đóng băng (không báo động ảo). Nhấn phím `2` (STOPPED) để mở khóa thuật toán.

## 7. Các tính năng an toàn
Hệ thống được thiết kế với cơ chế chịu lỗi (Fault-tolerance):
- **Cử chỉ hủy báo động :** Khi còi hú, người dùng giơ 2 tay bắt chéo (chữ X) để AI tự động tắt còi. Lịch sử đứng thẳng vẫn được AI ghi nhớ để theo dõi cú ngã kế tiếp.
- **Lưu trữ tự động:** Khi phát hiện té ngã, hệ thống tự động chụp ảnh hiện trường và lưu vào thư mục `backend/snapshots/`.
- **Gửi cảnh báo Telegram:** Hệ thống đọc tệp `backend/.env` và sử dụng token bot để gửi cảnh báo y tế.
- **Watchdog:** Máy chủ liên tục phát tín hiệu `PING` qua MQTT cho ESP32. Nếu đứt kết nối, AI sẽ tự phục hồi.

## 8. Lịch sử cập nhật 

### Backend & AI

*   **Tối giản và chống rò rỉ bộ nhớ (`backend/main.py`):**
    *   **Xóa logic dư thừa:** Lược bỏ hoàn toàn hàm nhận diện màu áo `cv2.calcHist()`, thuật toán đổi hệ màu HSV và đối chiếu `cv2.compareHist`.
    *   **Ngăn chặn Crash:** Gỡ bỏ biến chia sẻ (shared variable) `reid_store` trong thư viện Multiprocessing, chấm dứt triệt để lỗi rò rỉ bộ nhớ khi chạy lâu dài.
*   **Solo Protection Mode:**
    *   Bổ sung bộ lọc độ tin cậy `conf > 0.5` cho Yolo Bounding Box.
    *   **Rẽ nhánh (Fallback):** Thêm điều kiện `if global_person_count >= 2: continue`. Khi có nhiều người, AI ngừng tính toán góc ngã và radar để tiết kiệm CPU, đồng thời hiển thị thông báo `MUTED: MULTIPLE PEOPLE PRESENT` lên màn hình.
    *   **Chống giật động cơ :** Đóng băng luồng MQTT xuất lệnh (`embedded/servo/tracking`) để camera đứng yên bao quát toàn cảnh khi phát hiện đông người.
*   **API điều khiển thủ công (`backend/main.py` & `backend/mock_hardware.py`):**
    *   **REST API:** Viết mới 2 API `POST /api/v1/camera/mode` và `POST /api/v1/camera/move` để hỗ trợ Joystick ảo trên giao diện web.
    *   **Flag:** Tiến trình AI (`ai_process`) sẽ đọc tín hiệu từ file `camera_mode.txt` để tự động nhường quyền truyền lệnh MQTT (`embedded/servo/manual`) khi người dùng thao tác.
    *   **Heartbeat PING:** Bổ sung gói tin nhịp tim vào `mock_hardware.py` để mô phỏng giữ kết nối liên tục với máy chủ.
*   **Vá lỗi thuật toán té ngã (`backend/fall_detection.py` & `backend/main.py`):**
    *   **Lỗi Amnesia (Quên lịch sử):** Sửa đổi luồng logic của cử chỉ X (Hủy báo động). Thay vì xóa mảng lịch sử tư thế, hệ thống chỉ đưa cờ báo động vào trạng thái làm nguội (Cooldown). Lịch sử khung xương vẫn được bảo tồn để bắt các cú ngã liên hoàn.
    *   **Lỗi ngã từ từ (Gradual Fall):** Tăng `history_seconds` lên `5.0s`. Xây dựng hàm `max_spine` và `min_com_y` để quét toàn bộ chiều dài lịch sử thay vì so sánh với khung hình liền kề.
    *   **Lỗi gục trên ghế:** Cập nhật hàm `gradual_collapse`, hủy bỏ điều kiện tụt hông (hip drop) bắt buộc. Thay bằng logic: nếu tỉ lệ khoảng cách đầu - hông tụt đột biến (`head_hip_drop >= 0.15`), kích hoạt cảnh báo ngay lập tức.
    *   **Lỗi rung lắc khi cuộn tròn:** Khai báo bộ lọc trung bình động theo cấp số nhân (EMA Filter) trong `main.py` để làm mượt tuyệt đối các góc xương nội suy. Nới lỏng ngưỡng `max_post_impact_speed` từ `0.45` lên `0.90` để nhận diện chính xác trạng thái bất tỉnh.

### Phần giao diện Web (Frontend)

*   **Kiến trúc nền tảng và đa ngôn ngữ:**
    *   **Theme (`app/globals.css`, `app/ThemeProvider.tsx`):** Cấu hình biến thể Tailwind v4 `@custom-variant dark (&:is(.dark *))` và tích hợp thư viện `next-themes` cho Dark mode.
    *   **i18n (`app/context/LanguageContext.tsx`):** Khởi tạo bộ từ điển nội bộ (`en`, `vi`). Thiết lập hook `useTranslation()` và cơ chế tự động ghi nhớ (hydrate) ngôn ngữ xuống `localStorage`.
    *   **State Management (`app/context/AlertsContext.tsx`, `app/layout.tsx`):** Chuyển dịch kết nối WebSocket ra Global Context để duy trì liên kết khi chuyển trang. Cấu trúc lại dữ liệu cảnh báo với ID sinh ngẫu nhiên, hỗ trợ hàm `acknowledgeMultiple` để xử lý mảng.
*   **Màn hình Dashboard & Điều hướng:**
    *   **Sidebar (`app/Sidebar.tsx`):** Thêm nút gạt chế độ tối/sáng và chuyển đổi ngôn ngữ. Dịch động các tiêu đề tĩnh bằng hàm `t()`.
    *   **Giám sát (`app/page.tsx`):** Thay thế CSS z-index bằng API nguyên bản `element.requestFullscreen()` để hiển thị camera toàn màn hình hoàn hảo. Chèn đồng hồ thời gian thực (OSD clock) và tự động map mã lỗi từ backend (`t("alert." + alert.eventCode)`) sang tiếng Việt.
    *   **Joystick ảo (`app/CameraControlPanel.tsx`):** Xây dựng component phím chữ thập (D-Pad). Bắt sự kiện `onMouseDown` truyền hướng đi (LEFT/RIGHT...) và `onMouseUp` truyền lệnh phanh (STOP) qua API.
*   **Chức năng mới:**
    *   **Nhật ký (`app/logs/page.tsx`):** Code hoàn toàn mới. Thêm thanh tìm kiếm từ khóa/thời gian, Dropdown lọc trạng thái. Xây dựng logic Checkbox `Set<string>` để chọn nhiều và xác nhận lỗi hàng loạt.
    *   **Cài đặt (`app/settings/page.tsx`):** Trình bày 4 khối giao diện (AI, Camera, Integrations, Database). Viết hàm `useEffect` đồng bộ mọi chỉ số vào `localStorage`. Sửa lỗi UI của nút gạt bằng class `dark:peer-checked:bg-indigo-600`.
*   **Trang Phân tích Radar (`app/analytics/page.tsx` & `app/RadarMap.tsx`):**
    *   **Logic dữ liệu:** Sửa đường dẫn import bị sai và tái cấu trúc Object Props truyền vào Radar (đổi mm sang m, truyền mảng `zones`).
    *   **Giao diện vùng an toàn:** Khôi phục cụm Input thiết lập mốc tọa độ X/Y (Min/Max). Ràng buộc thay đổi từ Input trực tiếp làm thay đổi hình chiếu Recharts ReferenceArea trên bản đồ ngay lập tức.
    *   **Layout Fix:** Xóa thẻ Header bị trùng lặp. Đặt `flex-1 overflow-hidden h-full` cho thẻ main. Kích hoạt `overflow-y-auto` riêng cho cột cài đặt bên trái, ép cột radar bên phải khóa cứng 100% chiều cao (Không bắt người dùng cuộn chuột toàn trang).
    *   **Lỗi xén viền:** Loại bỏ thuộc tính `aspect={rWidth / rLength}` và `maxHeight` của thư viện Recharts vì chúng tính toán sai chiều cao khi phòng rộng. Ép lại `width="100%"` và `height="100%"`, nới `margin-bottom: 40` để trục Y hiện đầy đủ.
    *   **Light Mode:** Nâng độ tương phản (Contrast) của Radar Coverage và SAFE/DANGER Zones (fillOpacity 0.15). Sơn lại lưới tọa độ (Cartesian Grid) và số đo sang mã màu `#cbd5e1`, `#94a3b8` để hiển thị sắc nét hơn trên nền sáng.

## 9. Cấu hình không gian radar
- **Kích thước phòng:** Cho phép nhập chiều rộng và chiều dài thực tế. Bản đồ 2D sẽ tự động căn chỉnh lưới trục theo tỷ lệ tương ứng.
- **Vị trí và góc quét:** Khai báo vị trí treo radar trên tường và hướng quay (`0°`, `90°`, `180°`, `270°`). Máy chủ tự động áp dụng ma trận xoay và tịnh tiến tọa độ cảm biến về đúng vị trí thực tế trong phòng.
- **Hình quạt phủ sóng:** Vùng màu xanh lam mô phỏng chùm tia quét của cảm biến LD2450 (bán kính 6m, góc mở 120 độ) được vẽ đè lên bản đồ để dễ dàng phát hiện điểm mù.


