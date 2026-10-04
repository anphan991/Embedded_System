# Hướng dẫn cài đặt và vận hành hệ thống camera, radar, servo

**Nếu dùng sketch đơn giản vừa gửi ngày 04/10 (LEFT/RIGHT/UP/DOWN/RESET), đọc [hướng dẫn firmware đơn giản](HUONG_DAN_SERVO_FIRMWARE_DON_GIAN.md) trước và đặt `SERVO_PROTOCOL=legacy_step`.** Các mục chẩn đoán, HOLD/STOP và hiệu chỉnh servo dưới đây áp dụng cho firmware chẩn đoán với `SERVO_PROTOCOL=sequenced_hold`, không áp dụng cho sketch đơn giản.

Tài liệu này áp dụng cho bộ phần cứng **đang có trên tay người lắp** và mã nguồn trong thư mục này. `README.md` hiện tại được giữ nguyên. Làm lần lượt từ nguồn điện, từng bo, MQTT, backend rồi frontend; sau mỗi bước có cách kiểm tra để biết chính xác lỗi nằm ở đâu.

## 1. Xác định phần cứng và giới hạn đã kiểm chứng

| Thành phần | Đã xác định từ ảnh/mã nguồn | Vai trò |
| --- | --- | --- |
| Bo camera | Mặt trước `ESP32-CAM`, mặt sau module `ESP-32S`, dây camera `TY-OV3660-21MM-V3.0` | Chụp JPEG và phát MJPEG qua Wi-Fi |
| Đế nạp Micro-USB | Gắn dưới ESP32-CAM, là bo nạp/nguồn cho camera | Cắm USB khi nạp |
| ESP32 DevKit | Bo **khác** với ESP32-CAM | Nhận radar, phát PWM cho hai servo, kết nối MQTT |
| HLK-LD2450 | Radar mmWave | Xuất tọa độ mục tiêu qua UART |
| 2 × MG996R | PAN và TILT | Quay cụm camera |
| Adapter 12 V/5 A + XL4015 | Người lắp đang dùng **một** XL4015 cấp cả hệ thống | Cần kiểm tra nguồn lúc servo kéo tải |

