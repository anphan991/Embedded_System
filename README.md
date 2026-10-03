# Hướng dẫn khởi chạy dự án: Hệ thống giám sát & bám sát mục tiêu

> **Camera:** Người lắp đã nạp bằng board **AI Thinker ESP32-CAM** và xem được hình với FPS thấp; firmware camera nay mặc định profile AI Thinker theo bằng chứng đó. Mô tả ESP32-S3 WROOM CAM + OV5640 trong đề xuất cũ và ảnh trang bán hàng chưa xác nhận được bo thực tế. Xem [hướng dẫn lắp mạch và chẩn đoán](hardware/SETUP_DIAGNOSTICS.md); chụp bo thật khi có thể để xác nhận. Firmware servo/radar dành riêng cho ESP32 DevKit GPIO13/27.

> **Nguồn hiện tại:** một XL4015 đang cấp chung hai MG996R, hai ESP32 và LD2450; chưa đo sụt áp dưới tải. Cần đo tại đầu servo/camera lúc chuyển động và ưu tiên đường nguồn servo riêng đủ dòng, GND chung. Đây là nghi vấn phần cứng trực tiếp đối với hiện tượng servo đứng yên và stream đứng hình.

Thông số hoạt động hiện tại xem tại `GET /api/v1/video/status`, `GET /api/v1/servo/diag` và bảng chẩn đoán trên dashboard. Các giá trị FPS, thời gian suy luận, số khung rơi và lệnh PWM được đo/log để xác định điểm nghẽn; không có cam kết 30 FPS hay xác nhận trục servo đã quay chỉ từ log góc đích.

Cảnh báo ngã được backend xử lý và ghi ảnh/DB/gửi Telegram ngay cả khi không mở dashboard; WebSocket phát cùng một sự kiện tới mọi dashboard đang kết nối. Hàng đợi cảnh báo có giới hạn 16 sự kiện để không bỏ mất các phát hiện gần nhau trong điều kiện bình thường, và ghi log nếu vượt giới hạn.

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
2. Trước tiên kiểm tra Mosquitto đã chạy như Windows Service chưa bằng `Get-Service mosquitto -ErrorAction SilentlyContinue`. Nếu service đang chạy, dùng chính instance đó và kiểm tra nó cho phép ESP32 kết nối qua mạng LAN; **không mở thêm broker thủ công trên cổng 1883**. Chỉ khi không có service/instance đang chạy, mở PowerShell tại thư mục `backend` và khởi động với cấu hình của dự án:
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
    *   **Chế độ:** Backend giữ trạng thái AUTO/MANUAL và gửi qua `embedded/servo/mode`; ESP32 chỉ nhận lệnh joystick `embedded/servo/manual` khi ở MANUAL. File `camera_mode.txt` chỉ ghi lại chế độ, tiến trình AI không đọc file này.
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

---

### Tích hợp phần cứng: ESP32-CAM Stream + Pan/Tilt Servo Control

#### Backend (`backend/main.py`)

*   **Sửa lỗi Stream Camera từ ESP32-CAM (hàm `camera_process`):**
    *   **Vấn đề gốc:** `cv2.VideoCapture(url, cv2.CAP_FFMPEG)` trên Windows bị lỗi MSMF (Error -138), treo vô thời hạn khi kết nối HTTP stream từ ESP32-CAM.
    *   **Giải pháp:** Viết lại hoàn toàn hàm `camera_process` — thay `cv2.VideoCapture` bằng `urllib.request.urlopen()` đọc raw byte stream, tự tay parse JPEG frame dựa trên magic bytes `\xff\xd8` (SOI) và `\xff\xd9` (EOI), sau đó dùng `cv2.imdecode(np.frombuffer(...))` để decode. Cơ chế tự động reconnect khi mất tín hiệu.
    *   **Cập nhật địa chỉ:** đặt `VIDEO_SOURCE=http://<IP-ESP32-CAM>:81/stream` trong `backend/.env` theo IP Serial Monitor in ra, rồi khởi động lại backend. IP mẫu trong code là `10.28.125.12`; hotspot có thể cấp IP khác sau khi reset.

*   **Sửa lỗi điều khiển Servo qua MQTT (hàm `move_camera`):**
    *   **Vấn đề gốc 1:** `camera_mode` mặc định là `"AUTO"` khiến API `/api/v1/camera/move` luôn từ chối lệnh với lỗi `"Must be in MANUAL mode"`.
    *   **Sửa:** Đổi `camera_mode = "AUTO"` → `camera_mode = "MANUAL"` làm giá trị mặc định khi khởi động.
    *   **Vấn đề gốc 2:** Backend publish MQTT đến `"localhost"` / `"127.0.0.1"` (Windows Service Mosquitto mặc định, không có ESP32 kết nối vào), trong khi ESP32 đang kết nối đến Mosquitto chạy tại IP WiFi `10.28.125.55`.
    *   **Sửa:** Đổi default broker từ `"localhost"` → `"10.28.125.55"` trong hàm `move_camera`.

