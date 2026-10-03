# Lắp mạch và chẩn đoán camera, radar, servo

## 1. Xác định đúng hai bo trước khi nạp

| Chức năng | Bo | Sketch |
| --- | --- | --- |
| Radar LD2450 và hai servo PAN/TILT | ESP32 DevKit | [`esp32_servo_radar/esp32_servo_radar.ino`](esp32_servo_radar/esp32_servo_radar.ino) |
| Phát MJPEG | ESP32-CAM có module ESP-32S và dây OV3660 | [`esp32_cam_stream/esp32_cam_stream.ino`](esp32_cam_stream/esp32_cam_stream.ino) |

Ảnh **bo thật ở cả hai mặt** cho thấy mặt trước in `ESP32-CAM`, mặt sau là module `ESP-32S`, dây camera in `TY-OV3660-21MM-V3.0`. Trang bán hàng cũng ghi OV3660. Vì vậy firmware dùng profile chân AI Thinker cho ESP32 thường và kỳ vọng PID **OV3660**; đọc `sensor_pid`/`sensor_match` tại `:82/status` sau khi nạp để xác nhận cảm biến được phát hiện. Mô tả ESP32-S3 WROOM CAM + OV5640 trước đây **không đúng với bo đang chụp**. Sketch servo/radar chỉ nạp vào ESP32 DevKit.

Trong sketch camera, `CAMERA_BOARD_PROFILE` mặc định là `CAMERA_PROFILE_AI_THINKER_ESP32`; chọn board Arduino **AI Thinker ESP32-CAM**. Các profile S3 là cho bo khác và không áp dụng cho bo `ESP-32S` trong ảnh. Firmware báo lỗi biên dịch nếu chọn profile và chip target không khớp.

