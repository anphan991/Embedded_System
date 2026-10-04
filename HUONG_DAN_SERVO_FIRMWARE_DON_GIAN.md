# Dùng backend/frontend với firmware servo bạn gửi

## 1. Chọn đúng bộ firmware và cấu hình

Bản cập nhật này thêm profile **`legacy_step`** cho đúng sketch bạn gửi ngày 04/10/2026. Không cần nạp lại DevKit nếu nó đã chạy đúng sketch đó. Thay đổi backend/frontend không tự cập nhật firmware trên bo.

| Phần cứng / phần mềm | File hoặc cấu hình |
| --- | --- |
| ESP32 DevKit nối radar và servo — code bạn vừa gửi | `hardware/esp32_servo_radar_legacy/esp32_servo_radar_legacy.ino` |
| Backend cho code trên | `SERVO_PROTOCOL=legacy_step` trong `backend/.env` |
| ESP32-CAM ESP-32S/OV3660 | Giữ firmware camera hiện tại; sketch dự án là `hardware/esp32_cam_stream/esp32_cam_stream.ino` |
| Firmware chẩn đoán r5 đã chuẩn bị trong lần sửa trước | `hardware/esp32_servo_radar/esp32_servo_radar.ino`; chỉ dùng với `SERVO_PROTOCOL=sequenced_hold` |

**Trong lần này, dùng hàng `legacy_step`.** File sketch legacy giữ nguyên thuật toán bạn gửi; chỉ thay ba giá trị Wi-Fi/mật khẩu/broker bằng chỗ điền mẫu để không đưa thông tin mạng thật vào bản chia sẻ. Nếu cần nạp lại, sửa `ssid`, `password`, `mqtt_server`, chọn **ESP32 Dev Module**, cài **PubSubClient** và **ESP32Servo** trong Library Manager. PAN = GPIO13, TILT = GPIO27. Đây là firmware cho **DevKit**, không nạp vào ESP32-CAM.

Firmware r5 là phương án khác đã có hàng đợi hữu hạn, tác vụ MQTT riêng, LEDC và chẩn đoán bộ nhớ. Nó chưa được xác nhận vận hành trên mạch của bạn. Không trộn hai profile hoặc dùng kết quả biên dịch để kết luận mạch đã ổn định.

## 2. Backend/frontend đã thay đổi gì?

- MQTT gửi đúng chuỗi `LEFT`, `RIGHT`, `UP`, `DOWN`, `RESET`, không thêm tiền tố `@...`.
- Joystick gửi **một bước ngay khi nhấn**, không tự lặp khi giữ và không phát `STOP` khi nhả. Mỗi bước PAN 12°, TILT 7° theo firmware. ESP32 tự làm mượt khi tiến tới góc đích.
- Web chỉ cho một yêu cầu bước đang chờ; nhịp nhấn tối đa khoảng 5 lần/giây. Backend chặn hai lệnh bước cách nhau dưới 150 ms, kể cả từ nhiều tab. Lệnh bị chặn không xếp hàng chạy sau. Không tự thử lại một lệnh đã timeout vì bo có thể đã nhận nó.
- `session_id`/`seq` vẫn dùng giữa trình duyệt và backend để loại yêu cầu HTTP trùng/cũ; chúng không được đưa vào payload MQTT legacy. Gói di chuyển dùng QoS 0, không retain: ưu tiên không lặp bước do gửi lại QoS 1; mạng lỗi có thể làm mất bước.
- Backend không yêu cầu `/diag`, `/online`, `/state` mà sketch này không phát. Dashboard hiển thị **chưa xác minh trạng thái thiết bị**, thay vì hiểu thiếu telemetry là bo offline.
- Nút hiệu chỉnh MQTT, `STATUS`, `TEST_PAN`, `TEST_TILT` được ẩn trong profile legacy vì code này không hỗ trợ chúng. Các giá trị nguồn, chiều quay, giới hạn và chiều cao phải sửa trong sketch.
- AUTO: backend đổi tọa độ khung hình sang hệ 640×480 trước khi gửi `x,y`, đúng tâm `(320,240)` của firmware. Ví dụ tâm ảnh QVGA `(160,120)` phải gửi `(320,240)`. Gửi nguyên tọa độ QVGA vào sketch này sẽ làm lệch điểm ngắm.
- Với legacy, tọa độ AI chỉ gửi khi worker nhận chế độ yêu cầu AUTO qua MQTT, tối đa 10 gói/giây. Giới hạn này dành cho lệnh tracking, không giới hạn FPS stream hay tốc độ xử lý radar tại DevKit.