#### Frontend (`frontend/app/CameraControlPanel.tsx`)

*   **Sửa lỗi Joystick:**
    *   **Vấn đề gốc:** Toàn bộ 5 nút bấm (Lên/Xuống/Trái/Phải/Reset) và 2 nút chế độ (Thủ công/Tự động) không có bất kỳ handler `onClick` nào. Bấm không gửi lệnh gì về Backend.
    *   **Sửa:** Thêm 2 hàm async: `handleMove(dir: string)` gọi `POST /api/v1/camera/move` với body `{direction: dir}`, và `handleModeChange(isAuto: boolean)` gọi `POST /api/v1/camera/mode?mode=...`. Gắn `onClick` vào tất cả các nút.
    *   **Sửa thêm:** Dùng `window.location.hostname` thay cho `"localhost"` cứng (hardcode) để tương thích khi truy cập qua IP mạng nội bộ hoặc Tailscale.

#### Firmware ESP32 Thường (`hardware/esp32_servo_radar/esp32_servo_radar.ino`)

*   **Cấu hình `ESP32PWM::allocateTimer()` và `servo.setPeriodHertz(50)`** trong `setup()` để cấp xung PWM 50 Hz cho servo; log `attached` và `pulse_us` giúp xác định lệnh PWM có được tạo hay không.
*   **Thêm log debug** `Serial.print("NHAN LENH TỪ KÊNH [...]:")` vào `mqttCallback()` để dễ chẩn đoán khi bấm Joystick.
*   **Thêm `msg.toUpperCase()`** trong `mqttCallback()` để đề phòng frontend gửi chữ thường (`"left"` thay vì `"LEFT"`).
*   **Dùng GPIO13 cho PAN và GPIO27 cho TILT.** Dây tín hiệu phải đúng hai chân này trên ESP32 Dev Module thường; nếu lắp chân khác, sửa hằng `PAN_PIN`/`TILT_PIN` trước khi nạp.
*   **Cải thiện `reconnect()`:** Thử lại có khoảng cách trong vòng lặp chính, để việc mất MQTT không chặn đọc radar và cập nhật servo.

#### Môi trường & Hệ thống

*   **Cài đặt thư viện `paho-mqtt`:** Thư viện này bị thiếu trong môi trường Python của máy host (`pip install paho-mqtt`). Thiếu thư viện này khiến Backend crash âm thầm mỗi lần gọi `publish.single()`.
*   **Xử lý xung đột 2 tiến trình Mosquitto:** Windows tự động chạy Mosquitto như một Windows Service (PID chạy dưới `SI=0`). Không cần và không thể chạy thêm một instance thủ công nào nữa. Mosquitto Service mặc định (`listener 1883 0.0.0.0` + `allow_anonymous true` trong `backend/mosquitto_local.conf`) đã đủ để ESP32 kết nối.



## 9. Cấu hình không gian radar
- **Kích thước phòng:** Cho phép nhập chiều rộng và chiều dài thực tế. Bản đồ 2D sẽ tự động căn chỉnh lưới trục theo tỷ lệ tương ứng.
- **Vị trí và góc quét:** Khai báo vị trí treo radar trên tường và hướng quay (`0°`, `90°`, `180°`, `270°`). Máy chủ tự động áp dụng ma trận xoay và tịnh tiến tọa độ cảm biến về đúng vị trí thực tế trong phòng.
- **Hình quạt phủ sóng:** Vùng màu xanh lam mô phỏng chùm tia quét của cảm biến LD2450 (bán kính 6m, góc mở 120 độ) được vẽ đè lên bản đồ để dễ dàng phát hiện điểm mù.