Đây là **ESP32 thường, không phải ESP32-S3**. Dây camera ghi OV3660; `sensor_pid` do firmware đọc sau khi khởi động là bước xác nhận bằng điện tử. Chọn profile chân **AI Thinker ESP32-CAM**. Driver camera của Espressif có hỗ trợ ESP32 và OV3660, nhưng hỗ trợ cảm biến không đồng nghĩa camera này đạt một FPS cố định. [Nguồn: driver `esp32-camera` của Espressif](https://github.com/espressif/esp32-camera).

Mã đã có cơ chế lấy khung mới nhất, chẩn đoán FPS/lỗi và điều khiển servo theo radar. **Chưa có phép đo FPS, điện áp dưới tải hoặc vị trí trục từ chính bộ mạch của bạn sau lần nạp mới**, nên không thể xác nhận stream đã mượt hơn, đạt 30 FPS hoặc hai servo đã quay đúng chỉ bằng biên dịch và log góc. Mục 9 chỉ cách đo để kết luận.

## 2. Sơ đồ kết nối và nguồn

**Tắt toàn bộ nguồn trước khi thay dây.** Chỉnh và đo điện áp đầu ra bộ hạ áp trước khi nối bo. Không đưa 12 V trực tiếp vào ESP32, LD2450 hoặc servo.

```text
Adapter 12 V / 5 A
├─ XL4015 hiện có, chỉnh/đo 5,0 V ── ESP32 DevKit + ESP32-CAM + LD2450
└─ bộ hạ áp 5–6 V riêng, đủ dòng cho 2 servo ── MG996R PAN + MG996R TILT

GND của hai đường nguồn, ESP32 DevKit, ESP32-CAM, radar và hai servo: nối chung.
Không nối hai đầu ra +5 V của hai bộ nguồn với nhau.
```

| Dây | Đầu ESP32 DevKit | Đầu thiết bị |
| --- | --- | --- |
| PWM PAN | GPIO13 | Dây tín hiệu servo PAN |
| PWM TILT | GPIO27 | Dây tín hiệu servo TILT |
| Radar TX | GPIO16 (RX2) | TX của LD2450 |
| Radar RX, nếu dùng | GPIO17 (TX2) | RX của LD2450 |
| Radar nguồn | Đường 5 V logic, GND chung | 5 V, GND của LD2450 |
| Servo nguồn | **Không lấy qua chân 3,3 V/5 V của DevKit** | Nguồn servo riêng, GND chung |

ESP32-CAM dùng đường 5 V logic qua chân/đế nạp phù hợp với bo. Khi nạp bằng Micro-USB, tránh đồng thời cấp 5 V từ một đường khác vào cùng bo nếu chưa xác minh mạch đế nạp. Radar cần gắn **cố định trên đế**, không gắn lên trục PAN; mặt cảm biến hướng vào vùng cần theo dõi. Tọa độ radar phục vụ servo là tọa độ cục bộ của radar, còn tọa độ/phép xoay trong trang bản đồ phục vụ hiển thị và vùng cảnh báo.

MG996R chính hãng có điện áp hoạt động 4,8–6,6 V và dòng kẹt công bố khoảng 1,4 A/chiếc; servo và module nguồn thực tế có thể khác. Chọn bộ hạ áp servo khoảng **5–6 V, khả năng cấp dòng liên tục có dự phòng (mức ≥5 A là điểm bắt đầu hợp lý cho hai servo)**, dây đủ tiết diện, rồi **đo ngay tại đầu servo khi hai trục bắt đầu quay**. Nhãn 5 A của IC XL4015 không chứng minh cả module, cọc vít, dây và tản nhiệt đạt 5 A liên tục. [MG996R TowerPro](https://towerpro.com.tw/product/mg996R/), [datasheet XL4015](https://www.xlsemi.com/datasheet/XL4015-EN.pdf), [HLK-LD2450](https://www.hlktech.com/en/Goods-226.html).

Trước khi lắp tay đòn, thử từng servo ở góc tâm, kiểm tra không kẹt cơ khí và dây camera không bị kéo. Giới hạn phần mềm 45–135° chỉ là khoảng ban đầu; cần đo khoảng quay an toàn trên khung thật. Nếu chưa có đồng hồ đo/nguồn servo riêng, không dùng log `[AUTO]` như bằng chứng hệ cơ điện đã hoạt động đúng.

## 3. Tải phần mềm trên Windows

Máy chạy backend/frontend nên dùng Windows 10/11 64-bit. Tải **từ trang chính thức**:

1. [Node.js](https://nodejs.org/en/download): chọn **LTS 64-bit Windows Installer**, cài theo mặc định. Frontend dùng Next.js 16; [Next.js yêu cầu Node.js từ 20.9](https://nextjs.org/docs/app/getting-started/installation). Dùng bản LTS còn được hỗ trợ, không cần chọn đúng số phiên bản trong tài liệu này.
2. [Python 3.11.9 cho Windows](https://www.python.org/downloads/release/python-3119/): chọn **Windows installer (64-bit)** cho bộ thư viện AI hiện tại; đánh dấu thêm Python vào PATH nếu trình cài đặt có tùy chọn. Nếu đã có Python 3.11 chạy được thì dùng lại. Bản `backend/venv` cũ của máy có thể được tạo bằng Python khác; các lệnh bên dưới dùng `backend/.venv` mới để không sửa môi trường cũ.
3. [Arduino IDE 2](https://www.arduino.cc/en/software): cài bản Windows. [Hướng dẫn chính thức](https://support.arduino.cc/hc/en-us/articles/360019833020-Download-and-install-Arduino-IDE).
4. [Eclipse Mosquitto](https://mosquitto.org/download/): chọn Windows x64 installer. Broker phải chạy trên máy mà **cả backend và ESP32 DevKit đều truy cập được**.

Mở PowerShell **mới** sau khi cài Node/Python rồi kiểm tra:

```powershell
node --version
npm.cmd --version
py -3.11 --version
```

Trong PowerShell, dùng `npm.cmd` nếu lệnh `npm` bị chặn bởi Execution Policy; không cần thay đổi chính sách thực thi chỉ để chạy dự án. Nếu `py` chưa có trên PATH, chạy `where.exe python` và `python --version` để xem lệnh `python` đang trỏ vào bản nào. **Chỉ dùng `python -m venv` khi nó thực sự là Python 3.11**; nếu không, dùng đường dẫn đầy đủ của Python 3.11 vừa cài (ví dụ `& 'C:\Users\PC\AppData\Local\Programs\Python\Python311\python.exe' -m venv .venv`). Máy hiện có thể có một `python` khác trong PATH nên không nên đoán theo tên lệnh.

### Cài board và thư viện Arduino

1. Arduino IDE → **File → Preferences → Additional boards manager URLs**, thêm URL ổn định do Espressif công bố:

   ```text
   https://espressif.github.io/arduino-esp32/package_esp32_index.json
   ```

2. **Tools → Board → Boards Manager**, tìm `esp32`, cài **esp32 by Espressif Systems**. Hai sketch đã biên dịch với core **3.3.12**; nếu cần tái lập đúng môi trường, chọn phiên bản này trong Boards Manager. [Hướng dẫn Espressif](https://docs.espressif.com/projects/arduino-esp32/en/latest/installing.html).
3. **Sketch → Include Library → Manage Libraries**, cài `PubSubClient` và `ESP32Servo`. Môi trường đã biên dịch dùng **PubSubClient 2.8** và **ESP32Servo 3.2.1**; nếu gặp lỗi thư viện với bản khác, chọn các bản này. ESP32Servo hỗ trợ Arduino ESP32 core 3.x. [`ESP32Servo`](https://github.com/madhephaestus/ESP32Servo). `WiFi.h`, `Preferences.h` và `esp_camera.h` đi kèm core ESP32; không cài thư viện camera trùng tên từ nguồn lạ. [Espressif hướng dẫn `esp_camera.h`](https://github.com/espressif/esp32-camera).

## 4. Chuẩn bị Wi-Fi và địa chỉ máy chủ

Cả hai ESP32 dùng **Wi-Fi 2,4 GHz**. PC chạy Mosquitto/backend, hai ESP32 và máy xem dashboard cần nằm trên mạng có thể truy cập lẫn nhau; hotspot/guest Wi-Fi có chế độ cô lập thiết bị sẽ làm MQTT hoặc stream thất bại.

Trên PC mở PowerShell:

```powershell
ipconfig
```

Ghi địa chỉ **IPv4 của card Wi-Fi/Ethernet đang nối cùng mạng**, ví dụ `192.168.1.10`. Đây là **IP PC**, dùng cho `MQTT_BROKER` và trang web ở máy khác. IP camera lấy từ **Serial Monitor camera**, ví dụ `192.168.1.50`. Hai IP phải khác nhau. Nếu IP đổi sau khi khởi động lại router/hotspot, cập nhật cấu hình hoặc đặt DHCP reservation cho PC/camera.

### Danh sách địa chỉ cần kiểm tra khi đổi PC hoặc mạng

| Địa chỉ | Cách lấy địa chỉ thật | Chỗ dùng/thay | Có cần nạp lại ESP32? |
| --- | --- | --- | --- |
| **IP LAN của PC chạy Mosquitto và backend** | Chạy `ipconfig` trên PC; chọn `IPv4 Address` của **Wi-Fi/Ethernet đang kết nối**, có `Default Gateway`, không lấy Tailscale, VMware, WSL hoặc `127.0.0.1` | `MQTT_BROKER=<IP-PC>` trong `backend/.env`; trên ESP32 DevKit gửi `MQTT_HOST=<IP-PC>` qua Serial Monitor; khi mở web từ máy khác dùng `http://<IP-PC>:3000` và đặt **Server URL** là `http://<IP-PC>:8000` trong Cài đặt dashboard | **Không** nếu chỉ đổi `MQTT_HOST` bằng Serial; nếu đổi SSID/mật khẩu Wi-Fi trong sketch thì **có** |
| **IP ESP32-CAM** | Mở Serial Monitor của **bo camera** ở 115200, tìm `[CAM-WIFI] connected ip=...` hoặc sao chép nguyên URL `[CAM-URL] VIDEO_SOURCE=...` | `VIDEO_SOURCE=http://<IP-CAM>:81/stream` trong `backend/.env`, hoặc điền **Địa chỉ IP Camera ESP32** ở Cài đặt dashboard rồi Lưu; kiểm tra `http://<IP-CAM>:82/status` | Không khi IP camera đổi nhưng Wi-Fi giữ nguyên |
| **IP ESP32 DevKit** | Mở Serial Monitor của **bo radar/servo**, tìm `[WiFi] Connected, IP=...` | Chỉ để nhận diện/chẩn đoán; backend giao tiếp qua IP **broker**, không nhập IP DevKit vào `MQTT_BROKER` | Không |

Trong `hardware/esp32_servo_radar/esp32_servo_radar.ino`, biến `mqttHost` chỉ là **giá trị mặc định lúc chưa có cấu hình đã lưu**. Firmware đọc `mqtt_host` từ NVS khi khởi động; vì thế sửa IP trong sketch rồi nạp lại vẫn có thể tiếp tục dùng IP cũ. Đọc địa chỉ **đang có hiệu lực** bằng lệnh `STATUS` trong Serial Monitor (115200 baud, chọn **New Line**) và xem dòng `[CONFIG] broker=...`. Để đổi mà không nạp lại, gửi `MQTT_HOST=<IP-PC>`; chờ log reconnect MQTT. Nếu đang dùng bản sao `sketch_oct3a.ino` trong Arduino IDE, sửa đúng sketch sẽ nạp lên bo, không chỉ sửa file `.ino` trong dự án.

`backend/.env` có thể chứa IP ví dụ của mạng cũ; sửa `MQTT_BROKER` và `VIDEO_SOURCE` theo mạng **hiện tại**, rồi **khởi động lại backend**. Nếu dùng nút Lưu cho IP camera trên dashboard, backend cập nhật `VIDEO_SOURCE` ngay và lưu vào `.env`; Server URL được lưu riêng trong trình duyệt, nên máy/trình duyệt khác phải đặt lại. Trong mã Python có IP mặc định khi thiếu `.env`; dùng `.env` để cấu hình thay vì sửa các giá trị mặc định đó. `frontend/next.config.ts` chứa `allowedDevOrigins` chỉ cần cập nhật khi chạy Next.js ở chế độ phát triển từ máy khác và Next.js báo chặn origin đó. `0.0.0.0` trong `mosquitto_local.conf` là địa chỉ **lắng nghe mọi card mạng**, không phải IP thiết bị cần thay.

Sau khi đổi, kiểm tra `GET http://<IP-PC>:8000/api/v1/servo/diag`: `mqtt_broker` cho biết **địa chỉ backend thực sự dùng**, còn `mqtt_connected=true`, `online=true`, `fresh=true` và `age_seconds` nhỏ chứng minh backend nhận chẩn đoán mới của ESP32 qua broker. Chỉ thấy HTTP `200` hoặc ESP32 báo `mqtt=1` chưa chứng minh **hai bên cùng một broker**. API joystick sẽ trả lỗi khi ESP32 offline/diagnostics cũ, thay vì báo thành công chỉ vì broker nhận gói; lệnh dừng `STOP` vẫn được gửi. Nếu thử `TEST_PAN`/`TEST_TILT` trực tiếp trên Serial mà góc/xung trong log đổi nhưng servo vẫn đứng yên, sửa IP không chữa được phần nguồn/dây/PWM/cơ khí đó; kiểm tra riêng ngay tại servo.

Nếu chuyển sang Wi-Fi khác, sửa `ssid` và `password` ở đầu **cả hai sketch** rồi nạp lại đúng từng bo; lệnh Serial `MQTT_HOST` chỉ đổi địa chỉ broker, không đổi Wi-Fi. Không đưa mật khẩu Wi-Fi hoặc token Telegram vào ảnh log chia sẻ công khai.

## 5. Nạp đúng firmware cho từng bo

| Bo cắm USB | Mở sketch | Board chọn trong Arduino IDE | Serial Monitor |
| --- | --- | --- | --- |
| **ESP32 DevKit** nối radar + servo | [`hardware/esp32_servo_radar/esp32_servo_radar.ino`](hardware/esp32_servo_radar/esp32_servo_radar.ino) | `ESP32 Dev Module` | 115200 baud, New Line |
| **ESP32-CAM** có `ESP-32S`, dây `TY-OV3660` và đế Micro-USB | [`hardware/esp32_cam_stream/esp32_cam_stream.ino`](hardware/esp32_cam_stream/esp32_cam_stream.ino) | `AI Thinker ESP32-CAM` | 115200 baud |

Hai file `hardware/esp32.c` và `hardware/esp32_cam.c` là bản sao để đọc/tham khảo; **nạp hai file `.ino` nêu trên**, không nạp sketch servo vào bo camera. Camera hiện chọn `CAMERA_PROFILE_AI_THINKER_ESP32` mặc định và kiểm tra PID OV3660. Nếu sau này thay camera module khác, kiểm tra lại PID thực tế ở `:82/status`, không chọn profile S3 cho bo `ESP-32S` này.

Thứ tự thao tác mỗi bo: cắm **một bo** vào USB → **Tools → Port** chọn COM của bo đó → mở đúng sketch → sửa Wi-Fi/host → bấm **Verify** → **Upload** → mở Serial Monitor 115200. Nếu không nạp được ESP32-CAM qua đế Micro-USB, kiểm tra COM/cáp dữ liệu, thử tốc độ upload 115200 và nút BOOT/IO0 hoặc RST theo đế nạp đang dùng; đừng đổi ngẫu nhiên pin camera để chữa lỗi nạp.

### Kết quả mong đợi ở Serial

- ESP32 DevKit: log Wi-Fi/MQTT, `[SERVO-DIAG]` có `attached=1/1`, `[RADAR-DIAG]` có `bytes` và `frames` tăng. Khi có người trong vùng radar, thấy `[RADAR] X=... Y=...`.
- Firmware servo `r4` in tên reset và bước loop gần nhất ở `[BOOT]`; API `/api/v1/servo/diag` chuyển các trường này thành `device_health`. `TASK_WDT` cùng `previous_loop_stage` giúp khoanh vùng tác vụ bị kẹt; `slow_loop_stage`/`slow_loop_stage_ms` và `mqtt_connect_ms` đo đoạn gây trễ. `task_wdt_count` tăng khi watchdog tiếp tục reset, không bị xóa bởi nút EN; mất nguồn sẽ đặt lại bộ đếm.
- ESP32-CAM: log `[CAM-BOOT] profile=...`, `[CAM-PINS]`, `[CAM-SENSOR]`, IP, URL `:81/stream` và `:82/status`. Mở `http://<IP-CAMERA>:82/status`; `camera_ready=true`, `sensor=OV3660`, `sensor_match=true`, `psram_bytes>0` là các dấu hiệu đúng profile/cảm biến/PSRAM. Nếu PID khác, hãy gửi lại JSON status và log cảm biến; nhãn dây camera là bằng chứng mạnh nhưng không thay phép đọc PID.

## 6. Khởi chạy MQTT, backend, frontend

Mỗi thành phần giữ **một cửa sổ PowerShell riêng**. Thay đường dẫn dự án nếu thư mục của bạn khác ví dụ.

### 6.1 Mosquitto: chỉ một broker trên cổng 1883

Kiểm tra trước:

```powershell
Get-Service mosquitto -ErrorAction SilentlyContinue
Get-NetTCPConnection -LocalPort 1883 -State Listen -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,OwningProcess
```

Nếu Windows Service Mosquitto đã chạy, lắng nghe trên IP LAN hoặc `0.0.0.0` **và cấu hình cho phép client ESP32 hiện tại kết nối**, dùng service đó. Nếu nó chỉ nghe `127.0.0.1` hoặc yêu cầu tài khoản mà firmware chưa cấu hình, ESP32 sẽ không kết nối được. Cách rõ ràng để dùng cấu hình trong dự án: ở **PowerShell chạy quyền Administrator**, `Stop-Service mosquitto`; sau đó mở cửa sổ PowerShell thường:

```powershell
Set-Location 'C:\Users\PC\Desktop\Embedded system\backend'
& 'C:\Program Files\mosquitto\mosquitto.exe' -c '.\mosquitto_local.conf' -v
```

Giữ cửa sổ Mosquitto **đang chạy** và mở backend trong **cửa sổ PowerShell thứ hai**. Nếu log in `mosquitto version ... terminating` rồi dấu nhắc `PS ...>` xuất hiện lại, broker đã dừng; mọi API sẽ báo `mqtt_connected=false` sau đó. Khi cả hai đang chạy, log broker nên có client `ESP32_AI_Tracking` và `FallGuard_Web_Control`. Dòng `Received PUBLISH from ESP32_AI_Tracking ... embedded/servo/diag` xác nhận **ESP32 đã gửi telemetry tới broker tại thời điểm đó**; dòng `disconnected: exceeded timeout` nghĩa là kết nối ESP32 bị mất sau một khoảng không có gói MQTT. Nếu timeout lặp lại, đối chiếu thời điểm với Serial `[BOOT]`, `[WiFi]`, `[NET-DIAG]` và đo nguồn 5 V tại ESP32/servo để phân biệt reset, Wi-Fi rớt và vòng xử lý bị chặn. Một ảnh API chụp sau khi broker đã tắt không phản ánh trạng thái khi broker còn chạy.

`mosquitto_local.conf` của dự án hiện nghe cổng 1883 trên mọi địa chỉ và cho kết nối MQTT không mật khẩu. Chỉ dùng trên **mạng riêng đáng tin cậy**, không chuyển tiếp cổng 1883 ra Internet. Nếu vị trí cài Mosquitto khác, sửa đường dẫn `mosquitto.exe`. Nếu báo cổng 1883 bận, tìm đúng tiến trình/service đang nghe, không chạy broker thứ hai.

### 6.2 Backend Python/FastAPI

Lần đầu, mở PowerShell mới:

```powershell
Set-Location 'C:\Users\PC\Desktop\Embedded system\backend'
py -3.11 -m venv .venv
& '.\.venv\Scripts\python.exe' -m pip install --upgrade pip
& '.\.venv\Scripts\python.exe' -m pip install -r requirements.txt
```

Nếu `py -3.11` báo không tồn tại, thay **chỉ dòng tạo môi trường** bằng đường dẫn đầy đủ đến `python.exe` bản 3.11 như hướng dẫn mục 3; các dòng `\.venv\Scripts\python.exe` còn lại giữ nguyên. Kiểm tra `& '.\.venv\Scripts\python.exe' --version` trước khi cài thư viện.

Mở `backend/.env` bằng `notepad .env` **trong thư mục backend**. Nếu file đã có, sửa các dòng liên quan và giữ những token/cấu hình cũ cần dùng. Ví dụ, thay IP mẫu bằng IP **thật**:

```dotenv
VIDEO_SOURCE=http://192.168.1.50:81/stream
MQTT_BROKER=192.168.1.10
POSE_MODEL_PATH=yolov8m-pose.pt
AI_FPS_LIMIT=30
# TELEGRAM_BOT_TOKEN=...
# TELEGRAM_CHAT_ID=...
```

`MQTT_BROKER` là IP PC/broker; `VIDEO_SOURCE` là IP ESP32-CAM. Nếu không dùng Telegram, bỏ hai biến đó. Muốn nhận Telegram, điền token/chat ID **trong `.env` của backend**, không chỉ điền trong form frontend. File `.env` và mật khẩu không nên đưa vào Git hoặc ảnh chụp.

**Khi chuyển dự án sang máy khác:** `.env` bị Git bỏ qua nên có thể chưa tồn tại trên máy mới. Nếu `/api/v1/servo/diag` báo `mqtt_broker=10.28.125.55`, đó là giá trị mặc định trong mã khi không có `MQTT_BROKER` (hoặc chính là giá trị máy đã đặt); `mqtt_connected=false` nghĩa backend chưa tới được broker đó. Trên **máy chạy backend của người lắp**, mở PowerShell trong thư mục `backend` rồi kiểm tra `Test-Path .env`, `Select-String -Path .env -Pattern '^MQTT_BROKER='` (chỉ khi file có), và `Get-ChildItem Env:MQTT_BROKER -ErrorAction SilentlyContinue`. Biến môi trường của tiến trình có thể ghi đè giá trị trong `.env`. Lấy IP máy thật đang chạy Mosquitto, cập nhật `MQTT_BROKER=<IP-BROKER>`, khởi động lại backend và kiểm tra `mqtt_broker`, `mqtt_connected`, `online`, `fresh` trong API. Nếu backend đã nối broker nhưng ESP32 chưa online, gửi `STATUS` trên Serial Monitor DevKit để đối chiếu `[CONFIG] broker=...` với cùng IP broker.

Khởi động backend **từ thư mục `backend`**:

```powershell
Set-Location 'C:\Users\PC\Desktop\Embedded system\backend'
& '.\.venv\Scripts\python.exe' main.py
```

Mở `http://127.0.0.1:8000/docs` và `http://127.0.0.1:8000/api/v1/video/status`. Lần đầu model AI có thể tải/biên dịch phụ thuộc vào môi trường, nên chờ log worker báo chạy. Cổng 8000 chỉ có **một backend**. Nếu gặp `WinError 10048`:

```powershell
Get-NetTCPConnection -LocalPort 8000 -State Listen |
  Select-Object LocalAddress,LocalPort,OwningProcess
Get-NetTCPConnection -LocalPort 8000 -State Listen |
  Select-Object -ExpandProperty OwningProcess | Get-Process
```

Xác định tiến trình cũ trước khi tự dừng nó; tránh đóng nhầm ứng dụng khác. Có thể dùng backend đang chạy nếu đúng bản mã/cấu hình vừa cập nhật, hoặc tắt nó và chạy lại **một** tiến trình.

### 6.3 Frontend Next.js

Lần đầu, mở PowerShell mới:

```powershell
Set-Location 'C:\Users\PC\Desktop\Embedded system\frontend'
npm.cmd ci
npm.cmd run dev
```

Mở `http://localhost:3000` trên PC. Những lần sau chỉ cần `npm.cmd run dev`. Lệnh `npm.cmd ci` dùng `package-lock.json` để cài đúng bộ phụ thuộc; **không cần `create-next-app`** vì dự án đã có sẵn frontend. Nếu xem từ máy tính khác cùng LAN, mở `http://<IP-PC>:3000` và trong **Cài đặt hệ thống** đặt Server URL là `http://<IP-PC>:8000` (hoặc `http://<IP-PC>:8000/api/v1`). Sau khi lưu Server URL, WebSocket cảnh báo kết nối lại theo địa chỉ mới; nếu tab đã mở lâu vẫn hiện dữ liệu cũ, tải lại trang. Giao diện hiện dùng `DesktopOnly` ở các trang chính và yêu cầu chiều rộng hiển thị ít nhất 1024 px; trên điện thoại có thể chỉ thấy thông báo dùng desktop. `localhost` trên thiết bị khác là chính thiết bị đó, không phải PC.

Nếu Windows Firewall chặn, cho phép Node/Python/Mosquitto trên **Private network** hoặc mở riêng TCP 3000, 8000, 1883 cho `LocalSubnet` bằng PowerShell Administrator. Cổng 81/82 trên ESP32-CAM cũng phải truy cập được từ PC trên mạng nội bộ. Không mở các cổng này ra Internet công cộng.

### 6.4 Thứ tự khởi động mỗi ngày

1. Bật nguồn đã đo đúng điện áp, xem hai bo không reset lặp.
2. Bảo đảm Mosquitto đang chạy, ESP32 DevKit báo MQTT connected.
3. Bảo đảm camera có IP, `:82/status` báo `camera_ready=true`.
4. Chạy **một** backend bằng `main.py`; kiểm tra `video/status` và `servo/diag`.
5. Chạy frontend, mở dashboard. Chọn xem **RAW/LIVE** để đánh giá camera, chọn lớp phủ AI để đánh giá tốc độ suy luận.

## 7. Cấu hình radar, hiệu chỉnh servo và AUTO

Trên trang **Analytics/Radar**, nhập kích thước phòng, vị trí radar và hướng lắp. Giao diện nhập **mm**; backend lưu bản đồ/phạm vi cảnh báo theo m. Lắp radar cố định để hướng 0° và trục X/Y có ý nghĩa ổn định. Đứng ở vài vị trí biết trước trong phòng, so tọa độ `[RADAR] X/Y` với bản đồ rồi hiệu chỉnh vị trí/hướng, không đổi hướng bản đồ chỉ để chữa servo quay sai chiều.

Trên ESP32 DevKit, radar chạy UART **256000 baud**; Serial Monitor để xem log chạy **115200 baud**. Gửi lệnh trong Serial Monitor với **New Line**; không cần nạp lại khi hiệu chỉnh các mục sau. Có thể dùng trang **Cài đặt hệ thống → Hiệu chỉnh servo** hoặc `POST /api/v1/servo/config` khi bo online và ở MANUAL.

| Lệnh Serial | Việc cần quan sát |
| --- | --- |
| `STATUS` | In cấu hình và chẩn đoán hiện hành |
| `TEST_PAN` | Trục PAN nhích khoảng 8° rồi trở về; thử **không tải** trước |
| `TEST_TILT` | Trục TILT nhích khoảng 8° rồi trở về |
| `CENTER` | Đưa về góc tâm đã cấu hình |
| `PAN_DIR=1` hoặc `PAN_DIR=-1` | Đảo hướng PAN nếu radar bên trái mà camera quay sang phải |
| `TILT_DIR=1` hoặc `TILT_DIR=-1` | Đảo hướng TILT sau khi xác định chiều cơ khí |
| `PAN_MIN=45`, `PAN_MAX=135` | Giới hạn PAN theo hành trình cơ thật; TILT có lệnh tương tự |
| `PAN_OFFSET=...`, `TILT_OFFSET=...` | Căn góc ngắm tại tâm radar |
| `CAMERA_HEIGHT_MM=1500`, `TARGET_HEIGHT_MM=900` | Khớp chiều cao lắp camera và điểm muốn ngắm |
| `RADAR_ALPHA=0.45` | Độ lọc tọa độ; lớn hơn phản hồi nhanh hơn nhưng rung hơn |
| `SPEED_DPS=220` | Tốc độ đặt góc; tăng chỉ sau khi nguồn và cơ khí ổn định |
| `LOST_ACTION=HOLD` hoặc `CENTER` | Cách xử lý khi mất mục tiêu |
| `MQTT_HOST=<IP-PC>` | Đổi broker đã lưu trong NVS |

Các giá trị hiệu chỉnh hợp lệ được lưu NVS; nạp firmware mới có thể **không** ghi đè cấu hình cũ. `DEFAULTS` khôi phục cấu hình mặc định, cần kiểm tra lại hành trình cơ khí trước khi dùng. Nếu lệnh/API báo `pending`, MQTT broker đã nhận nhưng ESP32 chưa xác nhận kịp; kiểm tra `last_config_result` và log Serial.

**Quy trình mở AUTO:**

1. Chọn MANUAL trên web, chạy `TEST_PAN`, `TEST_TILT`. **Cả hai trục phải thật sự chuyển động**, không chỉ có `cmd/pulse_us` đổi trong log.
2. Bấm joystick; kiểm tra lệnh đến ngay, nhả tay servo dừng. Nếu log thay đổi mà trục đứng yên: đo 5 V tại servo khi có lệnh, kiểm tra GND chung, GPIO13/27, đầu cắm, kẹt cơ khí; nếu có oscilloscope/logic analyzer, đo PWM 50 Hz tại đầu dây servo.
3. Kiểm tra radar `bytes`, `frames`, `with_target` tăng và tọa độ đổi khi người di chuyển. Căn chiều PAN/TILT bằng `*_DIR` và `*_OFFSET`.
4. Sau đó mới chọn AUTO. Quan sát `[AUTO]`, `[SERVO-DIAG] target/current/pulse_us` **và trục thật**. Radar cập nhật ở tốc độ của LD2450, không phụ thuộc trực tiếp FPS camera. [Tài liệu Hi-Link LD2450](https://www.hlktech.com/en/Goods-226.html).

`pulse_us`, `command_pan` và `command_tilt` là **lệnh từ ESP32**, không phải số đo góc trục. Muốn xác nhận vị trí cơ khí bằng phần mềm cần thêm cảm biến/feedback riêng; MG996R hiện tại không trả vị trí qua dây tín hiệu.

## 8. API và log cần xem khi có lỗi

Đặt `$CameraIp` thành địa chỉ từ Serial camera. Chạy trên PC:

```powershell
$CameraIp = '192.168.1.50'
Invoke-RestMethod "http://${CameraIp}:82/status" | Format-List
Invoke-RestMethod 'http://127.0.0.1:8000/api/v1/video/status' | Format-List
Invoke-RestMethod 'http://127.0.0.1:8000/api/v1/servo/diag' | Format-List
Invoke-RestMethod 'http://127.0.0.1:8000/api/v1/camera/mode' | Format-List
```

Camera trực tiếp: `http://<IP-CAMERA>:81/stream`; trạng thái/tuning: `http://<IP-CAMERA>:82/status`, `http://<IP-CAMERA>:82/tune?framesize=QVGA&quality=20`. URL tune **xếp yêu cầu đổi, không cần nạp lại**; firmware áp dụng ở vòng nhận khung khi `:81/stream` có client. Nếu camera đang rảnh, mở backend/stream để áp dụng rồi kiểm tra `tuning_pending=false`, `framesize` và `jpeg_quality` ở `:82/status`. Số JPEG quality **cao hơn nghĩa nén mạnh hơn, ít byte hơn**. Mặc định giữ VGA/quality 16 để AI còn đủ chi tiết; QVGA/quality 20 là chế độ thử khi Wi-Fi/nguồn có giới hạn. Chỉ nên có một client MJPEG dài hạn trên ESP32-CAM; khi backend đang đọc camera, xem stream qua backend/dashboard. Để thử `:81/stream` trực tiếp, dừng backend hoặc cho nó ngắt camera trước.

| Dấu hiệu | Đọc ở đâu | Khả năng chính |
| --- | --- | --- |
| `camera_ready=false` hoặc `sensor_match=false` | Camera `:82/status` + Serial `[CAM-ERROR]`/`[CAM-SENSOR]` | Init camera thất bại hoặc PID khác OV3660; nếu chỉ PID lệch, firmware vẫn có thể phát stream và cần xác minh cụm cảm biến |
| `fps_x10=0` | Camera `:82/status` | Nếu `stream_active=false`, chưa có người xem; nếu đang xem, tìm lỗi capture/send |
| `rssi_dbm` rất thấp, `wifi_reconnects` tăng | Camera `:82/status` | Wi-Fi yếu/cô lập hoặc nguồn chập chờn |
| Camera FPS khá nhưng `raw_fps` thấp | Backend `video/status` | Mạng từ camera đến PC, parser/reconnect/backend |
| `raw_fps` khá nhưng `ai_fps` thấp | Backend `video/status` | CPU/model AI; xem `ai_work_ms`, `ai_target_fps`, `ai_decode_fps`, `inference_ms`, `pipeline_ms` |
| `camera_reconnects` tăng hoặc `age_seconds` >3 | Backend `video/status` | Nguồn camera, Wi-Fi, stream URL sai/mất |
| `mqtt_connected=false` hoặc `online=false` | Backend `servo/diag` | Broker/IP MQTT/Firewall hoặc ESP32 DevKit mất Wi-Fi |
| Radar `bytes=0`; hoặc bytes có mà frames=0 | Serial `[RADAR-DIAG]` | Dây TX→GPIO16/GND/nguồn; hoặc sai UART 256000 |
| `[AUTO]` đổi nhưng servo đứng | Serial `[SERVO-DIAG]` và điện áp ở đầu servo | Chưa chứng minh PWM đến đầu cắm, nguồn đủ dòng hay cơ cấu không kẹt |
| Joystick trễ | `dispatch_ms`, `[NET-DIAG]`, Wi-Fi RSSI, `hold_heartbeats` | Tách trễ HTTP/MQTT khỏi trễ PWM/cơ khí |

Khi bấm joystick mà giao diện báo lỗi, mở **F12 → Network → yêu cầu `move` → Response** trên chính trình duyệt đang điều khiển. Đọc `error_code`: `MQTT_DISCONNECTED` nghĩa backend chưa nối broker; `SERVO_OFFLINE` hoặc `SERVO_DIAG_STALE` nghĩa chưa có telemetry ESP32 mới; `UI_MODE_MISMATCH` nghĩa dashboard chưa ở MANUAL; `SERVO_MODE_MISMATCH` nghĩa bo chưa xác nhận MANUAL. Đối chiếu `/api/v1/servo/diag` (`mqtt_broker`, `mqtt_connected`, `online`, `fresh`, `age_seconds`, `device_health`) và `/api/v1/camera/mode` (`mode`, `hardware_mode`). Nếu `move` báo `success`, xem `manual_count`, `target` và `pulse_us` trong chẩn đoán mới để xác nhận lệnh đã đến firmware, rồi kiểm tra chuyển động vật lý riêng. HTTP `200` nghĩa backend đã trả lời; vẫn cần đọc `status`/`error_code` trong JSON.

Dashboard có hai đường video: **RAW/LIVE** từ khung camera mới nhất và **AI** có lớp phủ suy luận; bảng chẩn đoán trên dashboard hiện hiển thị FPS RAW, FPS giải mã/đầu ra AI, trần/đích AI và ms xử lý. `AI_FPS_LIMIT=30` hiện là **mức trần mặc định**, không phải FPS đảm bảo; backend bắt đầu AI ở 15 FPS rồi tự nâng/hạ `ai_target_fps` theo `ai_work_ms` để chừa khoảng 20% thời gian xử lý. Hàng đợi AI chỉ giữ khung mới nhất. `ai_decode_fps` là số khung giải mã/giây để đưa vào AI; `ai_fps` là số khung AI hoàn thành/giây; `raw_fps` là FPS camera đến backend và **không bị giới hạn bởi biến này**. Muốn AI đạt 30 FPS ổn định, camera RAW cũng phải có ít nhất 30 FPS và thời gian xử lý mỗi khung `ai_work_ms` nên ở khoảng **≤27 ms**; nếu `ai_work_ms` khoảng 40 ms, mức mục tiêu có dự phòng gần 20 FPS. Tăng mức trần không làm model suy luận nhanh hơn. Nếu CPU quá tải, có thể hạ trần xuống 20/15 trong `.env`, hoặc thử `POSE_MODEL_PATH=yolov8n-pose.pt` (model nhỏ hơn đã có trong `backend`) rồi đánh giá lại độ chính xác cảnh báo ngã. Sửa `.env` cần khởi động lại backend, không cần nạp lại ESP32.

## 9. Cách xác nhận FPS và lỗi nguồn thật

1. Bật hệ thống, chỉ mở **một** dashboard RAW/LIVE và chờ 10–20 giây. Camera `fps_x10` là FPS ×10 (`150` = 15 FPS); backend `raw_fps` là tốc độ nhận trên PC. Ghi `ai_fps` riêng khi chuyển sang lớp phủ AI.
2. Đo trong khoảng 1 phút cùng một độ phân giải, cùng vị trí Wi-Fi, cùng ánh sáng. Ghi `fps_x10`, `raw_fps`, `ai_fps`, `ai_target_fps`, `ai_decode_fps`, `ai_work_ms`, `rssi_dbm`, `capture_errors`, `send_errors`, `camera_reconnects` và số lần ESP reset. Chờ ít nhất 15–20 giây để AI có thời gian tự điều chỉnh; một ảnh chụp tức thời không đủ kết luận mượt/ổn định.
3. **Tắt nguồn**, tạm tháo nguồn servo, bật lại và đo cùng điều kiện. Tắt nguồn, đấu lại từng servo, đo điện áp **tại đầu cấp camera và tại đầu servo** lúc `TEST_PAN`/`TEST_TILT`, so FPS và reconnect. Nếu FPS tụt hoặc camera reset khi servo chạy, sửa nguồn/dây trước khi tăng tốc độ code.
4. Thử `:82/tune?framesize=QVGA&quality=20`, để stream hoạt động và chờ `tuning_pending=false` ở `:82/status` rồi đo lại. Nếu raw FPS tăng nhưng AI phát hiện kém, trở về `:82/tune?framesize=VGA&quality=16` theo cùng cách. Lưu giá trị đạt cân bằng cho bộ mạch thật. Lệnh tune có thể mất hiệu lực khi bo reset vì mặc định nằm trong firmware.
5. Gửi lại JSON từ `:82/status`, `/api/v1/video/status`, `/api/v1/servo/diag`, vài dòng `[CAM-DIAG]`, `[RADAR-DIAG]`, `[NET-DIAG]` cùng số đo điện áp để xác định phần còn nghẽn. Che IP public/token/mật khẩu nếu có.

Để lấy 12 mẫu trong khoảng một phút trên **PC chạy backend**, thay IP camera rồi chạy PowerShell khi dashboard RAW/AI đang mở:

```powershell
$CameraIp = '192.168.1.50'
$Samples = 1..12 | ForEach-Object {
  $camera = Invoke-RestMethod "http://${CameraIp}:82/status"
  $video = Invoke-RestMethod 'http://127.0.0.1:8000/api/v1/video/status'
  [PSCustomObject]@{
    Time = Get-Date -Format 'HH:mm:ss'
    CameraFPS = [math]::Round($camera.fps_x10 / 10, 1)
    RawFPS = $video.raw_fps
    AIFPS = $video.ai_fps
    AITarget = $video.ai_target_fps
    AIWorkMs = $video.ai_work_ms
    RSSI = $camera.rssi_dbm
    Reconnects = $video.camera_reconnects
  }
  Start-Sleep -Seconds 5
}
$Samples | Format-Table -AutoSize
```

Không có chỉ số thực địa sau nạp mới thì câu trả lời đúng là **chưa xác nhận được FPS đã tăng và cơ cấu đã ổn định**. Firmware/backend được tối ưu để giảm backlog và có thêm phép đo; giới hạn của ESP32-CAM, cảm biến OV3660, Wi-Fi và nguồn vẫn cần kiểm tra bằng quy trình trên. Espressif nêu rằng JPEG với PSRAM và hai frame buffer có thể tăng tốc độ nhận khung nhưng cũng tăng tải CPU/bộ nhớ; không có cam kết 30 FPS cho cấu hình cụ thể này. [Tài liệu driver camera Espressif](https://github.com/espressif/esp32-camera).

## 10. Vấn đề thường gặp

- **`TypeError: Failed to fetch` trên dashboard:** kiểm tra backend còn chạy ở `http://<IP-PC>:8000/docs`, Server URL trong Cài đặt, Firewall Private và việc `localhost` trên máy xem khác PC. Nếu cổng 8000 bận, dùng lệnh ở mục 6.2.
- **Backend chạy rồi thoát với `WinError 10048`:** có tiến trình khác nghe 8000. Không khởi chạy hai backend.
- **Mosquitto kết nối trên PC nhưng ESP32 không kết nối:** broker có thể chỉ nghe `127.0.0.1`, PC firewall chặn 1883, `MQTT_HOST` cũ nằm trong NVS hoặc hotspot cô lập thiết bị.
- **Cài `npm` lỗi trong PowerShell:** dùng `npm.cmd`. Nếu `node`/`npm.cmd` chưa nhận, đóng/mở lại PowerShell sau cài Node.
- **Camera có hình nhưng chậm/đứng:** đọc `:82/status` trước; tách lỗi RAW camera với AI/backend bằng mục 8–9. Không suy từ FPS của lớp phủ AI ra khả năng ESP32-CAM.
- **Servo log đổi nhưng trục không xoay:** bắt đầu từ nguồn tại đầu servo, GND chung, đúng GPIO13/27 và kiểm tra cơ khí. `attached=1` chỉ xác nhận thư viện đã gắn chân PWM.
- **AUTO không theo:** phải có `frames_with_target`/`with_target` tăng, mode thật là AUTO, tọa độ hợp lệ, manual test quay đúng hai trục; rồi mới chỉnh `*_DIR`, offset, height và tốc độ.

Nếu cần chẩn đoán sâu hơn sau khi đã có số liệu, xem thêm [`hardware/SETUP_DIAGNOSTICS.md`](hardware/SETUP_DIAGNOSTICS.md).