Luồng camera, AI phát hiện ngã, dữ liệu radar và thông báo vẫn dùng các đường xử lý hiện có. Bản sửa giao thức servo không phải bằng chứng FPS đã tăng; kiểm tra riêng ở `/api/v1/video/status`.

## 3. Cấu hình trên máy thực sự chạy dự án

Thay `C:\Users\PC\Desktop\Embedded system` bằng đường dẫn trên máy của người được bạn hỗ trợ. Khi máy khác nhận code qua Git, **`.env` không được mang theo**.

### Backend

Mở `backend/.env`, thêm hoặc sửa đúng một dòng:

```dotenv
SERVO_PROTOCOL=legacy_step
```

Trong thư mục đang sửa, dòng này đã được đặt sẵn. Các cấu hình mạng khác được giữ nguyên. Đối chiếu và thay trên máy người chạy:

```dotenv
SERVO_PROTOCOL=legacy_step
MQTT_BROKER=192.168.1.10
VIDEO_SOURCE=http://192.168.1.50:81/stream
AI_FPS_LIMIT=30
```

`192.168.1.10` là **ví dụ IP máy chạy Mosquitto**, phải khớp `mqtt_server` trong sketch DevKit. `192.168.1.50` là **ví dụ IP camera**, lấy từ Serial Monitor camera. Lấy IP PC bằng `ipconfig`. `AI_FPS_LIMIT` là trần xử lý AI, không buộc camera đạt 30 FPS.

Máy mới chưa có `.env` có thể tạo từ mẫu, rồi mở sửa IP:

```powershell
cd "C:\Users\PC\Desktop\Embedded system\backend"
if (!(Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
```

Nếu đã có biến môi trường `SERVO_PROTOCOL` trong cửa sổ PowerShell, nó ưu tiên hơn `.env`. Đặt rõ trong cửa sổ chạy backend để tránh dùng nhầm:

```powershell
$env:SERVO_PROTOCOL = 'legacy_step'
.\venv\Scripts\python.exe main.py
```

Dừng backend cũ bằng `Ctrl+C` ở cửa sổ của nó trước khi chạy lại. Không chạy hai backend cùng cổng 8000. Log phải có `servo protocol=legacy_step`.

### Broker và frontend

Giữ Mosquitto chạy trong cửa sổ riêng. Từ thư mục backend:

```powershell
& 'C:\Program Files\mosquitto\mosquitto.exe' -c .\mosquitto_local.conf -v
```

Chạy frontend từ cửa sổ khác:

```powershell
cd "C:\Users\PC\Desktop\Embedded system\frontend"
npm install
npm run dev
```

Nếu dùng bản production, phải build lại để nhận logic joystick mới:

```powershell
npm run build
npm run start
```

Chỉ chạy **một** trong hai cách frontend. Mở `http://localhost:3000` trên PC đó, hoặc `http://<IP-PC>:3000` trên máy khác. Trong Cài đặt dashboard, Server URL phải trỏ tới backend `http://<IP-PC>:8000`. Tải lại trang bằng `Ctrl+Shift+R`; nên đóng các tab cũ còn gửi `HOLD_*`.

Hướng dẫn cài Node.js, Python, Arduino IDE, Mosquitto từ đầu nằm trong [hướng dẫn cài đặt tổng thể](HUONG_DAN_CAI_DAT_VA_VAN_HANH.md). Với firmware vừa gửi, ưu tiên file này ở những mục giao thức servo, nạp DevKit và hiệu chỉnh.

## 4. Kiểm tra đúng đường truyền

### Bước 1 — Xác nhận profile

Trên PC chạy backend:

```powershell
Invoke-RestMethod 'http://127.0.0.1:8000/api/v1/camera/mode' | ConvertTo-Json -Depth 5
Invoke-RestMethod 'http://127.0.0.1:8000/api/v1/servo/diag' | ConvertTo-Json -Depth 5
```