### Kết nối radar và servo
- Dự án dùng hai bo riêng: nạp `hardware/esp32_servo_radar/esp32_servo_radar.ino` vào **ESP32 DevKit** để đọc LD2450 và điều khiển servo; chỉ nạp `hardware/esp32_cam_stream/esp32_cam_stream.ino` vào **bo camera đã xác minh** sau khi chọn đúng profile pin ở đầu sketch. Không nạp nhầm hai sketch cho nhau.
- LD2450: cấp VCC 5V, nối GND chung; TX của radar vào GPIO16 (RX2) và RX radar vào GPIO17 (TX2) nếu cần cấu hình radar từ ESP32. UART mặc định là 256000 baud, 8N1.
- Servo pan nhận tín hiệu ở GPIO13, servo tilt ở GPIO27. Dùng nguồn servo riêng theo điện áp và dòng định mức của servo; nối GND nguồn servo với GND ESP32. Không cấp nguồn servo từ chân 3.3V của ESP32.
- Gắn radar cố định trên phần đế, mặt anten hướng vào phòng và trùng hướng nhìn giữa với camera khi servo ở góc 90°. Firmware dùng tọa độ radar cục bộ để tính góc servo; không gắn radar lên phần pan đang xoay.
- Trong trang **Cấu hình thiết bị**, nhập kích thước phòng, vị trí radar và góc quay theo bản đồ; các ô hiện đơn vị mm. Nhấn **Lưu cấu hình** để lưu xuống backend. Cấu hình này phục vụ bản đồ và vùng an toàn/nguy hiểm; góc xoay servo vẫn lấy trực tiếp từ tọa độ X/Y của radar.
- Mặc định firmware giả định camera cao 1500 mm và ngắm vào tâm thân người cao 900 mm. Hiệu chỉnh `CAMERA_HEIGHT_MM` và `TARGET_HEIGHT_MM` lúc chạy bằng Serial/MQTT hoặc `POST /api/v1/servo/config`; giá trị lưu NVS. Xem [các lệnh và giới hạn an toàn](hardware/SETUP_DIAGNOSTICS.md).

### Xử lý trễ joystick, khựng hình và AUTO không quay

**Hướng dẫn đang áp dụng:** [Lắp mạch và chẩn đoán](hardware/SETUP_DIAGNOSTICS.md). Các bước ngắn bên dưới dùng profile AI Thinker theo lần nạp và xem được hình mà người lắp đã xác nhận; hướng dẫn chi tiết có cách kiểm tra lại bo và nguồn.

1. Nạp `hardware/esp32_servo_radar/esp32_servo_radar.ino` cho **ESP32 Dev Module thường**. Chỉ nạp `hardware/esp32_cam_stream/esp32_cam_stream.ino` cho bo camera sau khi đã xác nhận profile chân và board Arduino theo bo thực tế. Mở Serial Monitor từng bo ở 115200 baud.
2. Nhập IP in trên Serial của bo camera vào **Cài đặt hệ thống → Địa chỉ IP Camera ESP32**, rồi bấm **Lưu thay đổi**: backend lưu `VIDEO_SOURCE` vào `.env`, kết nối lại camera và bỏ khung hình/trạng thái AI từ nguồn cũ. Có thể đặt tay `VIDEO_SOURCE=http://<IP-camera>:81/stream` trong `backend/.env` rồi khởi động lại backend. Nếu broker MQTT đổi IP, đặt `MQTT_BROKER=<IP-broker>` trong backend và gửi `MQTT_HOST=<IP-broker>` qua Serial ESP32 DevKit để lưu NVS; phải phối hợp đổi cùng lúc để không mất điều khiển. Chỉ chạy **một** tiến trình `python main.py` trên cổng 8000; khởi động lại backend sau khi sửa `.env` bằng tay.
3. Dashboard mặc định chọn **Trực tiếp**: đây là JPEG mới nhất từ bo camera qua backend, không bị tốc độ suy luận AI chặn. Nút **Lớp phủ AI** giữ hình có bounding box/cảnh báo; pipeline AI mặc định giới hạn tối đa 15 khung hình mới/giây và CPU có thể thấp hơn. Backend chỉ duy trì một kết nối đọc tới camera để tránh tranh luồng. `GET /api/v1/video/status` báo `online`, FPS và tuổi khung hình; Serial bo camera báo `[CAM-DIAG] fps=... jpeg=... rssi=...` mỗi 5 giây khi có người xem.
4. Nếu cả URL camera trực tiếp `http://<IP-camera>:81/stream` cũng giật, hãy **dừng backend trước khi mở URL trực tiếp** (sketch camera phục vụ một stream dài hạn), rồi xem `[CAM-DIAG] fps`, PSRAM và RSSI tại `http://<IP-camera>:82/status`. Giữ bo và điểm phát Wi-Fi 2.4 GHz gần nhau, dùng nguồn đúng thông số bo và ổn định dưới tải. Có thể thử `http://<IP-camera>:82/tune?framesize=QVGA&quality=20` khi chạy để giảm tải, đổi lại AI khó nhận người ở xa hơn. Không thể bảo đảm 30 FPS cố định trên ESP32 qua Wi-Fi.
5. Joystick gửi một lệnh ngay khi nhấn rồi giữ tối đa một yêu cầu HTTP đang xử lý; khi nhả nút gửi `STOP`. Backend gắn số thứ tự cho lệnh HTTP và lệnh MQTT, ESP32 bỏ lệnh MQTT cũ đến muộn; payload chữ đơn như `LEFT` vẫn được hỗ trợ. Lệnh STOP dùng MQTT QoS 1 và giao diện báo lỗi nếu backend/broker không xác nhận. Backend dùng kết nối MQTT duy trì. Nếu còn trễ, xem Serial ESP32 có nhận `[MQTT] ... embedded/servo/manual` ngay lúc nhấn không. `GET /api/v1/camera/mode` cần có `mqtt_connected: true`. Nếu MQTT đến ngay nhưng trục vẫn chậm, kiểm tra nguồn 5 V **ngay tại servo khi đang quay**, dây tín hiệu GPIO13/27 và tải cơ khí; dòng nguồn phải đáp ứng dòng kẹt của đúng model servo. Nếu nhãn nguồn chỉ ghi 1 A hoặc không rõ dòng, xác nhận lại model servo và dòng nguồn trước khi thử cả hai trục dưới tải.
6. Khi bấm AUTO, chờ `hardware_online: true` và `hardware_mode: "AUTO"` ở `GET /api/v1/camera/mode`. Log `[AUTO]` chỉ chứng minh đã tính **góc đích**. Log `[SERVO-DIAG]` cho `target`, `current`, `cmd`, `pulse_us`, `attached`: nếu `target` đổi nhưng `current/cmd` đứng yên, xem đường cập nhật firmware; nếu `current/cmd/pulse_us` đổi mà trục đứng yên, kiểm tra chân tín hiệu thực, nguồn/dây và xung PWM 50 Hz. `attached=0` nghĩa là PWM chưa gắn vào chân. Radar phải cố định trên đế; chỉnh `CAMERA_HEIGHT_MM`, `TARGET_HEIGHT_MM`, `PAN_DIR`, `TILT_DIR` và offset theo cách lắp thực tế sau khi servo đã quay được.