Nếu cần xác minh thêm chip bằng USB, `esptool -p COM7 flash-id` là thao tác chỉ đọc flash (thay COM theo cổng camera). Ảnh `ESP-32S` đã đủ để chọn target ESP32 thường; lệnh này không xác nhận cảm biến. [Espressif mô tả chế độ tự nhận chip](https://docs.espressif.com/projects/esptool/en/latest/esp32/esptool/basic-options.html).

## 2. Nguồn và dây tín hiệu

| Thiết bị | Kết nối dự kiến |
| --- | --- |
| Servo PAN MG996R | Dây tín hiệu → GPIO13 ESP32 DevKit; dây nguồn → đường nguồn servo; GND chung |
| Servo TILT MG996R | Dây tín hiệu → GPIO27 ESP32 DevKit; dây nguồn → đường nguồn servo; GND chung |
| HLK-LD2450 | 5 V, GND; TX radar → GPIO16 ESP32 DevKit; RX radar ← GPIO17 nếu cần; UART 256000 baud |
| Bo camera | Nguồn đúng với **bo thực tế**; kết nối Wi-Fi cùng mạng với máy chạy backend |

**Tình trạng hiện được người lắp xác nhận:** một XL4015 đang cấp chung cho hai MG996R, hai ESP32 và radar; chưa đo điện áp đầu ra khi quay. Nguồn 12 V/5 A đi **vào XL4015**; chỉ cấp đầu ra đã đo và chỉnh đúng điện áp cho thiết bị. Không đưa 12 V trực tiếp vào servo/ESP32. Hai MG996R chính hãng có dòng kẹt theo công bố khoảng **1,4 A mỗi chiếc**; hàng không rõ model có thể khác. Một XL4015 ghi 5 A là thông số IC trong điều kiện phù hợp, không bảo đảm cả module, dây và đầu nối chịu được liên tục. Khi servo kéo dòng trên nguồn chung, ESP32 có thể brownout và camera ngắt stream.

Phương án đi dây nên dùng cho bộ linh kiện này:

```text
Adapter 12 V / 5 A
  ├─ XL4015 hiện có, chỉnh/đo 5.0 V  → ESP32 DevKit + bo camera + LD2450
  └─ bộ hạ áp servo riêng 5–6 V, ≥5 A có kiểm tra nhiệt/tải → 2 × MG996R

GND hai đường 5 V và GND hai ESP32/radar/servo → nối chung tại điểm phân phối nguồn.
GPIO13/GPIO27 của ESP32 DevKit → chỉ dây tín hiệu PAN/TILT.
```

Nếu chưa có bộ hạ áp thứ hai, thử chẩn đoán từng servo khi logic/camera được cấp bằng nguồn 5 V ổn định riêng, không vận hành hai servo có tải trên nguồn chưa đo. Giữ dây servo ngắn, đủ tiết diện và tránh thanh tiếp xúc breadboard. Đặt tụ điện phân khoảng 1000–2200 µF đúng cực gần đầu cấp servo có thể giảm sụt áp xung ngắn, nhưng không thay cho nguồn đủ dòng. Không cấp servo qua chân 5 V/3.3 V ESP32. Nếu sau này hạ áp servo lên trên 5 V, **phải tách hẳn đường cấp MCU/camera**, không đưa điện áp servo vào chân 5 V của bo.

Đo điện áp **ngay tại đầu cấp servo và đầu cấp bo camera lúc cả hai servo bắt đầu chuyển động**. Đo điện áp XL4015 lúc nhàn rỗi không phát hiện được sụt áp dưới tải. Trước khi gắn tay đòn, cho servo về tâm và kiểm tra từng trục; bảo đảm khung không kẹt và dây camera không bị kéo căng. Giới hạn góc mặc định 45–135° chỉ là vùng thử ban đầu, không chứng minh cơ cấu thực tế an toàn ở cả dải đó.

Để tách lỗi FPS do nguồn: tắt điện, tháo **nguồn của cả hai servo**, bật lại, mở **một** luồng `:81/stream` qua backend hoặc trực tiếp, rồi ghi `fps_x10`, RSSI, số lần reconnect ở `:82/status` (`fps_x10=150` tương ứng 15 FPS); tắt điện rồi lắp từng servo trở lại, đo lại lúc `TEST_PAN`/`TEST_TILT`. Nếu không có người xem stream, `fps_x10=0` chỉ có nghĩa camera đang rảnh. Nếu FPS giảm hoặc bo reset khi gắn servo, tập trung sửa nguồn/dây trước. Không cắm đồng thời hai nguồn 5 V khác nhau vào cùng bo camera khi chưa biết mạch cấp nguồn của bo.

Nguồn tham khảo: [MG996R TowerPro](https://towerpro.com.tw/product/mg996R/), [datasheet IC XL4015](https://www.xlsemi.com/datasheet/XL4015-EN.pdf), [LD2450 Hi-Link](https://www.hlktech.com/en/Goods-226.html).

## 3. Thứ tự đưa hệ thống vào hoạt động

1. Chỉnh/đo nguồn, kiểm tra GND chung, lắp dây tín hiệu GPIO13/27 và UART radar. Tháo tay đòn servo hoặc bỏ tải để thử chiều quay đầu tiên.
2. Nạp sketch servo/radar vào **ESP32 DevKit**. Mở Serial Monitor **115200 baud**, gửi `STATUS` nếu cần. Phải thấy servo `attached`, `pulse_us`, lệnh/đích và thông tin radar. `pulse_us` và góc `cmd` là **lệnh xung**, không phải cảm biến phản hồi vị trí trục.
3. Ở chế độ **MANUAL**, gửi `TEST_PAN` rồi `TEST_TILT` riêng từng trục. Nếu log góc/xung thay đổi mà trục đứng yên, kiểm tra dây tín hiệu đúng chân, GND, điện áp ngay tại servo, đầu cắm, servo và khung cơ khí. Nếu có máy hiện sóng/logic analyzer, kiểm tra xung PWM 50 Hz **trên chân GPIO rồi tại đầu dây servo**; `pulse_us` trong log không phải phép đo xung ngoài đời. Chỉ xem xét mạch đệm tín hiệu phù hợp sau khi xác nhận nguồn, xung và yêu cầu mức logic của servo thực tế. Nếu `attached=0`, kiểm tra khởi tạo PWM/timer và Serial log. Không tăng góc giới hạn để chữa lỗi không quay.
4. Căn tay đòn ở góc tâm thực, sau đó chỉnh giới hạn, hướng quay, offset, tốc độ và chiều cao camera bằng Serial hoặc API cấu hình; thông số được lưu trong NVS. Lệnh cấu hình/diagnostics cụ thể ở phần 5.
5. Nạp sketch camera với profile AI Thinker mặc định và board Arduino **AI Thinker ESP32-CAM**. Mở Serial **115200 baud**, lấy IP in từ log, nhập IP vào Cài đặt dashboard hoặc `VIDEO_SOURCE=http://<IP>:81/stream` trong `backend/.env`. Mở `http://<IP>:82/status` để xem `sensor=OV3660`, `sensor_match=true`, `camera_ready=true`, FPS, RSSI và lỗi phía camera trong lúc stream ở cổng 81 vẫn chạy. Nếu PID khác kỳ vọng, ghi lại log/JSON rồi xác minh cụm cảm biến; không chọn profile S3 cho bo này.
6. Chạy một Mosquitto và một `python main.py` trên máy backend, sau đó chạy dashboard. Kiểm tra `GET /api/v1/camera/mode`, `/api/v1/servo/diag`, `/api/v1/video/status` và panel diagnostics trên dashboard. Bật AUTO chỉ sau khi cả hai servo đã quay đúng trong MANUAL và radar báo tọa độ hợp lệ.

## 4. Đọc log để xác định chỗ nghẽn

| Triệu chứng | Kiểm tra đầu tiên | Ý nghĩa |
| --- | --- | --- |
| Bấm joystick trễ | `dispatch_ms` của `POST /api/v1/camera/move`, Serial `[MQTT]`, `[SERVO-DIAG]` | HTTP/MQTT đến chậm, firmware xử lý chậm hoặc điện/cơ chậm là ba lỗi khác nhau |
| Joystick nhả nhưng còn quay | Log `STOP`, số gói `HOLD_*`, servo hold timeout | Nút phải gửi STOP; firmware tự dừng nếu quá hạn heartbeat |
| Log `[AUTO]` đổi, trục đứng yên | `cmd`, `pulse_us`, `attached` trong `/api/v1/servo/diag` hoặc Serial | Tính được góc đích chưa chứng minh trục đã nhận nguồn/xung và đã di chuyển |
| Không có tọa độ radar | UART 256000, TX→GPIO16, GND, số byte/frame/reject, `radar_age_seconds` | Phân biệt mất dây, sai baud, frame lỗi và không có mục tiêu |
| Camera trực tiếp cũng ít FPS | Log `[CAM]`, `/status` camera, RSSI, nguồn ngay tại bo, PSRAM | Nghẽn ở cảm biến/ESP32/Wi-Fi/nguồn |
| Camera nhanh nhưng dashboard ít FPS | `raw_fps`, `raw_kBps`, `camera_reconnects`, `preview_dropped` | Đường Wi-Fi hoặc backend đọc luồng |
| RAW nhanh nhưng lớp phủ AI chậm | `ai_fps`, `ai_target_fps`, `ai_work_ms`, `inference_ms`, `pipeline_ms`, `ai_input_dropped` | CPU/model AI giới hạn FPS; đổi AI FPS limit không làm inference nhanh hơn |
| API trả lỗi hoặc dashboard báo backend | Có một tiến trình lắng nghe cổng 8000, cấu hình server URL, `mqtt_connected` | Port 8000 từng bị chiếm; không chạy hai backend |

Dashboard RAW và lớp phủ AI có tốc độ khác nhau. ESP32-CAM OV3660 dùng Wi-Fi 2.4 GHz và CPU/PSRAM giới hạn; **30 FPS không phải cam kết** với VGA trên bo này. Đo FPS trong các điều kiện thật rồi mới chọn độ phân giải và JPEG quality. Firmware camera nhận yêu cầu qua `http://<IP>:82/tune?framesize=QVGA&quality=20` (framesize QVGA/VGA, JPEG quality 10–30; số lớn nén nhiều hơn); áp dụng ở vòng lấy khung khi có client stream. Kiểm tra `tuning_pending=false` và `framesize`/`jpeg_quality` tại `:82/status`. Khi thử URL stream camera trực tiếp, dừng backend hoặc đóng stream backend trước để tránh tạo thêm client dài hạn trên camera.

LD2450 theo tài liệu hãng cập nhật mục tiêu khoảng **10 Hz**, nên lệnh AUTO từ radar có mẫu tọa độ mới khoảng mỗi 100 ms; servo nhận PWM 50 Hz và nội suy giữa các mẫu. FPS video không trực tiếp quyết định tốc độ lấy mẫu radar. [Tài liệu LD2450 của Hi-Link](https://h.hlktech.com/download/HLK-LD2450-24G/1/HLK%20LD2450%201T2R%E8%BF%90%E5%8A%A8%E7%9B%AE%E6%A0%87%E6%A3%80%E6%B5%8B%E8%BF%BD%E8%B8%AA%E6%A8%A1%E7%BB%84%E8%AF%B4%E6%98%8E%E4%B9%A6%20V1.02%20.pdf).

## 5. Cấu hình runtime và API

Các lệnh servo gửi trực tiếp trong Serial Monitor (dòng lệnh có newline) hoặc qua MQTT topic `embedded/servo/config`, thí dụ `STATUS`, `TEST_PAN`, `TEST_TILT`, `CENTER`, `PAN_DIR=1`, `TILT_DIR=-1`, `PAN_MIN=45`, `PAN_MAX=135`, `TILT_MIN=45`, `TILT_MAX=135`, `PAN_OFFSET=0`, `TILT_OFFSET=0`, `SPEED_DPS=220`, `RADAR_ALPHA=0.45`, `CAMERA_HEIGHT_MM=1500`, `TARGET_HEIGHT_MM=900`, `LOST_ACTION=HOLD`. Firmware chỉ nhận giá trị hợp lệ và công bố trạng thái trên `embedded/servo/config/state`, kết quả trên `embedded/servo/config/result`, chẩn đoán trên `embedded/servo/diag`. `DEFAULTS` khôi phục hiệu chỉnh mặc định; cần kiểm tra lại khung cơ khí sau lệnh này. Nếu NVS đã lưu giá trị cũ, mặc định mới không ghi đè; gửi `RADAR_ALPHA=0.45` để áp dụng riêng bộ lọc mà không mất hiệu chỉnh khác.

Backend có `POST /api/v1/servo/config` với JSON `{ "key": "PAN_DIR", "value": 1 }` hoặc `{ "key": "STATUS" }`, và `GET /api/v1/servo/diag`. Trang **Cài đặt hệ thống → Hiệu chỉnh servo** gọi hai API này, cho thử từng trục và thay các thông số hợp lệ; phần **SERVO DIAG** trên dashboard cho xem lệnh xung và độ mới của dữ liệu. Các lệnh làm servo chuyển động/cấu hình chỉ thực hiện khi ESP32 online và MANUAL; API trả `pending` nếu broker đã nhận nhưng ESP32 chưa xác nhận trong thời gian chờ. Xem `last_config_result` và chẩn đoán mới để biết MCU đã áp dụng. Giá trị được lưu NVS nên đổi giới hạn/hướng/offset mà không nạp lại sketch. `MQTT_HOST=<địa chỉ broker>` chỉ nên đổi qua Serial trong lúc phối hợp sửa `MQTT_BROKER` của backend; đổi riêng địa chỉ broker trên ESP32 sẽ cắt liên lạc web. Phần radar trên bản đồ phòng và hiệu chỉnh cơ cấu PAN/TILT là hai hệ tọa độ khác nhau; cấu hình phòng trên trang Analytics không thay đổi phép tính góc trong firmware.

### Backend và lỗi cổng 8000

Các biến có thể đặt trong `backend/.env` (thay IP bằng địa chỉ thật):

```dotenv
VIDEO_SOURCE=http://192.168.1.50:81/stream
MQTT_BROKER=192.168.1.10
POSE_MODEL_PATH=yolov8m-pose.pt
AI_FPS_LIMIT=30
```

`POSE_MODEL_PATH` có thể chuyển sang model pose 17 điểm khớp nhỏ hơn, chẳng hạn `yolov8n-pose.pt`, nếu CPU suy luận quá chậm; cần đánh giá lại độ chính xác phát hiện ngã. `AI_FPS_LIMIT` nay là mức trần 1–30 FPS (mặc định 30), AI khởi đầu ở 15 rồi tự điều chỉnh theo `ai_work_ms` và chừa khoảng 20% thời gian xử lý; tăng mức trần không làm CPU suy luận nhanh hơn và không tăng FPS của RAW camera. Xem `ai_target_fps`, `ai_decode_fps`, `ai_fps` trong `/api/v1/video/status` sau 15–20 giây. Thay `.env` cần **khởi động lại backend**, không cần nạp firmware. Giá trị `MQTT_BROKER` của backend phải trỏ tới broker mà ESP32 dùng.

Nếu Python báo `WinError 10048`, cổng 8000 đã có tiến trình dùng. Trong PowerShell, xem tiến trình trước khi quyết định dừng nó:

```powershell
Get-NetTCPConnection -LocalPort 8000 -State Listen | Select-Object LocalAddress,LocalPort,OwningProcess
Get-NetTCPConnection -LocalPort 8000 -State Listen | Select-Object -ExpandProperty OwningProcess | Get-Process
```

Chỉ chạy **một** backend. `python main.py` kiểm tra cổng 8000 trước khi khởi động worker camera/AI và báo lỗi rõ nếu cổng bận; không tự dừng tiến trình đang chiếm cổng. Kiểm tra `http://localhost:8000/api/v1/video/status` trên chính máy backend và dùng đúng địa chỉ backend trong Cài đặt dashboard; `localhost` trên điện thoại là điện thoại, không phải PC.

Tham khảo [driver esp32-camera của Espressif](https://github.com/espressif/esp32-camera) về OV3660, PSRAM/JPEG/framebuffer và [bảng chân AI Thinker trong ví dụ Arduino của Espressif](https://github.com/espressif/arduino-esp32/blob/master/libraries/ESP32/examples/Camera/CameraWebServer/camera_pins.h).