Kết quả mong đợi:

```json
{
  "control_protocol": "legacy_step",
  "mqtt_connected": true,
  "online": null,
  "fresh": false,
  "data": null,
  "device_health": { "state": "UNVERIFIED" }
}
```

Đây là các trường trích từ `/servo/diag`. `online=null`, `fresh=false` không phải lỗi với firmware này; bo không gửi dữ liệu để xác nhận. `mqtt_connected=true` chỉ chứng minh **backend nối broker**, chưa chứng minh DevKit nhận lệnh. Không dùng dữ liệu retained của firmware cũ để suy ra bo mới đang online.

### Bước 2 — Thử mỗi trục

1. Chọn **Thủ công** trên web.
2. Nhấn ngắn **LEFT**, quan sát trục PAN và Serial Monitor DevKit 115200.
3. Chờ kết thúc bước, thử **RIGHT**, **UP**, **DOWN**, rồi nút giữa.
4. Mỗi lần nhấn phải xuất hiện `[MQTT] ... embedded/servo/manual | Lenh: LEFT` (hoặc hướng tương ứng), không có `HOLD_...`, `STOP` hay `@...`.
5. Backend in `[MOVE-LEGACY] command=... dispatched_ms=...`. Thời gian này chỉ đo xử lý API tới lúc gửi MQTT, không phải độ trễ tới trục thật.

Không nhấn liên tiếp để tìm giới hạn khi chưa kiểm tra cơ cấu: firmware giới hạn 10–170°, dải này có thể vượt khoảng quay an toàn của gá camera. Nó không hỗ trợ dừng bước đang thực hiện. `RESET` là lệnh quay về 90° chứ không phải ngắt nguồn/dừng khẩn cấp.

Nếu cần tách lỗi web và backend, sau khi dọn vùng chuyển động, lệnh sau **sẽ yêu cầu quay TILT lên một bước**:

```powershell
Invoke-RestMethod -Method Post 'http://127.0.0.1:8000/api/v1/camera/mode?mode=MANUAL'
Invoke-RestMethod -Method Post 'http://127.0.0.1:8000/api/v1/camera/move' -ContentType 'application/json' -Body '{"direction":"UP","session_id":"manual-check","seq":1}'
```

Mỗi lệnh kiểm tra mới phải tăng `seq` hoặc dùng session khác. Không tự gửi lại cùng lệnh khi không biết bo đã nhận hay chưa. API `status=success` chỉ báo backend đã nhận/gửi lệnh; `device_confirmed=false` là chủ ý vì firmware không ACK từng lệnh.

### Bước 3 — AUTO

Chỉ thử sau khi cả hai trục quay tay đúng. LD2450 TX → GPIO16/RX2, RX → GPIO17/TX2, GND chung; UART radar 256000, Serial Monitor 115200. Kiểm tra cấp nguồn radar theo tài liệu module và sơ đồ dự án.

`[RADAR-DIAG] bytes` và `frames` phải cùng tăng. `bytes=1, frames=0` không đủ để AUTO theo radar hoạt động; lỗi này không chữa bằng đổi joystick. Firmware dùng radar khi có mục tiêu mới trong 1,2 giây, dùng AI làm dự phòng khi radar cũ; vị trí/chiều lắp radar quyết định dấu PAN. Chiều cao camera và điểm ngắm nằm trong `CAMERA_HEIGHT_MM`, `TARGET_HEIGHT_MM`.

Dashboard ghi **Chế độ yêu cầu: AUTO**; xem `[MODE]` và góc thật trên bo để xác nhận. Hai điểm cần biết ở chính sketch bạn gửi:

- Sau một giờ không có lệnh manual, firmware tự chuyển AUTO, không thông báo lại backend. Nhấn chọn Thủ công để đồng bộ lại khi cần.
- Khi mất mục tiêu radar sau 3 giây, firmware có thể đưa về giữa ngay cả khi AI đang điều khiển dự phòng. `LOST` của AI chỉ bị bỏ qua, không tạo một chế độ dừng mới.

## 5. Đánh giá độ ổn định và xử lý reset

**Phần mềm có thể tương thích đúng với code này. Chưa thể khẳng định code/mạch hết reset.** Các giới hạn thấy trực tiếp trong sketch:

- Kết nối MQTT vẫn thực hiện trong `loop()`. Đặt socket timeout 2 giây không đảm bảo cả TCP connect chỉ mất 2 giây. Khi broker mất hoặc mạng lỗi, việc cập nhật góc có thể chậm.
- Sketch tạo `String` và in Serial trên mỗi lệnh/radar. Việc này không tự chứng minh rò rỉ bộ nhớ; giảm nhịp lệnh làm nhẹ tải nhưng cần log và chạy trên bo để kết luận.
- Client ID cố định `ESP32_AI_Tracking`: chỉ chạy một DevKit dùng ID đó trên cùng broker; hai bo trùng ID có thể đẩy nhau mất kết nối.
- Có subscribe topic buzzer nhưng không có nhánh thực thi buzzer trong callback. Backend/frontend không thể làm còi chạy chỉ bằng đổi payload.
- Không có cảm biến phản hồi góc trục hay đo nguồn servo. Giá trị góc tính toán không chứng minh trục đã quay.

Theo log bạn đã gửi trước đây, heap còn khoảng 221–224 KB; đó không phải bằng chứng hết bộ nhớ. Đã từng có reset watchdog, nhưng chưa có log reset mới để xác định cùng nguyên nhân. Với hai MG996R và một XL4015 cấp chung toàn hệ thống, cần kiểm tra nguồn dưới tải, đặc biệt khi TILT nâng cụm camera.

Để phân biệt trên bàn lắp: tắt nguồn trước khi đổi dây; cấp nhánh 5 V ổn định riêng cho logic và nhánh phù hợp cho servo, nối chung GND, không nối chập hai đầu ra nguồn 5 V. Đo tại chân cấp servo và ESP32 trong lúc TILT chạy, quan sát sụt áp và kẹt cơ. Không đưa 12 V trực tiếp vào servo/ESP32, không tắt watchdog hoặc brownout để che lỗi reset. [Sơ đồ và chẩn đoán phần cứng](hardware/SETUP_DIAGNOSTICS.md).

Nếu vẫn reset, cần log từ ngay trước reset tới dòng `rst:...` sau reset và kết quả thử nguồn/tải. Code giao thức không thể tự sửa dây, nguồn sụt hoặc trục bị kẹt.

## 6. Quay lại firmware có giữ/thả và chẩn đoán

Chỉ khi DevKit đã nạp `hardware/esp32_servo_radar/esp32_servo_radar.ino`:

```dotenv
SERVO_PROTOCOL=sequenced_hold
```

Khởi động lại backend, bỏ hoặc đổi biến môi trường cùng tên nếu có, tải lại web. Khi đó web dùng HOLD/STOP, kiểm tra online/telemetry mới và bật hiệu chỉnh MQTT. Không dùng profile này với sketch legacy vì lệnh có tiền tố sẽ bị bỏ qua.

## 7. Đã kiểm tra những gì trong lần sửa này?

- 20 bài kiểm tra Python đã qua: 15 trường hợp giao thức servo (cả hai profile), 5 trường hợp thuật toán phát hiện ngã. MQTT được giả lập, không phát lệnh vào bo thật.
- TypeScript và ESLint của hai panel điều khiển/hiệu chỉnh đã qua.
- Sketch legacy biên dịch thành công với Arduino ESP32 core 3.3.12, PubSubClient 2.8, ESP32Servo 3.2.1, board `esp32:esp32:esp32`. Các cảnh báo còn lại của build legacy nằm trong thư viện ESP32Servo về biến không dùng.
- Sketch r5 cũng biên dịch thành công; hai bài kiểm tra parser/hàng đợi và dung lượng JSON của nó đã qua.
- Đối chiếu file legacy với nội dung bạn gửi: logic giống nhau, chỉ ba giá trị cấu hình mạng được thay bằng mẫu.

Chưa nạp vào phần cứng từ phiên làm việc này; chưa đo độ trễ trục, chạy tải lâu dài hoặc FPS thực tế. Chưa kiểm tra tương tác bằng trình duyệt trên bộ mạch của bạn. Các kết quả trên xác nhận biên dịch và xử lý giao thức trong phạm vi bài kiểm tra, không chứng nhận hết reset hay mọi chức năng phần cứng đã đúng.