## 10. Hướng dẫn thiết lập Tailscale cho Mobile Testing
Dự án hỗ trợ xem và điều khiển camera trực tiếp qua mạng nội bộ ảo Tailscale mà không cần port forwarding.

### Các bước cài đặt:
1. **Cài đặt Tailscale:** Cài đặt ứng dụng Tailscale trên cả Máy chủ (PC chạy code) và Thiết bị di động (Điện thoại/Tablet).
2. **Đăng nhập:** Đăng nhập cùng một tài khoản Tailscale trên cả 2 thiết bị.
3. **Lấy IP Máy chủ:** Mở ứng dụng Tailscale trên PC, copy địa chỉ IP của máy (thường có dạng `100.x.x.x`).
4. **Truy cập:** Trên trình duyệt điện thoại, gõ `http://<IP-Tailscale-PC>:3000`.

### Lưu ý quan trọng:
* **Lỗi trắng màn hình (Next.js 15 CORS):** Theo mặc định, Next.js 15 sẽ chặn fetch JS chunk từ các IP lạ. Nếu dùng điện thoại mới (IP Tailscale mới) để test và gặp hiện tượng "Có UI nhưng không bấm được gì", hãy mở file `frontend/next.config.ts` và thêm IP Tailscale của điện thoại đó vào mảng `allowedDevOrigins`. **Nhớ khởi động lại server (`npm run dev`) sau khi sửa!**
* **Luồng Stream MJPEG trên iOS/Safari:** Không dựa riêng vào `onLoad` của thẻ `<img>` để xác định còn hình mới. Dashboard hỏi `/api/v1/video/status` theo định kỳ và tự kết nối lại khi nguồn camera hoặc luồng AI gián đoạn.
* **Bố cục màn hình di động:** Màn hình Giám sát trên điện thoại đã được tối ưu lại Camera nửa trên, PTZ nửa dưới. Phần Nhật ký sự cố bị ẩn đi trên điện thoại để tiết kiệm không gian.
* **DesktopOnly:** Các trang có biểu đồ phức tạp (`/analytics` và `/settings`) được bọc bằng `<DesktopOnly>`. Khi xem trên thiết bị có bề ngang nhỏ hơn `1024px`, hệ thống sẽ chặn hiển thị và yêu cầu người dùng chuyển qua PC/Tablet để đảm bảo trải nghiệm vẽ bản đồ tốt nhất.
* **Đa ngôn ngữ & Mã hóa (Encoding):** File `frontend/app/context/LanguageContext.tsx` chứa từ điển tiếng Việt và tiếng Anh. Khi chỉnh sửa file này, **BẮT BUỘC** phải lưu dưới chuẩn `UTF-8` (không dùng ANSI) để tránh lỗi vỡ font tiếng Việt.
